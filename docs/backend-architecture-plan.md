# GraphFlow Backend Architecture Plan

## Contexto e Decisão Técnica

Este plano foi criado com base no texto anexado sobre arquitetura backend, nas telas já construídas do GraphFlow e na inspeção real do projeto Supabase via MCP.

O texto anexado é focado em Go, mas o requisito explícito de usar Zod torna TypeScript a escolha principal para a primeira versão do backend. A arquitetura preserva os princípios do guia: camadas isoladas, dependência apontando para dentro, configuração 12-factor, validação na borda, observabilidade, testes e migrações controladas.

Decisão recomendada:

- Backend/BFF em TypeScript com Fastify, Zod e Clean Architecture.
- Supabase como Postgres gerenciado, Auth, Storage e RLS.
- Keycloak como provedor OIDC conectado ao Supabase Auth.
- Service role somente em processos server-side e rotas internas estritamente necessárias.
- Frontend nunca recebe `service_role`, `secret key` ou `DATABASE_URL`.

## Descobertas via Supabase MCP

Projeto:

- Nome: `printai`
- Ref: `wlxuevhxnxyvvjtocnrc`
- Região: `sa-east-1`
- Status: ativo/saudável
- Postgres: 17.6
- Edge Functions: nenhuma função publicada

Schema existente:

- Já existem tabelas importantes: `users`, `companies`, `products`, `product_categories`, `inventories`, `inventory_movements`, `sectors`, `machines`, `machine_usage_logs`, `orders`, `order_items`, `order_item_logs`, `quotes`, `quote_items`, `payments`, `receivables`, `payables`, `audit_logs`.
- As estimativas de linhas retornaram zero para as tabelas públicas consultadas, então há espaço para consolidar sem migração de dados complexa.
- RLS está habilitado na maioria/todas as tabelas públicas consultadas, mas várias policies estão inconsistentes.

Riscos de segurança detectados pelos advisors:

- `public.debug_auth_users` expõe dados de `auth.users` e está no schema público.
- `public.dashboard_daily_metrics` e `public.debug_auth_users` foram apontadas como views `SECURITY DEFINER`.
- Funções públicas `SECURITY DEFINER` estão executáveis por `anon`/`authenticated`.
- Várias funções não definem `search_path`.
- Tabelas com RLS habilitado mas sem policies: `cart_items`, `carts`, `companies`, `data_subject_requests`, `financial_transactions`, `product_categories`, `suppliers`.
- Policy permissiva demais em `product_unit_conversions`.
- Bucket público `products` permite listagem ampla.
- Muitas FKs sem índice: `orders.userId`, `orders.shippingAddressId`, `orders.billingAddressId`, `order_items.orderId`, `order_items.machineId`, `quote_items.quoteId`, `quotes.userId`, `machines.sectorId`, entre outras.

## Arquitetura de Camadas

Fluxo:

```text
HTTP Handler -> Zod Validation -> Use Case -> Repository Interface -> Supabase/Postgres Adapter
```

Pastas propostas:

```text
backend/
  src/
    config/
      env.ts
    http/
      middleware/
        auth.ts
        tenant.ts
        rate-limit.ts
      schemas.ts
      routes.ts
    modules/
      auth/
      companies/
      users/
      products/
      inventory/
      sectors/
      machines/
      maintenance/
      orders/
      production/
      quotes/
      finance/
      files/
      reports/
      audit/
    shared/
      errors/
      observability/
      pagination/
      supabase/
    server.ts
```

## Módulos de Domínio

### Auth e IAM

Responsabilidades:

- Login via Keycloak usando Supabase Auth provider `keycloak`.
- Callback OAuth/PKCE.
- Sincronização de usuário Keycloak -> `public.users`.
- Mapeamento de roles em `public.users.role` e permissões em `permissions`.
- Nunca usar `user_metadata` para autorização; usar `app_metadata`, `public.users` e RLS.

### Empresas/Tenants

Responsabilidades:

- Cadastro de empresa gráfica.
- Configurações fiscais, marca, canais, LGPD.
- Tenant isolation padrão por `tenantId` ou `company_id`, mas não misturar ambos sem uma camada de compatibilidade.

Problema atual:

- Algumas tabelas usam `tenantId`, outras `tenant_id`, outras `company_id`, e algumas policies dependem de claims JWT diferentes.

Plano:

