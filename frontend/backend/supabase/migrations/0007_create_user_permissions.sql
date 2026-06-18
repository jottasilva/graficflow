alter table public.users add column if not exists type text not null default 'OPERATOR'
  check (type in ('ADMIN', 'OPERATOR', 'CLIENT'));
alter table public.users add column if not exists phone text;
alter table public.users add column if not exists document text;
alter table public.users add column if not exists "avatarUrl" text;
alter table public.users add column if not exists status text not null default 'ACTIVE'
  check (status in ('ACTIVE', 'INVITED', 'SUSPENDED', 'INACTIVE'));
alter table public.users add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.users add column if not exists "deletedAt" timestamptz;

create table if not exists public.user_sector_permissions (
  id text primary key,
  "tenantId" text not null references public.tenants(id) on delete cascade,
  "userId" text not null references public.users(id) on delete cascade,
  "sectorId" text not null references public.sectors(id) on delete cascade,
  "canRead" boolean not null default true,
  "canWrite" boolean not null default false,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  unique ("tenantId", "userId", "sectorId")
);

create index if not exists user_sector_permissions_user_idx
  on public.user_sector_permissions ("tenantId", "userId");

alter table public.user_sector_permissions enable row level security;
revoke all on table public.user_sector_permissions from anon, authenticated;
grant all on table public.user_sector_permissions to service_role;
