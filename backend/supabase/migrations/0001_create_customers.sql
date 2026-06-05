create table if not exists public.customers (
  id text primary key,
  "tenantId" text not null,
  "personType" text not null check ("personType" in ('PF', 'PJ')),
  "documentType" text not null check ("documentType" in ('CPF', 'CNPJ')),
  document text not null,
  name text not null,
  "companyName" text,
  email text not null,
  phone text,
  whatsapp text,
  "avatarUrl" text,
  "addressZip" text,
  "addressStreet" text,
  "addressNumber" text,
  "addressComplement" text,
  "addressDistrict" text,
  "addressCity" text,
  "addressState" text,
  "addressCountry" text not null default 'BR',
  notes text,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'ATTENTION', 'INACTIVE')),
  metadata jsonb not null default '{}'::jsonb,
  "createdAt" timestamp without time zone not null default now(),
  "updatedAt" timestamp without time zone not null default now(),
  "deletedAt" timestamp without time zone
);

create unique index if not exists customers_tenant_document_active_key
  on public.customers ("tenantId", document)
  where "deletedAt" is null;

create index if not exists customers_tenant_created_idx
  on public.customers ("tenantId", "createdAt" desc);

create index if not exists customers_tenant_name_idx
  on public.customers ("tenantId", lower(name));

create index if not exists customers_tenant_company_idx
  on public.customers ("tenantId", lower(coalesce("companyName", '')));

alter table public.customers enable row level security;

grant select, insert, update, delete on public.customers to authenticated;
grant all on public.customers to service_role;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'customers'
      and policyname = 'customers_authenticated_tenant_select'
  ) then
    create policy customers_authenticated_tenant_select
      on public.customers
      for select
      to authenticated
      using (
        "tenantId" = coalesce(
          auth.jwt() -> 'app_metadata' ->> 'tenantId',
          auth.jwt() -> 'app_metadata' ->> 'tenant_id',
          auth.jwt() ->> 'tenantId'
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'customers'
      and policyname = 'customers_authenticated_tenant_insert'
  ) then
    create policy customers_authenticated_tenant_insert
      on public.customers
      for insert
      to authenticated
      with check (
        "tenantId" = coalesce(
          auth.jwt() -> 'app_metadata' ->> 'tenantId',
          auth.jwt() -> 'app_metadata' ->> 'tenant_id',
          auth.jwt() ->> 'tenantId'
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'customers'
      and policyname = 'customers_authenticated_tenant_update'
  ) then
    create policy customers_authenticated_tenant_update
      on public.customers
      for update
      to authenticated
      using (
        "tenantId" = coalesce(
          auth.jwt() -> 'app_metadata' ->> 'tenantId',
          auth.jwt() -> 'app_metadata' ->> 'tenant_id',
          auth.jwt() ->> 'tenantId'
        )
      )
      with check (
        "tenantId" = coalesce(
          auth.jwt() -> 'app_metadata' ->> 'tenantId',
          auth.jwt() -> 'app_metadata' ->> 'tenant_id',
          auth.jwt() ->> 'tenantId'
        )
      );
  end if;
end $$;
