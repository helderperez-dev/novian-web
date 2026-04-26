begin;

drop table if exists public.whatsapp_auth;
drop table if exists public.whatsapp_tasks;
drop table if exists public.whatsapp_instances;

drop index if exists public.whatsapp_instances_desired_state_idx;

commit;
