-- Supabase's default ACL can explicitly grant anon execution independently of PUBLIC.
revoke all on function public.schedule_record_deletion(text,uuid,integer) from anon;
revoke all on function public.undo_record_deletion(uuid) from anon;
revoke all on function public.pending_record_deletions() from anon;
revoke all on function public.finalize_record_deletions() from anon;
revoke all on function public.process_record_deletions() from anon;
revoke all on private.pending_record_deletions from public,anon;
