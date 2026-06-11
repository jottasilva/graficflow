create table if not exists public.suppliers (
  id text primary key,
  "tenantId" text not null references public.tenants(id) on delete cascade,
  "documentType" text not null default 'CNPJ' check ("documentType" in ('CPF', 'CNPJ', 'IE', 'FOREIGN')),
  document text not null,
  name text not null,
  "companyName" text,
  email text,
  phone text,
  whatsapp text,
  "contactName" text,
  categories text[] not null default '{}'::text[],
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'BLOCKED', 'INACTIVE')),
  "addressZip" text,
  "addressStreet" text,
  "addressNumber" text,
  "addressComplement" text,
  "addressDistrict" text,
  "addressCity" text,
  "addressState" text,
  "addressCountry" text not null default 'BR',
  "paymentTerms" text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  "deletedAt" timestamptz
);

create unique index if not exists suppliers_tenant_document_active_key
  on public.suppliers ("tenantId", document)
  where "deletedAt" is null;

create table if not exists public.purchase_orders (
  id text primary key,
  "tenantId" text not null references public.tenants(id) on delete cascade,
  "supplierId" text not null references public.suppliers(id) on delete restrict,
  "userId" text references public.users(id) on delete set null,
  number text not null,
  status text not null default 'DRAFT' check (status in ('DRAFT', 'SENT', 'APPROVED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELED')),
  "paymentStatus" text not null default 'PENDING' check ("paymentStatus" in ('PENDING', 'PARTIAL', 'PAID', 'OVERDUE', 'CANCELED')),
  subtotal numeric(14,2) not null default 0,
  "discountAmount" numeric(14,2) not null default 0,
  "shippingAmount" numeric(14,2) not null default 0,
  "taxAmount" numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  "paidAmount" numeric(14,2) not null default 0,
  "remainingAmount" numeric(14,2) not null default 0,
  "expectedDeliveryAt" timestamptz,
  "receivedAt" timestamptz,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  "deletedAt" timestamptz,
  unique ("tenantId", number)
);

