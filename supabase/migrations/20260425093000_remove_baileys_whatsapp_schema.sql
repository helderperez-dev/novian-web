begin;

drop table if exists public.whatsapp_auth;
drop table if exists public.whatsapp_tasks;

drop index if exists public.whatsapp_instances_desired_state_idx;

alter table public.whatsapp_instances
  drop column if exists desired_state,
  drop column if exists worker_id,
  drop column if exists heartbeat_at;

commit;
