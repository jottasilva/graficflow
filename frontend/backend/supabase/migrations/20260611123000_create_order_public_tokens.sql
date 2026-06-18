create table if not exists public.order_public_tokens (
  id text primary key,
  "tenantId" text not null references public.tenants(id) on delete cascade,
  "orderId" text not null references public.orders(id) on delete cascade,
  "tokenHash" text not null unique,
  "expiresAt" timestamptz not null,
  "acceptedAt" timestamptz,
  "revokedAt" timestamptz,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create index if not exists order_public_tokens_order_idx
  on public.order_public_tokens ("orderId");

create index if not exists order_public_tokens_tenant_idx
  on public.order_public_tokens ("tenantId", "createdAt" desc);

alter table public.order_public_tokens enable row level security;
revoke all on table public.order_public_tokens from anon, authenticated;
grant all on table public.order_public_tokens to service_role;
