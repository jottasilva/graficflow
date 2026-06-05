insert into public.tenants (id, name, slug, status, "createdAt", "updatedAt")
values ('graphflow-main', 'Grafica Exemplo', 'graphflow-main', 'ACTIVE', now(), now())
on conflict (id) do update
set name = excluded.name,
    slug = excluded.slug,
    status = excluded.status,
    "updatedAt" = now();

insert into public.sectors (id, "tenantId", name, description, color, icon, status, "kanbanOrder", capacity, sla, lead, "createdAt", "updatedAt")
values
  ('sec-comercial', 'graphflow-main', 'Comercial', 'Atendimento, triagem e negociacao de propostas.', '#6d4aff', 'users', 'OPERATIONAL', 0, 42, '98%', '2h', now(), now()),
  ('sec-arte-final', 'graphflow-main', 'Arte Final', 'Conferencia tecnica, fechamento de arquivo e prova digital.', '#0099ff', 'palette', 'OPERATIONAL', 1, 61, '96%', '5h', now(), now()),
  ('sec-impressao', 'graphflow-main', 'Impressao', 'Operacao de impressoras digitais e grandes formatos.', '#00b870', 'printer', 'OPERATIONAL', 2, 78, '94%', '8h', now(), now()),
  ('sec-acabamento', 'graphflow-main', 'Acabamento', 'Corte, laminação, montagem, embalagem e conferencia final.', '#ff8a00', 'scissors', 'OPERATIONAL', 3, 55, '97%', '6h', now(), now())
on conflict (id) do update
set name = excluded.name,
    description = excluded.description,
    color = excluded.color,
    icon = excluded.icon,
    status = excluded.status,
    "kanbanOrder" = excluded."kanbanOrder",
    capacity = excluded.capacity,
    sla = excluded.sla,
    lead = excluded.lead,
    "updatedAt" = now();

insert into public.users (id, "tenantId", type, name, email, phone, document, "avatarUrl", role, permissions, status, metadata, "createdAt", "updatedAt")
values
  (
    'dev-admin',
    'graphflow-main',
    'ADMIN',
    'Administrador GraphFlow',
    'admin@email.com',
    '(11) 99999-0001',
    '12345678901',
    'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=256&q=80',
    'ADMIN',
    array['*'],
    'ACTIVE',
    '{"cargo":"Administrador geral"}'::jsonb,
    now(),
    now()
  ),
  (
    'usr-carla',
    'graphflow-main',
    'OPERATOR',
    'Carla Nunes',
    'carla@graficaexemplo.com.br',
    '(11) 98888-1001',
    '23456789012',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=256&q=80',
    'OPERATOR',
    array['dashboard:read','orders:read','production:read','production:write','machines:read','sectors:read'],
    'ACTIVE',
    '{"cargo":"Operadora de producao"}'::jsonb,
    now(),
    now()
  ),
  (
    'usr-marcos',
    'graphflow-main',
    'OPERATOR',
    'Marcos Lima',
    'marcos@graficaexemplo.com.br',
    '(11) 98888-1002',
    '34567890123',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=256&q=80',
    'FINANCE',
    array['dashboard:read','orders:read','clients:read','finance:read','finance:write','quotes:read','reports:read'],
    'ACTIVE',
    '{"cargo":"Analista financeiro"}'::jsonb,
    now(),
    now()
  ),
  (
    'usr-client-pixel',
    'graphflow-main',
    'CLIENT',
    'Agencia Pixel',
    'contato@agenciapixel.com.br',
    '(11) 97777-3030',
    '11222333000144',
    'https://images.unsplash.com/photo-1549923746-c502d488b3ea?auto=format&fit=crop&w=256&q=80',
    'CLIENT',
    array['orders:read','quotes:read','files:read'],
    'ACTIVE',
    '{"origem":"portal do cliente"}'::jsonb,
    now(),
    now()
  )
on conflict (id) do update
set type = excluded.type,
    name = excluded.name,
    email = excluded.email,
    phone = excluded.phone,
    document = excluded.document,
    "avatarUrl" = excluded."avatarUrl",
    role = excluded.role,
    permissions = excluded.permissions,
    status = excluded.status,
    metadata = excluded.metadata,
    "updatedAt" = now();

