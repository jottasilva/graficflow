const fs = require('fs');

const landingViewCode = `
function LandingPageView({ onRefreshData }: { onRefreshData: () => void }) {
  const [draft, setDraft] = useState<LandingPageConfig | null>(null);
  const [activeTab, setActiveTab] = useState<"geral" | "hero" | "produtos" | "textos" | "depoimentos" | "rodape">("geral");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    graphflowApi.getLandingPageConfig().then((config) => {
      setDraft(config);
      setIsLoading(false);
    });
  }, []);

  const handleSave = async () => {
    if (!draft) return;
    setIsSaving(true);
    try {
      await graphflowApi.updateLandingPageConfig(draft);
      createNotification({ tone: "success", title: "Landing Page", message: "Configurações atualizadas com sucesso!" });
      onRefreshData();
    } catch (e) {
      createNotification({ tone: "danger", title: "Erro ao salvar", message: "Tente novamente." });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || !draft) {
    return (
      <div className="view-content empty-state">
        <div className="loader" />
        <p>Carregando configurações da Landing Page...</p>
      </div>
    );
  }

  const updateDraft = (updater: (prev: LandingPageConfig) => LandingPageConfig) => {
    setDraft((prev) => (prev ? updater(prev) : prev));
  };

  return (
    <div className="view-content" style={{ display: 'flex', flexDirection: 'column', gap: '24px', padding: '24px' }}>
      <header className="page-header" style={{ marginBottom: 0 }}>
        <div>
          <h2>Landing Page</h2>
          <p>Gerencie o conteúdo do site vitrine da gráfica.</p>
        </div>
        <button className="primary-button" onClick={handleSave} disabled={isSaving}>
          {isSaving ? <span className="loader" style={{ width: 16, height: 16 }} /> : <Save size={18} />}
          {isSaving ? "Salvando..." : "Salvar Configurações"}
        </button>
      </header>

      <nav className="panel-tabs">
        {(["geral", "hero", "produtos", "textos", "depoimentos", "rodape"] as const).map((tab) => (
          <button
            key={tab}
            className={\`tab-button \${activeTab === tab ? "active" : ""}\`}
            onClick={() => setActiveTab(tab)}
            style={{ textTransform: 'capitalize' }}
          >
            {tab}
          </button>
        ))}
      </nav>

      {activeTab === "geral" && (
        <div className="dashboard-grid">
          <section className="form-section panel">
            <h3>Marca e Identidade</h3>
            <div className="form-row">
              <label>Nome da Gráfica
                <input type="text" value={draft.brand.name} onChange={(e) => updateDraft(d => ({ ...d, brand: { ...d.brand, name: e.target.value } }))} />
              </label>
              <label>Slogan / Tagline
                <input type="text" value={draft.brand.tagline} onChange={(e) => updateDraft(d => ({ ...d, brand: { ...d.brand, tagline: e.target.value } }))} />
              </label>
            </div>
            <label>Logo URL
              <input type="text" value={draft.brand.logoUrl} onChange={(e) => updateDraft(d => ({ ...d, brand: { ...d.brand, logoUrl: e.target.value } }))} />
            </label>
          </section>

          <section className="form-section panel">
            <h3>Barra de Contatos (Topo)</h3>
            <div className="form-row">
              <label>Telefone
                <input type="text" value={draft.topStrip.phone} onChange={(e) => updateDraft(d => ({ ...d, topStrip: { ...d.topStrip, phone: e.target.value } }))} />
              </label>
              <label>E-mail Principal
                <input type="text" value={draft.topStrip.email} onChange={(e) => updateDraft(d => ({ ...d, topStrip: { ...d.topStrip, email: e.target.value } }))} />
              </label>
            </div>
            <label>Mensagem de Boas-vindas
              <input type="text" value={draft.topStrip.welcome} onChange={(e) => updateDraft(d => ({ ...d, topStrip: { ...d.topStrip, welcome: e.target.value } }))} />
            </label>
            <label>WhatsApp (Link flutuante)
              <input type="text" value={draft.whatsappUrl} onChange={(e) => updateDraft(d => ({ ...d, whatsappUrl: e.target.value }))} />
            </label>
          </section>
        </div>
      )}

      {activeTab === "hero" && (
        <div className="dashboard-grid">
          <section className="form-section panel">
            <h3>Textos Principais (Hero)</h3>
            <label>Prefixo do Título
              <input type="text" value={draft.hero.titlePrefix} onChange={(e) => updateDraft(d => ({ ...d, hero: { ...d.hero, titlePrefix: e.target.value } }))} />
            </label>
            <label>Texto em Destaque (Principal)
              <textarea rows={2} value={draft.hero.titleHighlight} onChange={(e) => updateDraft(d => ({ ...d, hero: { ...d.hero, titleHighlight: e.target.value } }))} />
            </label>
            <label>Descrição
              <textarea rows={3} value={draft.hero.description} onChange={(e) => updateDraft(d => ({ ...d, hero: { ...d.hero, description: e.target.value } }))} />
            </label>
          </section>

          <section className="form-section panel">
            <h3>Botões de Ação (CTAs)</h3>
            <h4>Principal</h4>
            <div className="form-row">
              <label>Rótulo <input type="text" value={draft.hero.primaryCta.label} onChange={(e) => updateDraft(d => ({ ...d, hero: { ...d.hero, primaryCta: { ...d.hero.primaryCta, label: e.target.value } } }))} /></label>
              <label>Link <input type="text" value={draft.hero.primaryCta.href} onChange={(e) => updateDraft(d => ({ ...d, hero: { ...d.hero, primaryCta: { ...d.hero.primaryCta, href: e.target.value } } }))} /></label>
            </div>
            <h4 style={{ marginTop: 12 }}>Secundário</h4>
            <div className="form-row">
              <label>Rótulo <input type="text" value={draft.hero.secondaryCta.label} onChange={(e) => updateDraft(d => ({ ...d, hero: { ...d.hero, secondaryCta: { ...d.hero.secondaryCta, label: e.target.value } } }))} /></label>
              <label>Link <input type="text" value={draft.hero.secondaryCta.href} onChange={(e) => updateDraft(d => ({ ...d, hero: { ...d.hero, secondaryCta: { ...d.hero.secondaryCta, href: e.target.value } } }))} /></label>
            </div>
          </section>
        </div>
      )}

      {activeTab === "produtos" && (
        <div className="dashboard-grid">
          <section className="form-section panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3>Vitrines de Produtos</h3>
              <button className="ghost-button compact" type="button" onClick={() => updateDraft(d => ({ ...d, products: [...d.products, { id: Date.now().toString(), tag: "NOVO", imageUrl: "", title: "Novo Produto", specs: "", oldPrice: "", price: "R$ 0,00", reviews: "0", active: true }] }))}>
                <Plus size={14} /> Adicionar
              </button>
            </div>
            {draft.products.map((prod, idx) => (
              <div key={prod.id} style={{ border: '1px solid var(--border)', padding: 12, borderRadius: 8, marginBottom: 12 }}>
                <div className="form-row">
                  <label>Título <input type="text" value={prod.title} onChange={(e) => updateDraft(d => { const p = [...d.products]; p[idx].title = e.target.value; return { ...d, products: p }; })} /></label>
                  <label>Tag (ex: MAIS VENDIDO) <input type="text" value={prod.tag} onChange={(e) => updateDraft(d => { const p = [...d.products]; p[idx].tag = e.target.value; return { ...d, products: p }; })} /></label>
                </div>
                <div className="form-row">
                  <label>Preço Novo <input type="text" value={prod.price} onChange={(e) => updateDraft(d => { const p = [...d.products]; p[idx].price = e.target.value; return { ...d, products: p }; })} /></label>
                  <label>Preço Antigo <input type="text" value={prod.oldPrice} onChange={(e) => updateDraft(d => { const p = [...d.products]; p[idx].oldPrice = e.target.value; return { ...d, products: p }; })} /></label>
                </div>
                <label>Especificações <input type="text" value={prod.specs} onChange={(e) => updateDraft(d => { const p = [...d.products]; p[idx].specs = e.target.value; return { ...d, products: p }; })} /></label>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 8 }}>
                  <label style={{ display: 'flex', gap: 8, alignItems: 'center', margin: 0 }}>
                    <input type="checkbox" checked={prod.active} onChange={(e) => updateDraft(d => { const p = [...d.products]; p[idx].active = e.target.checked; return { ...d, products: p }; })} />
                    Ativo
                  </label>
                  <button className="ghost-button compact danger" type="button" onClick={() => updateDraft(d => { const p = [...d.products]; p.splice(idx, 1); return { ...d, products: p }; })}>
                    Remover
                  </button>
                </div>
              </div>
            ))}
          </section>
        </div>
      )}

      {activeTab === "textos" && (
        <div className="dashboard-grid">
          <section className="form-section panel">
            <h3>Por que nos escolher? (Benefícios)</h3>
            {draft.benefits.map((ben, idx) => (
              <div key={ben.id} style={{ marginBottom: 16 }}>
                <div className="form-row">
                  <label>Rótulo <input type="text" value={ben.label} onChange={(e) => updateDraft(d => { const b = [...d.benefits]; b[idx].label = e.target.value; return { ...d, benefits: b }; })} /></label>
                  <label>Título <input type="text" value={ben.title} onChange={(e) => updateDraft(d => { const b = [...d.benefits]; b[idx].title = e.target.value; return { ...d, benefits: b }; })} /></label>
                </div>
                <label>Texto Descritivo
                  <textarea rows={2} value={ben.text} onChange={(e) => updateDraft(d => { const b = [...d.benefits]; b[idx].text = e.target.value; return { ...d, benefits: b }; })} />
                </label>
              </div>
            ))}
          </section>
        </div>
      )}

      {activeTab === "depoimentos" && (
        <div className="dashboard-grid">
          <section className="form-section panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3>Depoimentos de Clientes</h3>
              <button className="ghost-button compact" type="button" onClick={() => updateDraft(d => ({ ...d, testimonials: [...d.testimonials, { id: Date.now().toString(), name: "Novo Cliente", role: "Cliente", text: "", initials: "NC", active: true }] }))}>
                <Plus size={14} /> Adicionar
              </button>
            </div>
            {draft.testimonials.map((testi, idx) => (
              <div key={testi.id} style={{ border: '1px solid var(--border)', padding: 12, borderRadius: 8, marginBottom: 12 }}>
                <div className="form-row">
                  <label>Nome <input type="text" value={testi.name} onChange={(e) => updateDraft(d => { const t = [...d.testimonials]; t[idx].name = e.target.value; return { ...d, testimonials: t }; })} /></label>
                  <label>Cargo / Perfil <input type="text" value={testi.role} onChange={(e) => updateDraft(d => { const t = [...d.testimonials]; t[idx].role = e.target.value; return { ...d, testimonials: t }; })} /></label>
                  <label style={{ flex: 0.3 }}>Sigla <input type="text" maxLength={2} value={testi.initials} onChange={(e) => updateDraft(d => { const t = [...d.testimonials]; t[idx].initials = e.target.value; return { ...d, testimonials: t }; })} /></label>
                </div>
                <label>Depoimento <textarea rows={2} value={testi.text} onChange={(e) => updateDraft(d => { const t = [...d.testimonials]; t[idx].text = e.target.value; return { ...d, testimonials: t }; })} /></label>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 8 }}>
                  <label style={{ display: 'flex', gap: 8, alignItems: 'center', margin: 0 }}>
                    <input type="checkbox" checked={testi.active} onChange={(e) => updateDraft(d => { const t = [...d.testimonials]; t[idx].active = e.target.checked; return { ...d, testimonials: t }; })} />
                    Ativo
                  </label>
                  <button className="ghost-button compact danger" type="button" onClick={() => updateDraft(d => { const t = [...d.testimonials]; t.splice(idx, 1); return { ...d, testimonials: t }; })}>
                    Remover
                  </button>
                </div>
              </div>
            ))}
          </section>
        </div>
      )}

      {activeTab === "rodape" && (
        <div className="dashboard-grid">
          <section className="form-section panel">
            <h3>Newsletter (Captura)</h3>
            <label>Título <input type="text" value={draft.newsletter.title} onChange={(e) => updateDraft(d => ({ ...d, newsletter: { ...d.newsletter, title: e.target.value } }))} /></label>
            <label>Subtítulo <input type="text" value={draft.newsletter.subtitle} onChange={(e) => updateDraft(d => ({ ...d, newsletter: { ...d.newsletter, subtitle: e.target.value } }))} /></label>
            <div className="form-row">
              <label>WhatsApp Destino <input type="text" value={draft.newsletter.whatsapp} onChange={(e) => updateDraft(d => ({ ...d, newsletter: { ...d.newsletter, whatsapp: e.target.value } }))} /></label>
              <label>Mensagem Padrão <input type="text" value={draft.newsletter.message} onChange={(e) => updateDraft(d => ({ ...d, newsletter: { ...d.newsletter, message: e.target.value } }))} /></label>
            </div>
          </section>

          <section className="form-section panel">
            <h3>Rodapé</h3>
            <label>Descrição Curta <textarea rows={2} value={draft.footer.description} onChange={(e) => updateDraft(d => ({ ...d, footer: { ...d.footer, description: e.target.value } }))} /></label>
            <label>Copyright <input type="text" value={draft.footer.copyright} onChange={(e) => updateDraft(d => ({ ...d, footer: { ...d.footer, copyright: e.target.value } }))} /></label>
          </section>
        </div>
      )}

    </div>
  );
}

`;

let s = fs.readFileSync('src/components/graphflow-app.tsx', 'utf8');

// 1. Insert LandingPageView right before SettingsView
if (!s.includes('function LandingPageView')) {
  s = s.replace('function SettingsView(', landingViewCode + 'function SettingsView(');
}

// 2. Insert the rendering inside GraphflowApp
const targetRender = '{view === "settings" ? (';
const replacementRender = '{view === "landing" ? (\n            <LandingPageView onRefreshData={refreshData} />\n          ) : null}\n\n          {view === "settings" ? (';

if (!s.includes('<LandingPageView')) {
  s = s.replace(targetRender, replacementRender);
}

fs.writeFileSync('src/components/graphflow-app.tsx', s, 'utf8');
console.log('Successfully injected LandingPageView');
