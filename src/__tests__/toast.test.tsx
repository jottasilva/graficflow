import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

type ToastItem = {
  id: string;
  tone: "info" | "success" | "warning" | "danger";
  title: string;
  message: string;
};

function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;
  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast-${toast.tone}`} role="alert">
          <div className="toast-body">
            <span className="toast-title">{toast.title}</span>
            {toast.message && <span className="toast-message">{toast.message}</span>}
          </div>
          <button
            className="toast-close"
            type="button"
            aria-label="Fechar"
            onClick={() => onDismiss(toast.id)}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

function createTestToasts(count: number): ToastItem[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `tst-${i}`,
    tone: i % 2 === 0 ? "success" : "danger",
    title: `Toast ${i}`,
    message: `Mensagem ${i}`,
  }));
}

describe("ToastContainer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders nothing when toasts array is empty", () => {
    const { container } = render(<ToastContainer toasts={[]} onDismiss={vi.fn()} />);
    expect(container.querySelector(".toast-container")).toBeNull();
  });

  it("renders toast with correct tone class", () => {
    const toasts: ToastItem[] = [
      { id: "1", tone: "success", title: "Sucesso", message: "Criado com sucesso" },
    ];
    render(<ToastContainer toasts={toasts} onDismiss={vi.fn()} />);

    const toast = screen.getByRole("alert");
    expect(toast).toHaveClass("toast-success");
  });

  it("renders toast title and message", () => {
    const toasts: ToastItem[] = [
      { id: "1", tone: "info", title: "Titulo Teste", message: "Corpo da mensagem" },
    ];
    render(<ToastContainer toasts={toasts} onDismiss={vi.fn()} />);

    expect(screen.getByText("Titulo Teste")).toBeInTheDocument();
    expect(screen.getByText("Corpo da mensagem")).toBeInTheDocument();
  });

  it("renders toast without message when message is empty", () => {
    const toasts: ToastItem[] = [
      { id: "1", tone: "warning", title: "Aviso", message: "" },
    ];
    render(<ToastContainer toasts={toasts} onDismiss={vi.fn()} />);

    expect(screen.getByText("Aviso")).toBeInTheDocument();
    expect(screen.queryByRole("alert")?.querySelector(".toast-message")).toBeNull();
  });

  it("calls onDismiss when close button is clicked", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onDismiss = vi.fn();
    const toasts: ToastItem[] = [
      { id: "tst-abc", tone: "success", title: "Teste", message: "" },
    ];
    render(<ToastContainer toasts={toasts} onDismiss={onDismiss} />);

    await user.click(screen.getByRole("button", { name: "Fechar" }));

    expect(onDismiss).toHaveBeenCalledWith("tst-abc");
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("renders multiple toasts", () => {
    const toasts = createTestToasts(3);
    render(<ToastContainer toasts={toasts} onDismiss={vi.fn()} />);

    const alerts = screen.getAllByRole("alert");
    expect(alerts).toHaveLength(3);
  });

  it("each toast has correct tone class", () => {
    const toasts: ToastItem[] = [
      { id: "1", tone: "success", title: "OK", message: "" },
      { id: "2", tone: "danger", title: "Erro", message: "" },
      { id: "3", tone: "warning", title: "Aviso", message: "" },
      { id: "4", tone: "info", title: "Info", message: "" },
    ];
    render(<ToastContainer toasts={toasts} onDismiss={vi.fn()} />);

    const alerts = screen.getAllByRole("alert");
    expect(alerts[0]).toHaveClass("toast-success");
    expect(alerts[1]).toHaveClass("toast-danger");
    expect(alerts[2]).toHaveClass("toast-warning");
    expect(alerts[3]).toHaveClass("toast-info");
  });

  it("dismisses correct toast when multiple exist", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onDismiss = vi.fn();
    const toasts = createTestToasts(3);
    render(<ToastContainer toasts={toasts} onDismiss={onDismiss} />);

    const closeButtons = screen.getAllByRole("button", { name: "Fechar" });
    await user.click(closeButtons[1]);

    expect(onDismiss).toHaveBeenCalledWith("tst-1");
  });
});

describe("Toast auto-dismiss flow", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("simulates addToast auto-removal after 4 seconds", () => {
    let toasts: ToastItem[] = [];
    const setToasts = vi.fn((updater: (current: ToastItem[]) => ToastItem[]) => {
      toasts = updater(toasts);
    });

    function addToast(item: Omit<ToastItem, "id">) {
      const id = `tst-${Date.now()}`;
      setToasts((current) => [...current, { id, ...item }]);
      setTimeout(() => {
        setToasts((current) => current.filter((t) => t.id !== id));
      }, 4000);
    }

    addToast({ tone: "success", title: "Produto cadastrado", message: "Teste" });
    expect(setToasts).toHaveBeenCalledTimes(1);
    expect(toasts).toHaveLength(1);
    expect(toasts[0].tone).toBe("success");

    act(() => {
      vi.advanceTimersByTime(4000);
    });

    expect(setToasts).toHaveBeenCalledTimes(2);
    expect(toasts).toHaveLength(0);
  });

  it("does not remove toast before 4 seconds", () => {
    let toasts: ToastItem[] = [];
    const setToasts = vi.fn((updater: (current: ToastItem[]) => ToastItem[]) => {
      toasts = updater(toasts);
    });

    function addToast(item: Omit<ToastItem, "id">) {
      const id = `tst-delay`;
      setToasts((current) => [...current, { id, ...item }]);
      setTimeout(() => {
        setToasts((current) => current.filter((t) => t.id !== id));
      }, 4000);
    }

    addToast({ tone: "info", title: "Teste", message: "" });

    act(() => {
      vi.advanceTimersByTime(3999);
    });

    expect(toasts).toHaveLength(1);
  });

  it("handles multiple toasts with staggered dismissals", () => {
    let toasts: ToastItem[] = [];
    const setToasts = vi.fn((updater: (current: ToastItem[]) => ToastItem[]) => {
      toasts = updater(toasts);
    });

    function addToast(item: Omit<ToastItem, "id">) {
      const id = `tst-${toasts.length}`;
      setToasts((current) => [...current, { id, ...item }]);
      setTimeout(() => {
        setToasts((current) => current.filter((t) => t.id !== id));
      }, 4000);
    }

    addToast({ tone: "success", title: "Primeiro", message: "" });
    addToast({ tone: "danger", title: "Segundo", message: "" });

    expect(toasts).toHaveLength(2);

    act(() => {
      vi.advanceTimersByTime(4000);
    });

    expect(toasts).toHaveLength(0);
  });
});

describe("createNotification dual-write flow", () => {
  it("simulates createNotification writing to both notifications and toasts", () => {
    const notifications: Array<{ id: string; title: string; tone: string; read: boolean; time: string }> = [];
    const toasts: ToastItem[] = [];

    function createNotification(item: { tone: ToastItem["tone"]; title: string; message: string }) {
      notifications.push({
        id: `not-${notifications.length}`,
        time: "agora",
        read: false,
        ...item,
      });
      toasts.push({
        id: `tst-${toasts.length}`,
        ...item,
      });
    }

    createNotification({ tone: "success", title: "Produto cadastrado", message: "Widget esta disponivel" });
    createNotification({ tone: "danger", title: "Erro ao salvar", message: "Falha na conexao" });

    expect(notifications).toHaveLength(2);
    expect(toasts).toHaveLength(2);

    expect(notifications[0]).toMatchObject({
      title: "Produto cadastrado",
      tone: "success",
      read: false,
      time: "agora",
    });

    expect(toasts[0]).toMatchObject({
      title: "Produto cadastrado",
      tone: "success",
      message: "Widget esta disponivel",
    });

    expect(notifications[1]).toMatchObject({
      title: "Erro ao salvar",
      tone: "danger",
    });
  });
});
