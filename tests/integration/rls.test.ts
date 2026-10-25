import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
let db: PGlite;
const a = "00000000-0000-4000-8000-000000000001",
  b = "00000000-0000-4000-8000-000000000002",
  project = "00000000-0000-4000-8000-000000000003",
  task = "00000000-0000-4000-8000-000000000004";
async function asUser(id: string) {
  await db.exec(
    `reset role;set role authenticated;select set_config('request.jwt.claim.sub','${id}',false);`,
  );
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role authenticated;create role anon;alter default privileges in schema public grant execute on functions to anon;create schema auth;create table auth.users(id uuid primary key);create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id) on delete cascade);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;grant usage on schema auth to authenticated,anon;insert into auth.users values('${a}'),('${b}');`,
  );
  for (const f of readdirSync("supabase/migrations")
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await db.exec(readFileSync(`supabase/migrations/${f}`, "utf8"));
  await asUser(a);
  await db.exec(
    `insert into public.projects(id,user_id,title) values('${project}','${a}','Private project');insert into public.tasks(id,user_id,title,project_id) values('${task}','${a}','Private task','${project}');`,
  );
});
afterAll(async () => {
  await db.close();
});
describe("database-enforced account isolation on real PostgreSQL (PGlite)", () => {
  it("lets the owner read and update records", async () => {
    await asUser(a);
    const result = await db.query("select title from public.tasks");
    expect(result.rows).toEqual([{ title: "Private task" }]);
    await db.exec(
      `update public.tasks set title='Updated private task' where id='${task}'`,
    );
    const updated = await db.query<{ version: number }>(
      "select version from public.tasks",
    );
    expect(updated.rows[0].version).toBe(2);
  });
  it("hides user A records from user B, including guessed identifiers", async () => {
    await asUser(b);
    expect(
      (await db.query(`select * from public.tasks where id='${task}'`)).rows,
    ).toEqual([]);
    expect(
      (
        await db.query(
          `update public.tasks set title='Hijacked' where id='${task}' returning id`,
        )
      ).rows,
    ).toEqual([]);
    expect(
      (
        await db.query(
          `delete from public.projects where id='${project}' returning id`,
        )
      ).rows,
    ).toEqual([]);
  });
  it("rejects user_id spoofing and cross-user project associations", async () => {
    await asUser(b);
    await expect(
      db.exec(
        `insert into public.tasks(user_id,title) values('${a}','Spoofed')`,
      ),
    ).rejects.toThrow();
    await expect(
      db.exec(
        `insert into public.tasks(user_id,title,project_id) values('${b}','Cross link','${project}')`,
      ),
    ).rejects.toThrow();
  });
  it("rejects changing owner and ID, even through the direct Data API", async () => {
    await asUser(a);
    await expect(
      db.exec(`update public.tasks set user_id='${b}' where id='${task}'`),
    ).rejects.toThrow();
    await expect(
      db.exec(
        `update public.tasks set id='00000000-0000-4000-8000-000000000099' where id='${task}'`,
      ),
    ).rejects.toThrow();
  });
  it("rejects anonymous table access", async () => {
    await db.exec("reset role;set role anon;");
    await expect(db.query("select * from public.tasks")).rejects.toThrow();
  });
  it("enforces ownership on every exposed record table", async () => {
    await db.exec("reset role;");
    const tables = await db.query<{ relname: string; relrowsecurity: boolean }>(
      `select relname,relrowsecurity from pg_class join pg_namespace n on n.oid=relnamespace where n.nspname='public' and relkind='r'`,
    );
    expect(tables.rows.length).toBeGreaterThanOrEqual(14);
    expect(tables.rows.every((t) => t.relrowsecurity)).toBe(true);
  });
  it("enforces unique habit dates and prevents cross-user habit check-ins", async () => {
    await asUser(a);
    const id = "00000000-0000-4000-8000-000000000005";
    await db.exec(
      `insert into habits(id,user_id,title,start_date) values('${id}','${a}','Read','2026-10-01');insert into habit_entries(user_id,habit_id,date) values('${a}','${id}','2026-10-20');`,
    );
    await expect(
      db.exec(
        `insert into habit_entries(user_id,habit_id,date) values('${a}','${id}','2026-10-20')`,
      ),
    ).rejects.toThrow();
    await asUser(b);
    await expect(
      db.exec(
        `insert into habit_entries(user_id,habit_id,date) values('${b}','${id}','2026-10-21')`,
      ),
    ).rejects.toThrow();
  });
  it("validates basic fields and recurrence cost bounds in PostgreSQL", async () => {
    await asUser(a);
    await expect(
      db.exec(`insert into tasks(user_id,title) values('${a}','  ')`),
    ).rejects.toThrow();
    await expect(
      db.exec(
        `insert into tasks(user_id,title,due_date,recurrence) values('${a}','Bad recurrence','2026-10-22','{"frequency":"daily","interval":100000,"weekdays":[]}')`,
      ),
    ).rejects.toThrow();
  });
  it("rejects account erasure without a live session", async () => {
    await asUser(b);
    await expect(db.exec("select public.delete_own_account()")).rejects.toThrow(
      "Active session required",
    );
  });
  it("queues an owner-only deletion and undo preserves its linked records", async () => {
    await asUser(a);
    const parent = "00000000-0000-4000-8000-000000000021";
    await db.exec(
      `insert into projects(id,user_id,title) values('${parent}','${a}','Undo parent');insert into tasks(user_id,title,project_id) values('${a}','Undo child','${parent}')`,
    );
    const queued = await db.query<{ item: { id: string } }>(
      `select public.schedule_record_deletion('projects','${parent}',1) as item`,
    );
    const token = queued.rows[0].item.id;
    expect(
      (await db.query(`select title from tasks where project_id='${parent}'`))
        .rows,
    ).toHaveLength(1);
    await asUser(b);
    expect(
      (
        await db.query<{ items: unknown[] }>(
          "select public.pending_record_deletions() as items",
        )
      ).rows[0].items,
    ).toEqual([]);
    await expect(
      db.exec(`select public.undo_record_deletion('${token}')`),
    ).rejects.toThrow();
    await expect(
      db.exec(
        `select public.schedule_record_deletion('projects','${parent}',1)`,
      ),
    ).rejects.toThrow();
    await asUser(a);
    await db.exec(`select public.undo_record_deletion('${token}')`);
    expect(
      (await db.query(`select title from tasks where project_id='${parent}'`))
        .rows,
    ).toHaveLength(1);
    expect(
      (
        await db.query<{ items: unknown[] }>(
          "select public.pending_record_deletions() as items",
        )
      ).rows[0].items,
    ).toEqual([]);
  });
  it("finalizes expired deletions with an atomic cascade and refuses late undo", async () => {
    const parent = "00000000-0000-4000-8000-000000000022";
    await asUser(a);
    await db.exec(
      `insert into projects(id,user_id,title) values('${parent}','${a}','Expiry parent');insert into tasks(user_id,title,project_id) values('${a}','Expiry child','${parent}')`,
    );
    const queued = await db.query<{ item: { id: string } }>(
      `select public.schedule_record_deletion('projects','${parent}',1) as item`,
    );
    const token = queued.rows[0].item.id;
    await db.exec(
      `reset role;update private.pending_record_deletions set expires_at=clock_timestamp()-interval '1 second' where id='${token}'`,
    );
    await asUser(a);
    await expect(
      db.exec(`select public.undo_record_deletion('${token}')`),
    ).rejects.toThrow();
    await db.exec("select public.process_record_deletions()");
    expect(
      (await db.query(`select id from projects where id='${parent}'`)).rows,
    ).toEqual([]);
    expect(
      (await db.query(`select id from tasks where project_id='${parent}'`))
        .rows,
    ).toEqual([]);
  });
  it("keeps records changed during the undo window and rejects arbitrary table names", async () => {
    const id = "00000000-0000-4000-8000-000000000023";
    await asUser(a);
    await db.exec(
      `insert into notes(id,user_id,title) values('${id}','${a}','Concurrent note');select public.schedule_record_deletion('notes','${id}',1);update notes set title='Newer edit' where id='${id}';reset role;update private.pending_record_deletions set expires_at=clock_timestamp()-interval '1 second' where record_id='${id}'`,
    );
    await asUser(a);
    const result = await db.query<{ conflicts: string[] }>(
      "select public.finalize_record_deletions() as conflicts",
    );
    expect(result.rows[0].conflicts).toEqual([id]);
    expect(
      (await db.query(`select title from notes where id='${id}'`)).rows,
    ).toEqual([{ title: "Newer edit" }]);
    await expect(
      db.exec(`select public.schedule_record_deletion('profiles','${id}',1)`),
    ).rejects.toThrow();
    await db.exec("reset role;set role anon");
    await expect(
      db.exec("select public.pending_record_deletions()"),
    ).rejects.toThrow();
    await asUser(a);
  });
  it("deletes only the current account and its data transactionally", async () => {
    await db.exec(
      `reset role;insert into auth.sessions(id,user_id) values('00000000-0000-4000-8000-000000000010','${a}');`,
    );
    await asUser(a);
    await db.exec(
      `select set_config('request.jwt.claims','{"session_id":"00000000-0000-4000-8000-000000000010"}',false);select public.delete_own_account();reset role;`,
    );
    expect((await db.query("select id from auth.users")).rows).toEqual([
      { id: b },
    ]);
    expect((await db.query("select * from public.tasks")).rows).toEqual([]);
    expect((await db.query("select * from public.activity")).rows).toEqual([]);
  });
});