insert into public.user_sector_permissions (id, "tenantId", "userId", "sectorId", "canRead", "canWrite", "createdAt", "updatedAt")
values
  ('usp-carla-arte', 'graphflow-main', 'usr-carla', 'sec-arte-final', true, true, now(), now()),
  ('usp-carla-impressao', 'graphflow-main', 'usr-carla', 'sec-impressao', true, true, now(), now()),
  ('usp-carla-acabamento', 'graphflow-main', 'usr-carla', 'sec-acabamento', true, true, now(), now()),
  ('usp-marcos-comercial', 'graphflow-main', 'usr-marcos', 'sec-comercial', true, false, now(), now())
on conflict ("tenantId", "userId", "sectorId") do update
set "canRead" = excluded."canRead",
    "canWrite" = excluded."canWrite",
    "updatedAt" = now();

insert into public.customers (
  id, "tenantId", "personType", "documentType", document, name, "companyName", email, phone, whatsapp,
  "avatarUrl", "addressZip", "addressStreet", "addressNumber", "addressComplement", "addressDistrict",
  "addressCity", "addressState", "addressCountry", notes, status, metadata, "createdAt", "updatedAt"
)
values
  (
    'cus-agencia-pixel',
    'graphflow-main',
    'PJ',
    'CNPJ',
    '11222333000144',
    'Agencia Pixel',
    'Agencia Pixel Comunicacao Ltda',
    'contato@agenciapixel.com.br',
    '(11) 3333-3030',
    '(11) 97777-3030',
    'https://images.unsplash.com/photo-1549923746-c502d488b3ea?auto=format&fit=crop&w=480&q=80',
    '01310-100',
    'Avenida Paulista',
    '1000',
    '10 andar',
    'Bela Vista',
    'Sao Paulo',
    'SP',
    'BR',
    'Cliente recorrente, prefere receber orcamentos por WhatsApp.',
    'ACTIVE',
    '{"segmento":"marketing"}'::jsonb,
    now(),
    now()
  ),
  (
    'cus-cafe-aurora',
    'graphflow-main',
    'PJ',
    'CNPJ',
    '55666777000188',
    'Cafe Aurora',
    'Cafe Aurora Comercio de Alimentos Ltda',
    'compras@cafeaurora.com.br',
    '(21) 3232-9090',
    '(21) 98888-9090',
    'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=480&q=80',
    '22250-040',
    'Rua Voluntarios da Patria',
    '420',
    'loja 3',
    'Botafogo',
    'Rio de Janeiro',
    'RJ',
    'BR',
    'Demanda recorrente de embalagens e cardapios.',
    'ACTIVE',
    '{"segmento":"alimentacao"}'::jsonb,
    now(),
    now()
  ),
  (
    'cus-juliana',
    'graphflow-main',
    'PF',
    'CPF',
    '12345678909',
    'Juliana Andrade',
    null,
    'juliana@email.com',
    '(31) 3333-1010',
    '(31) 99999-1010',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=480&q=80',
    '30140-071',
    'Rua da Bahia',
    '900',
    'sala 5',
    'Centro',
    'Belo Horizonte',
    'MG',
    'BR',
    'Cliente pessoa fisica para convites e papelaria personalizada.',
    'ATTENTION',
    '{"segmento":"eventos"}'::jsonb,
    now(),
    now()
  )
on conflict (id) do update
set name = excluded.name,
    "companyName" = excluded."companyName",
    email = excluded.email,
    phone = excluded.phone,
    whatsapp = excluded.whatsapp,
    "avatarUrl" = excluded."avatarUrl",
    notes = excluded.notes,
    status = excluded.status,
    metadata = excluded.metadata,
    "updatedAt" = now();

