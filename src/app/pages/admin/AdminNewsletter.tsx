import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Copy,
  Eye,
  FileText,
  LayoutDashboard,
  Loader2,
  Mail,
  Megaphone,
  Newspaper,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings,
  Trash2,
  Users,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { NewsletterEmailConfig } from "./newsletter/NewsletterEmailConfig";
import { newsletterAdmin, newsletterErrorText } from "./newsletter/api";

type TabKey = "overview" | "campaigns" | "audience" | "templates" | "settings";
type CampaignStatus = "draft" | "scheduled" | "sending" | "sent" | "failed";
type CampaignCategory = "newsletter" | "novidade" | "aviso" | "campanha";

type Subscriber = {
  id: string;
  email: string;
  name: string | null;
  status: "active" | "unsubscribed" | "bounced" | string;
  source: string | null;
  tags: string[] | null;
  created_at: string;
  subscribed_at: string | null;
  last_sent_at: string | null;
};

type Campaign = {
  id: string;
  title: string | null;
  subject: string;
  preview_text: string | null;
  category: CampaignCategory | null;
  mode: string | null;
  materia_id: string | null;
  content_html: string | null;
  content_json: Record<string, unknown> | null;
  audience_mode: string | null;
  audience_filter: Record<string, unknown> | null;
  template_id: string | null;
  status: CampaignStatus;
  total_recipients: number | null;
  sent_count: number | null;
  fail_count: number | null;
  open_count: number | null;
  created_at: string;
  sent_at: string | null;
};

type MateriaLite = {
  id: string;
  titulo: string;
  resumo?: string | null;
  slug?: string | null;
  capa_url?: string | null;
  capa_thumb_url?: string | null;
  published_at?: string | null;
  created_at?: string | null;
};

type Template = {
  id: string;
  name: string;
  slug: string;
  subject: string | null;
  preview_text: string | null;
  content_html: string;
  is_system: boolean;
  active: boolean;
  updated_at: string;
};

type Delivery = {
  id: string;
  campaign_id: string;
  subscriber_id: string | null;
  email: string;
  status: string;
  error_message: string | null;
  sent_at: string | null;
  opened_at: string | null;
  open_count: number;
  created_at: string;
};

type CampaignForm = {
  title: string;
  subject: string;
  preview_text: string;
  category: CampaignCategory;
  materia_id: string;
  article_ids: string[];
  intro: string;
  notice_message: string;
  cta_label: string;
  cta_url: string;
  custom_html: string;
  template_id: string;
  audience_source: string;
  audience_tags: string;
};

const EMPTY_FORM: CampaignForm = {
  title: "",
  subject: "",
  preview_text: "",
  category: "newsletter",
  materia_id: "",
  article_ids: [],
  intro: "",
  notice_message: "",
  cta_label: "",
  cta_url: "",
  custom_html: "",
  template_id: "",
  audience_source: "",
  audience_tags: "",
};

const fieldClass =
  "mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none transition focus:ring-2 focus:ring-ring/30";

function toBR(value?: string | null) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("pt-BR");
  } catch {
    return value;
  }
}

