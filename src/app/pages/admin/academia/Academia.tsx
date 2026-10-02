import { useEffect, useState } from "react";
import { useParams, useLocation, Link } from "react-router-dom";
import { CopyPlus, GraduationCap, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAcademy } from "./useAcademy";
import { Study } from "./Study";
import { DriveUploads } from "./DriveUploads";
import {
  Card,
  Badge,
  Meter,
  Empty,
  Button,
  Editor,
  Asset,
  labels,
  type Field,
} from "./components";
import { fieldsFor, defaults } from "./fields";
import {
  deleteEntity,
  duplicateCourse,
  exportCsv,
  message,
  questionKey,
  rpc,
  saveEntity,
  saveQuestion,
  safeLink,
  type Entity,
} from "./service";
import type { Activity, Answer, Attempt, Course } from "./types";
type EditState = {
  entity: Entity;
  title: string;
  values: Record<string, unknown>;
  courseId?: string;
  activityId?: string;
  fields?: Field[];
};
const learnerTabs = [
  "Minha Academia",
  "Cursos publicados",
  "Editar meus cursos",
  "Contribuições",
];
const managementTabs = [
  "Dashboard",
  "Gestão de cursos",
  "Matrículas",
  "Atividades e avaliações",
  "Relatórios",
  "Categorias",
  "Instrutores",
  "Configurações",
];
export function Academia() {
  const academy = useAcademy();
  const { data, userId, admin, manager, canEdit, reload, error, loading } =
    academy;
  const { courseId, lessonId } = useParams();
  const location = useLocation();
  const [tab, setTab] = useState("Minha Academia");
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [selectedCourse, setSelectedCourse] = useState("");
  const [courseSearch, setCourseSearch] = useState("");
  const [courseCategory, setCourseCategory] = useState("");
  const [edit, setEdit] = useState<EditState | null>(null);
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setNotice("");
    setActionError("");
  }, [tab, selectedCourse, location.key]);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);
  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setActionError("");
    setNotice("");
    try {
      await action();
      await reload();
      setNotice("Alteração salva.");
    } catch (e) {
      setActionError(message(e));
    } finally {
      setBusy(false);
    }
  }
  function open(
    entity: Entity,
    title: string,
    row?: object,
    context?: { courseId?: string; activityId?: string },
  ) {
    const values = row
      ? ({ ...row } as Record<string, unknown>)
      : defaults(entity);
    for (const key of [
      "created_at",
      "updated_at",
      "created_by",
      "published_at",
      "enrolled_at",
      "completed_at",
      "last_lesson_id",
    ])
      delete values[key];
    if (
      context?.courseId &&
      [
        "modules",
        "lessons",
        "materials",
        "activities",
        "courseInstructors",
      ].includes(entity)
    )
      values.course_id = context.courseId;
    if (context?.activityId) values.activity_id = context.activityId;
    if (entity === "courses") {
      for (const key of ["available_from", "available_until"])
        if (values[key]) {
          const d = new Date(String(values[key]));
          values[key] = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
            .toISOString()
            .slice(0, 16);
        }
    }
    setEdit({
      entity,
      title,
      values,
      ...context,
      courseId:
        context?.courseId ||
        (entity === "courses" ? String(values.id || "") : undefined),
    });
  }
  async function save(values: Record<string, unknown>) {
    if (!edit) return;
    if (edit.entity === "courses" && !values.slug)
      values.slug = String(values.title)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
    let saved: unknown;
    if (edit.entity === "questions") {
      const { answer, ...question } = values;
      saved = await saveQuestion(question, String(answer || ""));
    } else {
      if (edit.entity === "lessons" && values.media_source === "drive")
        values.media_url = null;
      saved = await saveEntity(edit.entity, values);
    }
    if (edit.entity === "courses" && saved && typeof saved === "object" && "id" in saved)
      setSelectedCourse(String(saved.id));
    await reload();
    setNotice("Alteração salva.");
  }
  async function remove(entity: Entity, id: string) {
    if (!window.confirm(
      entity === "courses"
        ? "Excluir este curso? Arquivos vinculados devem ser removidos do Drive pela própria Academia. Histórico acadêmico pode impedir a exclusão."
        : "Excluir este registro? Registros com histórico acadêmico podem impedir a exclusão.",
    )) return;
    await run(async () => {
      try {
        await deleteEntity(entity, id);
      } catch (e) {
        const detail = message(e);
        if (entity === "courses" && /slug_key|duplicate key/i.test(detail)) {
          throw new Error("Não foi possível excluir o curso porque o banco tentou recriar um slug já existente. Não é necessário apagar pastas manualmente no Drive; este conflito é de dados da Academia.");
        }
        if (entity === "courses" && /foreign key|violates.*constraint|still referenced/i.test(detail)) {
          throw new Error("Este curso ainda possui histórico ou registros vinculados na Academia. A exclusão direta foi bloqueada para preservar os dados acadêmicos.");
        }
        throw e;
      }
    });
    if (entity === "courses" && selectedCourse === id) setSelectedCourse("");
  }
  if (loading && !data) return <p role="status">Carregando Academia RKC…</p>;
  if (error || !data)
    return (
      <Card>
        <h1 className="text-2xl font-bold">Academia RKC</h1>
        <p role="alert" className="text-destructive">
          {error || "Dados indisponíveis."}
        </p>
        <Button onClick={reload}>Tentar novamente</Button>
      </Card>
    );
  const course = data.courses.find((c) => c.id === courseId);
  if (courseId)
    return course ? (
      <Study
        data={data}
        course={course}
        userId={userId}
        lessonId={lessonId}
        reload={reload}
      />
    ) : (
      <Empty>
        Curso indisponível.{" "}
        <Link to="/admin/academia" className="underline">
          Voltar à Academia
        </Link>
      </Empty>
    );
  const myEnrollments = data.enrollments.filter(
    (e) => e.user_id === userId && e.status === "active",
  );
  const myReports = data.reports.filter((r) => r.user_id === userId);
  const visibleCourses = data.courses.filter(
    (c) => c.status === "published" && c.access_mode === "internal",
  );
  const filteredCatalog = visibleCourses.filter(
    (c) =>
      (!category || c.category_id === category) &&
      `${c.title} ${c.summary}`.toLowerCase().includes(q.toLowerCase()),
  );
  const courseTitle = (id: string) =>
    data.courses.find((c) => c.id === id)?.title ||
    data.reports.find((r) => r.course_id === id)?.course_title ||
    "Curso indisponível";
  const memberName = (uid: string) =>
    data.members.find((m) => m.user_id === uid)?.nome || "Usuário do painel";
  const ownCourses = data.courses.filter((c) => c.created_by === userId);
  const editingCourses =
    tab === "Editar meus cursos"
      ? ownCourses
      : data.courses.filter((c) => canEdit(c.id));
  const managedCourse = editingCourses.find((c) => c.id === selectedCourse);
  const managedCourseMatches = editingCourses.filter((c) => {
    const categoryName = data.categories.find((item) => item.id === c.category_id)?.name || "";
    const searchable = [c.title, c.summary, c.description, categoryName, labels[c.status], labels[c.level]].join(" ").toLowerCase();
    return (!courseCategory || c.category_id === courseCategory) && searchable.includes(courseSearch.toLowerCase());
  });
  function actions(
    entity: Entity,
    row: { id: string },
    title: string,
    context?: { courseId?: string; activityId?: string },
  ) {
    return (
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => open(entity, title, row, context)}
        >
          Editar
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => remove(entity, row.id)}
        >
          Excluir
        </Button>
      </div>
    );
  }
  function courseCard(c: Course) {
    const e = myEnrollments.find((e) => e.course_id === c.id);
    const r = myReports.find((r) => r.enrollment_id === e?.id);
    return (
      <Card key={c.id}>
        {c.cover_path || c.cover_drive_file_id ? (
          <Link to={`/admin/academia/cursos/${c.id}`} aria-label={`Abrir curso ${c.title}`} className="block overflow-hidden rounded-lg aspect-video bg-muted">
            <Asset
              path={c.cover_path}
              driveFileId={c.cover_drive_file_id}
              title={c.title}
              type="image"
              variant="card"
              showOpenLink={false}
            />
          </Link>
        ) : (
          <div className="rounded-md bg-primary/10 p-8">
            <GraduationCap
              aria-hidden="true"
              className="h-12 w-12 text-primary"
            />
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Badge tone={c.status === "published" ? "published" : "draft"}>
            {labels[c.status]}
          </Badge>
          <Badge>{labels[c.level]}</Badge>
          {c.required && <Badge>Obrigatório</Badge>}
          {r?.completed_at && <Badge>Concluído</Badge>}
        </div>
        <h3 className="text-xl font-semibold break-words">
          <Link className="hover:text-primary hover:underline underline-offset-4" to={`/admin/academia/cursos/${c.id}`}>
            {c.title}
          </Link>
        </h3>
        <p className="text-muted-foreground">{c.summary}</p>
        <p className="text-sm">
          Por {memberName(c.created_by || "")} ·{" "}
          {data!.categories.find((category) => category.id === c.category_id)
            ?.name || "Sem categoria"}
        </p>
        <p className="text-sm text-muted-foreground">
          {data!.modules.filter((m) => m.course_id === c.id).length} módulos ·{" "}
          {
            data!.lessons.filter(
              (l) => l.course_id === c.id && l.status === "published",
            ).length
          }{" "}
          aulas
        </p>
        {e && <Meter value={r?.progress || 0} />}
        <Link
          className="inline-flex rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm"
          to={`/admin/academia/cursos/${c.id}${r?.last_lesson_id && !r.completed_at ? `/aulas/${r.last_lesson_id}` : ""}`}
        >
          {e
            ? r?.completed_at
              ? "Revisitar curso"
              : "Continuar estudando"
            : "Conhecer curso"}
        </Link>
      </Card>
    );
  }
  const pending = data.activities.filter(
    (a) =>
      a.status === "published" &&
      myEnrollments.some(
        (e) =>
          e.course_id === a.course_id &&
          !data.attempts.some(
            (t) =>
              t.enrollment_id === e.id &&
              t.activity_id === a.id &&
              t.status === "passed",
          ),
      ),
  );
  return (
    <div className="space-y-6">
      <header className="flex gap-4 items-start">
        <GraduationCap
          aria-hidden="true"
          className="h-10 w-10 text-primary shrink-0"
        />
        <div>
          <h1 className="text-3xl font-bold">
            {data.settings[0]?.title || "Academia RKC"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {data.settings[0]?.welcome_text ||
              "Formação e conhecimento para a equipe RKC."}
          </p>
        </div>
      </header>
      <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)] items-start">
        <nav
          className="rounded-lg border bg-card p-2 lg:p-3 space-y-3 lg:space-y-4 lg:sticky lg:top-4 overflow-x-auto"
          aria-label="Áreas da Academia"
        >
          {[
            { label: "Aprendizagem e autoria", tabs: learnerTabs },
            {
              label: "Gestão",
              tabs: manager
                ? managementTabs.filter(
                    (t) =>
                      admin ||
                      [
                        "Dashboard",
                        "Gestão de cursos",
                        "Atividades e avaliações",
                        "Relatórios",
                      ].includes(t),
                  )
                : [],
            },
          ]
            .filter((group) => group.tabs.length)
            .map((group) => (
              <div key={group.label} className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground px-2">
                  {group.label}
                </p>
                <div className="flex min-w-max gap-1 lg:min-w-0 lg:grid lg:grid-cols-1">
                  {group.tabs.map((t) => (
                    <Button
                      key={t}
                      className="justify-start h-auto whitespace-nowrap lg:whitespace-normal text-left py-2"
                      variant={tab === t ? "default" : "ghost"}
                      aria-current={tab === t ? "page" : undefined}
                      onClick={() => {
                        setTab(t);
                        setSelectedCourse("");
                        setEdit(null);
                        setNotice("");
                        setActionError("");
                      }}
                    >
                      {t}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
        </nav>
        <div className="min-w-0 space-y-5">
          <h2 className="text-2xl font-semibold">{tab}</h2>
          {loading && <p role="status">Atualizando…</p>}
          {actionError && (
            <p role="alert" className="text-destructive">
              {actionError}
            </p>
          )}
          {notice && (
            <p role="status" className="text-primary">
              {notice}
            </p>
          )}
          {tab === "Minha Academia" && (
            <>
              <div className="grid sm:grid-cols-3 gap-4">
                {[
                  ["Meus cursos", myEnrollments.length],
                  [
                    "Em andamento",
                    myReports.filter((r) => !r.completed_at).length,
                  ],
                  [
                    "Concluídos",
                    myReports.filter((r) => r.completed_at).length,
                  ],
                ].map(([name, count]) => (
                  <Card key={name}>
                    <p className="text-muted-foreground">{name}</p>
                    <p className="text-3xl font-bold">{count}</p>
                  </Card>
                ))}
              </div>
              <h2 className="text-xl font-semibold">Continuar estudando</h2>
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                {data.courses
                  .filter(
                    (c) =>
                      myEnrollments.some((e) => e.course_id === c.id) &&
                      !myReports.find((r) => r.course_id === c.id)
                        ?.completed_at,
                  )
                  .map(courseCard)}
              </div>
              {!myEnrollments.length && (
                <Empty>
                  Você ainda não está matriculado. Consulte os cursos
                  disponíveis ou solicite uma matrícula.
                </Empty>
              )}
              <Card>
                <h2 className="text-xl font-semibold">Atividades pendentes</h2>
                {pending.length ? (
                  pending.map((a) => (
                    <p key={a.id}>
                      <Link
                        className="text-primary underline"
                        to={`/admin/academia/cursos/${a.course_id}${a.lesson_id ? `/aulas/${a.lesson_id}` : ""}`}
                      >
                        {a.title}
                      </Link>{" "}
                      · {courseTitle(a.course_id)}
                    </p>
                  ))
                ) : (
                  <p className="text-muted-foreground">
                    Nenhuma atividade pendente.
                  </p>
                )}
              </Card>
              <Card>
                <h2 className="text-xl font-semibold">
                  Histórico e competências
                </h2>
                {myReports.length ? (
                  myReports.map((r) => (
                    <div
                      className="border-b pb-3 last:border-0"
                      key={r.enrollment_id}
                    >
                      <Link
                        className="text-primary underline"
                        to={`/admin/academia/cursos/${r.course_id}`}
                      >
                        {courseTitle(r.course_id)}
                      </Link>
                      <p className="text-sm">
                        {r.completed_at
                          ? `Concluído em ${new Date(r.completed_at).toLocaleDateString("pt-BR")}`
                          : `Em andamento: ${r.completed_units}/${r.total_units} etapas`}
                      </p>
                      {r.completed_at && (
                        <p className="text-sm">
                          Competências:{" "}
                          {r.competencies?.join(", ") ||
                            data.courses
                              .find((c) => c.id === r.course_id)
                              ?.competencies.join(", ") ||
                            "Não informadas"}
                        </p>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground">
                    Seu histórico aparecerá aqui conforme você estudar.
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  As competências permanecem internas. Não são publicadas
                  automaticamente no perfil.
                </p>
              </Card>
            </>
          )}
          {tab === "Cursos publicados" && (
            <>
              <div className="flex flex-col sm:flex-row gap-3">
                <label className="flex-1">
                  Buscar cursos
                  <input
                    type="search"
                    className="block w-full border rounded-md px-3 py-2 bg-background"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                  />
                </label>
                <label>
                  Categoria
                  <select
                    className="block border rounded-md px-3 py-2 bg-background"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <option value="">Todas</option>
                    {data.categories.map((c) => (
                      <option value={c.id} key={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredCatalog.map(courseCard)}
              </div>
              {!filteredCatalog.length && (
                <Empty>
                  Nenhum curso publicado corresponde à sua busca ou às suas
                  permissões.
                </Empty>
              )}
            </>
          )}
          {tab === "Dashboard" && manager && (
            <>
              <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {[
                  [
                    "Cursos publicados",
                    editingCourses.filter((c) => c.status === "published")
                      .length,
                  ],
                  [
                    "Em elaboração",
                    editingCourses.filter((c) =>
                      ["draft", "review"].includes(c.status),
                    ).length,
                  ],
                  [
                    "Integrantes matriculados",
                    new Set(data.reports.map((r) => r.user_id)).size,
                  ],
                  [
                    "Matrículas em andamento",
                    data.reports.filter((r) => !r.completed_at).length,
                  ],
                  [
                    "Cursos concluídos",
                    data.reports.filter((r) => r.completed_at).length,
                  ],
                  [
                    "Taxa de conclusão",
                    `${data.reports.length ? Math.round((100 * data.reports.filter((r) => r.completed_at).length) / data.reports.length) : 0}%`,
                  ],
                  [
                    "Atividades obrigatórias pendentes",
                    data.enrollments
                      .filter(
                        (e) => e.status === "active" && canEdit(e.course_id),
                      )
                      .reduce(
                        (n, e) =>
                          n +
                          data.activities.filter(
                            (a) =>
                              a.course_id === e.course_id &&
                              a.status === "published" &&
                              a.required &&
                              !data.attempts.some(
                                (t) =>
                                  t.enrollment_id === e.id &&
                                  t.activity_id === a.id &&
                                  t.status === "passed",
                              ),
                          ).length,
                        0,
                      ),
                  ],
                  [
                    "Correções pendentes",
                    data.attempts.filter((t) => t.status === "pending").length,
                  ],
                  [
                    "Contribuições em revisão",
                    data.contributions.filter((c) => c.status === "review")
                      .length,
                  ],
                ].map(([name, count]) => (
                  <Card key={name}>
                    <p className="text-muted-foreground">{name}</p>
                    <p className="text-3xl font-bold">{count}</p>
                  </Card>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">
                Indicadores calculados a partir dos registros acessíveis ao seu
                perfil.
              </p>
            </>
          )}
          {["Editar meus cursos", "Gestão de cursos"].includes(tab) &&
            manager && (
              <>
                <div className="flex flex-wrap items-end gap-3">
                  <label className="min-w-[240px] flex-1">
                    Buscar por curso, descrição ou categoria
                    <input
                      type="search"
                      className="mt-1 block w-full rounded-md border bg-background px-3 py-2"
                      placeholder="Digite um nome ou tema"
                      value={courseSearch}
                      onChange={(e) => setCourseSearch(e.target.value)}
                    />
                  </label>
                  {manager && (
                    <Button onClick={() => open("courses", "Novo curso")}>
                      Novo curso
                    </Button>
                  )}
                </div>
                <div className="space-y-2">
                  <h2 className="text-sm font-semibold">Filtrar por categoria</h2>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant={courseCategory ? "outline" : "default"}
                      onClick={() => setCourseCategory("")}
                    >
                      Todas
                    </Button>
                    {data.categories.map((item) => (
                      <Button
                        key={item.id}
                        size="sm"
                        variant={courseCategory === item.id ? "default" : "outline"}
                        onClick={() => setCourseCategory(item.id)}
                      >
                        {item.name}
                      </Button>
                    ))}
                  </div>
                </div>
                {editingCourses.length > 0 && (
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {managedCourseMatches.map((c) => {
                      const categoryName = data.categories.find((item) => item.id === c.category_id)?.name;
                      return (
                        <Card key={c.id}>
                          <div className="aspect-video overflow-hidden rounded-md bg-primary/10">
                            {c.cover_path || c.cover_drive_file_id ? (
                              <Asset
                                path={c.cover_path}
                                driveFileId={c.cover_drive_file_id}
                                title={c.title}
                                type="image"
                              />
                            ) : (
                              <div className="flex h-full items-center justify-center">
                                <GraduationCap className="h-12 w-12 text-primary" aria-hidden="true" />
                              </div>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Badge tone={c.status === "published" ? "published" : "draft"}>
                              {labels[c.status]}
                            </Badge>
                            <Badge>{labels[c.level]}</Badge>
                          </div>
                          <h3 className="text-lg font-semibold break-words">{c.title}</h3>
                          <p className="line-clamp-3 text-sm text-muted-foreground">
                            {c.summary || c.description || "Descrição ainda não informada."}
                          </p>
                          <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                            {categoryName ? (
                              <button
                                type="button"
                                className="rounded-full border px-3 py-1 text-sm hover:bg-muted"
                                onClick={() => setCourseCategory(c.category_id || "")}
                              >
                                {categoryName}
                              </button>
                            ) : <span className="text-sm text-muted-foreground">Sem categoria</span>}
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                aria-label={"Editar curso " + c.title}
                                title="Editar curso"
                                onClick={() => setSelectedCourse(c.id)}
                              >
                                <Pencil className="h-4 w-4" aria-hidden="true" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                aria-label={"Duplicar curso " + c.title}
                                title="Duplicar curso"
                                disabled={busy}
                                onClick={() => void (async () => {
                                  setBusy(true);
                                  setActionError("");
                                  try {
                                    const result = await duplicateCourse(c.id);
                                    await reload();
                                    setSelectedCourse(String(result.course.id));
                                    const skipped = result.skippedDriveMedia + result.skippedDriveMaterials;
                                    setNotice(skipped
                                      ? "Curso duplicado como rascunho. Reenvie os " + skipped + " arquivo(s) privado(s) do Drive na cópia."
                                      : "Curso duplicado como rascunho.");
                                  } catch (e) {
                                    setActionError(message(e));
                                  } finally {
                                    setBusy(false);
                                  }
                                })()}
                              >
                                <CopyPlus className="h-4 w-4" aria-hidden="true" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                aria-label={"Excluir curso " + c.title}
                                title="Excluir curso"
                                disabled={busy}
                                onClick={() => void remove("courses", c.id)}
                              >
                                <Trash2 className="h-4 w-4" aria-hidden="true" />
                              </Button>
                            </div>
                          </div>
                          {selectedCourse === c.id && (
                            <p className="text-sm font-medium text-primary">Selecionado para edição</p>
                          )}
                        </Card>
                      );
                    })}
                  </div>
                )}
                {!editingCourses.length && (
                  <Empty>
                    Cadastre o primeiro curso. O catálogo começa vazio, sem conteúdos fictícios.
                  </Empty>
                )}
                {editingCourses.length > 0 && !managedCourseMatches.length && (
                  <Empty>Nenhum curso corresponde à busca ou à categoria selecionada.</Empty>
                )}
                {managedCourse && (
                  <>
                    <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
                      <div className="relative aspect-[3/1] min-h-44 overflow-hidden bg-gradient-to-br from-primary/25 via-primary/10 to-muted">
                        {managedCourse.cover_path || managedCourse.cover_drive_file_id ? (
                          <Asset
                            path={managedCourse.cover_path}
                            driveFileId={managedCourse.banner_drive_file_id || managedCourse.cover_drive_file_id}
                            title={managedCourse.title}
                            type="image"
                            variant="banner"
                            showOpenLink={false}
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center"><GraduationCap className="h-16 w-16 text-primary/50" aria-hidden="true" /></div>
                        )}
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent p-4 pt-16 sm:p-6">
                          <div className="flex items-end justify-between gap-4">
                            <div className="min-w-0 text-white">
                              <p className="mb-1 text-xs font-medium uppercase tracking-[0.16em] text-white/75">Editor visual do curso</p>
                              <h2 className="truncate text-2xl font-bold sm:text-3xl">{managedCourse.title}</h2>
                            </div>
                            <Button size="sm" variant="outline" className="shrink-0 bg-background/90 backdrop-blur" onClick={() => open("courses", "Editar curso", managedCourse)}>
                              <Pencil className="mr-2 h-4 w-4" aria-hidden="true" /> Editar informações
                            </Button>
                          </div>
                        </div>
                      </div>
                      <div className="grid gap-5 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_280px]">
                        <div className="space-y-3">
                          <p className="text-lg leading-relaxed text-muted-foreground">{managedCourse.summary || "Adicione um resumo para apresentar o curso ao aluno."}</p>
                          <div className="flex flex-wrap gap-2">
                            <Badge tone={managedCourse.status === "published" ? "published" : "draft"}>{labels[managedCourse.status]}</Badge>
                            <Badge>{labels[managedCourse.level]}</Badge>
                            {managedCourse.required && <Badge>Obrigatório</Badge>}
                            <Badge>{managedCourse.hours || 0}h</Badge>
                          </div>
                        </div>
                        <div className="rounded-xl border bg-muted/30 p-4">
                          <p className="text-sm font-semibold">Imagem de apresentação</p>
                          <p className="mt-1 text-xs text-muted-foreground">Capa e banner são independentes. A capa aparece nos cards e o banner apresenta a página do curso.</p>
                          <div className="mt-3">
                      {data.driveFiles.some(
                        (f) =>
                          f.academy_course_id === managedCourse.id &&
                          f.status === "archived",
                      ) && (
                        <DriveUploads
                          courseId={managedCourse.id}
                          kind="material"
                          cleanupOnly
                          existing={data.driveFiles.filter(
                            (f) =>
                              f.academy_course_id === managedCourse.id &&
                              f.status === "archived",
                          )}
                          onSaved={reload}
                        />
                      )}

                      <DriveUploads
                        key={`cover-${managedCourse.id}`}
                        courseId={managedCourse.id}
                        kind="cover"
                        existing={data.driveFiles.filter((f) => f.id === managedCourse.cover_drive_file_id)}
                        onSaved={reload}
                      />
                      <DriveUploads
                        courseId={managedCourse.id}
                        kind="banner"
                        existing={data.driveFiles.filter((f) => f.id === managedCourse.banner_drive_file_id)}
                        onSaved={reload}
                      />
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 border-t bg-muted/20 px-4 py-3 sm:px-6">
                      <Button
                        disabled={busy}
                        variant="outline"
                        onClick={() => {
                          const publish = managedCourse.status !== "published";
                          if (
                            window.confirm(
                              publish
                                ? "Publicar este curso para a equipe RKC?"
                                : "Despublicar este curso? Ele deixará de aparecer na biblioteca da equipe.",
                            )
                          )
                            void run(() =>
                              saveEntity("courses", {
                                id: managedCourse.id,
                                status: publish ? "published" : "draft",
                              }),
                            );
                        }}
                      >
                        {managedCourse.status === "published"
                          ? "Despublicar"
                          : "Publicar"}
                      </Button>
                      <Link
                        className="block text-primary underline"
                        to={`/admin/academia/cursos/${managedCourse.id}`}
                      >
                        Visualizar área de estudo
                      </Link>
                      </div>
                    </section>
                    <Card>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Conteúdo do curso</p>
                          <h2 className="text-xl font-semibold">Módulos e aulas</h2>
                        </div>
                        <Badge>{data.modules.filter((m) => m.course_id === managedCourse.id).length} módulos</Badge>
                      </div>
                      <Button
                        variant="outline"
                        onClick={() =>
                          open("modules", "Novo módulo", undefined, {
                            courseId: managedCourse.id,
                          })
                        }
                      >
                        Novo módulo
                      </Button>
                      {data.modules
                        .filter((m) => m.course_id === managedCourse.id)
                        .sort((a, b) => a.position - b.position)
                        .map((m) => (
                          <div
                            key={m.id}
                            className="rounded-xl border bg-background p-4 space-y-3 shadow-sm"
                          >
                            <h3 className="font-semibold">
                              {m.position}. {m.title}
                            </h3>
                            {actions("modules", m, "Editar módulo", {
                              courseId: managedCourse.id,
                            })}
                            <Button
                              size="sm"
                              onClick={() =>
                                open(
                                  "lessons",
                                  "Nova aula",
                                  { ...defaults("lessons"), module_id: m.id },
                                  { courseId: managedCourse.id },
                                )
                              }
                            >
                              Nova aula
                            </Button>
                            {data.lessons
                              .filter((l) => l.module_id === m.id)
                              .sort((a, b) => a.position - b.position)
                              .map((l) => (
                                <div
                                  key={l.id}
                                  className="rounded-lg border bg-muted/20 p-3 space-y-2"
                                >
                                  <p>
                                    {l.position}. {l.title} · {labels[l.status]}{" "}
                                    · {labels[l.type]}
                                  </p>
                                  {actions("lessons", l, "Editar aula", {
                                    courseId: managedCourse.id,
                                  })}
                                  <DriveUploads
                                    key={`media-${l.id}`}
                                    courseId={managedCourse.id}
                                    lessonId={l.id}
                                    kind="media"
                                    existing={data.driveFiles.filter(
                                      (f) => f.id === l.media_drive_file_id,
                                    )}
                                    onSaved={reload}
                                  />
                                  <DriveUploads
                                    key={`materials-${l.id}`}
                                    courseId={managedCourse.id}
                                    lessonId={l.id}
                                    kind="material"
                                    onSaved={reload}
                                  />
                                  {data.materials
                                    .filter(
                                      (material) =>
                                        material.lesson_id === l.id &&
                                        material.drive_file_id,
                                    )
                                    .map((material) => (
                                      <div
                                        key={material.id}
                                        className="space-y-2"
                                      >
                                        <p className="text-sm font-medium">
                                          Substituir material: {material.title}
                                        </p>
                                        <DriveUploads
                                          courseId={managedCourse.id}
                                          lessonId={l.id}
                                          kind="material"
                                          replaceMaterialId={material.id}
                                          existing={data.driveFiles.filter(
                                            (f) =>
                                              f.id === material.drive_file_id,
                                          )}
                                          onSaved={reload}
                                        />
                                      </div>
                                    ))}
                                </div>
                              ))}
                          </div>
                        ))}
                    </Card>
                    <Card>
                      <h2 className="font-semibold">
                        Materiais complementares do curso
                      </h2>
                      <DriveUploads
                        key={`course-material-${managedCourse.id}`}
                        courseId={managedCourse.id}
                        kind="material"
                        existing={data.driveFiles.filter((f) =>
                          data.materials.some(
                            (m) =>
                              !m.lesson_id &&
                              m.course_id === managedCourse.id &&
                              m.drive_file_id === f.id,
                          ),
                        )}
                        onSaved={reload}
                      />
                      <Button
                        variant="outline"
                        onClick={() =>
                          open("materials", "Novo material", undefined, {
                            courseId: managedCourse.id,
                          })
                        }
                      >
                        Adicionar material
                      </Button>
                      {data.materials
                        .filter(
                          (m) =>
                            m.course_id === managedCourse.id &&
                            !m.drive_file_id,
                        )
                        .map((m) => (
                          <div key={m.id} className="space-y-2">
                            <p>{m.title}</p>
                            {actions("materials", m, "Editar material", {
                              courseId: managedCourse.id,
                            })}
                          </div>
                        ))}
                    </Card>
                    <Card>
                      <h2 className="font-semibold">Instrutores do curso</h2>
                      {admin && (
                        <Button
                          variant="outline"
                          onClick={() =>
                            open(
                              "courseInstructors",
                              "Vincular instrutor",
                              undefined,
                              { courseId: managedCourse.id },
                            )
                          }
                        >
                          Vincular instrutor
                        </Button>
                      )}
                      {data.courseInstructors
                        .filter((ci) => ci.course_id === managedCourse.id)
                        .map((ci) => (
                          <div
                            key={ci.instructor_id}
                            className="flex flex-wrap gap-3 items-center"
                          >
                            <p>
                              {data.instructors.find(
                                (i) => i.id === ci.instructor_id,
                              )?.external_name ||
                                data.members.find(
                                  (m) =>
                                    m.id ===
                                    data.instructors.find(
                                      (i) => i.id === ci.instructor_id,
                                    )?.member_id,
                                )?.nome ||
                                "Instrutor"}{" "}
                              · {ci.can_edit ? "Pode editar" : "Apresentação"}
                            </p>
                            {admin && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  run(async () => {
                                    const { error } = await supabase
                                      .from("academy_course_instructors")
                                      .delete()
                                      .eq("course_id", ci.course_id)
                                      .eq("instructor_id", ci.instructor_id);
                                    if (error) throw error;
                                  })
                                }
                              >
                                Desvincular
                              </Button>
                            )}
                          </div>
                        ))}
                    </Card>
                  </>
                )}
              </>
            )}
          {tab === "Categorias" && admin && (
            <Card>
              <h2 className="text-xl font-semibold">Categorias</h2>
              <Button onClick={() => open("categories", "Nova categoria")}>
                Nova categoria
              </Button>
              {data.categories.map((c) => (
                <div
                  key={c.id}
                  className="flex flex-wrap justify-between gap-3"
                >
                  <p>{c.name}</p>
                  {actions("categories", c, "Editar categoria")}
                </div>
              ))}
            </Card>
          )}
          {tab === "Instrutores" && admin && (
            <Card>
              <h2 className="text-xl font-semibold">Instrutores</h2>
              <Button onClick={() => open("instructors", "Novo instrutor")}>
                Novo instrutor
              </Button>
              {data.instructors.map((i) => (
                <div key={i.id} className="space-y-2">
                  <p>
                    {i.external_name ||
                      data.members.find((m) => m.id === i.member_id)?.nome ||
                      "Integrante"}
                  </p>
                  <p className="text-sm">{i.bio}</p>
                  {actions("instructors", i, "Editar instrutor")}
                </div>
              ))}
            </Card>
          )}
          {tab === "Matrículas" && admin && (
            <Card>
              <h2 className="text-xl font-semibold">Matrículas</h2>
              <Button
                onClick={() => open("enrollments", "Matricular integrante")}
              >
                Matricular integrante
              </Button>
              {!data.enrollments.length && (
                <Empty>Nenhuma matrícula cadastrada.</Empty>
              )}
              {data.enrollments.map((e) => (
                <div key={e.id} className="border-b pb-3 space-y-2">
                  <p>
                    {memberName(e.user_id)} · {courseTitle(e.course_id)} ·{" "}
                    {labels[e.status]} {e.required && "· Obrigatória"}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => open("enrollments", "Editar matrícula", e)}
                  >
                    Editar matrícula
                  </Button>
                </div>
              ))}
              <p className="text-sm text-muted-foreground">
                Integram esta lista os membros da equipe vinculados a um usuário
                existente. Matrículas automáticas são registradas quando o
                integrante inicia o curso.
              </p>
            </Card>
          )}
          {tab === "Atividades e avaliações" && manager && (
            <>
              <Card>
                <h2 className="text-xl font-semibold">
                  Atividades e avaliações
                </h2>
                <label>
                  Curso
                  <select
                    className="block w-full border rounded-md px-3 py-2 bg-background"
                    value={selectedCourse}
                    onChange={(e) => setSelectedCourse(e.target.value)}
                  >
                    <option value="">Selecione</option>
                    {editingCourses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                </label>
                {managedCourse && (
                  <Button
                    onClick={() =>
                      open(
                        "activities",
                        "Nova atividade / avaliação",
                        undefined,
                        {
                          courseId: managedCourse.id,
                        },
                      )
                    }
                  >
                    Nova atividade / avaliação
                  </Button>
                )}
                {data.activities
                  .filter((a) => a.course_id === managedCourse?.id)
                  .map((a) => (
                    <div key={a.id} className="border rounded-md p-4 space-y-3">
                      <h3 className="font-semibold">
                        {a.title} · {labels[a.kind]} · {labels[a.status]}
                      </h3>
                      {actions("activities", a, "Editar atividade", {
                        courseId: a.course_id,
                      })}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          open("questions", "Nova questão", undefined, {
                            courseId: a.course_id,
                            activityId: a.id,
                          })
                        }
                      >
                        Adicionar questão
                      </Button>
                      {data.questions
                        .filter((q) => q.activity_id === a.id)
                        .sort((x, y) => x.position - y.position)
                        .map((question) => (
                          <div
                            className="border-l-2 pl-3 space-y-2"
                            key={question.id}
                          >
                            <p>
                              {question.prompt} · {labels[question.type]} ·{" "}
                              {question.points} ponto(s)
                            </p>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={async () => {
                                  try {
                                    const answer = await questionKey(
                                      question.id,
                                    );
                                    open(
                                      "questions",
                                      "Editar questão",
                                      { ...question, answer },
                                      {
                                        courseId: a.course_id,
                                        activityId: a.id,
                                      },
                                    );
                                  } catch (e) {
                                    setActionError(message(e));
                                  }
                                }}
                              >
                                Editar questão
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => remove("questions", question.id)}
                              >
                                Excluir
                              </Button>
                            </div>
                          </div>
                        ))}
                    </div>
                  ))}
              </Card>
              <Card>
                <h2 className="text-xl font-semibold">Correção de respostas</h2>
                {data.attempts
                  .filter((t) => t.status === "pending" && canEdit(t.course_id))
                  .map((t) => (
                    <Review
                      key={t.id}
                      attempt={t}
                      activity={
                        data.activities.find((a) => a.id === t.activity_id)!
                      }
                      answers={data.answers.filter(
                        (a) => a.attempt_id === t.id,
                      )}
                      questions={data.questions}
                      member={memberName(
                        data.enrollments.find((e) => e.id === t.enrollment_id)
                          ?.user_id || "",
                      )}
                      onSave={(grades) =>
                        run(() =>
                          rpc("academy_review_attempt", {
                            p_attempt: t.id,
                            p_grades: grades,
                          }),
                        )
                      }
                      busy={busy}
                    />
                  ))}
                {!data.attempts.some(
                  (t) => t.status === "pending" && canEdit(t.course_id),
                ) && (
                  <p className="text-muted-foreground">
                    Nenhuma correção pendente.
                  </p>
                )}
              </Card>
            </>
          )}
          {tab === "Relatórios" && manager && (
            <Card>
              <div className="flex flex-wrap justify-between gap-3">
                <h2 className="text-xl font-semibold">
                  Progresso por integrante e curso
                </h2>
                <Button
                  variant="outline"
                  onClick={() =>
                    exportCsv(
                      [
                        "Integrante",
                        "Curso",
                        "Etapas concluídas",
                        "Total de etapas",
                        "Progresso (%)",
                        "Conclusão",
                      ],
                      data.reports.map((r) => [
                        memberName(r.user_id),
                        courseTitle(r.course_id),
                        r.completed_units,
                        r.total_units,
                        r.progress,
                        r.completed_at,
                      ]),
                    )
                  }
                >
                  Exportar CSV
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr>
                      {["Integrante", "Curso", "Progresso", "Situação"].map(
                        (h) => (
                          <th key={h} className="p-3">
                            {h}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {data.reports.map((r) => (
                      <tr key={r.enrollment_id} className="border-t">
                        <td className="p-3">{memberName(r.user_id)}</td>
                        <td className="p-3">{courseTitle(r.course_id)}</td>
                        <td className="p-3">
                          {r.completed_units}/{r.total_units} · {r.progress}%
                        </td>
                        <td className="p-3">
                          {r.completed_at
                            ? `Concluído em ${new Date(r.completed_at).toLocaleDateString("pt-BR")}`
                            : "Em andamento"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!data.reports.length && (
                <Empty>Nenhum progresso registrado.</Empty>
              )}
              <h3 className="font-semibold">
                Pendências de atividades por matrícula
              </h3>
              {data.enrollments
                .filter((e) => e.status === "active" && canEdit(e.course_id))
                .map((e) => (
                  <p key={e.id} className="text-sm">
                    {memberName(e.user_id)} · {courseTitle(e.course_id)}:{" "}
                    {data.activities
                      .filter(
                        (a) =>
                          a.course_id === e.course_id &&
                          a.status === "published" &&
                          a.required &&
                          !data.attempts.some(
                            (t) =>
                              t.enrollment_id === e.id &&
                              t.activity_id === a.id &&
                              t.status === "passed",
                          ),
                      )
                      .map((a) => a.title)
                      .join(", ") || "Nenhuma pendência"}
                  </p>
                ))}
            </Card>
          )}
          {tab === "Contribuições" && (
            <>
              <div className="flex flex-wrap justify-between gap-3">
                <h2 className="text-xl font-semibold">
                  Conhecimento da equipe
                </h2>
                <Button
                  onClick={() => open("contributions", "Nova contribuição")}
                >
                  Compartilhar conhecimento
                </Button>
              </div>
              <p className="text-muted-foreground">
                Envie tutoriais, experiências e referências para revisão
                editorial.
              </p>
              {data.contributions.map((c) => (
                <Card key={c.id}>
                  <div className="flex flex-wrap justify-between gap-3">
                    <h3 className="text-xl font-semibold">{c.title}</h3>
                    <Badge>{labels[c.status]}</Badge>
                  </div>
                  <p className="whitespace-pre-wrap break-words">{c.content}</p>
                  <p className="text-sm text-muted-foreground">
                    {memberName(c.user_id)} ·{" "}
                    {new Date(c.created_at).toLocaleDateString("pt-BR")}
                  </p>
                  {safeLink(c.reference_url) && (
                    <a
                      className="text-primary underline"
                      href={safeLink(c.reference_url)!}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Consultar referência
                    </a>
                  )}
                  {c.review_notes && <p>Revisão: {c.review_notes}</p>}
                  {c.user_id === userId &&
                    c.status === "draft" &&
                    actions("contributions", c, "Editar contribuição")}
                  {admin && c.status === "review" && (
                    <div className="flex gap-2">
                      <Button
                        disabled={busy}
                        onClick={() =>
                          run(() =>
                            saveEntity("contributions", {
                              id: c.id,
                              status: "approved",
                              reviewed_by: userId,
                              reviewed_at: new Date().toISOString(),
                            }),
                          )
                        }
                      >
                        Aprovar contribuição
                      </Button>
                      <Button
                        variant="outline"
                        disabled={busy}
                        onClick={() => {
                          const notes = window.prompt(
                            "Orientação para o integrante:",
                          );
                          if (notes !== null)
                            void run(() =>
                              saveEntity("contributions", {
                                id: c.id,
                                status: "rejected",
                                review_notes: notes,
                                reviewed_by: userId,
                                reviewed_at: new Date().toISOString(),
                              }),
                            );
                        }}
                      >
                        Devolver
                      </Button>
                    </div>
                  )}
                  {c.user_id === userId && c.status === "rejected" && (
                    <Button
                      variant="outline"
                      onClick={() =>
                        open("contributions", "Reenviar contribuição", {
                          title: c.title,
                          content: c.content,
                          reference_url: c.reference_url,
                          course_id: c.course_id,
                          status: "draft",
                        })
                      }
                    >
                      Criar versão corrigida
                    </Button>
                  )}
                </Card>
              ))}
              {!data.contributions.length && (
                <Empty>
                  Nenhuma contribuição disponível. Compartilhe o primeiro
                  material.
                </Empty>
              )}
            </>
          )}
          {tab === "Configurações" && admin && (
            <Card>
              <h2 className="text-xl font-semibold">
                Configurações da Academia
              </h2>
              <p>{data.settings[0]?.welcome_text}</p>
              <Button
                onClick={() =>
                  open(
                    "settings",
                    "Editar Academia",
                    data.settings[0] || {
                      id: true,
                      title: "Academia RKC",
                      welcome_text: "",
                    },
                  )
                }
              >
                Editar nome e mensagem
              </Button>
              <p className="text-sm text-muted-foreground">
                Cursos públicos, pagamentos, trilhas e certificados têm
                estrutura preparada para evolução. A publicação nesta versão é
                interna.
              </p>
            </Card>
          )}
          {edit && (
            <Editor
              key={`${edit.entity}-${edit.values.id || "new"}`}
              title={edit.title}
              fields={
                edit.fields || fieldsFor(edit.entity, data, edit.courseId)
              }
              initial={edit.values}
              courseId={edit.courseId}
              onSave={save}
              onClose={() => setEdit(null)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
function Review({
  attempt,
  activity,
  answers,
  questions,
  member,
  onSave,
  busy,
}: {
  attempt: Attempt;
  activity: Activity;
  answers: Answer[];
  questions: { id: string; prompt: string; points: number }[];
  member: string;
  onSave: (grades: Record<string, unknown>[]) => Promise<void>;
  busy: boolean;
}) {
  const [grades, setGrades] = useState<
    Record<string, { points: string; feedback: string }>
  >({});
  const manual = answers.filter((a) => a.points_awarded === null);
  return (
    <form
      className="border rounded-md p-4 space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        void onSave(
          manual.map((a) => ({
            answer_id: a.id,
            points: Number(grades[a.id]?.points),
            feedback: grades[a.id]?.feedback || "",
          })),
        );
      }}
    >
      <h3 className="font-semibold">
        {activity?.title} · {member} · Tentativa {attempt.attempt_number}
      </h3>
      {answers.map((a) => {
        const q = questions.find((q) => q.id === a.question_id);
        return (
          <div key={a.id} className="space-y-2">
            <p className="font-medium">{q?.prompt}</p>
            <p className="whitespace-pre-wrap break-words">{a.answer}</p>
            {a.points_awarded !== null ? (
              <p>
                Pontos: {a.points_awarded}/{q?.points}
              </p>
            ) : (
              <>
                <label className="block text-sm">
                  Pontos (0 a {q?.points})
                  <input
                    type="number"
                    required
                    min={0}
                    max={q?.points}
                    step="any"
                    className="block border rounded-md px-3 py-2 bg-background"
                    value={grades[a.id]?.points ?? ""}
                    onChange={(e) =>
                      setGrades({
                        ...grades,
                        [a.id]: {
                          points: e.target.value,
                          feedback: grades[a.id]?.feedback || "",
                        },
                      })
                    }
                  />
                </label>
                <label className="block text-sm">
                  Feedback
                  <input
                    className="block w-full border rounded-md px-3 py-2 bg-background"
                    value={grades[a.id]?.feedback || ""}
                    onChange={(e) =>
                      setGrades({
                        ...grades,
                        [a.id]: {
                          points: grades[a.id]?.points || "",
                          feedback: e.target.value,
                        },
                      })
                    }
                  />
                </label>
              </>
            )}
          </div>
        );
      })}
      <Button disabled={busy} type="submit">
        Salvar correção
      </Button>
    </form>
  );
}
