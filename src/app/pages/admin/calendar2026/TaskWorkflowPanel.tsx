import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import {
  fetchTaskWorkflow,
  mutateTaskWorkflow,
  openTaskAttachment,
} from "./tasksApi";
import {
  deliveryTemplates,
  historyLabels,
  progressLabel,
  type ChecklistItem,
} from "./taskWorkflow";
import {
  taskKeys,
  useCurrentMemberQuery,
  usePermissionQuery,
  useTaskAttachmentMutation,
  useExternalAttachmentMutation,
} from "./useTaskQueries";
import type { CalendarTask, TaskAttachment, TeamMember } from "./types";

const control =
  "min-h-11 w-full rounded-xl border border-emerald-200 bg-white p-2 text-sm text-slate-900 focus:ring-2 focus:ring-emerald-400 dark:bg-emerald-950 dark:text-white";
const button =
  "min-h-11 rounded-xl border border-emerald-200 px-3 text-sm disabled:opacity-50 focus:ring-2 focus:ring-emerald-400";
export function TaskWorkflowPanel({
  task,
  attachments,
  team,
}: {
  task: CalendarTask;
  attachments: TaskAttachment[];
  team: TeamMember[];
}) {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: [...taskKeys.detail(task.id), "workflow"],
    queryFn: () => fetchTaskWorkflow(task.id),
    staleTime: 30_000,
  });
  const projects = useQuery({
    queryKey: ["task-project-options"],
    queryFn: async () => {
      const r = await supabase
        .from("projetos")
        .select("id,titulo")
        .order("titulo");
      if (r.error) throw r.error;
      return r.data;
    },
    staleTime: 300_000,
  });
  const current = useCurrentMemberQuery();
  const permission = usePermissionQuery();
  const upload = useTaskAttachmentMutation();
  const external = useExternalAttachmentMutation();
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState("");
  const [metadata, setMetadata] = useState({
    expected_delivery: "",
    completion_criteria: "",
    project_id: "",
    reviewer_id: "",
    blocked_reason: "",
    blocked_by: "",
  });
  const [members, setMembers] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [template, setTemplate] = useState("Texto ou pesquisa");
  const [templateText, setTemplateText] = useState(
    deliveryTemplates["Texto ou pesquisa"].join("\n"),
  );
  const [mode, setMode] = useState("");
  const [reason, setReason] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const data = query.data;
  useEffect(
    () => () => {
      toast.dismiss(`task-workflow-${task.id}`);
    },
    [task.id],
  );
  useEffect(() => {
    if (!data) return;
    setMetadata({
      expected_delivery: data.task.expected_delivery ?? "",
      completion_criteria: data.task.completion_criteria ?? "",
      project_id: data.task.project_id ?? "",
      reviewer_id: data.task.reviewer_id ?? "",
      blocked_reason: data.task.blocked_reason ?? "",
      blocked_by: data.task.blocked_by ?? "",
    });
    setMembers(data.members);
  }, [data]);
  const actor = current.data?.id;
  const manager = Boolean(
    actor &&
      (permission.data === "admin" ||
        actor === task.creatorId ||
        actor === task.assigneeId),
  );
  const participant = Boolean(
    manager || (actor && data?.members.includes(actor)),
  );
  const fileParticipant =
    participant || Boolean(actor && actor === data?.task.reviewer_id);
  const closed = ["concluida", "concluido"].includes(
    data?.task.status ?? task.status,
  );
  const total = data?.items.length ?? 0;
  const completed = data?.items.filter((i) => i.completed_at).length ?? 0;
  const next = data?.items.find((i) => !i.completed_at);
  // Retain the operation token after an uncertain network result so retries cannot duplicate a mutation.
  const pending = useRef<{ signature: string; id: string } | null>(null);
  async function run(action: string, payload: Record<string, unknown>) {
    if (!data || busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    setError("");
    const signature = JSON.stringify([action, payload]);
    if (pending.current?.signature !== signature)
      pending.current = { signature, id: crypto.randomUUID() };
    try {
      const result = await mutateTaskWorkflow(
        task.id,
        action,
        payload,
        data.task.workflow_version,
        pending.current.id,
      );
      pending.current = null;
      if (!result.replayed)
        client
          .getQueriesData({ queryKey: taskKeys.all })
          .forEach(([key, rows]) => {
            if (Array.isArray(rows))
              client.setQueryData(
                key,
                rows.map((row) =>
                  row.id === task.id
                    ? {
                        ...row,
                        checklistTotal: result.total,
                        checklistCompleted: result.completed,
                        ...(action === "metadata"
                          ? {
                              reviewerId: payload.reviewer_id || null,
                              blockedReason: payload.blocked_reason || null,
                            }
                          : {}),
                        ...(action === "complete"
                          ? { status: "concluida" }
                          : action === "review"
                            ? { status: "revisao" }
                            : action === "reopen"
                              ? { status: "em_andamento" }
                              : {}),
                      }
                    : row,
                ),
              );
          });
      await client.invalidateQueries({ queryKey: taskKeys.detail(task.id) });
      if (
        ["metadata", "collaborators", "reopen", "review", "complete"].includes(
          action,
        )
      )
        void client.invalidateQueries({ queryKey: taskKeys.all });
      void client.invalidateQueries({ queryKey: taskKeys.notifications });
      toast.success("Alteração salva.", { id: `task-workflow-${task.id}` });
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível salvar.");
      await query.refetch();
      return false;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  function filePayload(file: TaskAttachment) {
    return file.file_url.startsWith("drive:")
      ? { drive_file_id: file.id }
      : { legacy_attachment_id: file.id };
  }
  async function attach(file: TaskAttachment, item?: ChecklistItem) {
    await run("link", {
      ...filePayload(file),
      item_id: item?.id ?? null,
      purpose: item ? "stage" : "final",
    });
  }
  async function uploadFile(file: File, item?: ChecklistItem) {
    if (busyRef.current) return;
    try {
      const attachment = await upload.mutateAsync({ taskId: task.id, file });
      await attach(attachment, item);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha no envio.");
    }
  }
  function filesFor(item?: ChecklistItem) {
    const links =
      data?.links.filter((l) =>
        item ? l.item_id === item.id : l.purpose === "final",
      ) ?? [];
    return (
      <div className="space-y-2">
        {links.map((link) => {
          const file = attachments.find(
            (a) => a.id === (link.drive_file_id ?? link.legacy_attachment_id),
          );
          return (
            <div key={link.id} className="flex flex-wrap gap-2">
              <button
                className={button}
                type="button"
                disabled={!file}
                onClick={() =>
                  file &&
                  void openTaskAttachment(file).catch((e) =>
                    setError(e.message),
                  )
                }
              >
                {file?.file_name ?? "Atualizando arquivo…"}
              </button>
              {fileParticipant && !closed ? (
                <button
                  className={button}
                  type="button"
                  disabled={busy}
                  onClick={() => void run("unlink", { link_id: link.id })}
                >
                  Desvincular {item ? "do item" : "da entrega final"}
                </button>
              ) : null}
            </div>
          );
        })}
        {fileParticipant && !closed ? (
          <>
            <label className="block text-sm">
              Vincular arquivo existente
              <select
                aria-label={
                  item
                    ? `Vincular arquivo a ${item.title}`
                    : "Vincular entrega final"
                }
                className={control}
                value=""
                disabled={busy}
                onChange={(e) => {
                  const file = attachments.find((a) => a.id === e.target.value);
                  if (file) void attach(file, item);
                }}
              >
                <option value="">Selecione um material da tarefa</option>
                {attachments.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.file_name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              Enviar arquivo {item ? "para esta etapa" : "final"}
              <input
                aria-label={
                  item
                    ? `Enviar arquivo para ${item.title}`
                    : "Enviar arquivo final"
                }
                className={control}
                type="file"
                disabled={busy || upload.isPending}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void uploadFile(file, item);
                  e.target.value = "";
                }}
              />
            </label>
          </>
        ) : null}
      </div>
    );
  }
  if (query.isLoading)
    return <p role="status">Carregando etapas e organização…</p>;
  if (query.error || !data)
    return (
      <p role="alert">
        Não foi possível carregar as etapas.{" "}
        <button className={button} onClick={() => void query.refetch()}>
          Tentar novamente
        </button>
      </p>
    );
  return (
    <section
      className="mb-4 space-y-4"
      aria-label="Acompanhamento da entrega"
      aria-busy={busy || upload.isPending}
    >
      <div className="rounded-2xl border border-emerald-200 p-4">
        <h3 className="font-semibold">Entrega esperada</h3>
        <p className="whitespace-pre-wrap break-words">
          {data.task.expected_delivery ||
            task.description ||
            "Defina a entrega e o critério de conclusão."}
        </p>
        <p className="mt-2 text-sm">
          Critério: {data.task.completion_criteria || "Ainda não definido"}
        </p>
        <p className="mt-2 text-sm">
          Prazo: {task.endDate.split("-").reverse().join("/")} · Responsável:{" "}
          {team.find((m) => m.id === task.assigneeId)?.name ?? "Não definido"}
        </p>
        <p role="status" className="mt-3 font-semibold">
          {progressLabel(total, completed)}
        </p>
        {total ? (
          <progress
            aria-label="Progresso das etapas"
            className="mt-2 w-full"
            value={completed}
            max={total}
          />
        ) : null}
        <p className="text-sm">
          {next
            ? `Próxima etapa: ${next.title}`
            : total
              ? "Etapas concluídas. A entrega ainda precisa ser concluída ou aprovada."
              : "Crie etapas ou aplique um modelo."}
        </p>
      </div>
      <div className="rounded-2xl border border-emerald-200 p-4">
        <h3 className="mb-3 font-semibold">Checklist</h3>
        <div className="space-y-3">
          {data.items.map((item, index) => (
            <ChecklistRow
              key={item.id}
              item={item}
              team={team}
              canOrganize={manager && !closed}
              canComplete={participant && !closed}
              busy={busy}
              first={index === 0}
              last={index === total - 1}
              onSave={(payload) =>
                run("edit", { item_id: item.id, ...payload })
              }
              onToggle={() =>
                void run("toggle", {
                  item_id: item.id,
                  completed: !item.completed_at,
                })
              }
              onDelete={() => {
                if (
                  window.confirm(
                    "Remover esta etapa? Os arquivos permanecerão nos materiais gerais da tarefa.",
                  )
                )
                  void run("delete", { item_id: item.id });
              }}
              onMove={(delta) => {
                const ids = data.items.map((i) => i.id);
                [ids[index], ids[index + delta]] = [
                  ids[index + delta],
                  ids[index],
                ];
                void run("order", { ids });
              }}
              files={filesFor(item)}
            />
          ))}
        </div>
        {manager && !closed ? (
          <>
            <form
              className="mt-3 flex flex-wrap gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void run("add", { title }).then((ok) => {
                  if (ok) setTitle("");
                });
              }}
            >
              <label className="min-w-0 flex-1">
                Nova etapa
                <input
                  className={control}
                  required
                  maxLength={300}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ação e resultado verificável"
                />
              </label>
              <button className={button} disabled={busy || !title.trim()}>
                Adicionar etapa
              </button>
            </form>
            <details className="mt-4">
              <summary className="min-h-11 cursor-pointer py-2">
                Aplicar modelo de entrega (editável)
              </summary>
              <label>
                Modelo
                <select
                  aria-label="Modelo"
                  className={control}
                  value={template}
                  onChange={(e) => {
                    setTemplate(e.target.value);
                    setTemplateText(
                      deliveryTemplates[e.target.value].join("\n"),
                    );
                    setMode("");
                  }}
                >
                  {Object.keys(deliveryTemplates).map((name) => (
                    <option key={name}>{name}</option>
                  ))}
                </select>
              </label>
              <label>
                Etapas, uma por linha
                <textarea
                  aria-label="Etapas, uma por linha"
                  className={control + " min-h-32"}
                  value={templateText}
                  onChange={(e) => setTemplateText(e.target.value)}
                />
              </label>
              {total ? (
                <label>
                  Como aplicar
                  <select
                    aria-label="Como aplicar"
                    className={control}
                    value={mode}
                    onChange={(e) => setMode(e.target.value)}
                  >
                    <option value="">Escolha explicitamente</option>
                    <option value="append">Acrescentar às etapas atuais</option>
                    <option value="replace">
                      Substituir checklist (preserva arquivos gerais)
                    </option>
                  </select>
                </label>
              ) : null}
              <button
                className={button + " mt-2"}
                type="button"
                disabled={busy || !templateText.trim() || (total > 0 && !mode)}
                onClick={() => {
                  if (
                    mode === "replace" &&
                    !window.confirm(
                      "Substituir o checklist atual? Os arquivos gerais serão preservados.",
                    )
                  )
                    return;
                  void run("template", {
                    name: template,
                    mode: total ? mode : "append",
                    steps: templateText
                      .split("\n")
                      .map((title) => ({ title: title.trim() }))
                      .filter((s) => s.title),
                  }).then((ok) => {
                    if (ok) setMode("");
                  });
                }}
              >
                Aplicar cópia do modelo
              </button>
            </details>
          </>
        ) : null}
      </div>
      <div className="rounded-2xl border border-emerald-200 p-4">
        <h3 className="font-semibold">Bloqueios e revisão</h3>
        <p className="mt-2 whitespace-pre-wrap break-words">
          {data.task.blocked_reason
            ? `Bloqueada: ${data.task.blocked_reason}${data.task.blocked_by ? ` · Depende de ${team.find((m) => m.id === data.task.blocked_by)?.name ?? "integrante"}` : ""}`
            : "Nenhum bloqueio informado."}
        </p>
        <p className="text-sm">
          Revisão:{" "}
          {team.find((m) => m.id === data.task.reviewer_id)?.name ??
            "Sem revisor definido"}
        </p>
        {closed ? (
          manager ? (
            <form
              className="mt-3"
              onSubmit={(e) => {
                e.preventDefault();
                void run("reopen", { reason }).then((ok) => {
                  if (ok) setReason("");
                });
              }}
            >
              <label>
                Motivo da reabertura
                <input
                  className={control}
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
              <button
                className={button + " mt-2"}
                disabled={busy || !reason.trim()}
              >
                Reabrir tarefa
              </button>
            </form>
          ) : null
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {manager &&
            data.task.reviewer_id &&
            data.task.status !== "revisao" ? (
              <button
                className={button}
                disabled={busy || !!next}
                onClick={() => void run("review", {})}
              >
                Solicitar revisão
              </button>
            ) : null}
            {(
              data.task.reviewer_id
                ? actor === data.task.reviewer_id &&
                  data.task.status === "revisao"
                : actor === task.assigneeId
            ) ? (
              <button
                className={button}
                disabled={busy || !!next}
                onClick={() => void run("complete", {})}
              >
                {data.task.reviewer_id
                  ? "Aprovar e concluir"
                  : "Concluir entrega"}
              </button>
            ) : null}
            {next ? (
              <p className="text-sm">
                Conclua as etapas pendentes antes de finalizar ou solicitar
                revisão.
              </p>
            ) : null}
          </div>
        )}
      </div>
      {manager && !closed ? (
        <details className="rounded-2xl border border-emerald-200 p-4">
          <summary className="min-h-11 cursor-pointer">
            Organização e colaboração
          </summary>
          <form
            className="mt-3 grid gap-3 md:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              void run("metadata", metadata);
            }}
          >
            <label className="md:col-span-2">
              Entrega esperada
              <textarea
                aria-label="Entrega esperada"
                className={control}
                value={metadata.expected_delivery}
                onChange={(e) =>
                  setMetadata({
                    ...metadata,
                    expected_delivery: e.target.value,
                  })
                }
              />
            </label>
            <label className="md:col-span-2">
              Critério de conclusão
              <textarea
                aria-label="Critério de conclusão"
                className={control}
                value={metadata.completion_criteria}
                onChange={(e) =>
                  setMetadata({
                    ...metadata,
                    completion_criteria: e.target.value,
                  })
                }
              />
            </label>
            <label>
              Projeto ou ação
              <select
                aria-label="Projeto ou ação"
                className={control}
                value={metadata.project_id}
                onChange={(e) =>
                  setMetadata({ ...metadata, project_id: e.target.value })
                }
              >
                <option value="">Sem vínculo</option>
                {projects.data?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.titulo}
                  </option>
                ))}
              </select>
              {projects.error ? (
                <span role="alert">Não foi possível carregar projetos.</span>
              ) : null}
            </label>
            <label>
              Pessoa revisora
              <select
                aria-label="Pessoa revisora"
                className={control}
                value={metadata.reviewer_id}
                onChange={(e) =>
                  setMetadata({ ...metadata, reviewer_id: e.target.value })
                }
              >
                <option value="">Sem revisão</option>
                {team.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              O que está faltando
              <textarea
                aria-label="O que está faltando"
                className={control}
                value={metadata.blocked_reason}
                onChange={(e) =>
                  setMetadata({ ...metadata, blocked_reason: e.target.value })
                }
              />
            </label>
            <label>
              De quem depende
              <select
                aria-label="De quem depende"
                className={control}
                value={metadata.blocked_by}
                onChange={(e) =>
                  setMetadata({ ...metadata, blocked_by: e.target.value })
                }
              >
                <option value="">Não definido</option>
                {team.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
            <button className={button} disabled={busy}>
              Salvar organização
            </button>
          </form>
          <fieldset className="mt-4" disabled={busy}>
            <legend>Colaboradores</legend>
            <div className="grid gap-2 md:grid-cols-2">
              {team
                .filter((m) => m.id !== task.assigneeId)
                .map((m) => (
                  <label
                    className="flex min-h-11 items-center gap-2"
                    key={m.id}
                  >
                    <input
                      type="checkbox"
                      checked={members.includes(m.id)}
                      onChange={(e) =>
                        setMembers(
                          e.target.checked
                            ? [...members, m.id]
                            : members.filter((id) => id !== m.id),
                        )
                      }
                    />
                    {m.name}
                  </label>
                ))}
            </div>
            <button
              className={button}
              onClick={() => void run("collaborators", { members })}
            >
              Salvar colaboradores
            </button>
          </fieldset>
        </details>
      ) : null}
      {fileParticipant && !closed ? (
        <details className="rounded-2xl border border-emerald-200 p-4">
          <summary className="min-h-11 cursor-pointer">
            Adicionar referências e materiais gerais
          </summary>
          <label>
            Enviar material
            <input
              className={control}
              type="file"
              disabled={busy || upload.isPending}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file)
                  void upload
                    .mutateAsync({ taskId: task.id, file })
                    .catch((e) => setError(e.message));
                e.target.value = "";
              }}
            />
          </label>
          <p className="text-sm">
            O material fica disponível nos anexos gerais e na central de
            arquivos.
          </p>
        </details>
      ) : null}
      <div className="rounded-2xl border border-emerald-200 p-4">
        <h3 className="mb-2 font-semibold">Entrega final</h3>
        {filesFor()}
        {fileParticipant && !closed ? (
          <form
            className="mt-3 flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void external
                .mutateAsync({ taskId: task.id, url: linkUrl })
                .then((file) => attach(file))
                .then(() => setLinkUrl(""))
                .catch((e) => setError(e.message));
            }}
          >
            <label className="min-w-0 flex-1">
              Link da entrega final
              <input
                className={control}
                type="url"
                required
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
              />
            </label>
            <button className={button} disabled={busy || external.isPending}>
              Adicionar link final
            </button>
          </form>
        ) : null}
        <p className="mt-2 text-xs">
          Vincular reutiliza o arquivo da tarefa. Desvincular preserva o arquivo
          nos materiais gerais.
        </p>
      </div>
      <details className="rounded-2xl border border-emerald-200 p-4">
        <summary className="min-h-11 cursor-pointer">
          Histórico da entrega
        </summary>
        <ol className="space-y-2">
          {data.history.map((h) => (
            <li key={h.id} className="break-words border-b py-2 text-sm">
              {historyLabels[h.event] ?? h.event} ·{" "}
              {team.find((m) => m.id === h.actor_id)?.name ?? "Sistema"} ·{" "}
              {new Date(h.created_at).toLocaleString("pt-BR")}
              {h.detail.reason ? (
                <p>Motivo: {String(h.detail.reason)}</p>
              ) : null}
              {h.detail.title ? <p>{String(h.detail.title)}</p> : null}
              {h.event === "toggle" ? (
                <p>
                  {h.detail.completed ? "Etapa concluída" : "Etapa reaberta"}
                </p>
              ) : null}
            </li>
          ))}
        </ol>
        {data.history.length === 100 ? (
          <p className="text-xs">Exibindo as 100 alterações mais recentes.</p>
        ) : null}
      </details>
      {busy || upload.isPending || external.isPending ? (
        <p role="status">Salvando alteração…</p>
      ) : null}
      {error ? (
        <p role="alert" className="rounded-xl bg-rose-50 p-3 text-rose-800">
          {error}
        </p>
      ) : null}
    </section>
  );
}
function ChecklistRow({
  item,
  team,
  canOrganize,
  canComplete,
  busy,
  first,
  last,
  onSave,
  onToggle,
  onDelete,
  onMove,
  files,
}: {
  item: ChecklistItem;
  team: TeamMember[];
  canOrganize: boolean;
  canComplete: boolean;
  busy: boolean;
  first: boolean;
  last: boolean;
  onSave: (payload: Record<string, unknown>) => Promise<boolean>;
  onToggle: () => void;
  onDelete: () => void;
  onMove: (delta: number) => void;
  files: React.ReactNode;
}) {
  const [title, setTitle] = useState(item.title),
    [note, setNote] = useState(item.note ?? ""),
    [assignee, setAssignee] = useState(item.assignee_id ?? ""),
    [due, setDue] = useState(item.due_date ?? "");
  useEffect(() => {
    setTitle(item.title);
    setNote(item.note ?? "");
    setAssignee(item.assignee_id ?? "");
    setDue(item.due_date ?? "");
  }, [item]);
  return (
    <article className="min-w-0 rounded-xl border border-emerald-100 p-3">
      <div className="flex items-start gap-2">
        <label className="flex min-h-11 min-w-0 flex-1 items-center gap-3">
          <input
            className="h-5 w-5 shrink-0"
            type="checkbox"
            aria-label={`Concluir ${item.title}`}
            checked={!!item.completed_at}
            disabled={!canComplete || busy}
            onChange={onToggle}
          />
          <span
            className={
              "break-words " + (item.completed_at ? "line-through" : "")
            }
          >
            {item.title}
          </span>
        </label>
      </div>
      {item.completed_at ? (
        <p className="text-xs">
          Concluída por{" "}
          {team.find((m) => m.id === item.completed_by)?.name ?? "integrante"}{" "}
          em {new Date(item.completed_at).toLocaleString("pt-BR")}
        </p>
      ) : null}
      {item.assignee_id || item.due_date ? (
        <p className="text-xs">
          {team.find((m) => m.id === item.assignee_id)?.name}{" "}
          {item.due_date
            ? `· Prazo ${item.due_date.split("-").reverse().join("/")}`
            : ""}
        </p>
      ) : null}
      <details className="mt-2">
        <summary className="min-h-11 cursor-pointer py-2">
          Observação, arquivos e opções
        </summary>
        {canOrganize ? (
          <form
            className="grid gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void onSave({
                title,
                note,
                assignee_id: assignee,
                due_date: due,
              });
            }}
          >
            <label>
              Título da etapa
              <input
                className={control}
                required
                maxLength={300}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <label>
              Observação
              <textarea
                className={control}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
            <details>
              <summary className="min-h-11 cursor-pointer py-2">
                Responsável e prazo opcionais
              </summary>
              <label>
                Responsável da etapa
                <select
                  className={control}
                  value={assignee}
                  onChange={(e) => setAssignee(e.target.value)}
                >
                  <option value="">Responsável da tarefa</option>
                  {team.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Prazo da etapa
                <input
                  className={control}
                  type="date"
                  value={due}
                  onChange={(e) => setDue(e.target.value)}
                />
              </label>
            </details>
            <button className={button} disabled={busy}>
              Salvar etapa
            </button>
          </form>
        ) : (
          <p className="whitespace-pre-wrap break-words">
            {item.note || "Sem observação"}
          </p>
        )}
        <div className="mt-3">{files}</div>
      </details>
      {canOrganize ? (
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            className={button}
            aria-label={`Subir ${item.title}`}
            disabled={first || busy}
            onClick={() => onMove(-1)}
          >
            ↑ Subir
          </button>
          <button
            type="button"
            className={button}
            aria-label={`Descer ${item.title}`}
            disabled={last || busy}
            onClick={() => onMove(1)}
          >
            ↓ Descer
          </button>
          <button
            type="button"
            className={button}
            disabled={busy}
            onClick={onDelete}
          >
            Remover etapa
          </button>
        </div>
      ) : null}
    </article>
  );
}
