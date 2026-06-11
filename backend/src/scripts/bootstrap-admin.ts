import { loadEnv } from "../config/env.js";
import { AuthService } from "../modules/auth/auth.service.js";
import { createSupabaseServiceClient } from "../shared/supabase/client.js";

const env = loadEnv();
const supabase = createSupabaseServiceClient(env);
const auth = new AuthService(env, supabase);
const adminEmail = env.DEV_ADMIN_EMAIL;
const adminPassword = env.DEV_ADMIN_PASSWORD;

if (!adminPassword) {
  throw new Error("Defina DEV_ADMIN_PASSWORD para criar ou sincronizar o administrador inicial.");
}

const result = await auth.bootstrapAdmin({
  email: adminEmail,
  password: adminPassword,
  name: "Administrador GraphFlow",
  companyName: "GraficFlow",
  tenantId: "graphflow-main",
  temporaryPassword: false,
});

console.log(
  JSON.stringify(
    {
      ok: true,
      ...result,
      email: adminEmail,
      temporaryPassword: false,
      nextStep: "Entrar no GraficFlow com o e-mail e a senha configurados em DEV_ADMIN_PASSWORD.",
    },
    null,
    2,
  ),
);
