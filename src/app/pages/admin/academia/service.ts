import { supabase } from "@/lib/supabase";
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
  const [members, reports] = await Promise.all([
    supabase.from("equipe").select("id,nome,user_id").order("nome"),
    supabase.rpc("academy_report"),
  ]);
  return {
    ...Object.fromEntries(entries),
    members: unwrap(members) || [],
    reports: unwrap(reports) || [],
  } as AcademyData;
}
export async function saveEntity(
  entity: Entity,
  values: Record<string, unknown>,
) {
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
export async function uploadAsset(courseId: string, file: File) {
  if (file.size > 50 * 1024 * 1024)
    throw new Error(
      "Arquivo acima de 50 MB. Use um link HTTPS para vídeos maiores.",
    );
  const filename = file.name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-");
  const path = `${courseId}/${crypto.randomUUID()}-${filename}`;
  unwrap(
    await supabase.storage
      .from("academy")
      .upload(path, file, { upsert: false, contentType: file.type }),
  );
  return path;
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
