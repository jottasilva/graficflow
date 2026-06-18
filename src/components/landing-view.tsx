"use client";

import {
  Save,
  CheckCircle2,
  Building2,
  Phone,
  Mail,
  Link2,
  Menu,
  Image,
  MessageCircle,
  FileText,
  Trash2,
  Plus,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { graphflowApi } from "@/lib/graphflow-api";
import type { LandingPageConfig } from "@/lib/graphflow-data";
import { defaultLandingPageConfig } from "@/lib/graphflow-data";
import { LANDING_ICON_MAP, ICON_KEYS, ICON_LABELS } from "@/lib/landing-icons";
import type { LandingIconKey } from "@/lib/landing-icons";
import { ImageUploader } from "./image-uploader";
import { useToast } from "./toast-provider";

type SectionKey = "brand" | "topStrip" | "navigation" | "hero" | "process" | "benefits" | "newsletter" | "footer" | "whatsapp";

const sections: Array<{ key: SectionKey; icon: LucideIcon; label: string }> = [
  { key: "brand", icon: Building2, label: "Marca" },
  { key: "topStrip", icon: Phone, label: "Topo" },
  { key: "navigation", icon: Menu, label: "Navegacao" },
  { key: "hero", icon: Image, label: "Hero" },
  { key: "process", icon: Link2, label: "Processo" },
  { key: "benefits", icon: CheckCircle2, label: "Beneficios" },
  { key: "newsletter", icon: MessageCircle, label: "Newsletter" },
  { key: "footer", icon: FileText, label: "Rodape" },
  { key: "whatsapp", icon: MessageCircle, label: "WhatsApp" },
];

export function LandingView() {
  const [config, setConfig] = useState<LandingPageConfig>(defaultLandingPageConfig);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<SectionKey>("brand");
  const { toast } = useToast();

  useEffect(() => {
    graphflowApi.getLandingPageConfig().then(setConfig).catch(() => {
      toast({ tone: "error", title: "Erro ao carregar", message: "Nao foi possivel carregar a configuracao da landing page." });
    }).finally(() => setLoading(false));
  }, []);

  const updateConfig = useCallback((update: Partial<LandingPageConfig>) => {
    setConfig((current) => ({ ...current, ...update }));
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      await graphflowApi.updateLandingPageConfig(config);
      toast({ tone: "success", title: "Configuracao salva", message: "As alteracoes foram aplicadas com sucesso." });
    } catch {
      toast({ tone: "error", title: "Erro ao salvar", message: "Nao foi possivel salvar a configuracao." });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <section className="settings-reference-page table-card">
        <div className="settings-reference-head">
          <h2>Landing Page</h2>
          <p>Personalize a pagina publica da sua grafica.</p>
        </div>
        <p>Carregando...</p>
      </section>
    );
  }

  return (
    <section className="settings-reference-page table-card">
      <div className="settings-reference-head">
        <h2>Landing Page</h2>
        <p>Personalize a pagina publica da sua grafica.</p>
      </div>

      <nav className="landing-section-tabs" style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "24px" }}>
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <button
              key={section.key}
              className={`permission-chip ${activeSection === section.key ? "active" : ""}`}
              type="button"
              onClick={() => setActiveSection(section.key)}
            >
              <Icon size={14} />
              {section.label}
            </button>
          );
        })}
      </nav>

      {activeSection === "brand" ? (
        <div className="field-grid two">
          <label>
            Nome da marca
            <input value={config.brand.name} onChange={(e) => updateConfig({ brand: { ...config.brand, name: e.target.value } })} />
          </label>
          <label>
            Tagline
            <input value={config.brand.tagline} onChange={(e) => updateConfig({ brand: { ...config.brand, tagline: e.target.value } })} />
          </label>
          <div style={{ gridColumn: "span 2" }}>
            <ImageUploader
              currentUrl={config.brand.logoUrl}
              label="Logotipo"
              onUploaded={(url) => updateConfig({ brand: { ...config.brand, logoUrl: url } })}
            />
          </div>
        </div>
      ) : null}

      {activeSection === "topStrip" ? (
        <div className="field-grid two">
          <label style={{ gridColumn: "span 2" }}>
            Mensagem de boas-vindas
            <input value={config.topStrip.welcome} onChange={(e) => updateConfig({ topStrip: { ...config.topStrip, welcome: e.target.value } })} />
          </label>
          <label>
            Telefone
            <input value={config.topStrip.phone} onChange={(e) => updateConfig({ topStrip: { ...config.topStrip, phone: e.target.value } })} />
          </label>
          <label>
            E-mail
            <input value={config.topStrip.email} onChange={(e) => updateConfig({ topStrip: { ...config.topStrip, email: e.target.value } })} />
          </label>
          <div style={{ gridColumn: "span 2" }}>
            <strong style={{ fontSize: "0.85rem", display: "block", marginBottom: "8px" }}>Links do topo</strong>
            {config.topStrip.links.map((link, i) => (
              <div key={i} style={{ display: "flex", gap: "8px", marginBottom: "6px", alignItems: "center" }}>
                <input
                  placeholder="Rotulo"
                  value={link.label}
                  style={{ flex: 1 }}
                  onChange={(e) => {
                    const links = [...config.topStrip.links];
                    links[i] = { ...links[i], label: e.target.value };
                    updateConfig({ topStrip: { ...config.topStrip, links } });
                  }}
                />
                <input
                  placeholder="URL"
                  value={link.href}
                  style={{ flex: 2 }}
                  onChange={(e) => {
                    const links = [...config.topStrip.links];
                    links[i] = { ...links[i], href: e.target.value };
                    updateConfig({ topStrip: { ...config.topStrip, links } });
                  }}
                />
                <button
                  type="button"
                  className="permission-chip"
                  style={{ color: "var(--red, #ef4444)", cursor: "pointer", whiteSpace: "nowrap" }}
                  onClick={() => {
                    const links = config.topStrip.links.filter((_, idx) => idx !== i);
                    updateConfig({ topStrip: { ...config.topStrip, links } });
                    toast({ tone: "info", title: "Link removido", message: `"${link.label}" foi removido do topo.` });
                  }}
                >
                  Remover
                </button>
              </div>
            ))}
            <button
              type="button"
              className="ghost-button"
              style={{ marginTop: "8px" }}
              onClick={() => {
                const links = [...config.topStrip.links, { label: "Novo Link", href: "#" }];
                updateConfig({ topStrip: { ...config.topStrip, links } });
                toast({ tone: "info", title: "Link adicionado", message: "Novo link foi adicionado ao topo." });
              }}
            >
              + Adicionar link
            </button>
          </div>
        </div>
      ) : null}

      {activeSection === "navigation" ? (
        <div>
          <p style={{ marginBottom: "12px", fontSize: "0.85rem", opacity: 0.7 }}>Itens do menu de navegacao</p>
          {config.navigation.map((link, i) => (
            <div key={i} style={{ display: "flex", gap: "8px", marginBottom: "6px", alignItems: "center" }}>
              <input
                placeholder="Rotulo"
                value={link.label}
                style={{ flex: 1 }}
                onChange={(e) => {
                  const nav = [...config.navigation];
                  nav[i] = { ...nav[i], label: e.target.value };
                  updateConfig({ navigation: nav });
                }}
              />
              <input
                placeholder="URL"
                value={link.href}
                style={{ flex: 2 }}
                onChange={(e) => {
                  const nav = [...config.navigation];
                  nav[i] = { ...nav[i], href: e.target.value };
                  updateConfig({ navigation: nav });
                }}
              />
              <button
                type="button"
                className="permission-chip"
                style={{ color: "var(--red, #ef4444)", cursor: "pointer", whiteSpace: "nowrap" }}
                onClick={() => {
                  const nav = config.navigation.filter((_, idx) => idx !== i);
                  updateConfig({ navigation: nav });
                  toast({ tone: "info", title: "Item removido", message: `"${link.label}" foi removido da navegacao.` });
                }}
              >
                Remover
              </button>
            </div>
          ))}
          <button
            type="button"
            className="ghost-button"
            style={{ marginTop: "8px" }}
            onClick={() => {
              const nav = [...config.navigation, { label: "Novo Link", href: "#" }];
              updateConfig({ navigation: nav });
              toast({ tone: "info", title: "Item adicionado", message: "Novo item foi adicionado ao menu de navegacao." });
            }}
          >
            + Adicionar item
          </button>
        </div>
      ) : null}

      {activeSection === "hero" ? (
        <div className="field-grid two">
          <label>
            Titulo (prefixo)
            <input value={config.hero.titlePrefix} onChange={(e) => updateConfig({ hero: { ...config.hero, titlePrefix: e.target.value } })} />
          </label>
          <label>
            Titulo (destaque)
            <input value={config.hero.titleHighlight} onChange={(e) => updateConfig({ hero: { ...config.hero, titleHighlight: e.target.value } })} />
          </label>
          <label style={{ gridColumn: "span 2" }}>
            Descricao
            <textarea
              value={config.hero.description}
              rows={3}
              onChange={(e) => updateConfig({ hero: { ...config.hero, description: e.target.value } })}
            />
          </label>
          <label>
            Texto do CTA principal
            <input value={config.hero.primaryCta.label} onChange={(e) => updateConfig({ hero: { ...config.hero, primaryCta: { ...config.hero.primaryCta, label: e.target.value } } })} />
          </label>
          <label>
            URL do CTA principal
            <input value={config.hero.primaryCta.href} onChange={(e) => updateConfig({ hero: { ...config.hero, primaryCta: { ...config.hero.primaryCta, href: e.target.value } } })} />
          </label>
          <label>
            Texto do CTA secundario
            <input value={config.hero.secondaryCta.label} onChange={(e) => updateConfig({ hero: { ...config.hero, secondaryCta: { ...config.hero.secondaryCta, label: e.target.value } } })} />
          </label>
          <label>
            URL do CTA secundario
            <input value={config.hero.secondaryCta.href} onChange={(e) => updateConfig({ hero: { ...config.hero, secondaryCta: { ...config.hero.secondaryCta, href: e.target.value } } })} />
          </label>
        </div>
      ) : null}

      {activeSection === "hero" ? (
        <div style={{ marginTop: "16px" }}>
          <strong style={{ fontSize: "0.85rem", display: "block", marginBottom: "8px" }}>Slides do Hero</strong>
          {config.hero.slides.map((slide, i) => (
            <div key={slide.id} style={{ display: "flex", gap: "8px", marginBottom: "12px", alignItems: "flex-start" }}>
              <div style={{ flex: 1 }}>
                <ImageUploader
                  currentUrl={slide.imageUrl}
                  label={`Slide ${i + 1}`}
                  onUploaded={(url) => {
                    const slides = [...config.hero.slides];
                    slides[i] = { ...slides[i], imageUrl: url };
                    updateConfig({ hero: { ...config.hero, slides } });
                  }}
                />
              </div>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "6px" }}>
                <input
                  placeholder="Texto alternativo"
                  value={slide.alt}
                  onChange={(e) => {
                    const slides = [...config.hero.slides];
                    slides[i] = { ...slides[i], alt: e.target.value };
                    updateConfig({ hero: { ...config.hero, slides } });
                  }}
                />
                <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.85rem" }}>
                  <input
                    type="checkbox"
                    checked={slide.active}
                    onChange={(e) => {
                      const slides = [...config.hero.slides];
                      slides[i] = { ...slides[i], active: e.target.checked };
                      updateConfig({ hero: { ...config.hero, slides } });
                    }}
                  />
                  Ativo
                </label>
              </div>
              <button
                type="button"
                className="permission-chip"
                style={{ color: "var(--red, #ef4444)", cursor: "pointer", marginTop: 22 }}
                onClick={() => {
                  const slides = config.hero.slides.filter((_, idx) => idx !== i);
                  updateConfig({ hero: { ...config.hero, slides } });
                  toast({ tone: "info", title: "Slide removido", message: `O slide "${slide.alt || "sem titulo"}" foi removido.` });
                }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <button
            type="button"
            className="ghost-button"
            style={{ marginBottom: "16px" }}
            onClick={() => {
              const slides = [
                ...config.hero.slides,
                { id: `slide-${Date.now()}`, imageUrl: "/assets/hero-placeholder.jpg", alt: "", active: true },
              ];
              updateConfig({ hero: { ...config.hero, slides } });
              toast({ tone: "info", title: "Slide adicionado", message: "Novo slide foi adicionado ao hero." });
            }}
          >
            <Plus size={14} />
            Adicionar slide
          </button>

          <strong style={{ fontSize: "0.85rem", display: "block", marginBottom: "8px" }}>Funcionalidades do Hero</strong>
          {config.hero.features.map((feature, i) => (
            <div key={feature.id} style={{ display: "flex", gap: "8px", marginBottom: "8px", alignItems: "center" }}>
              <IconPicker value={feature.icon} onChange={(icon) => {
                const features = [...config.hero.features];
                features[i] = { ...features[i], icon };
                updateConfig({ hero: { ...config.hero, features } });
              }} />
              <input
                placeholder="Titulo"
                value={feature.title}
                style={{ flex: 1 }}
                onChange={(e) => {
                  const features = [...config.hero.features];
                  features[i] = { ...features[i], title: e.target.value };
                  updateConfig({ hero: { ...config.hero, features } });
                }}
              />
              <input
                placeholder="Texto"
                value={feature.text}
                style={{ flex: 2 }}
                onChange={(e) => {
                  const features = [...config.hero.features];
                  features[i] = { ...features[i], text: e.target.value };
                  updateConfig({ hero: { ...config.hero, features } });
                }}
              />
            </div>
          ))}
        </div>
      ) : null}

      {activeSection === "process" ? (
        <div>
          <strong style={{ fontSize: "0.85rem", display: "block", marginBottom: "8px" }}>Etapas do processo</strong>
          {config.process.map((step, i) => (
            <div key={step.id} style={{ display: "flex", gap: "8px", marginBottom: "8px", alignItems: "center" }}>
              <IconPicker value={step.icon} onChange={(icon) => {
                const steps = [...config.process];
                steps[i] = { ...steps[i], icon };
                updateConfig({ process: steps });
              }} />
              <input
                placeholder="Titulo"
                value={step.title}
                style={{ flex: 1 }}
                onChange={(e) => {
                  const steps = [...config.process];
                  steps[i] = { ...steps[i], title: e.target.value };
                  updateConfig({ process: steps });
                }}
              />
              <input
                placeholder="Texto"
                value={step.text}
                style={{ flex: 2 }}
                onChange={(e) => {
                  const steps = [...config.process];
                  steps[i] = { ...steps[i], text: e.target.value };
                  updateConfig({ process: steps });
                }}
              />
            </div>
          ))}
        </div>
      ) : null}

      {activeSection === "benefits" ? (
        <div>
          <strong style={{ fontSize: "0.85rem", display: "block", marginBottom: "8px" }}>Beneficios</strong>
          {config.benefits.map((benefit, i) => (
            <div key={benefit.id} style={{ display: "flex", gap: "8px", marginBottom: "8px", alignItems: "center" }}>
              <IconPicker value={benefit.icon} onChange={(icon) => {
                const benefits = [...config.benefits];
                benefits[i] = { ...benefits[i], icon };
                updateConfig({ benefits });
              }} />
              <input
                placeholder="Rotulo"
                value={benefit.label}
                style={{ flex: 1 }}
                onChange={(e) => {
                  const benefits = [...config.benefits];
                  benefits[i] = { ...benefits[i], label: e.target.value };
                  updateConfig({ benefits });
                }}
              />
              <input
                placeholder="Titulo"
                value={benefit.title}
                style={{ flex: 1 }}
                onChange={(e) => {
                  const benefits = [...config.benefits];
                  benefits[i] = { ...benefits[i], title: e.target.value };
                  updateConfig({ benefits });
                }}
              />
              <input
                placeholder="Texto"
                value={benefit.text}
                style={{ flex: 2 }}
                onChange={(e) => {
                  const benefits = [...config.benefits];
                  benefits[i] = { ...benefits[i], text: e.target.value };
                  updateConfig({ benefits });
                }}
              />
            </div>
          ))}
        </div>
      ) : null}

      {activeSection === "newsletter" ? (
        <div className="field-grid two">
          <label style={{ gridColumn: "span 2" }}>
            Titulo
            <input value={config.newsletter.title} onChange={(e) => updateConfig({ newsletter: { ...config.newsletter, title: e.target.value } })} />
          </label>
          <label style={{ gridColumn: "span 2" }}>
            Subtitulo
            <input value={config.newsletter.subtitle} onChange={(e) => updateConfig({ newsletter: { ...config.newsletter, subtitle: e.target.value } })} />
          </label>
          <label>
            WhatsApp
            <input value={config.newsletter.whatsapp} onChange={(e) => updateConfig({ newsletter: { ...config.newsletter, whatsapp: e.target.value } })} />
          </label>
          <label>
            Mensagem
            <input value={config.newsletter.message} onChange={(e) => updateConfig({ newsletter: { ...config.newsletter, message: e.target.value } })} />
          </label>
        </div>
      ) : null}

      {activeSection === "footer" ? (
        <div className="field-grid two">
          <label style={{ gridColumn: "span 2" }}>
            Descricao
            <textarea
              value={config.footer.description}
              rows={2}
              onChange={(e) => updateConfig({ footer: { ...config.footer, description: e.target.value } })}
            />
          </label>
          <label style={{ gridColumn: "span 2" }}>
            Copyright
            <input value={config.footer.copyright} onChange={(e) => updateConfig({ footer: { ...config.footer, copyright: e.target.value } })} />
          </label>
          <label style={{ gridColumn: "span 2" }}>
            Desenvolvedor
            <input value={config.footer.developer} onChange={(e) => updateConfig({ footer: { ...config.footer, developer: e.target.value } })} />
          </label>
        </div>
      ) : null}

      {activeSection === "whatsapp" ? (
        <div className="field-grid two">
          <label style={{ gridColumn: "span 2" }}>
            URL do WhatsApp
            <input value={config.whatsappUrl} onChange={(e) => updateConfig({ whatsappUrl: e.target.value })} />
          </label>
        </div>
      ) : null}

      <div style={{ marginTop: "24px" }}>
        <button className="ghost-button" type="button" onClick={handleSave} disabled={saving}>
          <Save size={16} />
          {saving ? "Salvando..." : "Salvar alteracoes"}
        </button>
      </div>
    </section>
  );
}

function IconPicker({ value, onChange }: { value: string; onChange: (icon: LandingIconKey) => void }) {
  const [open, setOpen] = useState(false);

  const CurrentIcon = LANDING_ICON_MAP[value];

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        className="permission-chip"
        style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", minWidth: 100 }}
        onClick={() => setOpen(!open)}
      >
        {CurrentIcon ? <CurrentIcon size={14} /> : null}
        <span style={{ fontSize: "0.75rem" }}>{ICON_LABELS[value as LandingIconKey] ?? value}</span>
      </button>
      {open ? (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            zIndex: 10,
            background: "var(--card-bg, #fff)",
            border: "1px solid var(--border, #ddd)",
            borderRadius: 8,
            padding: "8px",
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "4px",
            marginTop: 4,
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          }}
        >
          {ICON_KEYS.map((key) => {
            const Icon = LANDING_ICON_MAP[key];
            const selected = value === key;
            return (
              <button
                key={key}
                type="button"
                className={`permission-chip ${selected ? "active" : ""}`}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                title={ICON_LABELS[key]}
                onClick={() => {
                  onChange(key);
                  setOpen(false);
                }}
              >
                <Icon size={16} />
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
