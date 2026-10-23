import { redirect } from "next/navigation";
import { supabase, configured } from "@/lib/supabase";
import { Workspace } from "@/components/workspace";
export default async function Page() {
  if (!configured()) redirect("/login");
  const db = await supabase();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect("/login");
  return <Workspace demo={false} />;
}
