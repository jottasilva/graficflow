"use client";

import { graphflowApi } from "@/lib/graphflow-api";
import { ArrowUpRight, Check, Eye, EyeOff, LockKeyhole, Mail, Send, UserPlus } from "lucide-react";
import Image from "next/image";
import { useState, type FormEvent } from "react";

const GRAPHFLOW_LOGO_SRC = "/assets/d2513524-f181-4a63-9fff-94a95de5aacf.png";

type AuthMode = "login" | "signup" | "recover";

export function AuthPage({
  initialMode = "login",
  onSubmit,
}: {
  initialMode?: AuthMode;
  onSubmit?: () => void | Promise<void>;
}) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: "error" | "success"; message: string } | null>(null);

  const isSignup = mode === "signup";
  const isRecover = mode === "recover";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    if (!graphflowApi.enabled()) {
      setFeedback({ tone: "error", message: "API do GraphFlow nao configurada." });
      return;
    }

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");

    try {
      setLoading(true);

      if (isRecover) {
        await graphflowApi.recoverPassword(email);
        setFeedback({ tone: "success", message: "Se o e-mail existir, enviaremos o link de recuperacao." });
        return;
      }

      if (isSignup) {
        await graphflowApi.register({
          name: String(form.get("name") ?? ""),
          companyName: String(form.get("company") ?? ""),
          email,
          password,
          passwordConfirmation: String(form.get("password-confirmation") ?? ""),
        });
      }

      await graphflowApi.login({ email, password, remember });

      if (onSubmit) {
        await onSubmit();
        return;
      }

      if (typeof window !== "undefined") {
        window.location.href = "/painel";
      }
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "Nao foi possivel autenticar.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-screen">
      <section className={`auth-card ${isSignup ? "is-signup" : ""}`} aria-label="Acesso ao GraphFlow">
        <aside className="auth-visual">
          <div className="auth-visual-content">
            <Image
              src={GRAPHFLOW_LOGO_SRC}
              alt="GraficFlow"
              width={430}
              height={246}
              className="auth-visual-logo"
              style={{ width: "min(360px, 100%)", height: 240, objectFit: "contain" }}
              priority
            />
            <p>
              Gestao inteligente para graficas que querem <strong>crescer.</strong>
            </p>
          </div>
          <div className="auth-wave" aria-hidden="true" />
        </aside>

        <form className={`auth-panel ${isSignup ? "is-signup" : ""}`} onSubmit={handleSubmit}>
          <div className="auth-copy">
            <div className="auth-mode-switch" role="tablist" aria-label="Acesso e cadastro">
              <button
                aria-selected={mode === "login"}
                className={mode === "login" ? "active" : ""}
                role="tab"
                type="button"
                onClick={() => {
                  setMode("login");
                  setFeedback(null);
                }}
              >
                Login
              </button>
              <button
                aria-selected={mode === "signup"}
                className={mode === "signup" ? "active" : ""}
                role="tab"
                type="button"
                onClick={() => {
                  setMode("signup");
                  setFeedback(null);
                }}
              >
                Cadastro
              </button>
            </div>

            <h1>{isRecover ? "Recuperar senha" : isSignup ? "Criar sua conta" : "Bem-vindo de volta!"}</h1>
            <p>
              {isRecover
                ? "Informe seu e-mail para receber o link de recuperacao."
                : isSignup
                  ? "Cadastre sua grafica para organizar pedidos, producao e financeiro."
                  : "Faca login para acessar sua conta."}
            </p>
          </div>

          {isSignup ? (
            <label className="auth-field">
              Nome
              <span className="auth-input">
                <UserPlus size={20} />
                <input name="name" placeholder="Seu nome" required type="text" />
              </span>
            </label>
          ) : null}

          {isSignup ? (
            <label className="auth-field">
              Empresa
              <span className="auth-input">
                <ArrowUpRight size={20} />
                <input name="company" placeholder="Nome da grafica" required type="text" />
              </span>
            </label>
          ) : null}

          <label className="auth-field">
            E-mail
            <span className="auth-input">
              <Mail size={20} />
              <input name="email" placeholder="seu@email.com" required type="email" />
            </span>
          </label>

          {!isRecover ? (
            <label className="auth-field">
              Senha
              <span className="auth-input">
                <LockKeyhole size={20} />
                <input
                  minLength={isSignup ? 8 : undefined}
                  name="password"
                  placeholder="••••••••"
                  required
                  type={showPassword ? "text" : "password"}
                />
                <button
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  className="auth-eye"
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </span>
            </label>
          ) : null}

          {isSignup ? (
            <label className="auth-field">
              Confirmar senha
              <span className="auth-input">
                <LockKeyhole size={20} />
                <input minLength={8} name="password-confirmation" placeholder="••••••••" required type="password" />
              </span>
            </label>
          ) : null}

          {!isRecover ? (
            <div className="auth-options">
              <button
                aria-pressed={remember}
                className={`auth-check ${remember ? "active" : ""}`}
                type="button"
                onClick={() => setRemember((current) => !current)}
              >
                <span>{remember ? <Check size={15} /> : null}</span>
                Lembrar de mim
              </button>
              <button
                className="auth-link"
                type="button"
                onClick={() => {
                  setMode("recover");
                  setFeedback(null);
                }}
              >
                Esqueci minha senha
              </button>
            </div>
          ) : null}

          {feedback ? <p className={`auth-feedback ${feedback.tone}`}>{feedback.message}</p> : null}

          <button className="auth-submit" type="submit" disabled={loading}>
            {isRecover ? <Send size={20} /> : <ArrowUpRight size={20} />}
            {loading ? "Aguarde" : isRecover ? "Enviar link" : isSignup ? "Criar conta" : "Entrar"}
          </button>

          <p className="auth-footer-text">
            {isRecover ? (
              <>
                Lembrou sua senha?{" "}
                <button type="button" onClick={() => setMode("login")}>
                  Voltar ao login
                </button>
              </>
            ) : isSignup ? (
              <>
                Ja tem uma conta?{" "}
                <button type="button" onClick={() => setMode("login")}>
                  Entrar
                </button>
              </>
            ) : (
              <>
                Ainda nao tem uma conta?{" "}
                <button type="button" onClick={() => setMode("signup")}>
                  Criar conta
                </button>
              </>
            )}
          </p>
        </form>
      </section>
    </main>
  );
}
