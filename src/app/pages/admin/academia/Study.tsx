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
  return (
    <div className="space-y-6">
      <Link to="/admin/academia" className="text-primary underline">
        ← Minha Academia
      </Link>
      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <Badge>Formação interna</Badge>
          <Badge>{labels[course.level]}</Badge>
          {course.required && <Badge>Curso obrigatório</Badge>}
        </div>
        <h1 className="text-3xl font-bold break-words">{course.title}</h1>
        <p>{course.summary}</p>
        {(course.cover_path || course.cover_drive_file_id) && (
          <div className="overflow-hidden rounded-xl bg-muted aspect-[3/1] max-h-64">
            <Asset
              path={course.cover_path}
              driveFileId={course.cover_drive_file_id}
              title={`Capa de ${course.title}`}
              type="image"
              variant="banner"
            />
          </div>
        )}
        <p className="text-sm text-muted-foreground">
          Carga horária: {course.hours} h · {lessons.length} aulas publicadas
        </p>
        {instructors.length > 0 && (
          <p>
            Instrutores:{" "}
            {instructors
              .map(
                (i) =>
                  i!.external_name ||
                  data.members.find((m) => m.id === i!.member_id)?.nome ||
                  "Integrante",
              )
              .join(", ")}
          </p>
        )}
        {enrollment ? (
          <>
            <Meter value={report?.progress || 0} />
            {report?.completed_at && (
              <p className="text-primary font-medium">
                Curso concluído em{" "}
                {new Date(report.completed_at).toLocaleDateString("pt-BR")}.
                Competências:{" "}
                {course.competencies.join(", ") || "Não informadas"}
              </p>
            )}
            {resume && !lesson && (
              <Button
                onClick={() =>
                  navigate(
                    `/admin/academia/cursos/${course.id}/aulas/${resume.id}`,
                  )
                }
              >
                Continuar estudando
              </Button>
            )}
          </>
        ) : course.status === "published" &&
          ["self", "automatic"].includes(course.enrollment_mode) ? (
          <Button
            disabled={busy}
            onClick={() =>
              run(() => rpc("academy_enroll", { p_course: course.id }))
            }
          >
            {busy ? "Matriculando…" : "Iniciar curso"}
          </Button>
        ) : (
          <p>
            Solicite sua matrícula ao administrador para registrar progresso.
          </p>
        )}
      </Card>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="space-y-4" aria-label="Módulos e aulas">
          {modules.map((m) => (
            <Card key={m.id}>
              <h2 className="font-semibold">{m.title}</h2>
              <p className="text-sm text-muted-foreground">{m.description}</p>
              <ol className="space-y-2">
                {lessons
                  .filter((l) => l.module_id === m.id)
                  .map((l) => (
                    <li key={l.id}>
                      <Link
                        aria-current={lesson?.id === l.id ? "page" : undefined}
                        className={`block rounded-md p-2 text-sm hover:bg-muted ${lesson?.id === l.id ? "bg-primary/10 text-primary font-semibold" : ""}`}
                        to={`/admin/academia/cursos/${course.id}/aulas/${l.id}`}
                      >
                        {data.progress.some(
                          (p) =>
                            p.enrollment_id === enrollment?.id &&
                            p.lesson_id === l.id &&
                            p.completed_at,
                        )
                          ? "✓ "
                          : ""}
                        {l.title}
                        {!l.required && " (opcional)"}
                      </Link>
                    </li>
                  ))}
              </ol>
            </Card>
          ))}
          {!lessons.length && (
            <Empty>Nenhuma aula publicada neste curso.</Empty>
          )}
        </aside>
        <div className="space-y-6">
          {lessonId && !lesson ? (
            <Empty>Aula indisponível.</Empty>
          ) : lesson ? (
            <Card>
              <h2 className="text-2xl font-bold">{lesson.title}</h2>
              <p className="text-muted-foreground">
                {lesson.description} · {lesson.duration_minutes} min
              </p>
              <div className="whitespace-pre-wrap break-words leading-relaxed">
                {lesson.content}
              </div>
              <Asset
                path={lesson.media_path}
                driveFileId={lesson.media_drive_file_id}
                source={lesson.media_source}
                url={lesson.media_url}
                title={lesson.title}
                type={lesson.type}
              />
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
                  {lessons[lessons.indexOf(lesson) + 1] && (
                    <Button
                      variant="outline"
                      onClick={() =>
                        navigate(
                          `/admin/academia/cursos/${course.id}/aulas/${lessons[lessons.indexOf(lesson) + 1].id}`,
                        )
                      }
                    >
                      Próxima aula
                    </Button>
                  )}
                </div>
              )}
            </Card>
          ) : (
            <Card>
              <h2 className="text-xl font-semibold">Sobre o curso</h2>
              <p className="whitespace-pre-wrap">
                {course.description || "Descrição ainda não informada."}
              </p>
              <h3 className="font-semibold">Objetivos</h3>
              <p className="whitespace-pre-wrap">
                {course.objectives || "Não informados."}
              </p>
              <h3 className="font-semibold">Público-alvo e pré-requisitos</h3>
              <p>
                {course.audience || "Equipe RKC"} ·{" "}
                {course.prerequisites || "Nenhum pré-requisito informado"}
              </p>
            </Card>
          )}
          <Card>
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
          </Card>
          {activities.map((a) => (
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
