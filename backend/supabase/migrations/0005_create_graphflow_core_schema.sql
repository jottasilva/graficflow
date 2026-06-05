create table if not exists public.tenants (
  id text primary key,
  name text not null,
  slug text not null unique,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'SUSPENDED', 'INACTIVE')),
  metadata jsonb not null default '{}'::jsonb,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  "deletedAt" timestamptz
);

create table if not exists public.users (
  id text primary key,
  "tenantId" text references public.tenants(id) on delete cascade,
  name text not null,
  email text not null unique,
  role text not null default 'VIEWER' check (role in ('ADMIN', 'MANAGER', 'OPERATOR', 'FINANCE', 'CLIENT', 'VIEWER')),
  permissions text[] not null default '{}'::text[],
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'INVITED', 'SUSPENDED', 'INACTIVE')),
  metadata jsonb not null default '{}'::jsonb,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  "deletedAt" timestamptz
);

create table if not exists public.sectors (
  id text primary key,
  "tenantId" text not null references public.tenants(id) on delete cascade,
  name text not null,
  description text,
  color text,
  icon text,
  status text not null default 'OPERATIONAL',
  "kanbanOrder" integer not null default 0,
  capacity integer not null default 0,
  sla text not null default '100%',
  lead text not null default '0h',
  metadata jsonb not null default '{}'::jsonb,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  unique ("tenantId", name)
);

create table if not exists public.customers (
  id text primary key,
  "tenantId" text not null references public.tenants(id) on delete cascade,
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
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  "deletedAt" timestamptz
);

create unique index if not exists customers_tenant_document_active_key
  on public.customers ("tenantId", document)
  where "deletedAt" is null;

create table if not exists public.products (
  id text primary key,
  "tenantId" text not null references public.tenants(id) on delete cascade,
  "sectorId" text references public.sectors(id) on delete set null,
  "sectorName" text,
  sku text not null,
  name text not null,
  category text not null default 'Geral',
  description text,
  "thumbnailUrl" text,
  "priceCost" numeric(14,2),
  "priceSale" numeric(14,2) not null default 0,
  "unitType" text not null default 'un',
  "stockQty" numeric(14,3) not null default 0,
  "stockMin" numeric(14,3) not null default 0,
  "stockMax" numeric(14,3),
  "trackStock" boolean not null default true,
  "allowFractional" boolean not null default false,
  "minOrderQty" numeric(14,3) not null default 1,
  "minFractionQty" numeric(14,3) not null default 1,
  tags text[] not null default '{}'::text[],
  attributes jsonb not null default '{}'::jsonb,
  "isActive" boolean not null default true,
  "isFeatured" boolean not null default false,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  "deletedAt" timestamptz,
  unique ("tenantId", sku)
);

