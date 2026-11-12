-- Independent health records. No changes to trip_states or existing auth settings.
begin;
create table public.health_plan_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null default '{}'::jsonb check (jsonb_typeof(state) = 'object'),
  revision bigint not null default 0 check (revision >= 0),
  updated_at timestamptz not null default now()
);
alter table public.health_plan_states enable row level security;
revoke all on public.health_plan_states from anon, authenticated;
grant select, insert, update on public.health_plan_states to authenticated;
create policy health_read_own on public.health_plan_states for select to authenticated
  using ((select auth.uid()) = user_id);
create policy health_insert_own on public.health_plan_states for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy health_update_own on public.health_plan_states for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create function public.save_health_plan(p_expected_revision bigint, p_state jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  current_record public.health_plan_states%rowtype;
  caller uuid := auth.uid();
begin
  if caller is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_expected_revision is null or p_expected_revision < 0 or p_state is null
     or jsonb_typeof(p_state) <> 'object' or octet_length(p_state::text) > 2097152
  then raise exception 'Invalid health plan'; end if;
  insert into public.health_plan_states (user_id) values (caller) on conflict (user_id) do nothing;
  select * into current_record from public.health_plan_states where user_id = caller for update;
  if current_record.revision <> p_expected_revision then
    return jsonb_build_object('saved', false, 'state', current_record.state,
      'revision', current_record.revision, 'updated_at', current_record.updated_at);
  end if;
  update public.health_plan_states set state = p_state, revision = revision + 1,
    updated_at = clock_timestamp() where user_id = caller returning * into current_record;
  return jsonb_build_object('saved', true, 'state', current_record.state,
    'revision', current_record.revision, 'updated_at', current_record.updated_at);
end;
$$;
revoke all on function public.save_health_plan(bigint, jsonb) from public, anon;
grant execute on function public.save_health_plan(bigint, jsonb) to authenticated;
commit;
