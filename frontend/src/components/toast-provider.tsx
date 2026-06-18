"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  createContext,
  useContext,
  type ReactNode,
} from "react";
import { X, CheckCircle2, AlertTriangle, Info, Loader2, Star } from "lucide-react";

type ToastTone = "success" | "error" | "warning" | "info" | "loading" | "custom";

type Toast = {
  id: string;
  tone: ToastTone;
  title: string;
  message: string;
  duration: number;
  paused: boolean;
};

type ToastInput = {
  tone: ToastTone;
  title: string;
  message?: string;
  duration?: number;
};

type ToastContextValue = {
  toast: (input: ToastInput) => string;
  dismiss: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

let toastCounter = 0;

function generateId(): string {
  toastCounter += 1;
  return `toast-${toastCounter}-${Date.now().toString(36)}`;
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

const TONE_CONFIG = {
  success: {
    icon: CheckCircle2,
    accent: "#22C55E",
    bg: "rgba(34, 197, 94, 0.10)",
    border: "rgba(34, 197, 94, 0.25)",
  },
  error: {
    icon: AlertTriangle,
    accent: "#EF4444",
    bg: "rgba(239, 68, 68, 0.10)",
    border: "rgba(239, 68, 68, 0.25)",
  },
  warning: {
    icon: AlertTriangle,
    accent: "#F97316",
    bg: "rgba(249, 115, 22, 0.10)",
    border: "rgba(249, 115, 22, 0.25)",
  },
  info: {
    icon: Info,
    accent: "#3B82F6",
    bg: "rgba(59, 130, 246, 0.10)",
    border: "rgba(59, 130, 246, 0.25)",
  },
  loading: {
    icon: Loader2,
    accent: "#6C4CF1",
    bg: "rgba(108, 76, 241, 0.10)",
    border: "rgba(108, 76, 241, 0.25)",
  },
  custom: {
    icon: Star,
    accent: "#6C4CF1",
    bg: "rgba(108, 76, 241, 0.10)",
    border: "rgba(108, 76, 241, 0.25)",
  },
};

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: string) => void;
}) {
  const config = TONE_CONFIG[toast.tone];
  const Icon = config.icon;
  const isSpinning = toast.tone === "loading";
  const progressRef = useRef<HTMLDivElement>(null);
  const startTimeRef = useRef<number>(Date.now());
  const elapsedRef = useRef<number>(0);
  const rafRef = useRef<number>(0);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (toast.duration <= 0) return;

    const frame = () => {
      if (toast.paused) {
        rafRef.current = requestAnimationFrame(frame);
        return;
      }

      const now = Date.now();
      const elapsed = elapsedRef.current + (now - startTimeRef.current);
      const remaining = Math.max(0, toast.duration - elapsed);
      const pct = (remaining / toast.duration) * 100;

      if (progressRef.current) {
        progressRef.current.style.width = `${pct}%`;
      }

      if (remaining <= 0) {
        setExiting(true);
        setTimeout(() => onDismiss(toast.id), 300);
        return;
      }

      rafRef.current = requestAnimationFrame(frame);
    };

    startTimeRef.current = Date.now();
    rafRef.current = requestAnimationFrame(frame);

    return () => cancelAnimationFrame(rafRef.current);
  }, [toast.duration, toast.paused, toast.id, onDismiss]);

  useEffect(() => {
    if (!toast.paused) {
      startTimeRef.current = Date.now();
    } else {
      elapsedRef.current += Date.now() - startTimeRef.current;
    }
  }, [toast.paused]);

  return (
    <div
      className={`toast-item ${exiting ? "toast-exit" : "toast-enter"}`}
      style={{
        "--toast-accent": config.accent,
        "--toast-bg": config.bg,
        "--toast-border": config.border,
      } as React.CSSProperties}
      onMouseEnter={() => { toast.paused = true; }}
      onMouseLeave={() => { toast.paused = false; }}
    >
      <div className="toast-body">
        <span className="toast-icon-wrap" style={{ background: config.bg, color: config.accent }}>
          <Icon size={18} className={isSpinning ? "toast-spin" : ""} />
        </span>
        <div className="toast-content">
          <strong className="toast-title">{toast.title}</strong>
          {toast.message ? <span className="toast-message">{toast.message}</span> : null}
        </div>
        <button
          className="toast-close"
          type="button"
          onClick={() => { setExiting(true); setTimeout(() => onDismiss(toast.id), 300); }}
          aria-label="Fechar"
        >
          <X size={14} />
        </button>
      </div>
      {toast.duration > 0 ? (
        <div className="toast-progress-track">
          <div ref={progressRef} className="toast-progress-bar" style={{ width: "100%" }} />
        </div>
      ) : null}
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((input: ToastInput): string => {
    const id = generateId();
    const item: Toast = {
      id,
      tone: input.tone,
      title: input.title,
      message: input.message ?? "",
      duration: input.duration ?? 4000,
      paused: false,
    };
    setToasts((prev) => [...prev, item]);
    return id;
  }, []);

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}
      <div className="toast-container">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
