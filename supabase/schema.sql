-- Run in Supabase: SQL Editor > New query > paste > Run.
create sequence if not exists member_seq start 1001;
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text, wallet_address text,
  role text not null default 'member' check (role in ('member','treasurer')),
  member_code text unique default ('STK-' || nextval('member_seq')),
  created_at timestamptz default now());
create table public.claims (
  id text primary key, member_id uuid references auth.users on delete set null, member_name text,
  amount numeric not null, recipient text, category text, reason text,
  status text not null default 'PENDING', block_reason text, tx_hash text,
  attempts int not null default 0, created_at timestamptz default now());
create table public.audit_events (
  id text primary key, time text, type text, recipient text, amount text, reason text,
  hash text, code text, payload jsonb, created_at timestamptz default now());

create or replace function public.is_treasurer() returns boolean language sql security definer set search_path = public as
$$ select exists (select 1 from profiles where id = auth.uid() and role = 'treasurer') $$;

-- every new sign-up becomes a MEMBER. Officers are promoted by SQL only (see bottom).
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as
$$ begin insert into profiles (id, full_name) values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email)); return new; end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

alter table profiles enable row level security;
alter table claims enable row level security;
alter table audit_events enable row level security;
create policy "own profile" on profiles for select using (id = auth.uid() or is_treasurer());
revoke update on profiles from authenticated, anon;            -- users can never edit their own role
grant update (full_name, wallet_address) on profiles to authenticated;
create policy "edit own profile" on profiles for update using (id = auth.uid());
create policy "own claims" on claims for select using (member_id = auth.uid() or is_treasurer());
create policy "audit readable" on audit_events for select to authenticated using (true);
-- No insert/update policies on claims or audit_events: only the backend (service-role key) writes them.

-- Promote an officer (after they have signed up):
-- update profiles set role = 'treasurer' where id = (select id from auth.users where email = 'chair@example.com');
