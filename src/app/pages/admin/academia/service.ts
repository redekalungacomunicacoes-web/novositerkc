import { supabase } from "@/lib/supabase";
import { videoEmbed } from "./media";
import type { AcademyData } from "./types";

export const tables = {
  courses: "academy_courses",
  categories: "academy_categories",
  modules: "academy_modules",
  lessons: "academy_lessons",
  materials: "academy_materials",
  enrollments: "academy_enrollments",
  progress: "academy_progress",
  activities: "academy_activities",
  questions: "academy_questions",
  attempts: "academy_attempts",
  answers: "academy_answers",
  contributions: "academy_contributions",
  instructors: "academy_instructors",
  courseInstructors: "academy_course_instructors",
  settings: "academy_settings",
} as const;
export type Entity = keyof typeof tables;
export function message(error: unknown) {
  const msg =
    error instanceof Error
      ? error.message
      : String((error as { message?: string })?.message || error);
  if (
    /academy_/.test(msg) &&
    /schema cache|does not exist|Could not find/.test(msg)
  )
    return "A Academia ainda precisa ser ativada no banco. Aplique a migration 20261001180000_academia_rkc.sql no Supabase e tente novamente.";
  return msg;
}
function unwrap<T>(result: {
  data: T | null;
  error: { message: string } | null;
}): T {
  if (result.error) throw new Error(message(result.error));
  return result.data as T;
}
export async function loadAcademy(): Promise<AcademyData> {
  const entries = await Promise.all(
    Object.entries(tables).map(async ([key, table]) => {
      const rows = unwrap(await supabase.from(table).select("*")) || [];
      return [key, rows] as const;
    }),
  );
  const [members, reports, driveFiles] = await Promise.all([
    supabase.from("equipe").select("id,nome,user_id").order("nome"),
    supabase.rpc("academy_report"),
    supabase
      .from("drive_files")
      .select("*")
      .eq("module", "academy")
      .in("status", ["active", "archived"]),
  ]);
  return {
    ...Object.fromEntries(entries),
    members: unwrap(members) || [],
    driveFiles: unwrap(driveFiles) || [],
    reports: unwrap(reports) || [],
  } as AcademyData;
}
export async function saveEntity(
  entity: Entity,
  values: Record<string, unknown>,
) {
  if (
    entity === "lessons" &&
    values.media_source &&
    ["youtube", "vimeo"].includes(String(values.media_source))
  ) {
    if (
      !videoEmbed(String(values.media_source), String(values.media_url || ""))
    )
      throw new Error(
        "Informe um link HTTPS válido do provedor selecionado (YouTube ou Vimeo).",
      );
    values.media_drive_file_id = null;
    values.media_path = null;
  }

  const query =
    values.id !== undefined
      ? supabase.from(tables[entity]).update(values).eq("id", values.id)
      : supabase.from(tables[entity]).upsert(values);
  return unwrap(
    await query.select().single<{ id: string } & Record<string, unknown>>(),
  );
}
export async function deleteEntity(entity: Entity, id: string) {
  unwrap(await supabase.from(tables[entity]).delete().eq("id", id));
}
export async function rpc(name: string, args: Record<string, unknown>) {
  return unwrap(await supabase.rpc(name, args));
}
export async function signedAsset(path: string) {
  return unwrap(
    await supabase.storage.from("academy").createSignedUrl(path, 900),
  ).signedUrl;
}
export function safeLink(url: string | null | undefined) {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && !u.username && !u.password
      ? u.href
      : null;
  } catch {
    return null;
  }
}
export function safeContextRoute(route: string | null | undefined) {
  return route &&
    /^\/admin(?:\/|$)/.test(route) &&
    !/[\\?#]/.test(route) &&
    !route.includes("..")
    ? route
    : null;
}
export async function saveQuestion(
  values: Record<string, unknown>,
  answer: string,
) {
  return rpc("academy_save_question", { p_question: values, p_answer: answer });
}
export async function questionKey(id: string) {
  const row = unwrap(
    await supabase
      .from("academy_answer_keys")
      .select("answer")
      .eq("question_id", id)
      .maybeSingle<{ answer: string }>(),
  );
  return row?.answer || "";
}
export async function duplicateCourse(courseId: string) {
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) throw new Error("Entre novamente para duplicar o curso.");
  const source = unwrap(await supabase.from("academy_courses").select("*").eq("id", courseId).single());
  const [moduleResult, lessonResult, materialResult, activityResult, questionResult] = await Promise.all([
    supabase.from("academy_modules").select("*").eq("course_id", courseId).order("position"),
    supabase.from("academy_lessons").select("*").eq("course_id", courseId).order("position"),
    supabase.from("academy_materials").select("*").eq("course_id", courseId),
    supabase.from("academy_activities").select("*").eq("course_id", courseId),
    supabase.from("academy_questions").select("*,academy_activities!inner(course_id)").eq("academy_activities.course_id", courseId),
  ]);
  const modules = unwrap(moduleResult) || [];
  const lessons = unwrap(lessonResult) || [];
  const materials = unwrap(materialResult) || [];
  const activities = unwrap(activityResult) || [];
  const questions = unwrap(questionResult) || [];
  const omit = (row: Record<string, unknown>) => Object.fromEntries(
    Object.entries(row).filter(([key]) => !["id", "created_at", "updated_at", "published_at"].includes(key)),
  );
  const insert = async (table: string, row: Record<string, unknown>) =>
    unwrap(await supabase.from(table).insert(row).select("*").single());
  let created: Record<string, unknown> | null = null;
  let skippedDriveMedia = 0;
  let skippedDriveMaterials = 0;
  try {
    const title = "Cópia de " + source.title;
    created = await insert("academy_courses", {
      ...omit(source),
      title,
      slug: String(source.slug) + "-copia-" + crypto.randomUUID().slice(0, 8),
      status: "draft",
      published_at: null,
      created_by: auth.user.id,
      cover_path: null,
      cover_drive_file_id: null,
      position: Number(source.position || 0) + 1,
    });
    const moduleIds = new Map<string, string>();
    for (const row of modules) {
      const copy = await insert("academy_modules", {
        ...omit(row),
        course_id: created.id,
      });
      moduleIds.set(row.id, copy.id);
    }
    const lessonIds = new Map<string, string>();
    for (const row of lessons) {
      if (row.media_source === "drive" || row.media_drive_file_id) skippedDriveMedia++;
      const copy = await insert("academy_lessons", {
        ...omit(row),
        course_id: created.id,
        module_id: moduleIds.get(row.module_id),
        status: "draft",
        media_source: ["youtube", "vimeo"].includes(row.media_source) ? row.media_source : "none",
        media_url: ["youtube", "vimeo"].includes(row.media_source) ? row.media_url : null,
        media_drive_file_id: null,
        media_path: null,
      });
      lessonIds.set(row.id, copy.id);
    }
    for (const row of materials) {
      if (row.drive_file_id) {
        skippedDriveMaterials++;
        continue;
      }
      await insert("academy_materials", {
        ...omit(row),
        course_id: created.id,
        lesson_id: row.lesson_id ? lessonIds.get(row.lesson_id) : null,
      });
    }
    const activityIds = new Map<string, string>();
    for (const row of activities) {
      const copy = await insert("academy_activities", {
        ...omit(row),
        course_id: created.id,
        lesson_id: row.lesson_id ? lessonIds.get(row.lesson_id) : null,
        status: "draft",
      });
      activityIds.set(row.id, copy.id);
    }
    for (const row of questions) {
      const key = await questionKey(row.id);
      await saveQuestion({
        activity_id: activityIds.get(row.activity_id),
        prompt: row.prompt,
        type: row.type,
        options: row.options,
        points: row.points,
        position: row.position,
        time_limit_seconds: row.time_limit_seconds,
      }, key);
    }
    return { course: created, skippedDriveMedia, skippedDriveMaterials };
  } catch (error) {
    if (created?.id) {
      await supabase.from("academy_courses").delete().eq("id", created.id);
    }
    throw error;
  }
}
export function exportCsv(
  headers: string[],
  rows: (string | number | null)[][],
) {
  const cell = (v: string | number | null) => {
    let s = String(v ?? "");
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  const blob = new Blob(
    [
      "\uFEFF" +
        [headers, ...rows].map((r) => r.map(cell).join(";")).join("\r\n"),
    ],
    { type: "text/csv;charset=utf-8" },
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "academia-rkc-progresso.csv";
  a.click();
  URL.revokeObjectURL(url);
}
