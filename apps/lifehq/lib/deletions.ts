import { z } from "zod";
import { cascadeDelete, tables, type Data } from "@lifehq/shared";
export const pendingDeletionSchema = z.object({
  id: z.uuid(),
  label: z.string().optional(),
  record_table: z.enum(tables),
  record_id: z.uuid(),
  record_version: z.number().int().positive(),
  expires_at: z.iso.datetime({ offset: true }),
});
export type PendingDeletion = z.infer<typeof pendingDeletionSchema>;
export function pendingDeletionList(value: unknown): PendingDeletion[] {
  return z.array(pendingDeletionSchema).parse(value ?? []);
}
export function visibleRecords(data: Data, pending: PendingDeletion[]): Data {
  return pending.reduce(
    (next, item) => cascadeDelete(next, item.record_table, item.record_id),
    data,
  );
}