create table if not exists public.inventories (
  id text primary key,
  "tenantId" text not null references public.tenants(id) on delete cascade,
  "productId" text references public.products(id) on delete set null,
  name text not null,
  category text not null default 'Geral',
  quantity numeric(14,3) not null default 0,
  "reservedQuantity" numeric(14,3) not null default 0,
  "availableQuantity" numeric(14,3) not null default 0,
  "minQuantity" numeric(14,3) not null default 0,
  unit text not null default 'un',
  "imageUrl" text,
  "lastMove" text,
  metadata jsonb not null default '{}'::jsonb,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table if not exists public.inventory_movements (
  id text primary key,
  "tenantId" text not null references public.tenants(id) on delete cascade,
  "inventoryId" text not null references public.inventories(id) on delete cascade,
  type text not null check (type in ('IN', 'OUT', 'ADJUSTMENT', 'RESERVE', 'RELEASE', 'LOSS')),
  quantity numeric(14,3) not null,
  "balanceBefore" numeric(14,3) not null,
  "balanceAfter" numeric(14,3) not null,
  reason text not null,
  "referenceType" text,
  "referenceId" text,
  "userId" text references public.users(id) on delete set null,
  "createdAt" timestamptz not null default now()
);

create table if not exists public.machines (
  id text primary key,
  "tenantId" text not null references public.tenants(id) on delete cascade,
  "sectorId" text references public.sectors(id) on delete set null,
  name text not null,
  model text,
  "serialNumber" text,
  status text not null default 'OPERATIONAL' check (status in ('OPERATIONAL', 'DOWN', 'MAINTENANCE')),
  "capacityPerHour" numeric(14,3) not null default 0,
  "nextMaintenanceAt" timestamptz,
  "lastMaintenanceAt" timestamptz,
  "totalUsageMinutes" integer not null default 0,
  "costMonth" numeric(14,2) not null default 0,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table if not exists public.maintenance_tickets (
  id text primary key,
  "tenantId" text not null references public.tenants(id) on delete cascade,
  "machineId" text not null references public.machines(id) on delete cascade,
  "openedByUserId" text references public.users(id) on delete set null,
  "assignedUserId" text references public.users(id) on delete set null,
  priority text not null default 'MEDIUM' check (priority in ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  status text not null default 'OPEN' check (status in ('OPEN', 'IN_PROGRESS', 'WAITING_PARTS', 'RESOLVED', 'CANCELED')),
  title text not null,
  description text not null,
  "openedAt" timestamptz not null default now(),
  "closedAt" timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table if not exists public.orders (
  id text primary key,
  "tenantId" text not null references public.tenants(id) on delete cascade,
  "customerId" text not null references public.customers(id) on delete restrict,
  "userId" text references public.users(id) on delete set null,
  "quoteId" text,
  number text not null,
  status text not null,
  "paymentStatus" text not null,
  "productionStatus" text not null,
  subtotal numeric(14,2) not null default 0,
  "discountAmount" numeric(14,2) not null default 0,
  "taxAmount" numeric(14,2) not null default 0,
  "shippingAmount" numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  "paidAmount" numeric(14,2) not null default 0,
  "remainingAmount" numeric(14,2) not null default 0,
  notes text,
  "internalNotes" text,
  carrier text,
  "trackingCode" text,
  "expectedDeliveryAt" timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  "deletedAt" timestamptz,
  unique ("tenantId", number)
);

create table if not exists public.order_items (
  id text primary key,
  "tenantId" text not null references public.tenants(id) on delete cascade,
  "orderId" text not null references public.orders(id) on delete cascade,
  "productId" text references public.products(id) on delete set null,
  "variantId" text,
  description text not null,
  quantity numeric(14,3) not null,
  "unitPrice" numeric(14,2) not null,
  discount numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  status text not null default 'PENDING',
  position integer not null default 0,
  priority text not null default 'NORMAL',
  "dueDate" timestamptz,
  "assignedUserId" text references public.users(id) on delete set null,
  "sectorId" text references public.sectors(id) on delete set null,
  "machineId" text references public.machines(id) on delete set null,
  "startedAt" timestamptz,
  "finishedAt" timestamptz,
  "pausedAt" timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table if not exists public.order_item_logs (
  id text primary key,
  "tenantId" text not null references public.tenants(id) on delete cascade,
  "orderItemId" text not null references public.order_items(id) on delete cascade,
  "userId" text references public.users(id) on delete set null,
  "fromStatus" text,
  "toStatus" text not null,
  "fromPosition" integer,
  "toPosition" integer not null default 0,
  note text,
  "createdAt" timestamptz not null default now()
);

create table if not exists public.machine_usage_logs (
  id text primary key,
  "tenantId" text not null references public.tenants(id) on delete cascade,
  "machineId" text not null references public.machines(id) on delete cascade,
  "userId" text references public.users(id) on delete set null,
  "orderItemId" text references public.order_items(id) on delete set null,
  "startTime" timestamptz not null,
  "endTime" timestamptz,
  duration integer,
  notes text,
  "createdAt" timestamptz not null default now()
);

create table if not exists public.quotes (
  id text primary key,
  "tenantId" text not null references public.tenants(id) on delete cascade,
  "customerId" text not null references public.customers(id) on delete restrict,
  "userId" text references public.users(id) on delete set null,
  number text not null,
  status text not null default 'DRAFT',
  "validUntil" timestamptz not null,
  notes text,
  "internalNotes" text,
  subtotal numeric(14,2) not null default 0,
  "discountAmount" numeric(14,2) not null default 0,
  "taxAmount" numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  "deletedAt" timestamptz,
  unique ("tenantId", number)
);

create table if not exists public.quote_items (
  id text primary key,
  "tenantId" text not null references public.tenants(id) on delete cascade,
  "quoteId" text not null references public.quotes(id) on delete cascade,
  "productId" text references public.products(id) on delete set null,
  "variantId" text,
  description text not null,
  quantity numeric(14,3) not null,
  "unitPrice" numeric(14,2) not null,
  discount numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  notes text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table if not exists public.quote_public_tokens (
  id text primary key,
  "tenantId" text not null references public.tenants(id) on delete cascade,
  "quoteId" text not null references public.quotes(id) on delete cascade,
  "tokenHash" text not null unique,
  "expiresAt" timestamptz not null,
  "acceptedAt" timestamptz,
  "revokedAt" timestamptz,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table if not exists public.financial_transactions (
  id text primary key,
  "tenantId" text not null references public.tenants(id) on delete cascade,
  "orderId" text references public.orders(id) on delete set null,
  "quoteId" text references public.quotes(id) on delete set null,
  label text not null,
  type text not null check (type in ('receivable', 'payable', 'profit', 'margin', 'cash')),
  value numeric(14,2) not null,
  due text,
  status text not null default 'Pendente',
  metadata jsonb not null default '{}'::jsonb,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table if not exists public.files (
  id text primary key,
  "tenantId" text not null references public.tenants(id) on delete cascade,
  name text not null,
  type text not null,
  size text,
  "linkedTo" text,
  url text,
  metadata jsonb not null default '{}'::jsonb,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table if not exists public.notifications (
  id text primary key,
  "tenantId" text not null references public.tenants(id) on delete cascade,
  title text not null,
  message text not null,
  tone text not null default 'info',
  read boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  "createdAt" timestamptz not null default now()
);

create index if not exists users_tenant_idx on public.users ("tenantId");
create index if not exists sectors_tenant_order_idx on public.sectors ("tenantId", "kanbanOrder");
create index if not exists customers_tenant_created_idx on public.customers ("tenantId", "createdAt" desc);
create index if not exists products_tenant_active_idx on public.products ("tenantId", "isActive", "createdAt" desc);
create index if not exists inventories_tenant_updated_idx on public.inventories ("tenantId", "updatedAt" desc);
create index if not exists machines_tenant_sector_idx on public.machines ("tenantId", "sectorId");
create index if not exists maintenance_tickets_tenant_opened_idx on public.maintenance_tickets ("tenantId", "openedAt" desc);
create index if not exists orders_tenant_created_idx on public.orders ("tenantId", "createdAt" desc);
create index if not exists order_items_tenant_status_idx on public.order_items ("tenantId", status, position);
create index if not exists machine_usage_logs_month_idx on public.machine_usage_logs ("tenantId", "machineId", "startTime" desc);
create index if not exists quotes_tenant_created_idx on public.quotes ("tenantId", "createdAt" desc);
create index if not exists financial_transactions_tenant_created_idx on public.financial_transactions ("tenantId", "createdAt" desc);
create index if not exists notifications_tenant_created_idx on public.notifications ("tenantId", "createdAt" desc);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'tenants',
    'users',
    'sectors',
    'customers',
    'products',
    'inventories',
    'inventory_movements',
    'machines',
    'maintenance_tickets',
    'orders',
    'order_items',
    'order_item_logs',
    'machine_usage_logs',
    'quotes',
    'quote_items',
    'quote_public_tokens',
    'financial_transactions',
    'files',
    'notifications'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from anon, authenticated', table_name);
    execute format('grant all on table public.%I to service_role', table_name);
  end loop;
end $$;
