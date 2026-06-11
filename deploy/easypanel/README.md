# Deploy do GraphFlow no EasyPanel

Este projeto deve rodar em dois serviços web:

- `graphflow-backend`: API Fastify, porta interna `8080`.
- `graphflow-frontend`: Next.js standalone, porta interna `3000`.

O fluxo recomendado no EasyPanel é criar dois **App Services** separados, cada um usando seu Dockerfile. O `compose.easypanel.yml` fica como alternativa para quem prefere **Compose Service**.

## 1. Antes do deploy

1. Crie ou escolha um projeto Supabase de produção.
2. Aplique, em ordem, as migrations em `frontend/backend/supabase/migrations`.
3. Confirme que as tabelas principais existem: `tenants`, `users`, `customers`, `products`, `orders`, `quotes`, `quote_public_tokens`.
4. Separe dois domínios ou subdomínios:
   - Frontend: `https://app.seudominio.com`
   - Backend/API: `https://api.seudominio.com`
5. Gere um segredo forte para `QUOTE_PUBLIC_TOKEN_PEPPER`, com pelo menos 32 caracteres.

## 2. Backend no EasyPanel

Crie um App Service:

- Name: `graphflow-backend`
- Source: GitHub ou Custom Git
- Root directory: `frontend/backend`
- Dockerfile: `Dockerfile`
- Proxy port: `8080`
- Domain: `api.seudominio.com`

Cole as variáveis de `deploy/easypanel/backend.env.example` e ajuste os valores reais.

Variáveis críticas:

- `APP_ORIGIN=https://app.seudominio.com`
- `PUBLIC_APP_URL=https://app.seudominio.com`
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_AUTH_CALLBACK_URL`
- `KEYCLOAK_*`
- `QUOTE_PUBLIC_TOKEN_PEPPER`
- `DEV_AUTH_BYPASS=false`

Observação sobre variáveis opcionais:

- Não deixe variável opcional vazia no EasyPanel.
- Se não for usar `AUTH_COOKIE_DOMAIN`, remova essa variável do serviço.
- Se usar subdomínios no mesmo domínio raiz, use algo como `.seudominio.com`.

Depois do deploy, valide:

```bash
curl https://api.seudominio.com/healthz
curl https://api.seudominio.com/readyz
```

## 3. Frontend no EasyPanel

Crie outro App Service:

- Name: `graphflow-frontend`
- Source: mesmo repositório
- Root directory: `frontend`
- Dockerfile: `Dockerfile`
- Proxy port: `3000`
- Domain: `app.seudominio.com`

Cole as variáveis de `deploy/easypanel/frontend.env.example` e ajuste:

```env
NEXT_PUBLIC_GRAPHFLOW_API_URL=https://api.seudominio.com
NEXT_PUBLIC_GRAPHFLOW_TENANT_ID=graphflow-main
```

Importante: `NEXT_PUBLIC_*` entra no bundle durante o build do Next.js. Se trocar a URL da API, faça novo deploy do frontend.

Depois do deploy, valide:

```bash
curl https://app.seudominio.com/login
```

## 4. Ordem correta de publicação

1. Publique o backend.
2. Teste `/healthz` e `/readyz`.
3. Publique o frontend com `NEXT_PUBLIC_GRAPHFLOW_API_URL` apontando para o domínio público do backend.
4. Acesse `/login`.
5. Faça login e teste:
   - Clientes
   - Produtos
   - Novo Pedido
   - Novo Orçamento
   - Link público de orçamento

## 5. Compose Service opcional

Se preferir Compose Service:

1. Copie `compose.easypanel.yml`.
2. Use as variáveis de `deploy/easypanel/compose.env.example`.
3. Configure os domínios no EasyPanel apontando para:
   - `graphflow-frontend`, porta `3000`
   - `graphflow-backend`, porta `8080`

O compose builda:

- `graphflow-backend` a partir de `./backend/Dockerfile`
- `graphflow-frontend` a partir de `./Dockerfile`

## 6. Arquivos preparados

- `Dockerfile`: build standalone do Next.js.
- `backend/Dockerfile`: build da API Fastify.
- `compose.easypanel.yml`: stack opcional para Compose Service.
- `deploy/easypanel/frontend.env.example`: env do frontend.
- `deploy/easypanel/backend.env.example`: env do backend.
- `deploy/easypanel/compose.env.example`: env unificado para compose.

## 7. Checklist de produção

- `DEV_AUTH_BYPASS=false`
- `NODE_ENV=production`
- `APP_ORIGIN` igual ao domínio público do frontend.
- `NEXT_PUBLIC_GRAPHFLOW_API_URL` igual ao domínio público do backend.
- Cookies seguros habilitados em HTTPS.
- Migrations aplicadas no Supabase.
- Storage do Supabase com permissões/buckets revisados.
- Domínios com SSL ativo no EasyPanel.
- Logs sem erro de validação de env.

## 8. Troubleshooting

Erro de CORS:

- Confira `APP_ORIGIN`.
- Use a URL do frontend sem barra final.

Frontend chama API errada:

- Ajuste `NEXT_PUBLIC_GRAPHFLOW_API_URL`.
- Faça novo deploy do frontend.

Backend cai ao iniciar:

- Revise variáveis obrigatórias.
- Não deixe variáveis opcionais com valor vazio.
- Veja logs do serviço no EasyPanel.

Login falha:

- Confirme `AUTH_LOGIN_PROVIDER`.
- Confirme as credenciais Keycloak/Supabase.
- Confirme callback URL no provedor de auth.

Link público de orçamento não abre:

- Confirme `PUBLIC_APP_URL`.
- Confirme `QUOTE_PUBLIC_TOKEN_PEPPER`; trocar esse valor invalida links antigos.
