import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, Button, Badge, Meter, Empty, Asset, labels } from "./components";
import { Textarea } from "@/app/components/ui/textarea";
import { rpc, safeContextRoute, message } from "./service";
import type { AcademyData, Activity, Course, Question } from "./types";
export function Study({
  data,
  course,
  userId,
  lessonId,
  reload,
}: {
  data: AcademyData;
  course: Course;
  userId: string;
  lessonId?: string;
  reload: () => Promise<void>;
}) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [courseTab, setCourseTab] = useState<"overview" | "curriculum" | "materials" | "activities">("curriculum");
  const [openModules, setOpenModules] = useState<Set<string>>(() => new Set());
  const enrollment = data.enrollments.find(
    (e) =>
      e.course_id === course.id &&
      e.user_id === userId &&
      e.status === "active",
  );
  const report = data.reports.find((r) => r.enrollment_id === enrollment?.id);
  const modules = data.modules
    .filter((m) => m.course_id === course.id)
    .sort((a, b) => a.position - b.position);
  const lessons = modules.flatMap((m) =>
    data.lessons
      .filter((l) => l.module_id === m.id && l.status === "published")
      .sort((a, b) => a.position - b.position),
  );
  const lesson = lessons.find((l) => l.id === lessonId);
  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await action();
      await reload();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  // Opening records a start and resume location only. Completion requires the explicit button.
  useEffect(() => {
    if (!lesson || !enrollment) return;
    let active = true;
    rpc("academy_record_lesson", {
      p_enrollment: enrollment.id,
      p_lesson: lesson.id,
      p_complete: false,
    })
      .then(() => {
        if (active) return reload();
      })
      .catch((e) => {
        if (active) setError(message(e));
      });
    return () => {
      active = false;
    };
  }, [lesson?.id, enrollment?.id]);
  const complete = !!data.progress.find(
    (p) => p.enrollment_id === enrollment?.id && p.lesson_id === lesson?.id,
  )?.completed_at;
  const resume =
    lessons.find((l) => l.id === report?.last_lesson_id) || lessons[0];
  const activities = data.activities.filter(
    (a) =>
      a.course_id === course.id &&
      a.status === "published" &&
      (!a.lesson_id || a.lesson_id === lesson?.id),
  );
  const instructors = data.courseInstructors
    .filter((ci) => ci.course_id === course.id)
    .map((ci) => data.instructors.find((i) => i.id === ci.instructor_id))
    .filter(Boolean);
  const route = safeContextRoute(lesson?.context_route);
  const lessonIndex = lesson ? lessons.indexOf(lesson) : -1;
  const previousLesson = lessonIndex > 0 ? lessons[lessonIndex - 1] : null;
  const nextLesson = lessonIndex >= 0 ? lessons[lessonIndex + 1] : null;
  const completedLessonIds = new Set(
    data.progress
      .filter((p) => p.enrollment_id === enrollment?.id && p.completed_at)
      .map((p) => p.lesson_id),
  );
  const completedLessons = lessons.filter((l) => completedLessonIds.has(l.id)).length;
  const remainingMinutes = lessons
    .filter((l) => !completedLessonIds.has(l.id))
    .reduce((total, l) => total + (l.duration_minutes || 0), 0);
  const courseMaterials = data.materials.filter((m) => m.course_id === course.id && !m.lesson_id);
  const totalMinutes = lessons.reduce((total, l) => total + (l.duration_minutes || 0), 0);
  const progressPercent = Math.round(report?.progress || 0);
  const toggleModule = (moduleId: string) => {
    setOpenModules((current) => {
      const next = new Set(current);
      if (next.has(moduleId)) next.delete(moduleId);
      else next.add(moduleId);
      return next;
    });
  };
  return (
    <div className="space-y-6">
      <Link to={lesson ? `/admin/academia/cursos/${course.id}` : "/admin/academia"} className="text-primary underline">
        {lesson ? `← Voltar para ${course.title}` : "← Minha Academia"}
      </Link>
      {!lesson && (
        <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
          <div className="relative min-h-[300px] overflow-hidden sm:min-h-[340px] lg:min-h-[380px]">
            {course.banner_drive_file_id ? (
              <div className="absolute inset-0">
                <Asset
                  driveFileId={course.banner_drive_file_id}
                  title={`Banner de ${course.title}`}
                  type="image"
                  variant="banner"
                  showOpenLink={false}
                />
              </div>
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-primary/25 via-muted to-background" />
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/55 to-black/20" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/10" />
            <div className="relative flex min-h-[300px] flex-col justify-end p-5 text-white sm:min-h-[340px] sm:p-8 lg:min-h-[380px] lg:p-10">
              <div className="max-w-3xl space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>Formação interna</Badge>
                  <Badge>{labels[course.level]}</Badge>
                  {course.required && <Badge>Curso obrigatório</Badge>}
                </div>
                <div>
                  <h1 className="text-3xl font-bold leading-tight break-words drop-shadow-sm sm:text-4xl lg:text-5xl">{course.title}</h1>
                  {course.summary && <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/85 sm:text-base">{course.summary}</p>}
                </div>
                <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/85">
                  <span>{course.hours} h de formação</span>
                  <span>{lessons.length} aulas publicadas</span>
                  {instructors.length > 0 && <span>Instrutores: {instructors.map((i) => i!.external_name || data.members.find((m) => m.id === i!.member_id)?.nome || "Integrante").join(", ")}</span>}
                </div>
                {enrollment && (
                  <div className="max-w-2xl rounded-xl bg-black/25 p-3 backdrop-blur-sm">
                    <div className="mb-2 flex items-center justify-between text-sm font-medium">
                      <span>Seu progresso</span><span>{Math.round(report?.progress || 0)}%</span>
                    </div>
                    <Meter value={report?.progress || 0} />
                  </div>
                )}
                <div className="flex flex-wrap gap-3">
                  {enrollment ? (
                    resume && <Button onClick={() => navigate(`/admin/academia/cursos/${course.id}/aulas/${resume.id}`)}>Continuar estudando</Button>
                  ) : course.status === "published" && ["self", "automatic"].includes(course.enrollment_mode) ? (
                    <Button disabled={busy} onClick={() => run(() => rpc("academy_enroll", { p_course: course.id }))}>{busy ? "Matriculando…" : "Iniciar curso"}</Button>
                  ) : (
                    <p className="text-sm text-white/85">Solicite sua matrícula ao administrador para registrar progresso.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
          {report?.completed_at && (
            <div className="border-t bg-primary/5 px-5 py-3 text-sm font-medium text-primary sm:px-8">
              Curso concluído em {new Date(report.completed_at).toLocaleDateString("pt-BR")}. Competências: {course.competencies.join(", ") || "Não informadas"}
            </div>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {!lesson && (
        <nav className="flex gap-1 overflow-x-auto border-b bg-background px-1" aria-label="Navegação do curso">
          {([
            ["curriculum", "▦ Módulos"],
            ["overview", "◉ Sobre o curso"],
            ["materials", `▣ Materiais · ${courseMaterials.length}`],
            ["activities", `◇ Atividades · ${activities.length}`],
          ] as const).map(([id, label]) => (
            <button key={id} type="button" onClick={() => setCourseTab(id)}
              className={`min-h-12 shrink-0 border-b-2 px-4 text-sm font-semibold transition-colors ${courseTab === id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              {label}
            </button>
          ))}
        </nav>
      )}
      <div className={lesson ? "space-y-6" : "grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]"}>
        {!lesson && courseTab === "curriculum" && (
          <>
            <main className="space-y-4" aria-label="Módulos e aulas">
              <div className="mb-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">Grade curricular</p>
                <h2 className="mt-1 text-2xl font-bold">Módulos e aulas</h2>
                <p className="mt-1 text-sm text-muted-foreground">Avance pelo curso no seu ritmo. Abra um módulo para visualizar suas aulas.</p>
              </div>
              {modules.map((m, moduleIndex) => {
                const moduleLessons = lessons.filter((l) => l.module_id === m.id);
                const moduleMinutes = moduleLessons.reduce((total, l) => total + (l.duration_minutes || 0), 0);
                const moduleCompleted = moduleLessons.filter((l) => completedLessonIds.has(l.id)).length;
                const isOpen = openModules.has(m.id) || moduleIndex === 0;
                return (
                  <section key={m.id} className="overflow-hidden rounded-2xl border bg-card shadow-sm">
                    <button
                      type="button"
                      className="flex w-full items-center gap-4 p-4 text-left sm:p-5"
                      onClick={() => toggleModule(m.id)}
                      aria-expanded={isOpen}
                    >
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">
                        {moduleIndex + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-base font-bold sm:text-lg">{m.title}</span>
                        <span className="mt-1 block text-sm text-muted-foreground">{m.description}</span>
                      </span>
                      <span className="hidden shrink-0 text-right text-xs text-muted-foreground sm:block">
                        {moduleLessons.length} {moduleLessons.length === 1 ? "aula" : "aulas"} · {moduleMinutes} min
                        {enrollment && <span className="mt-1 block">{moduleCompleted}/{moduleLessons.length} concluídas</span>}
                      </span>
                      <span className="shrink-0 text-lg text-muted-foreground">{isOpen ? "⌃" : "⌄"}</span>
                    </button>
                    {isOpen && (
                      <ol className="space-y-2 border-t bg-muted/20 p-3 sm:p-4">
                        {moduleLessons.map((l, lessonIndexInModule) => {
                          const done = completedLessonIds.has(l.id);
                          return (
                            <li key={l.id}>
                              <Link
                                className="group flex min-h-[76px] items-center gap-3 rounded-xl border bg-background p-3 transition hover:border-primary/40 hover:shadow-sm sm:p-4"
                                to={`/admin/academia/cursos/${course.id}/aulas/${l.id}`}
                              >
                                <span className="flex h-12 w-16 shrink-0 items-center justify-center rounded-lg bg-muted text-lg text-muted-foreground group-hover:text-primary">▶</span>
                                <span className="min-w-0 flex-1">
                                  <span className="block text-sm font-semibold sm:text-base">{moduleIndex + 1}.{lessonIndexInModule + 1} {l.title}</span>
                                  <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                    <span>{labels[l.type] || l.type || "Aula"}</span>
                                    <span>{l.duration_minutes} min</span>
                                    {!l.required && <span>Opcional</span>}
                                  </span>
                                </span>
                                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${done ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
                                  {done ? "✓" : ""}
                                </span>
                              </Link>
                            </li>
                          );
                        })}
                        {!moduleLessons.length && <li><Empty>Nenhuma aula publicada neste módulo.</Empty></li>}
                      </ol>
                    )}
                  </section>
                );
              })}
              {!lessons.length && <Empty>Nenhuma aula publicada neste curso.</Empty>}
            </main>
            <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start" aria-label="Resumo do curso">
              <Card>
                <h2 className="text-lg font-bold">Progresso do curso</h2>
                <div className="mt-4 flex items-center gap-4">
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-[8px] border-primary/15">
                    <strong className="text-xl">{progressPercent}%</strong>
                  </div>
                  <div>
                    <strong className="block text-lg">{completedLessons} de {lessons.length}</strong>
                    <span className="text-sm text-muted-foreground">aulas concluídas</span>
                  </div>
                </div>
                {enrollment && <div className="mt-4"><Meter value={report?.progress || 0} /></div>}
                {resume && enrollment && (
                  <Button className="mt-4 w-full" onClick={() => navigate(`/admin/academia/cursos/${course.id}/aulas/${resume.id}`)}>
                    ▶ Continuar de onde parei
                  </Button>
                )}
              </Card>
              <Card>
                <h2 className="text-lg font-bold">Informações do curso</h2>
                <dl className="mt-4 space-y-4 text-sm">
                  <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Duração total</dt><dd className="font-semibold">{course.hours ? `${course.hours} h` : `${totalMinutes} min`}</dd></div>
                  <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Módulos</dt><dd className="font-semibold">{modules.length}</dd></div>
                  <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Total de aulas</dt><dd className="font-semibold">{lessons.length}</dd></div>
                  <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Materiais</dt><dd className="font-semibold">{courseMaterials.length}</dd></div>
                </dl>
              </Card>
              <Card>
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-bold">Materiais do curso</h2>
                  <Badge>{courseMaterials.length} arquivos</Badge>
                </div>
                <div className="mt-4 space-y-2">
                  {courseMaterials.slice(0, 3).map((m) => (
                    <div key={m.id} className="rounded-xl border bg-muted/20 p-3">
                      <p className="truncate text-sm font-semibold">{m.title}</p>
                    </div>
                  ))}
                  {!courseMaterials.length && <p className="text-sm text-muted-foreground">Nenhum material disponível.</p>}
                </div>
                {courseMaterials.length > 0 && (
                  <Button variant="outline" className="mt-4 w-full" onClick={() => setCourseTab("materials")}>Ver todos os materiais</Button>
                )}
              </Card>
            </aside>
          </>
        )}
        <div className={`space-y-6 ${!lesson ? "lg:col-span-2" : ""}`}>
          {lessonId && !lesson ? (
            <Empty>Aula indisponível.</Empty>
          ) : lesson ? (
            <Card>
              <p className="text-sm text-muted-foreground">{modules.find((m) => m.id === lesson.module_id)?.title} · {course.title}</p>
              <h1 className="text-3xl font-bold">{lesson.title}</h1>
              <p className="text-muted-foreground">
                {lesson.description} · {lesson.duration_minutes} min
              </p>
              <div className="overflow-hidden rounded-xl bg-black shadow-sm">
                <Asset
                  path={lesson.media_path}
                  driveFileId={lesson.media_drive_file_id}
                  source={lesson.media_source}
                  url={lesson.media_url}
                  title={lesson.title}
                  type={lesson.type}
                  showOpenLink={false}
                />
              </div>
              {lesson.content && (
                <section className="space-y-3 border-t pt-5" aria-label="Conteúdo da aula">
                  <h2 className="text-xl font-semibold">Conteúdo da aula</h2>
                  <div className="whitespace-pre-wrap break-words leading-relaxed">
                    {lesson.content}
                  </div>
                </section>
              )}
              {route && (
                <Link
                  className="inline-flex border rounded-md px-4 py-2 text-primary"
                  to={route}
                >
                  Praticar agora:{" "}
                  {lesson.context_feature || "ir para esta área do sistema"}
                </Link>
              )}
              {enrollment && (
                <div className="flex flex-wrap gap-3">
                  <Button
                    disabled={busy || complete}
                    onClick={() =>
                      run(() =>
                        rpc("academy_record_lesson", {
                          p_enrollment: enrollment.id,
                          p_lesson: lesson.id,
                          p_complete: true,
                        }),
                      )
                    }
                  >
                    {complete ? "Aula concluída" : "Marcar aula como concluída"}
                  </Button>
                  {previousLesson && (
                    <Button variant="outline" onClick={() => navigate(`/admin/academia/cursos/${course.id}/aulas/${previousLesson.id}`)}>
                      ← Aula anterior
                    </Button>
                  )}
                  {nextLesson && (
                    <Button variant="outline" onClick={() => navigate(`/admin/academia/cursos/${course.id}/aulas/${nextLesson.id}`)}>
                      Próxima aula →
                    </Button>
                  )}
                </div>
              )}
            </Card>
          ) : courseTab === "overview" ? (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
              <Card>
                <div className="space-y-5">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-primary">Visão geral</p>
                    <h2 className="mt-1 text-2xl font-semibold">Sobre o curso</h2>
                    <p className="mt-3 whitespace-pre-wrap leading-relaxed text-muted-foreground">
                      {course.description || "Descrição ainda não informada."}
                    </p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-xl border bg-muted/30 p-4">
                      <h3 className="font-semibold">Objetivos</h3>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{course.objectives || "Não informados."}</p>
                    </div>
                    <div className="rounded-xl border bg-muted/30 p-4">
                      <h3 className="font-semibold">Para quem é</h3>
                      <p className="mt-2 text-sm text-muted-foreground">{course.audience || "Equipe RKC"}</p>
                      <p className="mt-2 text-xs text-muted-foreground">Pré-requisitos: {course.prerequisites || "nenhum informado"}</p>
                    </div>
                  </div>
                  {course.competencies.length > 0 && (
                    <div>
                      <h3 className="font-semibold">Competências desenvolvidas</h3>
                      <div className="mt-3 flex flex-wrap gap-2">{course.competencies.map((item) => <Badge key={item}>{item}</Badge>)}</div>
                    </div>
                  )}
                </div>
              </Card>
              <div className="space-y-4">
                <Card>
                  <p className="text-sm font-semibold">Seu percurso</p>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-muted/50 p-3"><strong className="block text-2xl">{completedLessons}/{lessons.length}</strong><span className="text-xs text-muted-foreground">aulas concluídas</span></div>
                    <div className="rounded-xl bg-muted/50 p-3"><strong className="block text-2xl">{remainingMinutes}</strong><span className="text-xs text-muted-foreground">min restantes</span></div>
                    <div className="rounded-xl bg-muted/50 p-3"><strong className="block text-2xl">{modules.length}</strong><span className="text-xs text-muted-foreground">módulos</span></div>
                    <div className="rounded-xl bg-muted/50 p-3"><strong className="block text-2xl">{courseMaterials.length}</strong><span className="text-xs text-muted-foreground">materiais</span></div>
                  </div>
                  {enrollment && <div className="mt-4"><Meter value={report?.progress || 0} /></div>}
                </Card>
                {resume && enrollment && (
                  <Card>
                    <p className="text-xs font-semibold uppercase tracking-wider text-primary">Próximo passo</p>
                    <h3 className="mt-2 font-semibold">{resume.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{resume.duration_minutes} min · {completedLessonIds.has(resume.id) ? "revisar conteúdo" : "continuar formação"}</p>
                    <Button className="mt-4 w-full" onClick={() => navigate(`/admin/academia/cursos/${course.id}/aulas/${resume.id}`)}>Continuar estudando</Button>
                  </Card>
                )}
              </div>
            </div>
          ) : null}
          {(lesson || courseTab === "materials") && <Card>
            <h2 className="font-semibold">Materiais complementares</h2>
            {data.materials
              .filter(
                (m) =>
                  m.course_id === course.id &&
                  (!m.lesson_id || m.lesson_id === lesson?.id),
              )
              .map((m) => (
                <Asset
                  key={m.id}
                  path={m.storage_path}
                  driveFileId={m.drive_file_id}
                  url={m.url}
                  title={m.title}
                />
              ))}
            {!data.materials.some(
              (m) =>
                m.course_id === course.id &&
                (!m.lesson_id || m.lesson_id === lesson?.id),
            ) && (
              <p className="text-muted-foreground">
                Nenhum material disponível.
              </p>
            )}
          </Card>}
          {(lesson || courseTab === "activities") && activities.map((a) => (
            <Card key={a.id}>
              <Badge>
                {labels[a.kind]}
                {a.required ? " obrigatória" : " opcional"}
              </Badge>
              <h2 className="text-xl font-semibold">{a.title}</h2>
              <p className="whitespace-pre-wrap">{a.instructions}</p>
              <p className="text-sm text-muted-foreground">
                Aprovação: {a.passing_score}% · Máximo de {a.max_attempts}{" "}
                tentativas
              </p>
              {enrollment ? (
                <Quiz
                  key={`${a.id}-${data.attempts.filter((t) => t.activity_id === a.id && t.enrollment_id === enrollment.id).length}`}
                  activity={a}
                  questions={data.questions
                    .filter((q) => q.activity_id === a.id)
                    .sort((x, y) => x.position - y.position)}
                  enrollmentId={enrollment.id}
                  data={data}
                  reload={reload}
                />
              ) : (
                <p>Matricule-se para realizar a atividade.</p>
              )}
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
function Quiz({
  activity,
  questions,
  enrollmentId,
  data,
  reload,
}: {
  activity: Activity;
  questions: Question[];
  enrollmentId: string;
  data: AcademyData;
  reload: () => Promise<void>;
}) {
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [times, setTimes] = useState<Record<string, number>>({});
  const [since, setSince] = useState(Date.now());
  const [elapsed, setElapsed] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const q = questions[index];
  const attempts = data.attempts
    .filter(
      (t) => t.activity_id === activity.id && t.enrollment_id === enrollmentId,
    )
    .sort((a, b) => b.attempt_number - a.attempt_number);
  useEffect(() => {
    if (!started) return;
    const timer = window.setInterval(
      () => setElapsed(Math.floor((Date.now() - since) / 1000)),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [since, started]);
  const recordTime = () => ({
    ...times,
    [q.id]: (times[q.id] || 0) + Math.floor((Date.now() - since) / 1000),
  });
  async function submit() {
    setBusy(true);
    setError("");
    try {
      const allTimes = recordTime();
      await rpc("academy_submit", {
        p_enrollment: enrollmentId,
        p_activity: activity.id,
        p_answers: questions.map((x) => ({
          question_id: x.id,
          answer: answers[x.id],
          elapsed_seconds: allTimes[x.id] || 0,
        })),
      });
      await reload();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-4">
      {attempts.map((t) => (
        <div key={t.id} className="rounded-md border p-3 space-y-2">
          <p>
            Tentativa {t.attempt_number}: <strong>{labels[t.status]}</strong>
            {t.score != null && ` · ${t.score}%`} ·{" "}
            {new Date(t.submitted_at).toLocaleString("pt-BR")}
          </p>
          {data.answers
            .filter((a) => a.attempt_id === t.id && a.feedback)
            .map((a) => (
              <p key={a.id} className="text-sm">
                {a.feedback}
              </p>
            ))}
        </div>
      ))}
      {attempts.some((t) => t.status === "passed") ? (
        <p className="text-primary font-medium">Atividade concluída.</p>
      ) : attempts.length >= activity.max_attempts ? (
        <p>Limite de tentativas atingido. Converse com o instrutor.</p>
      ) : !questions.length ? (
        <Empty>Esta atividade ainda não possui questões.</Empty>
      ) : !started ? (
        <Button
          variant="outline"
          onClick={() => {
            setStarted(true);
            setSince(Date.now());
          }}
        >
          Iniciar {labels[activity.kind].toLowerCase()}
        </Button>
      ) : (
        <fieldset className="space-y-4">
          <legend className="font-medium">
            Questão {index + 1} de {questions.length} · {q.points} ponto(s)
          </legend>
          <p className="whitespace-pre-wrap">{q.prompt}</p>
          <p className="text-xs text-muted-foreground">
            Tempo nesta questão: {elapsed + (times[q.id] || 0)} s
            {q.time_limit_seconds &&
              ` · recomendado: ${q.time_limit_seconds} s`}
          </p>
          {["choice", "boolean"].includes(q.type) ? (
            <div className="space-y-2">
              {(q.type === "boolean" ? ["verdadeiro", "falso"] : q.options).map(
                (o, i) => (
                  <label
                    key={i}
                    className="flex items-center gap-3 border rounded-md p-3 cursor-pointer"
                  >
                    <input
                      type="radio"
                      name={`question-${q.id}`}
                      value={o}
                      checked={answers[q.id] === o}
                      onChange={() => setAnswers({ ...answers, [q.id]: o })}
                    />
                    {o}
                  </label>
                ),
              )}
            </div>
          ) : (
            <>
              <label htmlFor={`answer-${q.id}`} className="text-sm">
                Sua resposta
              </label>
              <Textarea
                id={`answer-${q.id}`}
                maxLength={10000}
                value={answers[q.id] || ""}
                onChange={(e) =>
                  setAnswers({ ...answers, [q.id]: e.target.value })
                }
              />
              {["essay", "practical"].includes(q.type) && (
                <p className="text-sm text-muted-foreground">
                  Esta resposta será avaliada pelo instrutor.
                </p>
              )}
            </>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={busy || index === 0}
              onClick={() => {
                setTimes(recordTime());
                setIndex(index - 1);
                setSince(Date.now());
                setElapsed(0);
              }}
            >
              Anterior
            </Button>
            {index < questions.length - 1 ? (
              <Button
                disabled={!answers[q.id]?.trim()}
                onClick={() => {
                  setTimes(recordTime());
                  setIndex(index + 1);
                  setSince(Date.now());
                  setElapsed(0);
                }}
              >
                Próxima questão
              </Button>
            ) : (
              <Button
                disabled={busy || questions.some((x) => !answers[x.id]?.trim())}
                onClick={submit}
              >
                {busy ? "Enviando…" : "Enviar respostas"}
              </Button>
            )}
          </div>
        </fieldset>
      )}
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
