import { supabase } from "./supabase";
import { createProjeto as createProjetoRepo, deleteProjeto as deleteProjetoRepo, getProjetoById, listProjetosAdmin, updateProjeto as updateProjetoRepo } from "@/app/repositories/projectRepository";

export type MateriaRow = {
  id: string;
  created_at: string;
  updated_at: string;
  titulo: string;
  slug: string;
  resumo: string | null;
  conteudo: string | null;
  content_blocks?: MateriaContentBlock[] | null;
  hashtags?: string[] | null;
  audio_url?: string | null;
  photo_credits?: string | null;
  capa_url: string | null;
  banner_url?: string | null;
  autor_nome: string | null;
  tags: string[];
  status: "draft" | "published" | "archived";
  published_at: string | null;
};

export type MateriaTextBlockType = "paragraph" | "heading" | "quote" | "highlight";
export type MateriaTextSize = "sm" | "md" | "lg";

export type MateriaContentBlock =
  | {
      id: string;
      type: MateriaTextBlockType;
      text: string;
      size?: MateriaTextSize;
      author?: string;
    }
  | {
      id: string;
      type: "image";
      url: string;
      caption?: string;
      credit?: string;
    }
  | {
      id: string;
      type: "image-text";
      url: string;
      text: string;
      caption?: string;
      credit?: string;
      align?: "left" | "right";
      width?: "sm" | "md" | "lg";
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
  ano_lancamento: number | null;
  instagram_url: string | null;
  youtube_url: string | null;
  spotify_url: string | null;
  publicado_transparencia: boolean;
  published_at: string | null;
};

export type MateriaCategoriaRow = {
  id: string;
  nome: string;
  slug: string | null;
  created_at: string;
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

function dedupeAndSortCategoryNames(names: string[]) {
  return Array.from(new Set(names.map((name) => name.trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, "pt-BR", { sensitivity: "base" })
  );
}

async function ensureUniqueMateriaCategoriaSlug(baseSlug: string) {
  const root = baseSlug || `categoria-${Date.now()}`;
  let slug = root;
  let i = 1;

  while (true) {
    const { data, error } = await supabase
      .from("materia_categorias")
      .select("id")
      .eq("slug", slug)
      .limit(1);

    if (error) throw error;
    if (!data || data.length === 0) return slug;

    i += 1;
    slug = `${root}-${i}`;
  }
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

export async function listMateriaCategorias() {
  return supabase.from("materia_categorias").select("id, nome, slug, created_at").order("nome", { ascending: true });
}

export async function createMateriaCategoria(nome: string) {
  const nomeNormalizado = nome.trim();
  const slug = await ensureUniqueMateriaCategoriaSlug(slugify(nomeNormalizado));

  return supabase
    .from("materia_categorias")
    .insert({ nome: nomeNormalizado, slug })
    .select("id, nome, slug, created_at")
    .single();
}

export async function listMateriaCategoriasFromTags() {
  const { data, error } = await supabase.from("materias").select("tags");
  if (error) return { data: null, error };

  const names = dedupeAndSortCategoryNames(
    (data || [])
      .map((item: any) => (Array.isArray(item?.tags) ? item.tags[0] : ""))
      .filter(Boolean)
  );

  return { data: names, error: null };
}

export async function listMateriaCategoryNames() {
  const categoriasRes = await listMateriaCategorias();
  const tabelaNames = (categoriasRes.data || []).map((categoria) => categoria.nome);
  const tagsRes = await listMateriaCategoriasFromTags();
  const tagNames = tagsRes.data || [];

  return {
    data: dedupeAndSortCategoryNames([...tabelaNames, ...tagNames]),
    error: categoriasRes.error,
  };
}

// ===== Projetos =====
export async function listProjetos() {
  return listProjetosAdmin();
}

export async function getProjeto(id: string) {
  return getProjetoById(id);
}

export async function createProjeto(payload: Partial<ProjetoRow>) {
  return createProjetoRepo(payload);
}

export async function updateProjeto(id: string, payload: Partial<ProjetoRow>) {
  return updateProjetoRepo(id, payload);
}

export async function deleteProjeto(id: string) {
  return deleteProjetoRepo(id);
}
