import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Download, Send, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { listMaterias, MateriaRow } from "@/lib/cms";

type SubscriberRow = {
  id: string;
  email: string;
  name: string | null;
  status: "active" | "unsubscribed" | "bounced";
  created_at: string;
  unsubscribed_at: string | null;
};

function statusLabel(status: SubscriberRow["status"]) {
  if (status === "active") return "Ativo";
  if (status === "unsubscribed") return "Descadastrado";
  return "Bounce";
}

function toPtDate(d?: string | null) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("pt-BR");
  } catch {
    return "—";
  }
}

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildMateriaHtml(m: MateriaRow, baseUrl: string) {
  const title = escapeHtml(m.titulo || "");
  const resumo = escapeHtml(m.resumo || "");
  // você usa /materias/{id} no admin preview; no público pode ser slug.
  // Aqui vou usar id (padrão garantido). Se preferir slug depois, a gente troca.
  const url = `${baseUrl}/materias/${m.id}`;

  const image = (m as any).imagem || (m as any).capa || (m as any).banner || "";

  return `
  <div style="font-family: Arial, sans-serif; color:#111; line-height:1.5; max-width: 640px; margin: 0 auto;">
    <div style="padding: 24px 16px;">
      <h1 style="font-size: 22px; margin: 0 0 12px;">${title}</h1>
      ${
        image
          ? `<img src="${image}" alt="${title}" style="width:100%; border-radius: 12px; margin: 12px 0 16px;" />`
          : ""
      }
      <p style="margin:0 0 16px; color:#333;">${resumo}</p>
      <a href="${url}" style="display:inline-block; background:#0f3d2e; color:#fff; text-decoration:none; padding: 10px 14px; border-radius: 10px; font-weight: 700;">
        Ler matéria completa
      </a>
      <p style="margin:18px 0 0; font-size: 12px; color:#666;">
        Você está recebendo este email porque se cadastrou na newsletter da Rede Kalunga Comunicações.
      </p>
    </div>
  </div>
  `;
}

