"use client";

import { graphflowApi } from "@/lib/graphflow-api";
import {
  ArrowUpRight,
  Check,
  Clock3,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  Send,
  ShieldCheck,
  TrendingUp,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import { useState, type FormEvent } from "react";

const GRAPHFLOW_MARK_SRC = "/assets/graphflow-login-logo.png";

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
      setFeedback({ tone: "error", message: "API do GraphFlow não configurada." });
      return;
    }

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");

    try {
      setLoading(true);

      if (isRecover) {
        await graphflowApi.recoverPassword(email);
        setFeedback({ tone: "success", message: "Se o e-mail existir, enviaremos o link de recuperação." });
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
        message: error instanceof Error ? error.message : "Não foi possível autenticar.",
      });
    } finally {
      setLoading(false);
    }
  }

  function openMode(nextMode: AuthMode) {
    setMode(nextMode);
    setFeedback(null);
  }

  return (
    <main className="login-screen">
      <section className={`auth-card ${isSignup ? "is-signup" : ""}`} aria-label="Acesso ao GraphFlow">
        <aside className="auth-visual">
          <div className="auth-visual-content">
            <div className="auth-visual-logo-wrap">
              <Image
                src={GRAPHFLOW_MARK_SRC}
                alt="GraficFlow"
                width={944}
                height={622}
                className="auth-visual-logo"
                priority
              />
            </div>

            <div className="auth-visual-copy">
              <h2>
                Gestão inteligente
                <br />
                para gráficas que
                <br />
                querem <strong>crescer.</strong>
              </h2>
              <p>Organize pedidos, clientes, produção e estoque em um só lugar.</p>
            </div>

            <div className="auth-benefits" aria-label="Benefícios do GraphFlow">
              <AuthBenefit icon={TrendingUp} title="Mais controle" text="Tenha visão completa do seu negócio" tone="purple" />
              <AuthBenefit icon={Clock3} title="Mais agilidade" text="Automatize processos e ganhe tempo" tone="blue" />
              <AuthBenefit icon={ShieldCheck} title="Mais segurança" text="Seus dados protegidos com tecnologia avançada" tone="green" />
            </div>
          </div>
          <div className="auth-wave" aria-hidden="true" />
        </aside>

        <form className={`auth-panel ${isSignup ? "is-signup" : ""}`} onSubmit={handleSubmit}>
          <div className="auth-copy">
            <span className="auth-secure-badge">
              <ShieldCheck size={17} />
              Acesso seguro
            </span>

            <h1>{isRecover ? "Recuperar senha" : isSignup ? "Criar sua conta" : "Bem-vindo de volta! 👋"}</h1>
            <p>
              {isRecover
                ? "Informe seu e-mail para receber o link de recuperação."
                : isSignup
                  ? "Cadastre sua gráfica para organizar pedidos, produção e financeiro."
                  : "Faça login para acessar sua conta e continuar gerenciando seu negócio."}
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
                <input name="company" placeholder="Nome da gráfica" required type="text" />
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
              <button className="auth-link" type="button" onClick={() => openMode("recover")}>
                Esqueci minha senha
              </button>
            </div>
          ) : null}

          {feedback ? <p className={`auth-feedback ${feedback.tone}`}>{feedback.message}</p> : null}

          <button className="auth-submit" type="submit" disabled={loading}>
            {isRecover ? <Send size={20} /> : <ArrowUpRight size={20} />}
            {loading ? "Aguarde" : isRecover ? "Enviar link" : isSignup ? "Criar conta" : "Entrar"}
          </button>

          {!isRecover && !isSignup ? (
            <>
              <div className="auth-divider" aria-hidden="true">
                <span />
                <em>ou</em>
                <span />
              </div>
              <button
                className="auth-social-button"
                type="button"
                onClick={() =>
                  setFeedback({
                    tone: "error",
                    message: "Login com Google ainda não foi configurado no provedor de autenticação.",
                  })
                }
              >
                <span className="auth-google-mark" aria-hidden="true">G</span>
                Entrar com Google
              </button>
            </>
          ) : null}

          <p className="auth-footer-text">
            {isRecover ? (
              <>
                Lembrou sua senha?{" "}
                <button type="button" onClick={() => openMode("login")}>
                  Voltar ao login
                </button>
              </>
            ) : isSignup ? (
              <>
                Já tem uma conta?{" "}
                <button type="button" onClick={() => openMode("login")}>
                  Entrar
                </button>
              </>
            ) : (
              <>
                Ainda não tem uma conta?{" "}
                <button type="button" onClick={() => openMode("signup")}>
                  Criar conta
                </button>
                <ArrowUpRight size={16} aria-hidden="true" />
              </>
            )}
          </p>
        </form>
      </section>
    </main>
  );
}

function AuthBenefit({
  icon: Icon,
  title,
  text,
  tone,
}: {
  icon: LucideIcon;
  title: string;
  text: string;
  tone: "purple" | "blue" | "green";
}) {
  return (
    <div className={`auth-benefit ${tone}`}>
      <span>
        <Icon size={24} />
      </span>
      <div>
        <strong>{title}</strong>
        <small>{text}</small>
      </div>
    </div>
  );
}