create table if not exists public.purchase_order_items (
  id text primary key,
  "tenantId" text not null references public.tenants(id) on delete cascade,
  "purchaseOrderId" text not null references public.purchase_orders(id) on delete cascade,
  "productId" text references public.products(id) on delete set null,
  "inventoryId" text references public.inventories(id) on delete set null,
  description text not null,
  quantity numeric(14,3) not null,
  "unitCost" numeric(14,2) not null,
  discount numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  "receivedQuantity" numeric(14,3) not null default 0,
  status text not null default 'PENDING' check (status in ('PENDING', 'PARTIAL', 'RECEIVED', 'CANCELED')),
  metadata jsonb not null default '{}'::jsonb,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table if not exists public.payment_transactions (
  id text primary key,
  "tenantId" text not null references public.tenants(id) on delete cascade,
  "orderId" text references public.orders(id) on delete set null,
  "quoteId" text references public.quotes(id) on delete set null,
  "purchaseOrderId" text references public.purchase_orders(id) on delete set null,
  "financeId" text references public.financial_transactions(id) on delete set null,
  direction text not null check (direction in ('incoming', 'outgoing')),
  method text not null check (method in ('PIX', 'BOLETO', 'CARD', 'CASH', 'BANK_TRANSFER', 'OTHER')),
  provider text,
  "providerReference" text,
  amount numeric(14,2) not null,
  "feeAmount" numeric(14,2) not null default 0,
  "netAmount" numeric(14,2) not null,
  status text not null default 'PENDING' check (status in ('PENDING', 'AUTHORIZED', 'PAID', 'FAILED', 'CANCELED', 'REFUNDED')),
  "dueAt" timestamptz,
  "paidAt" timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table if not exists public.fiscal_documents (
  id text primary key,
  "tenantId" text not null references public.tenants(id) on delete cascade,
  "orderId" text references public.orders(id) on delete set null,
  "customerId" text references public.customers(id) on delete set null,
  type text not null check (type in ('NFE', 'NFCE', 'NFSE')),
  operation text not null default 'SALE' check (operation in ('SALE', 'SERVICE', 'RETURN', 'CANCEL')),
  environment text not null default 'HOMOLOGATION' check (environment in ('HOMOLOGATION', 'PRODUCTION')),
  status text not null default 'DRAFT' check (status in ('DRAFT', 'QUEUED', 'PROCESSING', 'AUTHORIZED', 'REJECTED', 'CANCELED')),
  provider text,
  series text,
  number text,
  "accessKey" text,
  protocol text,
  "issuedAt" timestamptz,
  "canceledAt" timestamptz,
  "xmlUrl" text,
  "pdfUrl" text,
  "rejectionReason" text,
  payload jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table if not exists public.production_work_logs (
  id text primary key,
  "tenantId" text not null references public.tenants(id) on delete cascade,
  "orderItemId" text not null references public.order_items(id) on delete cascade,
  "userId" text references public.users(id) on delete set null,
  "machineId" text references public.machines(id) on delete set null,
  "sectorId" text references public.sectors(id) on delete set null,
  type text not null check (type in ('START', 'PAUSE', 'RESUME', 'FINISH', 'REWORK', 'LOSS', 'NOTE')),
  "quantityGood" numeric(14,3) not null default 0,
  "quantityLoss" numeric(14,3) not null default 0,
  minutes integer not null default 0,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  "createdAt" timestamptz not null default now()
);

create table if not exists public.quality_inspections (
  id text primary key,
  "tenantId" text not null references public.tenants(id) on delete cascade,
  "orderItemId" text not null references public.order_items(id) on delete cascade,
  "userId" text references public.users(id) on delete set null,
  status text not null check (status in ('APPROVED', 'REJECTED', 'REWORK')),
  "checkedQty" numeric(14,3) not null,
  "rejectedQty" numeric(14,3) not null default 0,
  checklist jsonb not null default '{}'::jsonb,
  notes text,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id text primary key,
  "tenantId" text not null references public.tenants(id) on delete cascade,
  "userId" text references public.users(id) on delete set null,
  action text not null,
  "entityType" text not null,
  "entityId" text,
  before jsonb,
  after jsonb,
  ip text,
  "userAgent" text,
  "createdAt" timestamptz not null default now()
);

create index if not exists suppliers_tenant_status_idx on public.suppliers ("tenantId", status, "createdAt" desc);
create index if not exists purchase_orders_tenant_status_idx on public.purchase_orders ("tenantId", status, "createdAt" desc);
create index if not exists purchase_order_items_purchase_idx on public.purchase_order_items ("purchaseOrderId");
create index if not exists payment_transactions_tenant_status_idx on public.payment_transactions ("tenantId", status, "createdAt" desc);
create index if not exists payment_transactions_order_idx on public.payment_transactions ("orderId");
create index if not exists fiscal_documents_tenant_status_idx on public.fiscal_documents ("tenantId", status, "createdAt" desc);
create index if not exists fiscal_documents_order_idx on public.fiscal_documents ("orderId");
create index if not exists production_work_logs_tenant_item_idx on public.production_work_logs ("tenantId", "orderItemId", "createdAt" desc);
create index if not exists quality_inspections_tenant_item_idx on public.quality_inspections ("tenantId", "orderItemId", "createdAt" desc);
create index if not exists audit_logs_tenant_entity_idx on public.audit_logs ("tenantId", "entityType", "entityId", "createdAt" desc);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'suppliers',
    'purchase_orders',
    'purchase_order_items',
    'payment_transactions',
    'fiscal_documents',
    'production_work_logs',
    'quality_inspections',
    'audit_logs'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from anon, authenticated', table_name);
    execute format('grant all on table public.%I to service_role', table_name);
  end loop;
end $$;