insert into public.products (
  id, "tenantId", "sectorId", "sectorName", sku, name, category, description, "thumbnailUrl",
  "priceCost", "priceSale", "unitType", "stockQty", "stockMin", "stockMax", "trackStock",
  "allowFractional", "minOrderQty", "minFractionQty", tags, attributes, "isActive", "isFeatured",
  "createdAt", "updatedAt"
)
values
  (
    'prd-cartao-couche',
    'graphflow-main',
    'sec-impressao',
    'Impressao',
    'GF-CARTAO-300G',
    'Cartao de Visita Couche 300g',
    'Cartoes de Visita',
    'Cartao 9x5cm em couche 300g, impressao 4x4 cores e verniz total.',
    'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=600&q=80',
    12.50,
    29.90,
    'un',
    12000,
    2000,
    30000,
    true,
    true,
    100,
    100,
    array['cartao','couche','verniz'],
    '{"leadTime":"2 dias","acabamento":"Verniz total"}'::jsonb,
    true,
    true,
    now(),
    now()
  ),
  (
    'prd-folder-a4',
    'graphflow-main',
    'sec-impressao',
    'Impressao',
    'GF-FOLDER-A4',
    'Folder A4 Couche 150g',
    'Folders',
    'Folder A4 com uma dobra, impressao 4x4 cores em couche 150g.',
    'https://images.unsplash.com/photo-1586953208448-b95a79798f07?auto=format&fit=crop&w=600&q=80',
    46.00,
    109.90,
    'un',
    6500,
    1500,
    18000,
    true,
    true,
    250,
    250,
    array['folder','couche','a4'],
    '{"leadTime":"4 dias","dobras":1}'::jsonb,
    true,
    true,
    now(),
    now()
  ),
  (
    'prd-banner-lona',
    'graphflow-main',
    'sec-acabamento',
    'Acabamento',
    'GF-BANNER-440G',
    'Banner Lona 440g',
    'Banners',
    'Banner 80x120cm em lona 440g com acabamento em bastao e cordao.',
    'https://images.unsplash.com/photo-1516387938699-a93567ec168e?auto=format&fit=crop&w=600&q=80',
    32.00,
    59.90,
    'un',
    340,
    40,
    900,
    true,
    false,
    1,
    1,
    array['banner','lona','grande formato'],
    '{"leadTime":"3 dias","material":"Lona 440g"}'::jsonb,
    true,
    true,
    now(),
    now()
  ),
  (
    'prd-adesivo-redondo',
    'graphflow-main',
    'sec-arte-final',
    'Arte Final',
    'GF-ADESIVO-RED',
    'Adesivo Redondo',
    'Adesivos',
    'Adesivo redondo em vinil, corte especial e impressao colorida.',
    'https://images.unsplash.com/photo-1607462109225-6b64ae2dd3cb?auto=format&fit=crop&w=600&q=80',
    18.00,
    49.90,
    'un',
    9200,
    1200,
    25000,
    true,
    true,
    100,
    50,
    array['adesivo','vinil','corte'],
    '{"leadTime":"2 dias","corte":"especial"}'::jsonb,
    true,
    false,
    now(),
    now()
  )
on conflict (id) do update
set "sectorId" = excluded."sectorId",
    "sectorName" = excluded."sectorName",
    name = excluded.name,
    category = excluded.category,
    description = excluded.description,
    "thumbnailUrl" = excluded."thumbnailUrl",
    "priceCost" = excluded."priceCost",
    "priceSale" = excluded."priceSale",
    "stockQty" = excluded."stockQty",
    "stockMin" = excluded."stockMin",
    "stockMax" = excluded."stockMax",
    "allowFractional" = excluded."allowFractional",
    "minOrderQty" = excluded."minOrderQty",
    "minFractionQty" = excluded."minFractionQty",
    tags = excluded.tags,
    attributes = excluded.attributes,
    "isActive" = excluded."isActive",
    "isFeatured" = excluded."isFeatured",
    "updatedAt" = now();

