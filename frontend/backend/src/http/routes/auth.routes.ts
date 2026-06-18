import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Env } from "../../config/env.js";
import { loginSchema, recoverPasswordSchema, registerSchema } from "../schemas.js";
import type { AuthProvider } from "../middleware/auth.js";
import type { AuthService } from "../../modules/auth/auth.service.js";
import { checkRateLimit } from "../../shared/utils/rate-limiter.js";

function cookieOptions(env: Env, maxAge?: number) {
  return {
    path: "/",
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: env.NODE_ENV === "production" ? ("none" as const) : ("lax" as const),
    domain: env.AUTH_COOKIE_DOMAIN,
    maxAge,
  };
}

export function registerAuthRoutes(
  app: FastifyInstance,
  env: Env,
  authProvider: AuthProvider,
  authService: AuthService,
) {
  app.post("/api/auth/login", async (request, reply) => {
    const ip = request.ip;
    const rateLimit = checkRateLimit(`login:${ip}`, { windowMs: 60_000, maxRequests: 10 });
    if (!rateLimit.allowed) {
      return reply.code(429).send({
        code: "RATE_LIMITED",
        message: "Muitas tentativas de login. Aguarde e tente novamente.",
      });
    }

    const input = loginSchema.parse(request.body);
    const tokens = await authService.login(input);
    const auth = await authProvider.verifyToken(tokens.access_token);
    const accessMaxAge = input.remember ? tokens.expires_in ?? 3600 : undefined;
    const refreshMaxAge = input.remember ? tokens.refresh_expires_in : undefined;

    reply.setCookie(env.AUTH_COOKIE_NAME, tokens.access_token, cookieOptions(env, accessMaxAge));
    if (tokens.refresh_token) {
      reply.setCookie(env.AUTH_REFRESH_COOKIE_NAME, tokens.refresh_token, cookieOptions(env, refreshMaxAge));
    }

    return {
      authenticated: true,
      expiresIn: tokens.expires_in ?? null,
      user: authService.profile(auth).user,
    };
  });

  app.post("/api/auth/logout", async (_request, reply) => {
    reply.clearCookie(env.AUTH_COOKIE_NAME, cookieOptions(env));
    reply.clearCookie(env.AUTH_REFRESH_COOKIE_NAME, cookieOptions(env));
    return { authenticated: false };
  });

  app.get("/api/auth/session", async (request) => {
    const auth = await authProvider.requireAuth(request);
    return authService.profile(auth);
  });

  app.post("/api/auth/register", async (request, reply) => {
    const ip = request.ip;
    const rateLimit = checkRateLimit(`register:${ip}`, { windowMs: 3600_000, maxRequests: 3 });
    if (!rateLimit.allowed) {
      return reply.code(429).send({
        code: "RATE_LIMITED",
        message: "Muitas tentativas de cadastro. Aguarde e tente novamente.",
      });
    }

    const input = registerSchema.parse(request.body);
    const user = await authService.register(input);
    return reply.code(201).send(user);
  });

  app.post("/api/auth/recover", async (request, reply) => {
    const ip = request.ip;
    const rateLimit = checkRateLimit(`recover:${ip}`, { windowMs: 3600_000, maxRequests: 5 });
    if (!rateLimit.allowed) {
      return reply.code(429).send({
        code: "RATE_LIMITED",
        message: "Muitas tentativas de recuperacao. Aguarde e tente novamente.",
      });
    }

    const input = recoverPasswordSchema.parse(request.body);
    return authService.recoverPassword(input);
  });
}
