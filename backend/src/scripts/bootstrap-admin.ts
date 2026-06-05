import { loadEnv } from "../config/env.js";
import { AuthService } from "../modules/auth/auth.service.js";
import { createSupabaseServiceClient } from "../shared/supabase/client.js";

const env = loadEnv();
const supabase = createSupabaseServiceClient(env);
const auth = new AuthService(env, supabase);

const result = await auth.bootstrapAdmin({
  email: "admin@email.com",
  password: "123456",
  name: "Administrador GraphFlow",
  companyName: "GraficFlow",
  tenantId: "graphflow-main",
  temporaryPassword: true,
});

console.log(
  JSON.stringify(
    {
      ok: true,
      ...result,
      email: "admin@email.com",
      temporaryPassword: true,
      nextStep: "Entrar no Keycloak e trocar a senha temporaria no primeiro acesso.",
    },
    null,
    2,
  ),
);