- Eleger `tenantId` como contrato de domínio do GraphFlow.
- Criar camada de compatibilidade para tabelas novas/legadas.
- Consolidar policies para um único modelo de tenant.

### Produtos/Catálogo

Tabelas base:

- `products`
- `product_categories`
- `product_media`
- `product_price_tiers`
- `product_finishes`
- `product_bom_items`
- `product_unit_conversions`

Regras:

- Produto com preço de venda, custo, estoque, imagens e regras de fracionamento.
- Cadastro validado por Zod antes de persistir.
- Imagens em Supabase Storage, bucket com policy restrita.

### Estoque

Tabelas base:

- `inventories`
- `inventory_movements`

Regras:

- Nunca atualizar estoque sem criar movimento.
- Separar `quantity`, `reservedQuantity`, `availableQuantity`.
- Reserva ao aprovar orçamento/pedido.
- Baixa ao avançar produção/expedição conforme regra configurável.

### Pedidos e Produção

Tabelas base:

- `orders`
- `order_items`
- `order_item_logs`
- `sectors`
- `machines`
- `machine_usage_logs`

Regras:

- Pedido contém itens.
- Item de pedido é a unidade produtiva no Kanban.
- Cada item pode ter `sectorId`, `machineId`, `assignedUserId`, prioridade, prazo e logs.
- Movimentação no Kanban cria `order_item_logs`.
- Horas de máquina vêm de `machine_usage_logs.startTime/endTime` e vínculo com `orderItemId`.

### Máquinas e Manutenção

Adicionar tabela recomendada:

```sql
maintenance_tickets (
  id text primary key,
  tenantId text not null,
  machineId text not null references machines(id),
  openedByUserId text not null references users(id),
  assignedUserId text null references users(id),
  priority text not null,
  status text not null,
  title text not null,
  description text not null,
  openedAt timestamp not null,
  closedAt timestamp null,
  metadata jsonb
)
```

Regras:

- Abrir chamado muda máquina para status de manutenção se configurado.
- Fechar chamado registra downtime e agenda próxima manutenção.
- Métricas mensais por máquina vêm de uso real, chamados e custo informado.

### Orçamentos

Tabelas base:

- `quotes`
- `quote_items`

Adicionar tabela recomendada:

```sql
quote_public_tokens (
  id text primary key,
  tenantId text not null,
  quoteId text not null references quotes(id),
  tokenHash text not null unique,
  expiresAt timestamp not null,
  acceptedAt timestamp null,
  revokedAt timestamp null,
  createdAt timestamp not null
)
```

Regras:

- Orçamento nasce como `draft`.
- Ao enviar, gerar PDF e token público.
- Token bruto aparece só no link, nunca no banco.
- Banco armazena hash do token com pepper do `.env`.
- Link público permite visualizar e aceitar.
- Aceite atualiza `quotes.status = accepted`, grava `acceptedAt`, opcionalmente cria `orders` e `receivables`.

PDF:

- Gerar no backend com PDFKit ou template HTML renderizado server-side.
- Salvar em bucket privado `quote-pdfs`.
- Retornar signed URL com expiração curta.

### Financeiro

Tabelas base:

- `payments`
- `receivables`
- `payables`
- `cash_flows`
- `ledger_accounts`
- `ledger_entries`

Regras:

- Aceite de orçamento pode criar recebíveis.
- Pagamento baixa recebível e gera lançamento contábil.
- Despesa gera `payables` e `cash_flows`.

### Auditoria e LGPD

Tabelas base:

- `audit_logs`
- `data_subject_requests`

Regras:

- Toda criação/edição/exclusão de entidade crítica gera audit log.
- Não armazenar tokens ou chaves em logs.
- Rastrear `traceId`, IP e user-agent.

## API HTTP Proposta

Auth:

- `GET /auth/keycloak/login`
- `GET /auth/callback`
- `POST /auth/logout`
- `GET /auth/me`

Produtos:

- `GET /products`
- `POST /products`
- `PATCH /products/:id`
- `DELETE /products/:id`

Estoque:

- `GET /inventory`
- `POST /inventory/movements`
- `GET /inventory/movements`

Setores/Máquinas:

- `GET /sectors`
- `POST /sectors`
- `PATCH /sectors/:id`
- `DELETE /sectors/:id`
- `GET /machines`
- `POST /machines`
- `PATCH /machines/:id`
- `DELETE /machines/:id`
- `POST /maintenance-tickets`
- `PATCH /maintenance-tickets/:id/close`