function escapeHtml(value: string) {
  return (value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function categoryLabel(category?: string | null) {
  if (category === "novidade") return "Novidade";
  if (category === "aviso") return "Aviso";
  if (category === "campanha") return "Campanha";
  return "Newsletter";
}

function categoryIcon(category?: string | null) {
  if (category === "novidade") return Newspaper;
  if (category === "aviso") return Bell;
  if (category === "campanha") return Megaphone;
  return Mail;
}

function statusClasses(status: CampaignStatus | string) {
  if (status === "sent") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "sending") return "border-blue-200 bg-blue-50 text-blue-700";
  if (status === "failed") return "border-red-200 bg-red-50 text-red-700";
  if (status === "scheduled") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function StatusBadge({ status }: { status: CampaignStatus | string }) {
  const label =
    status === "sent"
      ? "Enviada"
      : status === "sending"
        ? "Enviando"
        : status === "failed"
          ? "Com falhas"
          : status === "scheduled"
            ? "Agendada"
            : "Rascunho";

  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusClasses(status)}`}>{label}</span>;
}

export function AdminNewsletter() {
  const [tab, setTab] = useState<TabKey>("overview");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [materias, setMaterias] = useState<MateriaLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const [subscriberQuery, setSubscriberQuery] = useState("");
  const [campaignOpen, setCampaignOpen] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [form, setForm] = useState<CampaignForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [operationMessage, setOperationMessage] = useState<string | null>(null);

  async function loadAll() {
    setLoading(true);
    setGlobalError(null);

    const [campaignRes, subscriberRes, templateRes, deliveryRes, materiaRes] = await Promise.all([
      supabase
        .from("newsletter_campaigns")
        .select(
          "id,title,subject,preview_text,category,mode,materia_id,content_html,content_json,audience_mode,audience_filter,template_id,status,total_recipients,sent_count,fail_count,open_count,created_at,sent_at",
        )
        .order("created_at", { ascending: false })
        .limit(300),
      supabase
        .from("newsletter_subscribers")
        .select("id,email,name,status,source,tags,created_at,subscribed_at,last_sent_at")
        .order("created_at", { ascending: false })
        .limit(3000),
      supabase
        .from("newsletter_templates")
        .select("id,name,slug,subject,preview_text,content_html,is_system,active,updated_at")
        .eq("active", true)
        .order("is_system", { ascending: false })
        .order("name", { ascending: true }),
      supabase
        .from("newsletter_deliveries")
        .select("id,campaign_id,subscriber_id,email,status,error_message,sent_at,opened_at,open_count,created_at")
        .order("created_at", { ascending: false })
        .limit(5000),
      supabase
        .from("materias")
        .select("id,titulo,resumo,slug,capa_url,capa_thumb_url,published_at,created_at")
        .eq("status", "published")
        .order("published_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

    const firstError =
      campaignRes.error || subscriberRes.error || templateRes.error || deliveryRes.error || materiaRes.error;

    if (firstError) {
      setGlobalError(firstError.message);
    }

    setCampaigns((campaignRes.data || []) as Campaign[]);
    setSubscribers((subscriberRes.data || []) as Subscriber[]);
    setTemplates((templateRes.data || []) as Template[]);
    setDeliveries((deliveryRes.data || []) as Delivery[]);
    setMaterias((materiaRes.data || []) as MateriaLite[]);
    setLoading(false);
  }

  useEffect(() => {
    void loadAll();
  }, []);

  const activeSubscribers = useMemo(
    () => subscribers.filter((subscriber) => subscriber.status === "active"),
    [subscribers],
  );

  const filteredSubscribers = useMemo(() => {
    const needle = subscriberQuery.trim().toLowerCase();
    if (!needle) return subscribers;
    return subscribers.filter((subscriber) =>
      [subscriber.email, subscriber.name || "", subscriber.source || "", ...(subscriber.tags || [])]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [subscriberQuery, subscribers]);

  const dashboard = useMemo(() => {
    const sentCampaigns = campaigns.filter((campaign) => campaign.status === "sent").length;
    const totalSent = campaigns.reduce((sum, campaign) => sum + Number(campaign.sent_count || 0), 0);
    const totalFailed = campaigns.reduce((sum, campaign) => sum + Number(campaign.fail_count || 0), 0);
    const openedRecipients = deliveries.filter((delivery) => Number(delivery.open_count || 0) > 0).length;
    const totalOpenEvents = deliveries.reduce((sum, delivery) => sum + Number(delivery.open_count || 0), 0);
    const deliverability = totalSent + totalFailed > 0 ? (totalSent / (totalSent + totalFailed)) * 100 : 100;
    const openRate = totalSent > 0 ? (openedRecipients / totalSent) * 100 : 0;

    return {
      sentCampaigns,
      totalSent,
      totalFailed,
      openedRecipients,
      totalOpenEvents,
      openRate,
      deliverability,
      unsubscribed: subscribers.filter((subscriber) => subscriber.status === "unsubscribed").length,
    };
  }, [campaigns, deliveries, subscribers]);

  const topReaders = useMemo(() => {
    const subscriberMap = new Map(subscribers.map((subscriber) => [subscriber.id, subscriber]));
    const campaignMap = new Map(campaigns.map((campaign) => [campaign.id, campaign]));
    const readers = new Map<
      string,
      {
        email: string;
        name: string;
        opens: number;
        subjects: Set<string>;
        lastOpenedAt: string | null;
      }
    >();

    for (const delivery of deliveries) {
      const opens = Number(delivery.open_count || 0);
      if (opens <= 0) continue;

      const subscriber = delivery.subscriber_id ? subscriberMap.get(delivery.subscriber_id) : undefined;
      const key = delivery.subscriber_id || delivery.email.toLowerCase();
      const current = readers.get(key) || {
        email: delivery.email,
        name: subscriber?.name || "Sem nome",
        opens: 0,
        subjects: new Set<string>(),
        lastOpenedAt: null,
      };

      current.opens += opens;
      const subject = campaignMap.get(delivery.campaign_id)?.subject;
      if (subject) current.subjects.add(subject);

      if (
        delivery.opened_at &&
        (!current.lastOpenedAt || new Date(delivery.opened_at) > new Date(current.lastOpenedAt))
      ) {
        current.lastOpenedAt = delivery.opened_at;
      }

      readers.set(key, current);
    }

    return [...readers.values()]
      .sort((a, b) => b.opens - a.opens)
      .slice(0, 10)
      .map((reader) => ({
        ...reader,
        subjects: [...reader.subjects].slice(0, 3),
      }));
  }, [campaigns, deliveries, subscribers]);

  function newCampaign() {
    const defaultTemplate = templates.find((template) => template.is_system) || templates[0];
    setSelectedCampaign(null);
    setForm({
      ...EMPTY_FORM,
      template_id: defaultTemplate?.id || "",
      article_ids: materias.slice(0, 3).map((materia) => materia.id),
    });
    setOperationMessage(null);
    setTestEmail("");
    setCampaignOpen(true);
  }

  function editCampaign(campaign: Campaign) {
    const json = campaign.content_json || {};
    const category = (campaign.category || (campaign.mode === "materia" ? "novidade" : "campanha")) as CampaignCategory;
    const filter = campaign.audience_filter || {};

    setSelectedCampaign(campaign);
    setForm({
      title: campaign.title || "",
      subject: campaign.subject || "",
      preview_text: campaign.preview_text || "",
      category,
      materia_id: campaign.materia_id || String(json.materia_id || ""),
      article_ids: Array.isArray(json.article_ids) ? (json.article_ids as string[]) : [],
      intro: String(json.intro || ""),
      notice_message: String(json.notice_message || ""),
      cta_label: String(json.cta_label || ""),
      cta_url: String(json.cta_url || ""),
      custom_html: category === "campanha" ? String(json.custom_html || campaign.content_html || "") : "",
      template_id: campaign.template_id || "",
      audience_source: typeof filter.source === "string" ? filter.source : "",
      audience_tags: Array.isArray(filter.tags) ? (filter.tags as string[]).join(", ") : "",
    });
    setOperationMessage(null);
    setTestEmail("");
    setCampaignOpen(true);
  }

  function materiaPreview(materia: MateriaLite) {
    const fallback = "Leia a nova matéria publicada pela Rede Kalunga Comunicações.";
    const source = String(materia.resumo || fallback).replace(/\s+/g, " ").trim();
    return source.length > 155 ? `${source.slice(0, 152).trimEnd()}…` : source;
  }

  function applyMateriaToForm(materiaId: string) {
    const materia = materias.find((item) => item.id === materiaId);

    if (!materia) {
      setForm((current) => ({ ...current, materia_id: materiaId }));
      return;
    }

    setForm((current) => ({
      ...current,
      category: "novidade",
      materia_id: materia.id,
      title: `Novidade — ${materia.titulo}`,
      subject: materia.titulo,
      preview_text: materiaPreview(materia),
    }));
  }

  function selectCampaignCategory(category: CampaignCategory) {
    if (category === "novidade") {
      const materiaId = form.materia_id || materias[0]?.id || "";
      if (materiaId) {
        applyMateriaToForm(materiaId);
        return;
      }
    }

    setForm((current) => ({ ...current, category }));
  }

  function buildArticleCard(materia: MateriaLite) {
    const path = materia.slug ? `/materias/${materia.slug}` : `/materias/${materia.id}`;
    const link = `https://kalungacomunicacoes.org${path}`;
    const coverUrl = materia.capa_thumb_url || materia.capa_url || "";
    return `
      <article style="margin:0 0 22px;border:1px solid #e9e9e4;border-radius:12px;overflow:hidden">
        ${coverUrl ? `<img src="${escapeHtml(coverUrl)}" alt="" style="display:block;width:100%;max-height:320px;object-fit:cover"/>` : ""}
        <div style="padding:18px">
          <h2 style="margin:0 0 8px;font-size:20px;line-height:1.25">${escapeHtml(materia.titulo)}</h2>
          ${materia.resumo ? `<p style="margin:0 0 14px;color:#555;line-height:1.55">${escapeHtml(materia.resumo)}</p>` : ""}
          <a href="${link}" style="display:inline-block;background:#0F7A3E;color:#fff;text-decoration:none;border-radius:8px;padding:10px 14px;font-weight:700">Ler matéria</a>
        </div>
      </article>`;
  }

  function buildCampaignBody(currentForm = form) {
    if (currentForm.category === "novidade") {
      const materia = materias.find((item) => item.id === currentForm.materia_id);
      return materia ? buildArticleCard(materia) : "";
    }

    if (currentForm.category === "newsletter") {
      const chosen = currentForm.article_ids
        .map((id) => materias.find((item) => item.id === id))
        .filter(Boolean) as MateriaLite[];

      const intro = currentForm.intro.trim()
        ? `<p style="font-size:16px;line-height:1.65;color:#333;margin:0 0 24px">${escapeHtml(currentForm.intro).replaceAll("\n", "<br>")}</p>`
        : "";
      return `${intro}${chosen.map(buildArticleCard).join("")}`;
    }

    if (currentForm.category === "aviso") {
      const text = escapeHtml(currentForm.notice_message).replaceAll("\n", "<br>");
      const cta =
        currentForm.cta_url.trim() && currentForm.cta_label.trim()
          ? `<p style="margin:22px 0 0"><a href="${escapeHtml(currentForm.cta_url)}" style="display:inline-block;background:#0F7A3E;color:#fff;text-decoration:none;border-radius:8px;padding:11px 16px;font-weight:700">${escapeHtml(currentForm.cta_label)}</a></p>`
          : "";
      return `<div style="font-size:16px;line-height:1.65;color:#333"><p style="margin:0">${text}</p>${cta}</div>`;
    }

    return currentForm.custom_html.trim();
  }

  function structuredContent() {
    if (form.category === "newsletter") {
      return { article_ids: form.article_ids, intro: form.intro };
    }
    if (form.category === "novidade") {
      return { materia_id: form.materia_id };
    }
    if (form.category === "aviso") {
      return {
        notice_message: form.notice_message,
        cta_label: form.cta_label,
        cta_url: form.cta_url,
      };
    }
    return { custom_html: form.custom_html };
  }

  function validateCampaign() {
    if (!form.title.trim()) return "Informe um título interno para a campanha.";
    if (!form.subject.trim()) return "Informe o assunto que aparecerá no e-mail.";
    if (form.category === "novidade" && !form.materia_id) return "Selecione a matéria que será enviada.";
    if (form.category === "newsletter" && form.article_ids.length === 0) return "Selecione ao menos uma matéria para o compilado.";
    if (form.category === "aviso" && !form.notice_message.trim()) return "Escreva a mensagem do aviso.";
    if (form.category === "campanha" && !form.custom_html.trim()) return "Adicione o conteúdo HTML da campanha personalizada.";
    return null;
  }

  async function saveCampaign() {
    const validation = validateCampaign();
    if (validation) {
      setOperationMessage(`❌ ${validation}`);
      return null;
    }

    setSaving(true);
    setOperationMessage(null);

    const contentHtml = buildCampaignBody();
    const audienceTags = form.audience_tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    const audienceFilter = {
      ...(form.audience_source.trim() ? { source: form.audience_source.trim() } : {}),
      ...(audienceTags.length ? { tags: audienceTags } : {}),
    };

    const mode =
      form.category === "novidade"
        ? "materia"
        : form.category === "newsletter"
          ? "digest"
          : form.category === "aviso"
            ? "notice"
            : "custom";

    const payload = {
      title: form.title.trim(),
      internal_title: form.title.trim(),
      subject: form.subject.trim(),
      preview_text: form.preview_text.trim() || null,
      category: form.category,
      mode,
      type: form.category === "novidade" ? "materia" : "custom",
      kind: "custom",
      materia_id: form.category === "novidade" ? form.materia_id : null,
      content_html: contentHtml,
      content_json: structuredContent(),
      template_id: form.template_id || null,
      audience_mode: Object.keys(audienceFilter).length ? "filtered" : "all",
      audience_filter: audienceFilter,
      site_url: "https://kalungacomunicacoes.org",
      status: selectedCampaign?.status === "sent" ? "sent" : selectedCampaign?.status || "draft",
    };

    let data: Campaign | null = null;
    let error: { message: string } | null = null;

    if (selectedCampaign) {
      const response = await supabase
        .from("newsletter_campaigns")
        .update(payload)
        .eq("id", selectedCampaign.id)
        .select(
          "id,title,subject,preview_text,category,mode,materia_id,content_html,content_json,audience_mode,audience_filter,template_id,status,total_recipients,sent_count,fail_count,open_count,created_at,sent_at",
        )
        .single();
      data = response.data as Campaign | null;
      error = response.error;
    } else {
      const response = await supabase
        .from("newsletter_campaigns")
        .insert(payload)
        .select(
          "id,title,subject,preview_text,category,mode,materia_id,content_html,content_json,audience_mode,audience_filter,template_id,status,total_recipients,sent_count,fail_count,open_count,created_at,sent_at",
        )
        .single();
      data = response.data as Campaign | null;
      error = response.error;
    }

    if (error || !data) {
      setOperationMessage(`❌ ${error?.message || "Não foi possível salvar a campanha."}`);
      setSaving(false);
      return null;
    }

    setSelectedCampaign(data);
    setOperationMessage("✅ Rascunho salvo. Agora você pode testar ou disparar.");
    setSaving(false);
    await loadAll();
    return data;
  }

  async function duplicateCampaign(campaign: Campaign) {
    const { data, error } = await supabase
      .from("newsletter_campaigns")
      .insert({
        title: `Cópia — ${campaign.title || campaign.subject}`,
        internal_title: `Cópia — ${campaign.title || campaign.subject}`,
        subject: campaign.subject,
        preview_text: campaign.preview_text,
        category: campaign.category || "newsletter",
        mode: campaign.mode || "custom",
        type: campaign.mode === "materia" ? "materia" : "custom",
        kind: "custom",
        materia_id: campaign.materia_id,
        content_html: campaign.content_html || "<p></p>",
        content_json: campaign.content_json || {},
        audience_mode: campaign.audience_mode || "all",
        audience_filter: campaign.audience_filter || {},
        template_id: campaign.template_id,
        status: "draft",
        sent_count: 0,
        fail_count: 0,
        total_recipients: 0,
      })
      .select(
        "id,title,subject,preview_text,category,mode,materia_id,content_html,content_json,audience_mode,audience_filter,template_id,status,total_recipients,sent_count,fail_count,open_count,created_at,sent_at",
      )
      .single();

    if (error || !data) {
      setGlobalError(error?.message || "Não foi possível duplicar a campanha.");
      return;
    }

    await loadAll();
    editCampaign(data as Campaign);
  }

  async function deleteCampaign(campaign: Campaign) {
    if (campaign.status === "sent") {
      setGlobalError("Campanhas enviadas fazem parte do histórico e não são excluídas. Duplique para reutilizar.");
      return;
    }
    if (!window.confirm(`Excluir o rascunho “${campaign.title || campaign.subject}”? `)) return;

    const { error } = await supabase.from("newsletter_campaigns").delete().eq("id", campaign.id);
    if (error) setGlobalError(error.message);
    await loadAll();
  }

  async function sendTest() {
    if (selectedCampaign?.status === "sent") {
      setOperationMessage("Campanhas já enviadas são imutáveis. Duplique a campanha para testar alterações.");
      return;
    }

    const campaign = await saveCampaign();
    if (!campaign) return;

    if (!testEmail.trim() || !testEmail.includes("@")) {
      setOperationMessage("❌ Digite um e-mail de teste válido.");
      return;
    }

    setSendingTest(true);
    setOperationMessage("Enviando teste…");

    const response = await newsletterAdmin<{ message: string }>("send_test", {
      campaign_id: campaign.id,
      test_email: testEmail.trim().toLowerCase(),
    });

    setOperationMessage(response.ok ? "✅ E-mail de teste enviado." : `❌ ${newsletterErrorText(response.error)}`);
    setSendingTest(false);
  }

  async function sendNow() {
    if (selectedCampaign?.status === "sent") {
      setOperationMessage("Esta campanha já foi concluída. Duplique-a para enviar novamente.");
      return;
    }

    const campaign = await saveCampaign();
    if (!campaign) return;

    const verb = campaign.status === "failed" ? "reenviar apenas as falhas" : "enviar esta campanha";
    if (!window.confirm(`Confirmar: ${verb} para a audiência selecionada?`)) return;

    setSending(true);
    setOperationMessage("Preparando audiência e fila de envio…");

    let action = campaign.status === "failed" ? "retry_failed" : "send_campaign";

    for (let step = 0; step < 100; step += 1) {
      const response = await newsletterAdmin<{
        done: boolean;
        total: number;
        sent: number;
        failed: number;
        queued: number;
        processed: number;
        status: string;
      }>(action, { campaign_id: campaign.id, batch_size: 40 });

      if (!response.ok || !response.data) {
        setOperationMessage(`❌ ${newsletterErrorText(response.error)}`);
        setSending(false);
        await loadAll();
        return;
      }

      const info = response.data;
      setOperationMessage(
        `Enviando… ${info.sent}/${info.total} concluídos • ${info.failed} falhas • ${info.queued} na fila`,
      );

      if (info.done) {
        setOperationMessage(
          info.failed > 0
            ? `⚠️ Disparo encerrado com ${info.sent} enviados e ${info.failed} falhas. Você pode reenviar somente as falhas.`
            : `✅ Campanha concluída: ${info.sent} e-mails enviados.`,
        );
        break;
      }

      action = "send_campaign";
    }

    setSending(false);
    await loadAll();

    const refreshed = await supabase
      .from("newsletter_campaigns")
      .select(
        "id,title,subject,preview_text,category,mode,materia_id,content_html,content_json,audience_mode,audience_filter,template_id,status,total_recipients,sent_count,fail_count,open_count,created_at,sent_at",
      )
      .eq("id", campaign.id)
      .single();

    if (refreshed.data) setSelectedCampaign(refreshed.data as Campaign);
  }

  async function toggleSubscriber(subscriber: Subscriber) {
    const nextStatus = subscriber.status === "active" ? "unsubscribed" : "active";
    const { error } = await supabase
      .from("newsletter_subscribers")
      .update({
        status: nextStatus,
        unsubscribed_at: nextStatus === "unsubscribed" ? new Date().toISOString() : null,
        subscribed_at: nextStatus === "active" ? new Date().toISOString() : subscriber.subscribed_at,
      })
      .eq("id", subscriber.id);

    if (error) setGlobalError(error.message);
    await loadAll();
  }

  const previewBody = buildCampaignBody();
  const selectedTemplate = templates.find((template) => template.id === form.template_id);
  const previewHtml = selectedTemplate
    ? selectedTemplate.content_html
        .replaceAll("{{content}}", previewBody || '<p style="color:#777">Prévia do conteúdo</p>')
        .replaceAll("{{unsubscribe_url}}", "#")
        .replaceAll("{{preview_text}}", escapeHtml(form.preview_text))
    : previewBody;

  const tabs: Array<{ id: TabKey; label: string; icon: typeof LayoutDashboard }> = [
    { id: "overview", label: "Visão geral", icon: LayoutDashboard },
    { id: "campaigns", label: "Campanhas", icon: Send },
    { id: "audience", label: "Inscritos", icon: Users },
    { id: "templates", label: "Modelos", icon: FileText },
    { id: "settings", label: "Configuração", icon: Settings },
  ];

  return (
    <div className="space-y-6 pb-10">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-medium text-[#0F7A3E]">Comunicação direta</p>
          <h1 className="text-3xl font-bold tracking-tight">Newsletter RKC</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Crie boletins, divulgue matérias, envie avisos e acompanhe o histórico de cada disparo.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => void loadAll()} className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </button>
          <button onClick={newCampaign} className="inline-flex items-center gap-2 rounded-lg bg-[#0F7A3E] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0d6633]">
            <Plus className="h-4 w-4" />
            Nova campanha
          </button>
        </div>
      </header>

      {globalError && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="flex-1">{globalError}</div>
          <button onClick={() => setGlobalError(null)} className="font-semibold">Fechar</button>
        </div>
      )}

      <nav className="flex gap-1 overflow-x-auto rounded-xl border bg-card p-1.5">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition ${
              tab === id ? "bg-[#0F7A3E] text-white shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </nav>

      {loading ? (
        <div className="flex min-h-[220px] items-center justify-center rounded-2xl border bg-card">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Carregando Newsletter…
        </div>
      ) : (
        <>
          {tab === "overview" && (
            <section className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                <MetricCard label="Inscritos ativos" value={activeSubscribers.length} detail={`${dashboard.unsubscribed} descadastrados`} icon={Users} />
                <MetricCard label="Campanhas enviadas" value={dashboard.sentCampaigns} detail={`${campaigns.length} campanhas no histórico`} icon={Send} />
                <MetricCard label="E-mails enviados" value={dashboard.totalSent} detail={`${dashboard.totalFailed} falhas registradas`} icon={Mail} />
                <MetricCard
                  label="Aberturas"
                  value={dashboard.openedRecipients}
                  detail={`${dashboard.openRate.toFixed(1)}% de abertura • ${dashboard.totalOpenEvents} aberturas totais`}
                  icon={Eye}
                />
                <MetricCard label="Taxa técnica" value={`${dashboard.deliverability.toFixed(1)}%`} detail="Enviados ÷ tentativas registradas" icon={CheckCircle2} />
              </div>

              <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
                <div className="rounded-2xl border bg-card">
                  <div className="flex items-center justify-between border-b p-5">
                    <div>
                      <h2 className="font-semibold">Campanhas recentes</h2>
                      <p className="text-sm text-muted-foreground">Últimos disparos e rascunhos.</p>
                    </div>
                    <button onClick={() => setTab("campaigns")} className="text-sm font-semibold text-[#0F7A3E]">Ver todas</button>
                  </div>
                  <div className="divide-y">
                    {campaigns.slice(0, 6).map((campaign) => {
                      const Icon = categoryIcon(campaign.category);
                      return (
                        <button key={campaign.id} onClick={() => editCampaign(campaign)} className="flex w-full items-center gap-3 p-4 text-left hover:bg-muted/40">
                          <div className="rounded-lg bg-[#0F7A3E]/10 p-2 text-[#0F7A3E]"><Icon className="h-4 w-4" /></div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-semibold">{campaign.title || campaign.subject}</div>
                            <div className="truncate text-xs text-muted-foreground">{campaign.subject}</div>
                          </div>
                          <StatusBadge status={campaign.status} />
                        </button>
                      );
                    })}
                    {campaigns.length === 0 && <div className="p-6 text-sm text-muted-foreground">Nenhuma campanha criada ainda.</div>}
                  </div>
                </div>

                <div className="rounded-2xl border bg-card p-5">
                  <h2 className="font-semibold">Fluxo recomendado</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Um disparo passa sempre pelas mesmas etapas.</p>
                  <ol className="mt-5 space-y-4">
                    {[
                      ["1", "Criar", "Escolha boletim, novidade, aviso ou campanha."],
                      ["2", "Revisar", "Confira assunto, prévia, audiência e conteúdo."],
                      ["3", "Testar", "Envie primeiro para um e-mail da equipe."],
                      ["4", "Disparar", "O sistema cria a fila e registra cada destinatário."],
                    ].map(([step, title, text]) => (
                      <li key={step} className="flex gap-3">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0F7A3E] text-xs font-bold text-white">{step}</div>
                        <div>
                          <div className="text-sm font-semibold">{title}</div>
                          <div className="text-xs leading-relaxed text-muted-foreground">{text}</div>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>

              <div className="rounded-2xl border bg-card">
                <div className="border-b p-5">
                  <h2 className="font-semibold">Top 10 leitores</h2>
                  <p className="text-sm text-muted-foreground">
                    Pessoas que mais abriram newsletters, considerando os disparos rastreados.
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-5 py-3">Leitor</th>
                        <th className="px-5 py-3">Aberturas</th>
                        <th className="px-5 py-3">Assuntos abertos</th>
                        <th className="px-5 py-3">Última abertura</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {topReaders.map((reader, index) => (
                        <tr key={reader.email}>
                          <td className="px-5 py-4">
                            <div className="font-semibold">#{index + 1} {reader.name}</div>
                            <div className="text-xs text-muted-foreground">{reader.email}</div>
                          </td>
                          <td className="px-5 py-4 text-lg font-bold text-[#0F7A3E]">{reader.opens}</td>
                          <td className="px-5 py-4">
                            <div className="max-w-[480px] text-xs text-muted-foreground">
                              {reader.subjects.length ? reader.subjects.join(" • ") : "—"}
                            </div>
                          </td>
                          <td className="px-5 py-4 text-muted-foreground">{toBR(reader.lastOpenedAt)}</td>
                        </tr>
                      ))}
                      {topReaders.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-5 py-8 text-center text-muted-foreground">
                            As aberturas aparecerão aqui após os próximos disparos.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

          {tab === "campaigns" && (
            <section className="rounded-2xl border bg-card">
              <div className="flex flex-col gap-3 border-b p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-semibold">Campanhas</h2>
                  <p className="text-sm text-muted-foreground">Histórico completo de rascunhos e disparos.</p>
                </div>
                <button onClick={newCampaign} className="inline-flex items-center gap-2 rounded-lg bg-[#0F7A3E] px-3.5 py-2 text-sm font-semibold text-white">
                  <Plus className="h-4 w-4" /> Criar
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-5 py-3">Campanha</th>
                      <th className="px-5 py-3">Tipo</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3">Audiência</th>
                      <th className="px-5 py-3">Enviados</th>
                      <th className="px-5 py-3">Abertos</th>
                      <th className="px-5 py-3">Falhas</th>
                      <th className="px-5 py-3">Data</th>
                      <th className="px-5 py-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {campaigns.map((campaign) => {
                      const Icon = categoryIcon(campaign.category);
                      return (
                        <tr key={campaign.id} className="hover:bg-muted/30">
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="rounded-lg bg-[#0F7A3E]/10 p-2 text-[#0F7A3E]"><Icon className="h-4 w-4" /></div>
                              <div>
                                <div className="font-semibold">{campaign.title || "Sem título"}</div>
                                <div className="max-w-[340px] truncate text-xs text-muted-foreground">{campaign.subject}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4">{categoryLabel(campaign.category)}</td>
                          <td className="px-5 py-4"><StatusBadge status={campaign.status} /></td>
                          <td className="px-5 py-4">{campaign.total_recipients || 0}</td>
                          <td className="px-5 py-4 font-medium">{campaign.sent_count || 0}</td>
                          <td className="px-5 py-4">
                            <div className="font-semibold text-[#0F7A3E]">{campaign.open_count || 0}</div>
                            <div className="text-xs text-muted-foreground">
                              {campaign.sent_count
                                ? `${((Number(campaign.open_count || 0) / Number(campaign.sent_count)) * 100).toFixed(1)}%`
                                : "0.0%"}
                            </div>
                          </td>
                          <td className="px-5 py-4">{campaign.fail_count || 0}</td>
                          <td className="px-5 py-4 text-muted-foreground">{toBR(campaign.sent_at || campaign.created_at)}</td>
                          <td className="px-5 py-4">
                            <div className="flex justify-end gap-1">
                              <IconButton label="Abrir" onClick={() => editCampaign(campaign)}><Eye className="h-4 w-4" /></IconButton>
                              <IconButton label="Duplicar" onClick={() => void duplicateCampaign(campaign)}><Copy className="h-4 w-4" /></IconButton>
                              {campaign.status !== "sent" && (
                                <IconButton label="Excluir" danger onClick={() => void deleteCampaign(campaign)}><Trash2 className="h-4 w-4" /></IconButton>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {campaigns.length === 0 && <tr><td colSpan={9} className="px-5 py-8 text-center text-muted-foreground">Nenhuma campanha.</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {tab === "audience" && (
            <section className="space-y-4">
              <div className="flex flex-col gap-3 rounded-2xl border bg-card p-4 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <input
                    value={subscriberQuery}
                    onChange={(event) => setSubscriberQuery(event.target.value)}
                    placeholder="Buscar por nome, e-mail, origem ou tag…"
                    className="w-full rounded-lg border bg-background py-2.5 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring/30"
                  />
                </div>
                <div className="text-sm text-muted-foreground"><b className="text-foreground">{activeSubscribers.length}</b> ativos</div>
              </div>

              <div className="overflow-hidden rounded-2xl border bg-card">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[800px] text-left text-sm">
                    <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-5 py-3">Contato</th>
                        <th className="px-5 py-3">Status</th>
                        <th className="px-5 py-3">Origem</th>
                        <th className="px-5 py-3">Tags</th>
                        <th className="px-5 py-3">Inscrição</th>
                        <th className="px-5 py-3 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filteredSubscribers.map((subscriber) => (
                        <tr key={subscriber.id} className="hover:bg-muted/30">
                          <td className="px-5 py-4">
                            <div className="font-medium">{subscriber.name || "Sem nome"}</div>
                            <div className="text-xs text-muted-foreground">{subscriber.email}</div>
                          </td>
                          <td className="px-5 py-4">
                            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${subscriber.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                              {subscriber.status === "active" ? "Ativo" : subscriber.status === "unsubscribed" ? "Descadastrado" : subscriber.status}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-muted-foreground">{subscriber.source || "—"}</td>
                          <td className="px-5 py-4">
                            <div className="flex flex-wrap gap-1">
                              {(subscriber.tags || []).slice(0, 3).map((tag) => <span key={tag} className="rounded bg-muted px-2 py-0.5 text-xs">{tag}</span>)}
                              {(subscriber.tags || []).length === 0 && <span className="text-muted-foreground">—</span>}
                            </div>
                          </td>
                          <td className="px-5 py-4 text-muted-foreground">{toBR(subscriber.subscribed_at || subscriber.created_at)}</td>
                          <td className="px-5 py-4 text-right">
                            <button onClick={() => void toggleSubscriber(subscriber)} className="rounded-lg border px-3 py-1.5 text-xs font-semibold hover:bg-muted">
                              {subscriber.status === "active" ? "Pausar" : "Reativar"}
                            </button>
                          </td>
                        </tr>
                      ))}
                      {filteredSubscribers.length === 0 && <tr><td colSpan={6} className="px-5 py-8 text-center text-muted-foreground">Nenhum inscrito encontrado.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

          {tab === "templates" && (
            <section className="grid gap-4 lg:grid-cols-2">
              {templates.map((template) => (
                <div key={template.id} className="overflow-hidden rounded-2xl border bg-card">
                  <div className="border-b p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="font-semibold">{template.name}</h3>
                        <p className="text-xs text-muted-foreground">{template.is_system ? "Modelo padrão da RKC" : "Modelo personalizado"}</p>
                      </div>
                      {template.is_system && <span className="rounded-full bg-[#0F7A3E]/10 px-2.5 py-1 text-xs font-semibold text-[#0F7A3E]">Padrão</span>}
                    </div>
                  </div>
                  <iframe
                    sandbox=""
                    title={template.name}
                    srcDoc={template.content_html.replaceAll("{{content}}", "<h2>Exemplo de conteúdo</h2><p>Este é o corpo da campanha.</p>").replaceAll("{{unsubscribe_url}}", "#")}
                    className="h-[320px] w-full bg-white"
                  />
                  <div className="border-t p-4 text-xs text-muted-foreground">Atualizado em {toBR(template.updated_at)}</div>
                </div>
              ))}
              {templates.length === 0 && <div className="rounded-2xl border bg-card p-8 text-sm text-muted-foreground">Nenhum modelo disponível.</div>}
            </section>
          )}

          {tab === "settings" && <div className="overflow-hidden rounded-2xl border bg-card"><NewsletterEmailConfig /></div>}
        </>
      )}

      {campaignOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/55 p-3 md:p-6">
          <div className="mx-auto my-2 max-w-6xl overflow-hidden rounded-2xl border bg-background shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b p-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[#0F7A3E]">Editor de campanha</p>
                <h2 className="mt-1 text-xl font-bold">{selectedCampaign ? selectedCampaign.title || "Editar campanha" : "Nova campanha"}</h2>
                <p className="mt-1 text-sm text-muted-foreground">Monte o conteúdo, escolha a audiência, faça um teste e só então dispare.</p>
              </div>
              <button onClick={() => setCampaignOpen(false)} className="rounded-lg border px-3 py-1.5 text-sm hover:bg-muted">Fechar</button>
            </div>

            <div className="grid lg:grid-cols-[1.15fr_.85fr]">
              <div className="space-y-5 p-5 lg:border-r">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="text-sm font-medium">Título interno
                    <input className={fieldClass} value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Ex.: Boletim RKC — Outubro" />
                  </label>
                  <label className="text-sm font-medium">Assunto do e-mail
                    <input className={fieldClass} value={form.subject} onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))} placeholder="Ex.: O que aconteceu no Território Kalunga esta semana" />
                  </label>
                </div>

                <label className="block text-sm font-medium">Texto de prévia
                  <input className={fieldClass} value={form.preview_text} onChange={(event) => setForm((current) => ({ ...current, preview_text: event.target.value }))} placeholder="A frase curta que aparece ao lado do assunto na caixa de entrada" />
                </label>

                <div>
                  <div className="mb-2 text-sm font-medium">O que você quer enviar?</div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {([
                      ["newsletter", Mail, "Newsletter", "Compilado com várias matérias"],
                      ["novidade", Newspaper, "Novidade", "Destaque de uma matéria"],
                      ["aviso", Bell, "Aviso", "Comunicado direto e rápido"],
                      ["campanha", Megaphone, "Campanha", "Conteúdo personalizado"],
                    ] as const).map(([value, Icon, label, detail]) => (
                      <button
                        key={value}
                        onClick={() => selectCampaignCategory(value)}
                        className={`flex items-start gap-3 rounded-xl border p-3 text-left transition ${form.category === value ? "border-[#0F7A3E] bg-[#0F7A3E]/5 ring-1 ring-[#0F7A3E]/20" : "hover:bg-muted/40"}`}
                      >
                        <div className="rounded-lg bg-[#0F7A3E]/10 p-2 text-[#0F7A3E]"><Icon className="h-4 w-4" /></div>
                        <div><div className="text-sm font-semibold">{label}</div><div className="text-xs text-muted-foreground">{detail}</div></div>
                      </button>
                    ))}
                  </div>
                </div>

                {form.category === "newsletter" && (
                  <div className="space-y-3 rounded-xl border p-4">
                    <label className="block text-sm font-medium">Introdução
                      <textarea className={`${fieldClass} min-h-[90px]`} value={form.intro} onChange={(event) => setForm((current) => ({ ...current, intro: event.target.value }))} placeholder="Uma abertura curta para o boletim…" />
                    </label>
                    <div>
                      <div className="mb-2 text-sm font-medium">Matérias do compilado</div>
                      <div className="max-h-[260px] space-y-2 overflow-y-auto pr-1">
                        {materias.map((materia) => {
                          const checked = form.article_ids.includes(materia.id);
                          return (
                            <label key={materia.id} className={`flex cursor-pointer gap-3 rounded-lg border p-3 ${checked ? "border-[#0F7A3E] bg-[#0F7A3E]/5" : ""}`}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() =>
                                  setForm((current) => ({
                                    ...current,
                                    article_ids: checked
                                      ? current.article_ids.filter((id) => id !== materia.id)
                                      : [...current.article_ids, materia.id],
                                  }))
                                }
                              />
                              <div className="min-w-0"><div className="truncate text-sm font-medium">{materia.titulo}</div><div className="text-xs text-muted-foreground">{materia.resumo || "Sem resumo"}</div></div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {form.category === "novidade" && (
                  <label className="block text-sm font-medium">Matéria em destaque
                    <select className={fieldClass} value={form.materia_id} onChange={(event) => applyMateriaToForm(event.target.value)}>
                      <option value="">Selecione uma matéria…</option>
                      {materias.map((materia) => <option key={materia.id} value={materia.id}>{materia.titulo}</option>)}
                    </select>
                  </label>
                )}

                {form.category === "aviso" && (
                  <div className="space-y-4 rounded-xl border p-4">
                    <label className="block text-sm font-medium">Mensagem
                      <textarea className={`${fieldClass} min-h-[150px]`} value={form.notice_message} onChange={(event) => setForm((current) => ({ ...current, notice_message: event.target.value }))} placeholder="Escreva o aviso de forma objetiva…" />
                    </label>
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="text-sm font-medium">Texto do botão (opcional)
                        <input className={fieldClass} value={form.cta_label} onChange={(event) => setForm((current) => ({ ...current, cta_label: event.target.value }))} placeholder="Saiba mais" />
                      </label>
                      <label className="text-sm font-medium">Link do botão
                        <input className={fieldClass} value={form.cta_url} onChange={(event) => setForm((current) => ({ ...current, cta_url: event.target.value }))} placeholder="https://…" />
                      </label>
                    </div>
                  </div>
                )}

                {form.category === "campanha" && (
                  <label className="block text-sm font-medium">HTML da campanha
                    <textarea className={`${fieldClass} min-h-[220px] font-mono text-xs`} value={form.custom_html} onChange={(event) => setForm((current) => ({ ...current, custom_html: event.target.value }))} placeholder="<h2>Conteúdo da campanha</h2>…" />
                    <span className="mt-1 block text-xs font-normal text-muted-foreground">Para campanhas especiais. Newsletter, novidade e aviso não exigem HTML.</span>
                  </label>
                )}

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="text-sm font-medium">Modelo visual
                    <select className={fieldClass} value={form.template_id} onChange={(event) => setForm((current) => ({ ...current, template_id: event.target.value }))}>
                      <option value="">Layout básico do sistema</option>
                      {templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
                    </select>
                  </label>
                  <div>
                    <div className="text-sm font-medium">Audiência</div>
                    <div className="mt-1.5 rounded-lg border bg-muted/20 px-3 py-2.5 text-sm">
                      {form.audience_source || form.audience_tags ? "Segmentada" : `Todos os ${activeSubscribers.length} inscritos ativos`}
                    </div>
                  </div>
                </div>

                <details className="rounded-xl border p-4">
                  <summary className="cursor-pointer text-sm font-semibold">Segmentar audiência (opcional)</summary>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <label className="text-sm font-medium">Origem exata
                      <input className={fieldClass} value={form.audience_source} onChange={(event) => setForm((current) => ({ ...current, audience_source: event.target.value }))} placeholder="Ex.: site_newsletter_page" />
                    </label>
                    <label className="text-sm font-medium">Tags
                      <input className={fieldClass} value={form.audience_tags} onChange={(event) => setForm((current) => ({ ...current, audience_tags: event.target.value }))} placeholder="Ex.: cultura, territorio" />
                    </label>
                  </div>
                </details>

                {operationMessage && (
                  <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm">{operationMessage}</div>
                )}

                <div className="flex flex-wrap gap-2 border-t pt-4">
                  <button onClick={() => void saveCampaign()} disabled={saving || selectedCampaign?.status === "sent"} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                    {saving ? "Salvando…" : selectedCampaign?.status === "sent" ? "Campanha enviada" : "Salvar rascunho"}
                  </button>
                  {selectedCampaign && (
                    <button onClick={() => void duplicateCampaign(selectedCampaign)} className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-muted">
                      <Copy className="h-4 w-4" /> Duplicar
                    </button>
                  )}
                </div>
              </div>

              <aside className="space-y-5 bg-muted/10 p-5">
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <div><h3 className="font-semibold">Prévia</h3><p className="text-xs text-muted-foreground">Visual aproximado do e-mail.</p></div>
                    {selectedCampaign && <StatusBadge status={selectedCampaign.status} />}
                  </div>
                  <iframe sandbox="" title="Prévia da campanha" srcDoc={previewHtml || "<p style='font-family:Arial;padding:24px;color:#777'>Adicione conteúdo para visualizar.</p>"} className="h-[420px] w-full rounded-xl border bg-white" />
                </div>

                <div className="rounded-xl border bg-card p-4">
                  <h3 className="text-sm font-semibold">Enviar teste</h3>
                  <p className="mt-1 text-xs text-muted-foreground">Faça isso antes de enviar para toda a lista.</p>
                  <div className="mt-3 flex gap-2">
                    <input value={testEmail} onChange={(event) => setTestEmail(event.target.value)} className="min-w-0 flex-1 rounded-lg border bg-background px-3 py-2 text-sm" placeholder="email@exemplo.com" />
                    <button onClick={() => void sendTest()} disabled={sendingTest} className="rounded-lg border px-3 py-2 text-sm font-semibold hover:bg-muted disabled:opacity-50">
                      {sendingTest ? "…" : "Testar"}
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border border-[#0F7A3E]/25 bg-[#0F7A3E]/5 p-4">
                  <h3 className="text-sm font-semibold text-[#0F7A3E]">Disparo</h3>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    O envio é feito em lotes e cada destinatário ganha um registro próprio. Se houver falha, o sistema reenvia somente os que falharam.
                  </p>
                  <button
                    onClick={() => void sendNow()}
                    disabled={sending || selectedCampaign?.status === "sent"}
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#0F7A3E] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    {sending
                      ? "Enviando…"
                      : selectedCampaign?.status === "failed"
                        ? "Reenviar falhas"
                        : selectedCampaign?.status === "sending"
                          ? "Continuar envio"
                          : selectedCampaign?.status === "sent"
                            ? "Concluída"
                            : "Enviar agora"}
                  </button>

                  {selectedCampaign && (
                    <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
                      <div className="rounded-lg bg-background p-2"><div className="font-bold">{selectedCampaign.total_recipients || 0}</div><div className="text-muted-foreground">Audiência</div></div>
                      <div className="rounded-lg bg-background p-2"><div className="font-bold text-emerald-700">{selectedCampaign.sent_count || 0}</div><div className="text-muted-foreground">Enviados</div></div>
                      <div className="rounded-lg bg-background p-2"><div className="font-bold text-[#0F7A3E]">{selectedCampaign.open_count || 0}</div><div className="text-muted-foreground">Abertos</div></div>
                      <div className="rounded-lg bg-background p-2"><div className="font-bold text-red-700">{selectedCampaign.fail_count || 0}</div><div className="text-muted-foreground">Falhas</div></div>
                    </div>
                  )}
                </div>

                {selectedCampaign && (
                  <div className="rounded-xl border bg-card p-4">
                    <h3 className="text-sm font-semibold">Últimos registros</h3>
                    <div className="mt-3 max-h-[180px] space-y-2 overflow-y-auto">
                      {deliveries.filter((delivery) => delivery.campaign_id === selectedCampaign.id).slice(0, 12).map((delivery) => (
                        <div key={delivery.id} className="flex items-center justify-between gap-2 text-xs">
                          <span className="min-w-0 truncate text-muted-foreground">{delivery.email}</span>
                          <span className={delivery.status === "sent" || delivery.status === "delivered" ? "text-emerald-700" : delivery.status === "failed" ? "text-red-700" : "text-blue-700"}>{delivery.status}</span>
                        </div>
                      ))}
                      {deliveries.filter((delivery) => delivery.campaign_id === selectedCampaign.id).length === 0 && <div className="text-xs text-muted-foreground">Ainda não há entregas registradas.</div>}
                    </div>
                  </div>
                )}
              </aside>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: typeof Users;
}) {
  return (
    <div className="rounded-2xl border bg-card p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <div className="rounded-lg bg-[#0F7A3E]/10 p-2 text-[#0F7A3E]"><Icon className="h-4 w-4" /></div>
      </div>
      <div className="mt-3 text-3xl font-bold">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{detail}</div>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  danger = false,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      title={label}
      onClick={onClick}
      className={`rounded-lg p-2 transition hover:bg-muted ${danger ? "text-red-600" : "text-muted-foreground hover:text-foreground"}`}
    >
      {children}
    </button>
  );
}