insert into public.inventories (
  id, "tenantId", "productId", name, category, quantity, "reservedQuantity", "availableQuantity",
  "minQuantity", unit, "imageUrl", "lastMove", metadata, "createdAt", "updatedAt"
)
values
  ('inv-cartao-couche', 'graphflow-main', 'prd-cartao-couche', 'Papel Couche 300g', 'Papel', 12000, 800, 11200, 2000, 'folhas', 'https://images.unsplash.com/photo-1586075010923-2dd4570fb338?auto=format&fit=crop&w=480&q=80', 'hoje', '{}'::jsonb, now(), now()),
  ('inv-folder-couche', 'graphflow-main', 'prd-folder-a4', 'Papel Couche 150g', 'Papel', 6500, 450, 6050, 1500, 'folhas', 'https://images.unsplash.com/photo-1603484477859-abe6a73f9366?auto=format&fit=crop&w=480&q=80', 'ontem', '{}'::jsonb, now(), now()),
  ('inv-lona-440', 'graphflow-main', 'prd-banner-lona', 'Lona 440g', 'Lonas', 340, 16, 324, 40, 'm2', 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=480&q=80', '2 dias', '{}'::jsonb, now(), now()),
  ('inv-vinil-branco', 'graphflow-main', 'prd-adesivo-redondo', 'Vinil Branco', 'Vinil', 9200, 600, 8600, 1200, 'folhas', 'https://images.unsplash.com/photo-1517971071642-34a2d3ecc9cd?auto=format&fit=crop&w=480&q=80', 'hoje', '{}'::jsonb, now(), now())
on conflict (id) do update
set quantity = excluded.quantity,
    "reservedQuantity" = excluded."reservedQuantity",
    "availableQuantity" = excluded."availableQuantity",
    "minQuantity" = excluded."minQuantity",
    "imageUrl" = excluded."imageUrl",
    "lastMove" = excluded."lastMove",
    "updatedAt" = now();

insert into public.machines (
  id, "tenantId", "sectorId", name, model, "serialNumber", status, "capacityPerHour",
  "nextMaintenanceAt", "lastMaintenanceAt", "totalUsageMinutes", "costMonth", description, metadata,
  "createdAt", "updatedAt"
)
values
  ('maq-hp-indigo', 'graphflow-main', 'sec-impressao', 'HP Indigo 7900', 'Indigo 7900', 'HP-7900-22', 'OPERATIONAL', 480, now() + interval '18 days', now() - interval '40 days', 15600, 18450.00, 'Impressora digital principal para pequenas e medias tiragens.', '{"fabricante":"HP"}'::jsonb, now(), now()),
  ('maq-uv-roll', 'graphflow-main', 'sec-impressao', 'Roland UV VersaUV', 'VersaUV LEC2', 'RL-UV-18', 'MAINTENANCE', 95, now() + interval '4 days', now() - interval '67 days', 9300, 9600.00, 'Equipamento UV para adesivos e materiais rigidos.', '{"fabricante":"Roland"}'::jsonb, now(), now()),
  ('maq-guilhotina', 'graphflow-main', 'sec-acabamento', 'Guilhotina Polar 92', 'Polar 92', 'PL-92-12', 'OPERATIONAL', 900, now() + interval '26 days', now() - interval '21 days', 7400, 5200.00, 'Corte e refilo de papelaria.', '{"fabricante":"Polar"}'::jsonb, now(), now())
on conflict (id) do update
set "sectorId" = excluded."sectorId",
    name = excluded.name,
    model = excluded.model,
    "serialNumber" = excluded."serialNumber",
    status = excluded.status,
    "capacityPerHour" = excluded."capacityPerHour",
    "nextMaintenanceAt" = excluded."nextMaintenanceAt",
    "lastMaintenanceAt" = excluded."lastMaintenanceAt",
    "totalUsageMinutes" = excluded."totalUsageMinutes",
    "costMonth" = excluded."costMonth",
    description = excluded.description,
    metadata = excluded.metadata,
    "updatedAt" = now();

insert into public.orders (
  id, "tenantId", "customerId", "userId", number, status, "paymentStatus", "productionStatus",
  subtotal, "discountAmount", "taxAmount", "shippingAmount", total, "paidAmount", "remainingAmount",
  notes, "internalNotes", "expectedDeliveryAt", metadata, "createdAt", "updatedAt"
)
values
  ('ord-1245', 'graphflow-main', 'cus-agencia-pixel', 'usr-carla', 'PED-1245', 'IN_PRODUCTION', 'PARTIAL', 'IN_PROGRESS', 1086.75, 0, 51.75, 0, 1086.75, 543.37, 543.38, 'Produzir com prova digital aprovada.', 'Prioridade para campanha de junho.', now() + interval '7 days', '{"origem":"orcamento"}'::jsonb, now() - interval '2 days', now()),
  ('ord-1246', 'graphflow-main', 'cus-cafe-aurora', 'usr-carla', 'PED-1246', 'CONFIRMED', 'PENDING', 'IN_QUEUE', 720.00, 0, 0, 0, 720.00, 0, 720.00, 'Cardapios e etiquetas promocionais.', 'Aguardar confirmacao final de layout.', now() + interval '10 days', '{}'::jsonb, now() - interval '1 day', now())
on conflict (id) do update
set status = excluded.status,
    "paymentStatus" = excluded."paymentStatus",
    "productionStatus" = excluded."productionStatus",
    subtotal = excluded.subtotal,
    total = excluded.total,
    "paidAmount" = excluded."paidAmount",
    "remainingAmount" = excluded."remainingAmount",
    notes = excluded.notes,
    "internalNotes" = excluded."internalNotes",
    "expectedDeliveryAt" = excluded."expectedDeliveryAt",
    metadata = excluded.metadata,
    "updatedAt" = now();

insert into public.order_items (
  id, "tenantId", "orderId", "productId", description, quantity, "unitPrice", discount, total,
  status, position, priority, "dueDate", "assignedUserId", "sectorId", "machineId", "startedAt",
  metadata, "createdAt", "updatedAt"
)
values
  ('itm-1245-folder', 'graphflow-main', 'ord-1245', 'prd-folder-a4', 'Folder A4 Couche 150g', 500, 1.20, 0, 600.00, 'IN_PROGRESS', 0, 'HIGH', now() + interval '7 days', 'usr-carla', 'sec-impressao', 'maq-hp-indigo', now() - interval '8 hours', '{"cliente":"Agencia Pixel"}'::jsonb, now() - interval '2 days', now()),
  ('itm-1245-cartao', 'graphflow-main', 'ord-1245', 'prd-cartao-couche', 'Cartao de Visita Couche 300g', 1000, 0.35, 0, 350.00, 'QUEUED', 1, 'NORMAL', now() + interval '8 days', 'usr-carla', 'sec-acabamento', 'maq-guilhotina', null, '{"cliente":"Agencia Pixel"}'::jsonb, now() - interval '2 days', now()),
  ('itm-1245-banner', 'graphflow-main', 'ord-1245', 'prd-banner-lona', 'Banner 80x120cm', 1, 85.00, 0, 85.00, 'PENDING', 2, 'NORMAL', now() + interval '7 days', 'usr-carla', 'sec-arte-final', null, null, '{"cliente":"Agencia Pixel"}'::jsonb, now() - interval '2 days', now()),
  ('itm-1246-adesivo', 'graphflow-main', 'ord-1246', 'prd-adesivo-redondo', 'Adesivo Redondo', 600, 0.55, 0, 330.00, 'PICKING', 0, 'NORMAL', now() + interval '10 days', 'usr-carla', 'sec-arte-final', null, null, '{"cliente":"Cafe Aurora"}'::jsonb, now() - interval '1 day', now())
on conflict (id) do update
set status = excluded.status,
    position = excluded.position,
    priority = excluded.priority,
    "dueDate" = excluded."dueDate",
    "assignedUserId" = excluded."assignedUserId",
    "sectorId" = excluded."sectorId",
    "machineId" = excluded."machineId",
    "startedAt" = excluded."startedAt",
    metadata = excluded.metadata,
    "updatedAt" = now();

insert into public.machine_usage_logs (id, "tenantId", "machineId", "userId", "orderItemId", "startTime", "endTime", duration, notes, "createdAt")
values
  ('use-hp-indigo-1', 'graphflow-main', 'maq-hp-indigo', 'usr-carla', 'itm-1245-folder', now() - interval '8 hours', null, null, 'Pedido PED-1245 em producao.', now() - interval '8 hours'),
  ('use-guilhotina-1', 'graphflow-main', 'maq-guilhotina', 'usr-carla', 'itm-1245-cartao', now() - interval '3 days', now() - interval '3 days' + interval '210 minutes', 210, 'Refilo inicial.', now() - interval '3 days')
on conflict (id) do nothing;

insert into public.maintenance_tickets (
  id, "tenantId", "machineId", "openedByUserId", priority, status, title, description, "openedAt", metadata,
  "createdAt", "updatedAt"
)
values
  ('mnt-uv-001', 'graphflow-main', 'maq-uv-roll', 'usr-carla', 'HIGH', 'OPEN', 'Revisar cabeca UV', 'Falhas intermitentes de cura em materiais rigidos.', now() - interval '6 hours', '{"origem":"painel"}'::jsonb, now() - interval '6 hours', now())
on conflict (id) do update
set priority = excluded.priority,
    status = excluded.status,
    title = excluded.title,
    description = excluded.description,
    metadata = excluded.metadata,
    "updatedAt" = now();

insert into public.quotes (
  id, "tenantId", "customerId", "userId", number, status, "validUntil", notes, "internalNotes",
  subtotal, "discountAmount", "taxAmount", total, metadata, "createdAt", "updatedAt"
)
values
  ('quo-1001', 'graphflow-main', 'cus-agencia-pixel', 'dev-admin', 'ORC-1001', 'SENT', now() + interval '10 days', 'Pagamento 50% entrada + 50% entrega.', 'Cliente solicitou link publico para aprovacao.', 1035.00, 0, 51.75, 1086.75, '{"publicLink":"pendente"}'::jsonb, now() - interval '3 days', now())
on conflict (id) do update
set status = excluded.status,
    "validUntil" = excluded."validUntil",
    notes = excluded.notes,
    "internalNotes" = excluded."internalNotes",
    subtotal = excluded.subtotal,
    "taxAmount" = excluded."taxAmount",
    total = excluded.total,
    metadata = excluded.metadata,
    "updatedAt" = now();

insert into public.quote_items (
  id, "tenantId", "quoteId", "productId", description, quantity, "unitPrice", discount, total, notes, "createdAt", "updatedAt"
)
values
  ('qit-1001-folder', 'graphflow-main', 'quo-1001', 'prd-folder-a4', 'Folder A4 Couche 150g', 500, 1.20, 0, 600.00, '1 dobra, 4x4 cores', now() - interval '3 days', now()),
  ('qit-1001-cartao', 'graphflow-main', 'quo-1001', 'prd-cartao-couche', 'Cartao de Visita Couche 300g', 1000, 0.35, 0, 350.00, 'Verniz total', now() - interval '3 days', now()),
  ('qit-1001-banner', 'graphflow-main', 'quo-1001', 'prd-banner-lona', 'Banner 80x120cm', 1, 85.00, 0, 85.00, 'Lona 440g', now() - interval '3 days', now())
on conflict (id) do update
set quantity = excluded.quantity,
    "unitPrice" = excluded."unitPrice",
    total = excluded.total,
    notes = excluded.notes,
    "updatedAt" = now();

insert into public.financial_transactions (id, "tenantId", "orderId", "quoteId", label, type, value, due, status, metadata, "createdAt", "updatedAt")
values
  ('fin-receber-1245', 'graphflow-main', 'ord-1245', 'quo-1001', 'Pedido PED-1245 - saldo', 'receivable', 543.38, '7 dias', 'Pendente', '{"cliente":"Agencia Pixel"}'::jsonb, now(), now()),
  ('fin-pagar-insumos', 'graphflow-main', null, null, 'Compra de insumos Graficos', 'payable', 15210.00, '15/06/2026', 'Pendente', '{"fornecedor":"Distribuidora Paper"}'::jsonb, now(), now()),
  ('fin-caixa-hoje', 'graphflow-main', null, null, 'Fluxo de Caixa Hoje', 'cash', 3250.00, 'Hoje', 'Recebido', '{}'::jsonb, now(), now())
on conflict (id) do update
set label = excluded.label,
    type = excluded.type,
    value = excluded.value,
    due = excluded.due,
    status = excluded.status,
    metadata = excluded.metadata,
    "updatedAt" = now();

insert into public.files (id, "tenantId", name, type, size, "linkedTo", url, metadata, "createdAt", "updatedAt")
values
  ('fil-arte-folder', 'graphflow-main', 'Arte final folder Agencia Pixel.pdf', 'PDF', '4.8 MB', 'PED-1245', 'https://example.com/arquivos/arte-folder.pdf', '{"categoria":"arte"}'::jsonb, now() - interval '1 day', now()),
  ('fil-briefing-cafe', 'graphflow-main', 'Briefing Cafe Aurora.docx', 'DOCX', '820 KB', 'Cliente Cafe Aurora', 'https://example.com/arquivos/briefing-cafe.docx', '{"categoria":"briefing"}'::jsonb, now() - interval '2 days', now())
on conflict (id) do update
set name = excluded.name,
    type = excluded.type,
    size = excluded.size,
    "linkedTo" = excluded."linkedTo",
    url = excluded.url,
    metadata = excluded.metadata,
    "updatedAt" = now();

insert into public.notifications (id, "tenantId", title, message, tone, read, metadata, "createdAt")
values
  ('not-estoque-baixo', 'graphflow-main', 'Estoque baixo', 'O item Lona 440g esta perto do minimo configurado.', 'warning', false, '{"inventoryId":"inv-lona-440"}'::jsonb, now() - interval '10 minutes'),
  ('not-manutencao', 'graphflow-main', 'Manutencao necessaria', 'Roland UV VersaUV tem chamado aberto de alta prioridade.', 'danger', false, '{"machineId":"maq-uv-roll"}'::jsonb, now() - interval '1 hour'),
  ('not-orcamento', 'graphflow-main', 'Orcamento enviado', 'ORC-1001 foi enviado para Agencia Pixel.', 'success', true, '{"quoteId":"quo-1001"}'::jsonb, now() - interval '3 hours')
on conflict (id) do update
set title = excluded.title,
    message = excluded.message,
    tone = excluded.tone,
    read = excluded.read,
    metadata = excluded.metadata,
    "createdAt" = excluded."createdAt";

notify pgrst, 'reload schema';