Pedidos:

- `GET /orders`
- `POST /orders`
- `GET /orders/:id`
- `PATCH /orders/:id`
- `POST /order-items/:id/move`
- `POST /order-items/:id/start-machine`
- `POST /order-items/:id/stop-machine`

Orçamentos:

- `GET /quotes`
- `POST /quotes`
- `GET /quotes/:id`
- `PATCH /quotes/:id`
- `POST /quotes/:id/send`
- `POST /quotes/:id/pdf`
- `POST /quotes/:id/public-link`
- `GET /public/quotes/:quoteId?token=...`
- `POST /public/quotes/:quoteId/accept`

Financeiro:

- `GET /finance/summary`
- `GET /receivables`
- `POST /receivables`
- `GET /payables`
- `POST /payables`
- `POST /payments`

## Validação com Zod

Todos os endpoints de criação/registro devem seguir este padrão:

```text
request.body -> zod schema -> use case input tipado -> repository
```

Schemas iniciais foram criados em `backend/src/http/schemas.ts` para:

- clientes
- produtos
- movimentações de estoque
- setores
- máquinas
- chamados de manutenção
- pedidos
- orçamentos
- aceite público de orçamento

## Segurança e Supabase

Medidas imediatas:

1. Rotacionar as chaves expostas no chat antes de produção.
2. Remover ou restringir `public.debug_auth_users`.
3. Recriar views públicas com `security_invoker = true` quando necessário.
4. Mover funções privilegiadas para schema privado ou revogar `EXECUTE` de `anon`/`authenticated`.
5. Definir `search_path` em funções.
6. Revisar policies duplicadas/permissivas.
7. Criar índices para FKs sem índice.
8. Remover listagem ampla do bucket público `products`.
9. Ativar leaked password protection no Supabase Auth.

RLS:

- Todas as tabelas expostas em `public` devem manter RLS habilitado.
- Policies devem usar `auth.uid()` ligado a `public.users`, ou claims de `app_metadata`; não usar claims editáveis por usuário.
- `service_role` só no backend e em jobs internos.

## Variáveis de Ambiente

Criado `backend/.env.example`.

Regras:

- Frontend: somente `NEXT_PUBLIC_SUPABASE_URL` e chave publishable.
- Backend: `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_SECRET_KEY`, `DATABASE_URL`, Keycloak secret, pepper de tokens públicos.
- Nunca commitar `.env`, `.env.local` ou chaves reais.
- Preferir secret manager no deploy.

## Keycloak

Fluxo recomendado:

1. Criar realm `graphflow`.
2. Criar client OIDC confidencial.
3. Redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`.
4. Configurar provider Keycloak no Supabase Auth.
5. Usar scope `openid`.
6. Frontend chama Supabase `signInWithOAuth({ provider: "keycloak", options: { scopes: "openid" } })`.
7. Backend valida token Supabase e resolve perfil/tenant em `public.users`.

## Plano de Entrega

Fase 0 - Segurança antes de produção:

- Rotacionar chaves.
- Corrigir advisors críticos.
- Travar buckets e funções públicas.

Fase 1 - Backend base:

- Instalar dependências do `backend`.
- Implementar config/env com Zod.
- Implementar middleware de auth, tenant, rate limit e erros padronizados.
- Implementar clients Supabase server-side.

Fase 2 - Domínio principal:

- Produtos, clientes, estoque, setores, máquinas.
- Pedidos com itens e Kanban.
- Logs de movimentação e uso de máquina.

Fase 3 - Orçamentos:

- CRUD de orçamento.
- PDF.
- Link público com token hash.
- Aceite e conversão para pedido/recebível.

Fase 4 - Financeiro e relatórios:

- Recebíveis, contas a pagar, caixa.
- Views `security_invoker` para dashboards.
- Exports CSV/PDF.

Fase 5 - Observabilidade e qualidade:

- Logs estruturados.
- Trace ID por request.
- Testes unitários e integração.
- CI com `npm run check`, testes e Supabase advisors.

## Fontes Oficiais Consultadas

- Supabase Keycloak Auth: https://supabase.com/docs/guides/auth/social-login/auth-keycloak
- Supabase MCP: https://supabase.com/mcp
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase API security: https://supabase.com/docs/guides/api/securing-your-api
