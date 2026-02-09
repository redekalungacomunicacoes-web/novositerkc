import { supabase } from "./supabase";

export type MateriaRow = {
  id: string;
  created_at: string;
  updated_at: string;
  titulo: string;
  slug: string;
  resumo: string | null;
  conteudo: string | null;
  capa_url: string | null;
  autor_nome: string | null;
  tags: string[];
  status: "draft" | "published" | "archived";
  published_at: string | null;
};

export type ProjetoRow = {
  meta?: any;

  id: string;
  created_at: string;
  updated_at: string;
  titulo: string;
  slug: string;
  resumo: string | null;
  descricao: string | null;
  capa_url: string | null;
  publicado_transparencia: boolean;
  published_at: string | null;
};

export function slugify(input: string) {
  return (input || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

// ===== Materias =====
export async function listMaterias() {
  return supabase.from("materias").select("*").order("created_at", { ascending: false });
}

export async function getMateria(id: string) {
  return supabase.from("materias").select("*").eq("id", id).single();
}

export async function createMateria(payload: Partial<MateriaRow>) {
  return supabase.from("materias").insert(payload).select("*").single();
}

export async function updateMateria(id: string, payload: Partial<MateriaRow>) {
  return supabase.from("materias").update(payload).eq("id", id).select("*").single();
}

export async function deleteMateria(id: string) {
  return supabase.from("materias").delete().eq("id", id);
}

// ===== Projetos =====
export async function listProjetos() {
  return supabase.from("projetos").select("*").order("created_at", { ascending: false });
}

export async function getProjeto(id: string) {
  return supabase.from("projetos").select("*").eq("id", id).single();
}

export async function createProjeto(payload: Partial<ProjetoRow>) {
  return supabase.from("projetos").insert(payload).select("*").single();
}

export async function updateProjeto(id: string, payload: Partial<ProjetoRow>) {
  return supabase.from("projetos").update(payload).eq("id", id).select("*").single();
}

export async function deleteProjeto(id: string) {
  return supabase.from("projetos").delete().eq("id", id);
}
