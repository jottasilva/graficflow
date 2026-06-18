"use client";

import { useState } from "react";
import Link from "next/link";
import { Upload, CheckCircle2, XCircle, FileText, ArrowLeft } from "lucide-react";
import { graphflowApi } from "@/lib/graphflow-api";

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; url?: string; message: string } | null>(null);

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setResult(null);
    try {
      const response = await graphflowApi.uploadFile(file, "files");
      setResult({ success: true, url: response.url, message: "Arquivo enviado com sucesso!" });
    } catch (err) {
      setResult({ success: false, message: err instanceof Error ? err.message : "Erro ao enviar arquivo." });
    } finally {
      setUploading(false);
    }
  }

  const allowedTypes = [
    "application/pdf",
    "application/zip",
    "application/x-zip-compressed",
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
  ];

  return (
    <main className="store-page">
      <div className="store-container" style={{ paddingTop: "48px", paddingBottom: "48px" }}>
        <Link
          href="/"
          style={{ display: "inline-flex", alignItems: "center", gap: "6px", marginBottom: "24px", fontSize: "0.9rem", opacity: 0.7 }}
        >
          <ArrowLeft size={16} />
          Voltar para página inicial
        </Link>

        <div style={{ maxWidth: 560, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "32px" }}>
            <h1 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: "8px" }}>Upload de Arte</h1>
            <p style={{ opacity: 0.6 }}>Envie seus arquivos de arte para orçamento e produção.</p>
          </div>

          <div
            style={{
              border: "2px dashed var(--border, #d1d5db)",
              borderRadius: 12,
              padding: "40px 24px",
              textAlign: "center",
              cursor: "pointer",
              transition: "border-color 0.2s",
              background: "var(--card-bg, #f9fafb)",
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.currentTarget.style.borderColor = "var(--primary, #5b45ff)";
            }}
            onDragLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--border, #d1d5db)";
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.currentTarget.style.borderColor = "var(--border, #d1d5db)";
              const dropped = e.dataTransfer.files[0];
              if (dropped && allowedTypes.includes(dropped.type)) {
                setFile(dropped);
                setResult(null);
              } else {
                setResult({ success: false, message: "Tipo de arquivo não suportado. Use PDF, ZIP, JPG, PNG, WebP ou GIF." });
              }
            }}
          >
            <input
              type="file"
              id="file-upload"
              style={{ display: "none" }}
              accept=".pdf,.zip,.jpg,.jpeg,.png,.webp,.gif"
              onChange={(e) => {
                const selected = e.target.files?.[0];
                if (selected) {
                  if (allowedTypes.includes(selected.type)) {
                    setFile(selected);
                    setResult(null);
                  } else {
                    setResult({ success: false, message: "Tipo de arquivo não suportado. Use PDF, ZIP, JPG, PNG, WebP ou GIF." });
                  }
                }
              }}
            />
            <label htmlFor="file-upload" style={{ cursor: "pointer", display: "block" }}>
              <Upload size={40} style={{ opacity: 0.4, marginBottom: "12px" }} />
              <p style={{ fontWeight: 600, marginBottom: "4px" }}>
                {file ? file.name : "Clique ou arraste o arquivo aqui"}
              </p>
              <p style={{ fontSize: "0.85rem", opacity: 0.5 }}>
                {file
                  ? `${(file.size / 1024 / 1024).toFixed(2)} MB`
                  : "PDF, ZIP, JPG, PNG, WebP ou GIF (máx. 25MB)"}
              </p>
            </label>
          </div>

          {file && !uploading ? (
            <button
              className="store-primary"
              type="button"
              onClick={handleUpload}
              style={{ marginTop: "16px", width: "100%", justifyContent: "center" }}
            >
              <Upload size={18} />
              Enviar arquivo
            </button>
          ) : null}

          {uploading ? (
            <div
              style={{
                marginTop: "16px",
                padding: "12px 16px",
                borderRadius: 8,
                background: "rgba(91, 69, 255, 0.08)",
                color: "var(--primary, #5b45ff)",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "0.9rem",
              }}
            >
              <Upload size={18} className="spin" />
              Enviando arquivo...
            </div>
          ) : null}

          {result ? (
            <div
              style={{
                marginTop: "16px",
                padding: "16px",
                borderRadius: 8,
                display: "flex",
                alignItems: "flex-start",
                gap: "10px",
                fontSize: "0.9rem",
                background: result.success ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)",
                color: result.success ? "var(--green, #10b981)" : "var(--red, #ef4444)",
              }}
            >
              {result.success ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
              <div>
                <p style={{ fontWeight: 600 }}>{result.message}</p>
                {result.url ? (
                  <a
                    href={result.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      marginTop: "4px",
                      textDecoration: "underline",
                      fontSize: "0.85rem",
                    }}
                  >
                    <FileText size={14} />
                    Visualizar arquivo
                  </a>
                ) : null}
              </div>
            </div>
          ) : null}

          <div
            style={{
              marginTop: "32px",
              padding: "20px",
              borderRadius: 8,
              background: "var(--card-bg, #f9fafb)",
              fontSize: "0.85rem",
              opacity: 0.7,
            }}
          >
            <strong style={{ display: "block", marginBottom: "8px" }}>Formatos aceitos:</strong>
            <ul style={{ paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "4px" }}>
              <li>PDF, CDR, AI, PSD, PNG, JPG, WebP, GIF</li>
              <li>Tamanho máximo: 25MB</li>
              <li>Arquivos ZIP também são aceitos</li>
            </ul>
          </div>
        </div>
      </div>
    </main>
  );
}