export function AdminNewsletter() {
  const [subs, setSubs] = useState<SubscriberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  // modal campanha
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"materia" | "custom">("materia");

  // matérias
  const [materias, setMaterias] = useState<MateriaRow[]>([]);
  const [loadingMaterias, setLoadingMaterias] = useState(false);
  const [materiaId, setMateriaId] = useState<string>("");

  // custom
  const [subject, setSubject] = useState("");
  const [html, setHtml] = useState("");

  // geral
  const [baseUrl, setBaseUrl] = useState(() => window.location.origin);
  const [sending, setSending] = useState(false);
  const [testEmail, setTestEmail] = useState("");

  async function loadSubscribers() {
    setLoading(true);
    const { data, error } = await supabase
      .from("newsletter_subscribers")
      .select("id,email,name,status,created_at,unsubscribed_at")
      .order("created_at", { ascending: false });

    if (!error && data) setSubs(data as any);
    setLoading(false);
  }

  async function loadMateriasForPick() {
    setLoadingMaterias(true);
    const { data, error } = await listMaterias();
    if (!error && data) setMaterias(data as MateriaRow[]);
    setLoadingMaterias(false);
  }

  useEffect(() => {
    loadSubscribers();
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return subs;
    return subs.filter((s) => {
      const a = (s.email || "").toLowerCase();
      const b = (s.name || "").toLowerCase();
      return a.includes(needle) || b.includes(needle) || statusLabel(s.status).toLowerCase().includes(needle);
    });
  }, [subs, q]);

  const activeCount = useMemo(() => subs.filter((s) => s.status === "active").length, [subs]);

  function exportCsv() {
    const rows = subs.map((s) => ({
      email: s.email,
      name: s.name || "",
      status: s.status,
      created_at: s.created_at,
    }));

    const header = ["email", "name", "status", "created_at"];
    const csv = [
      header.join(","),
      ...rows.map((r) =>
        header
          .map((k) => {
            const v = (r as any)[k] ?? "";
            const str = String(v).replaceAll('"', '""');
            return `"${str}"`;
          })
          .join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "newsletter_subscribers.csv";
    a.click();

    URL.revokeObjectURL(url);
  }

  function resetCampaign() {
    setTab("materia");
    setMateriaId("");
    setSubject("");
    setHtml("");
    setTestEmail("");
    setSending(false);
    setBaseUrl(window.location.origin);
  }

  async function openCampaignModal() {
    resetCampaign();
    setOpen(true);
    // carrega matérias só quando abrir
    if (!materias.length) await loadMateriasForPick();
  }

  async function sendCampaign(mode: "test" | "all") {
    if (sending) return;

    let finalSubject = subject.trim();
    let finalHtml = html.trim();

    if (tab === "materia") {
      const m = materias.find((x) => x.id === materiaId);
      if (!m) {
        alert("Selecione uma matéria.");
        return;
      }
      if (!finalSubject) finalSubject = m.titulo || "Nova matéria • Rede Kalunga Comunicações";
      finalHtml = buildMateriaHtml(m, baseUrl);
    } else {
      if (!finalSubject) {
        alert("Informe o assunto.");
        return;
      }
      if (!finalHtml) {
        alert("Informe o HTML do email.");
        return;
      }
    }

    if (mode === "test") {
      if (!testEmail.trim()) {
        alert("Informe um email para teste.");
        return;
      }
    }

    setSending(true);

    const payload: any = {
      type: tab === "materia" ? "materia" : "custom",
      subject: finalSubject,
      html: finalHtml,
      baseUrl,
      // opcional
      materia_id: tab === "materia" ? materiaId : null,
      mode,
      test_email: mode === "test" ? testEmail.trim() : null,
    };

    const { data, error } = await supabase.functions.invoke("newsletter-send-campaign", {
      body: payload,
    });

    setSending(false);

    if (error) {
      alert(error.message || "Erro ao enviar campanha.");
      return;
    }

    alert(
      mode === "test"
        ? "Teste enviado com sucesso."
        : "Disparo iniciado/enviado. Verifique o histórico no Supabase (newsletter_campaigns)."
    );

    setOpen(false);
    await loadSubscribers();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Newsletter</h1>
          <p className="text-muted-foreground mt-1">
            Inscritos: <b>{subs.length}</b> • Ativos: <b>{activeCount}</b>
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={exportCsv}
            className="inline-flex items-center justify-center rounded-md border bg-card px-4 py-2 text-sm font-medium shadow-sm hover:bg-muted"
            title="Exportar CSV"
          >
            <Download className="mr-2 h-4 w-4" />
            Exportar
          </button>

          <button
            onClick={openCampaignModal}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
          >
            <Plus className="mr-2 h-4 w-4" />
            Novo disparo
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 bg-card p-4 rounded-lg border shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="search"
            placeholder="Buscar inscritos (email, nome, status)..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full rounded-md border border-input bg-background pl-9 pr-4 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
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
                <th className="px-6 py-3 font-medium">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td className="px-6 py-4 text-muted-foreground" colSpan={4}>
                    Carregando...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td className="px-6 py-4 text-muted-foreground" colSpan={4}>
                    Nenhum inscrito encontrado.
                  </td>
                </tr>
              ) : (
                filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-muted/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-foreground">{s.email}</td>
                    <td className="px-6 py-4">{s.name || "—"}</td>
                    <td className="px-6 py-4">{statusLabel(s.status)}</td>
                    <td className="px-6 py-4">{toPtDate(s.created_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal - Novo Disparo */}
      {open && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-3xl rounded-lg bg-background border shadow-lg overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div>
                <h2 className="text-lg font-bold">Novo disparo</h2>
                <p className="text-sm text-muted-foreground">Escolha uma matéria ou faça um email personalizado.</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-2 rounded-md hover:bg-muted"
                title="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex gap-2">
                <button
                  onClick={() => setTab("materia")}
                  className={`px-3 py-2 rounded-md text-sm font-medium border ${
                    tab === "materia" ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"
                  }`}
                >
                  Disparo por Matéria
                </button>
                <button
                  onClick={() => setTab("custom")}
                  className={`px-3 py-2 rounded-md text-sm font-medium border ${
                    tab === "custom" ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"
                  }`}
                >
                  Personalizado (HTML)
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* base url */}
                <div className="space-y-1">
                  <label className="text-sm font-medium">URL do site (para links)</label>
                  <input
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    placeholder="https://kalungacomunicacoes.org"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>

                {/* assunto */}
                <div className="space-y-1">
                  <label className="text-sm font-medium">Assunto</label>
                  <input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder={tab === "materia" ? "Deixe vazio para usar o título da matéria" : "Assunto do email"}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
              </div>

              {tab === "materia" ? (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Selecione a matéria</label>
                  <select
                    value={materiaId}
                    onChange={(e) => setMateriaId(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">{loadingMaterias ? "Carregando..." : "— Selecione —"}</option>
                    {materias.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.titulo}
                      </option>
                    ))}
                  </select>

                  <p className="text-xs text-muted-foreground">
                    O email será montado automaticamente com resumo e botão “Ler matéria completa”.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-sm font-medium">HTML do email</label>
                  <textarea
                    value={html}
                    onChange={(e) => setHtml(e.target.value)}
                    placeholder="<h1>Olá!</h1><p>Seu conteúdo aqui...</p>"
                    className="w-full min-h-[180px] rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <p className="text-xs text-muted-foreground">
                    Dica: use HTML simples. O envio real é feito pela Edge Function via SMTP (Hostinger).
                  </p>
                </div>
              )}

              <div className="rounded-md border bg-card p-4 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Enviar teste para</label>
                    <input
                      value={testEmail}
                      onChange={(e) => setTestEmail(e.target.value)}
                      placeholder="seuemail@dominio.com"
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>

                  <div className="flex items-end gap-2">
                    <button
                      disabled={sending}
                      onClick={() => sendCampaign("test")}
                      className="inline-flex w-full items-center justify-center rounded-md border bg-background px-4 py-2 text-sm font-medium shadow-sm hover:bg-muted disabled:opacity-60"
                      title="Enviar teste"
                    >
                      <Send className="mr-2 h-4 w-4" />
                      Enviar teste
                    </button>
                  </div>
                </div>

                <button
                  disabled={sending}
                  onClick={() => sendCampaign("all")}
                  className="inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-60"
                  title="Enviar para inscritos ativos"
                >
                  <Send className="mr-2 h-4 w-4" />
                  Enviar para inscritos ativos
                </button>

                <p className="text-xs text-muted-foreground">
                  Esse botão dispara para <b>todos com status “active”</b>.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
