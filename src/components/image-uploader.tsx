"use client";

import { useState, useRef } from "react";
import { Upload, CheckCircle2, XCircle, Loader2, ImageIcon } from "lucide-react";
import { graphflowApi } from "@/lib/graphflow-api";
import { useToast } from "./toast-provider";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
const MAX_SIZE_MB = 25;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

type UploadState = "idle" | "uploading" | "success" | "error";

export function ImageUploader({
  currentUrl,
  onUploaded,
  label,
}: {
  currentUrl?: string;
  onUploaded: (url: string) => void;
  label?: string;
}) {
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [message, setMessage] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  function validate(file: File): string | null {
    if (!ALLOWED_TYPES.includes(file.type)) {
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (!ext || !ALLOWED_EXTENSIONS.includes(`.${ext}`)) {
        return "Formato não suportado. Use JPG, PNG, WebP ou GIF.";
      }
    }
    if (file.size > MAX_SIZE_BYTES) {
      return `Arquivo muito grande (máx. ${MAX_SIZE_MB}MB).`;
    }
    return null;
  }

  async function handleFile(file: File) {
    const error = validate(file);
    if (error) {
      setUploadState("error");
      setMessage(error);
      return;
    }

    setUploadState("uploading");
    setMessage("");

    try {
      const result = await graphflowApi.uploadFile(file, "files");
      setUploadState("success");
      setMessage("Imagem enviada com sucesso!");
      onUploaded(result.url);
      toast({ tone: "success", title: "Upload concluido", message: `${result.name} foi enviado com sucesso.` });
    } catch (err) {
      setUploadState("error");
      setMessage(err instanceof Error ? err.message : "Erro ao fazer upload.");
      toast({ tone: "error", title: "Upload falhou", message: err instanceof Error ? err.message : "Nao foi possivel enviar o arquivo." });
    }
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) await handleFile(file);
  }

  return (
    <div>
      {label ? (
        <span style={{ display: "block", fontSize: "0.85rem", marginBottom: "6px", opacity: 0.7 }}>{label}</span>
      ) : null}

      <div
        style={{
          display: "flex",
          gap: "10px",
          alignItems: "flex-start",
        }}
      >
        {currentUrl ? (
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: 8,
              overflow: "hidden",
              border: "1px solid var(--border, #d1d5db)",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "var(--card-bg, #f9fafb)",
            }}
          >
            <img
              src={currentUrl}
              alt="Preview"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
            <ImageIcon
              size={24}
              style={{ opacity: 0.3, display: currentUrl ? "none" : "block", position: "absolute" }}
            />
          </div>
        ) : null}

        <div style={{ flex: 1 }}>
          <div
            style={{
              border: "2px dashed var(--border, #d1d5db)",
              borderRadius: 8,
              padding: "16px",
              textAlign: "center",
              cursor: "pointer",
              transition: "border-color 0.2s",
              background: "var(--card-bg, #f9fafb)",
              opacity: uploadState === "uploading" ? 0.6 : 1,
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.currentTarget.style.borderColor = "var(--primary, #5b45ff)";
            }}
            onDragLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--border, #d1d5db)";
            }}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.webp,.gif"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
                e.target.value = "";
              }}
            />

            {uploadState === "uploading" ? (
              <Loader2 size={20} className="spin" style={{ margin: "0 auto" }} />
            ) : (
              <Upload size={20} style={{ opacity: 0.4, margin: "0 auto" }} />
            )}
            <p style={{ fontSize: "0.8rem", marginTop: "4px", opacity: 0.5 }}>
              {uploadState === "uploading" ? "Enviando..." : "Clique ou arraste imagem (JPG, PNG, WebP, GIF)"}
            </p>
          </div>

          {uploadState === "success" ? (
            <div
              style={{
                marginTop: "6px",
                fontSize: "0.8rem",
                color: "var(--green, #10b981)",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <CheckCircle2 size={14} />
              {message}
            </div>
          ) : null}

          {uploadState === "error" ? (
            <div
              style={{
                marginTop: "6px",
                fontSize: "0.8rem",
                color: "var(--red, #ef4444)",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <XCircle size={14} />
              {message}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
