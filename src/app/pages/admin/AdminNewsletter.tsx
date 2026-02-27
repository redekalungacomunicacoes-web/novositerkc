import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Plus, Send, Mail, Users, RefreshCw, Trash2, Eye, Settings } from "lucide-react";
import { NewsletterEmailConfig } from "./newsletter/NewsletterEmailConfig";

type Subscriber = {
  id: string;
  email: string;
  name: string | null;
  status: "active" | "unsubscribed" | "bounced";
  created_at: string;
};

type CampaignStatus = "draft" | "scheduled" | "sending" | "sent" | "failed";

type Campaign = {
  id: string;
  title: string;
  subject: string;
  mode: "custom" | "materia";
  materia_id: string | null;
  content_html: string;
  status: CampaignStatus;
  sent_count: number | null;
  fail_count: number | null;
  created_at: string;
};

type MateriaLite = {
  id: string;
  titulo: string;
  resumo?: string | null;
  slug?: string | null;
};

function toBR(d?: string | null) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString("pt-BR");
  } catch {
    return d;
  }
}

function normalizeStatus(s: any): CampaignStatus {
  const v = String(s || "draft");
  if (v === "draft" || v === "scheduled" || v === "sending" || v === "sent" || v === "failed") return v;
  // se tiver coisa antiga no banco (ex: "paused"), rebaixa pra draft
  return "draft";
}


async function getInvokeErrorDetails(error: any): Promise<{ status?: number; details: string }> {
  const status = error?.context?.status;

  if (error?.context && typeof error.context.text === "function") {
    try {
      const details = await error.context.text();
      if (details && String(details).trim()) {
        return { status, details: String(details).trim() };
      }
    } catch {
      // fallback para message
    }
  }

  return {
    status,
    details: String(error?.message || "Erro ao invocar a função de newsletter."),
  };
}

