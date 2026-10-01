-- =====================================================================
-- WPP Flow — estrutura do banco no Supabase
-- Como usar: Supabase → SQL Editor → New query → cole tudo → Run.
-- Pode rodar de novo sem problema (o script é idempotente).
-- =====================================================================

-- 1) Tabela de protótipos ------------------------------------------------
create table if not exists public.prototypes (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name         text not null default 'Protótipo sem título' check (char_length(name) between 1 and 200),
  data         jsonb not null default '{}'::jsonb,           -- { profile, screens, briefing } do editor
  screen_count int generated always as (coalesce(jsonb_array_length(data->'screens'), 0)) stored,
  is_public    boolean not null default false,               -- link de visualização ligado/desligado
  share_token  uuid not null default gen_random_uuid() unique,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists prototypes_user_updated_idx on public.prototypes (user_id, updated_at desc);

-- 2) updated_at automático ----------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists prototypes_updated_at on public.prototypes;
create trigger prototypes_updated_at
  before update on public.prototypes
  for each row execute function public.set_updated_at();

-- 3) Segurança: cada pessoa só enxerga e mexe nos próprios protótipos -----
alter table public.prototypes enable row level security;

drop policy if exists "ver os meus"     on public.prototypes;
drop policy if exists "criar os meus"   on public.prototypes;
drop policy if exists "editar os meus"  on public.prototypes;
drop policy if exists "excluir os meus" on public.prototypes;

create policy "ver os meus"     on public.prototypes for select to authenticated using (user_id = auth.uid());
create policy "criar os meus"   on public.prototypes for insert to authenticated with check (user_id = auth.uid());
create policy "editar os meus"  on public.prototypes for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "excluir os meus" on public.prototypes for delete to authenticated using (user_id = auth.uid());

-- 4) Link compartilhado (somente leitura, sem login) ---------------------
-- Devolve o protótipo só se o token bater E o link estiver ligado.
create or replace function public.get_shared_prototype(token uuid)
returns table (name text, data jsonb, updated_at timestamptz)
language sql stable security definer set search_path = public as $$
  select p.name, p.data, p.updated_at
  from public.prototypes p
  where p.share_token = token and p.is_public = true
  limit 1;
$$;

revoke all on function public.get_shared_prototype(uuid) from public;
grant execute on function public.get_shared_prototype(uuid) to anon, authenticated;

-- 5) Só e-mails @dtidigital.com.br podem criar conta ----------------------
-- Para liberar outro domínio, troque o texto abaixo. Para liberar qualquer
-- e-mail, rode: drop trigger if exists restrict_signup_domain on auth.users;
create or replace function public.restrict_signup_domain()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if lower(new.email) not like '%@dtidigital.com.br' then
    raise exception 'Cadastro permitido apenas para e-mails @dtidigital.com.br';
  end if;
  return new;
end $$;

drop trigger if exists restrict_signup_domain on auth.users;
create trigger restrict_signup_domain
  before insert on auth.users
  for each row execute function public.restrict_signup_domain();