export function AdminNewsletter() {
  const [tab, setTab] = useState<"campaigns" | "subscribers" | "config">("campaigns");

  // subscribers
  const [subs, setSubs] = useState<Subscriber[]>([]);
  const [subsLoading, setSubsLoading] = useState(false);
  const [subsQ, setSubsQ] = useState("");

  // campaigns
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campLoading, setCampLoading] = useState(false);

  // materias (para escolher)
  const [materias, setMaterias] = useState<MateriaLite[]>([]);
  const [materiasLoading, setMateriasLoading] = useState(false);

  // modal campanha
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    title: "",
    subject: "",
    mode: "custom" as "custom" | "materia",
    materia_id: "" as string,
    site_url: "https://kalungacomunicacoes.org",
    content_html: "",
  });

  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [sendingTest, setSendingTest] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [sendingAll, setSendingAll] = useState(false);
  const [sendLog, setSendLog] = useState<string | null>(null);

  async function loadSubscribers() {
    setSubsLoading(true);
    const { data, error } = await supabase
      .from("newsletter_subscribers")
      .select("id,email,name,status,created_at")
      .order("created_at", { ascending: false })
      .limit(1000);

    if (!error && data) setSubs(data as any);
    setSubsLoading(false);
  }

  async function loadCampaigns() {
    setCampLoading(true);
    const { data, error } = await supabase
      .from("newsletter_campaigns")
      .select("id,title,subject,mode,materia_id,content_html,status,sent_count,fail_count,created_at")
      .order("created_at", { ascending: false })
      .limit(200);

    if (!error && data) {
      const normalized = (data as any[]).map((c) => ({
        ...c,
        status: normalizeStatus(c.status),
      }));
      setCampaigns(normalized as any);
    }

    setCampLoading(false);
  }

  async function loadMateriasLite() {
    setMateriasLoading(true);

    const { data, error } = await supabase
      .from("materias")
      .select("id,titulo,resumo,slug")
      .order("created_at", { ascending: false })
      .limit(200);

    if (!error && data) setMaterias(data as any);
    setMateriasLoading(false);
  }

  useEffect(() => {
    loadCampaigns();
    loadSubscribers();
    loadMateriasLite();
  }, []);

  const filteredSubs = useMemo(() => {
    const needle = subsQ.trim().toLowerCase();
    if (!needle) return subs;
    return subs.filter(
      (s) =>
        (s.email || "").toLowerCase().includes(needle) ||
        (s.name || "").toLowerCase().includes(needle),
    );
  }, [subs, subsQ]);

  function openNewCampaign() {
    setSelectedCampaign(null);
    setSendLog(null);
    setForm({
      title: "",
      subject: "",
      mode: "custom",
      materia_id: "",
      site_url: "https://kalungacomunicacoes.org",
      content_html: "",
    });
    setOpen(true);
  }

  function openEditCampaign(c: Campaign) {
    setSelectedCampaign(c);
    setSendLog(null);
    setForm({
      title: c.title || "",
      subject: c.subject || "",
      mode: c.mode || "custom",
      materia_id: c.materia_id || "",
      site_url: "https://kalungacomunicacoes.org",
      content_html: c.content_html || "",
    });
    setOpen(true);
  }

  async function saveCampaign() {
    if (!form.title.trim() || !form.subject.trim()) {
      alert("Preencha o título e o assunto.");
      return;
    }

    if (form.mode === "materia" && !form.materia_id) {
      alert("Selecione uma matéria.");
      return;
    }

    setSaving(true);

    let finalHtml = form.content_html;

    // Se for matéria: gera um HTML básico com título/resumo/link
    if (form.mode === "materia") {
      const m = materias.find((x) => x.id === form.materia_id);
      if (!m) {
        setSaving(false);
        alert("Matéria não encontrada na lista.");
        return;
      }

      const link = m.slug
        ? `${form.site_url}/materias/${m.slug}`
        : `${form.site_url}/materias/${m.id}`;

      finalHtml = `
        <h3 style="margin:0 0 8px;">${m.titulo}</h3>
        ${m.resumo ? `<p style="margin:0 0 14px; color:#333;">${m.resumo}</p>` : ""}
        <p style="margin:0;">
          <a href="${link}" target="_blank" rel="noopener noreferrer"
             style="display:inline-block; padding:10px 14px; background:#0F7A3E; color:#fff; text-decoration:none; border-radius:10px;">
            Ler matéria
          </a>
        </p>
      `;
    } else {
      if (!finalHtml.trim()) {
        setSaving(false);
        alert("No modo personalizado, preencha o HTML do email.");
        return;
      }
    }

    const statusForSave: CampaignStatus = selectedCampaign
      ? normalizeStatus(selectedCampaign.status)
      : "draft";

    const payload = {
      title: form.title.trim(),
      subject: form.subject.trim(),

      // sua tabela tem `mode` (text)
      mode: form.mode,

      // sua tabela tem `type` NOT NULL (print anterior)
      type: form.mode,

      materia_id: form.mode === "materia" ? form.materia_id : null,
      content_html: finalHtml,

      status: statusForSave,
    };

    if (selectedCampaign) {
      const { error } = await supabase
        .from("newsletter_campaigns")
        .update(payload)
        .eq("id", selectedCampaign.id);

      if (error) alert(error.message);
    } else {
      const { error } = await supabase
        .from("newsletter_campaigns")
        .insert(payload);

      if (error) alert(error.message);
    }

    setSaving(false);
    setOpen(false);
    await loadCampaigns();
  }

  async function deleteCampaign(id: string) {
    if (!confirm("Excluir esta campanha?")) return;
    const { error } = await supabase.from("newsletter_campaigns").delete().eq("id", id);
    if (error) alert(error.message);
    await loadCampaigns();
  }

  async function sendTest() {
    if (!selectedCampaign) {
      alert("Salve a campanha antes de enviar teste.");
      return;
    }
    if (!testEmail.trim() || !testEmail.includes("@")) {
      alert("Digite um email de teste válido.");
      return;
    }

    setSendingTest(true);
    setSendLog(null);

    try {
      const { data, error } = await supabase.functions.invoke("newsletter-send-campaign", {
        body: {
          mode: "test",
          campaign_id: selectedCampaign.id,
          test_email: testEmail.trim().toLowerCase(),
        },
      });

      if (error) {
        const { status, details } = await getInvokeErrorDetails(error);
        const statusPrefix = typeof status === "number" ? `(${status}) ` : "";
        setSendLog(`❌ ${statusPrefix}${details}`);
        return;
      }

      const sent = Number(data?.sent || 0);
      const failed = Number(data?.failed || 0);
      setSendLog(`✅ Teste concluído. Enviados: ${sent} | Falhas: ${failed}`);
    } finally {
      setSendingTest(false);
    }

    await loadCampaigns();
  }

  async function sendCampaignAll() {
    if (!selectedCampaign) {
      alert("Selecione uma campanha.");
      return;
    }
    if (selectedCampaign.status === "sent") {
      alert("Essa campanha já está marcada como enviada.");
      return;
    }

    setSendingAll(true);
    setSendLog("Iniciando envio para todos inscritos...");

    try {
      const { data, error } = await supabase.functions.invoke("newsletter-send-campaign", {
        body: {
          mode: "all",
          campaign_id: selectedCampaign.id,
        },
      });

      if (error) {
        const { status, details } = await getInvokeErrorDetails(error);
        const statusPrefix = typeof status === "number" ? `(${status}) ` : "";
        setSendLog(`❌ ${statusPrefix}${details}`);
        return;
      }

      const sent = Number(data?.sent || 0);
      const failed = Number(data?.failed || 0);
      const status = String(data?.status || "—");
      setSendLog(`✅ Concluído. Status: ${status} | Enviados: ${sent} | Falhas: ${failed}`);
    } finally {
      setSendingAll(false);
    }

    await loadCampaigns();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Newsletter</h1>
          <p className="text-muted-foreground mt-1">
            Campanhas, inscritos e disparos de email marketing.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => {
              loadCampaigns();
              loadSubscribers();
              loadMateriasLite();
            }}
            className="inline-flex items-center gap-2 rounded-md border bg-background px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </button>

          {tab === "campaigns" && (
            <button
              onClick={openNewCampaign}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              Nova Campanha
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setTab("campaigns")}
          className={`px-4 py-2 rounded-md text-sm font-medium border ${
            tab === "campaigns"
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-background hover:bg-muted"
          }`}
        >
          Campanhas
        </button>

        <button
          onClick={() => setTab("subscribers")}
          className={`px-4 py-2 rounded-md text-sm font-medium border ${
            tab === "subscribers"
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-background hover:bg-muted"
          }`}
        >
          Inscritos
        </button>

        <button
          onClick={() => setTab("config")}
          className={`px-4 py-2 rounded-md text-sm font-medium border inline-flex items-center gap-2 ${
            tab === "config"
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-background hover:bg-muted"
          }`}
        >
          <Settings className="h-4 w-4" />
          Configuração de E-mail
        </button>
      </div>

      {/* CONFIG */}
      {tab === "config" && (
        <div className="rounded-md border bg-card shadow-sm overflow-hidden">
          <NewsletterEmailConfig />
        </div>
      )}

      {/* Campaigns */}
      {tab === "campaigns" && (
        <div className="rounded-md border bg-card shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-6 py-3 font-medium">Título</th>
                  <th className="px-6 py-3 font-medium">Assunto</th>
                  <th className="px-6 py-3 font-medium">Tipo</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Enviados</th>
                  <th className="px-6 py-3 font-medium">Falhas</th>
                  <th className="px-6 py-3 font-medium">Criada</th>
                  <th className="px-6 py-3 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {campLoading ? (
                  <tr>
                    <td className="px-6 py-4 text-muted-foreground" colSpan={8}>
                      Carregando...
                    </td>
                  </tr>
                ) : campaigns.length === 0 ? (
                  <tr>
                    <td className="px-6 py-4 text-muted-foreground" colSpan={8}>
                      Nenhuma campanha criada ainda.
                    </td>
                  </tr>
                ) : (
                  campaigns.map((c) => (
                    <tr key={c.id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-6 py-4 font-medium">{c.title}</td>
                      <td className="px-6 py-4">{c.subject}</td>
                      <td className="px-6 py-4">
                        {c.mode === "materia" ? "Matéria" : "Personalizado"}
                      </td>
                      <td className="px-6 py-4">{c.status}</td>
                      <td className="px-6 py-4">{c.sent_count ?? 0}</td>
                      <td className="px-6 py-4">{c.fail_count ?? 0}</td>
                      <td className="px-6 py-4">{toBR(c.created_at)}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEditCampaign(c)}
                            className="p-2 hover:bg-muted rounded-full text-muted-foreground hover:text-foreground transition-colors"
                            title="Abrir"
                          >
                            <Eye className="h-4 w-4" />
                          </button>

                          <button
                            onClick={() => deleteCampaign(c.id)}
                            className="p-2 hover:bg-muted rounded-full text-red-600 hover:text-red-700 transition-colors"
                            title="Excluir"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Subscribers */}
      {tab === "subscribers" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 bg-card p-4 rounded-lg border shadow-sm">
            <div className="relative flex-1">
              <input
                type="search"
                placeholder="Buscar inscritos por nome/email..."
                value={subsQ}
                onChange={(e) => setSubsQ(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              {subs.length} inscritos
            </div>
          </div>

          <div className="rounded-md border bg-card shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="px-6 py-3 font-medium">Email</th>
                    <th className="px-6 py-3 font-medium">Nome</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                    <th className="px-6 py-3 font-medium">Inscrito em</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {subsLoading ? (
                    <tr>
                      <td className="px-6 py-4 text-muted-foreground" colSpan={4}>
                        Carregando...
                      </td>
                    </tr>
                  ) : filteredSubs.length === 0 ? (
                    <tr>
                      <td className="px-6 py-4 text-muted-foreground" colSpan={4}>
                        Nenhum inscrito encontrado.
                      </td>
                    </tr>
                  ) : (
                    filteredSubs.map((s) => (
                      <tr key={s.id} className="hover:bg-muted/50 transition-colors">
                        <td className="px-6 py-4 font-medium">{s.email}</td>
                        <td className="px-6 py-4">{s.name || "—"}</td>
                        <td className="px-6 py-4">{s.status}</td>
                        <td className="px-6 py-4">{toBR(s.created_at)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal criar/editar campanha */}
      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-3xl rounded-xl bg-background border shadow-lg overflow-hidden">
            <div className="p-5 border-b flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold">
                  {selectedCampaign ? "Editar Campanha" : "Nova Campanha"}
                </h2>
                <p className="text-sm text-muted-foreground">
                  Crie uma campanha por matéria ou com HTML personalizado.
                </p>
              </div>

              <button
                className="px-3 py-1 rounded-md border hover:bg-muted text-sm"
                onClick={() => setOpen(false)}
              >
                Fechar
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Título interno</label>
                  <input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                    placeholder="Ex: Fevereiro/2026 - Edição 01"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Assunto do email</label>
                  <input
                    value={form.subject}
                    onChange={(e) => setForm({ ...form, subject: e.target.value })}
                    className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                    placeholder="Ex: Novidades do Território Kalunga"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Tipo</label>
                  <select
                    value={form.mode}
                    onChange={(e) => setForm({ ...form, mode: e.target.value as any })}
                    className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                  >
                    <option value="custom">Personalizado (HTML)</option>
                    <option value="materia">Disparo por Matéria</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium">URL do site</label>
                  <input
                    value={form.site_url}
                    onChange={(e) => setForm({ ...form, site_url: e.target.value })}
                    className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                    placeholder="https://kalungacomunicacoes.org"
                  />
                </div>
              </div>

              {form.mode === "materia" ? (
                <div>
                  <label className="text-sm font-medium">Escolha uma matéria</label>
                  <select
                    value={form.materia_id}
                    onChange={(e) => setForm({ ...form, materia_id: e.target.value })}
                    className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                  >
                    <option value="">
                      {materiasLoading ? "Carregando..." : "Selecione..."}
                    </option>
                    {materias.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.titulo}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">
                    O HTML será gerado automaticamente com título/resumo/botão.
                  </p>
                </div>
              ) : (
                <div>
                  <label className="text-sm font-medium">HTML do email</label>
                  <textarea
                    value={form.content_html}
                    onChange={(e) => setForm({ ...form, content_html: e.target.value })}
                    className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm min-h-[180px]"
                    placeholder="<h3>Olá...</h3><p>Conteúdo...</p>"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Dica: use HTML simples.
                  </p>
                </div>
              )}

              {sendLog && (
                <div className="rounded-md border bg-muted/30 px-4 py-3 text-sm">
                  {sendLog}
                </div>
              )}

              {/* Ações */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-2 border-t">
                <div className="flex gap-2">
                  <button
                    onClick={saveCampaign}
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                  >
                    {saving ? "Salvando..." : "Salvar campanha"}
                  </button>

                  {selectedCampaign && (
                    <button
                      onClick={sendCampaignAll}
                      disabled={sendingAll}
                      className="inline-flex items-center gap-2 rounded-md bg-[#0F7A3E] px-4 py-2 text-sm font-medium text-white hover:bg-[#0d6633] disabled:opacity-60"
                      title="Envia para todos inscritos"
                    >
                      <Send className="h-4 w-4" />
                      {sendingAll ? "Enviando..." : "Enviar campanha"}
                    </button>
                  )}
                </div>

                {selectedCampaign && (
                  <div className="flex flex-col md:flex-row gap-2 md:items-center">
                    <div className="relative">
                      <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <input
                        value={testEmail}
                        onChange={(e) => setTestEmail(e.target.value)}
                        className="w-full md:w-[260px] rounded-md border bg-background pl-9 pr-3 py-2 text-sm"
                        placeholder="email de teste"
                      />
                    </div>
                    <button
                      onClick={sendTest}
                      disabled={sendingTest}
                      className="inline-flex items-center gap-2 rounded-md border bg-background px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-60"
                      title="Envia apenas para o email de teste"
                    >
                      {sendingTest ? "Enviando..." : "Enviar teste"}
                    </button>
                  </div>
                )}
              </div>

              {selectedCampaign && (
                <div className="text-xs text-muted-foreground">
                  Status atual: <b>{selectedCampaign.status}</b> • Enviados:{" "}
                  <b>{selectedCampaign.sent_count ?? 0}</b> • Falhas:{" "}
                  <b>{selectedCampaign.fail_count ?? 0}</b>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
