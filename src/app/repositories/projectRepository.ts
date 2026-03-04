import { supabase } from "@/lib/supabase";

export const PROJECTS_BUCKET = "projetos";

export type ProjetoRecord = {
  id: string;
  slug: string | null;
  titulo: string | null;
  resumo: string | null;
  descricao: string | null;
  capa_url: string | null;
  cover_card_path: string | null;
  ano_lancamento: number | null;
  instagram_url: string | null;
  youtube_url: string | null;
  spotify_url: string | null;
  publicado_transparencia: boolean | null;
  sort_order?: number | null;
  updated_at?: string | null;
  created_at?: string | null;
  published_at?: string | null;
};

export type ProjetoGaleriaRecord = {
  id: string;
  projeto_id: string;
  tipo: string;
  url: string;
};

export function resolveProjectMediaUrl(rawValue: string | null | undefined): string {
  const raw = (rawValue || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  return supabase.storage.from(PROJECTS_BUCKET).getPublicUrl(raw).data.publicUrl;
}

export async function listProjetosAdmin() {
  return supabase.from("projetos").select("*").order("created_at", { ascending: false });
}

export async function getProjetoById(id: string) {
  return supabase.from("projetos").select("*").eq("id", id).maybeSingle();
}

export async function getProjetoGaleria(projetoId: string, tipo?: "image" | "video") {
  let query = supabase.from("projeto_galeria").select("id, projeto_id, tipo, url").eq("projeto_id", projetoId);
  if (tipo) query = query.eq("tipo", tipo);
  return query.order("id", { ascending: false });
}

export async function createProjeto(payload: Partial<ProjetoRecord>) {
  return supabase.from("projetos").insert(payload).select("*").single();
}

export async function updateProjeto(id: string, payload: Partial<ProjetoRecord>) {
  return supabase.from("projetos").update(payload).eq("id", id).select("*").single();
}

export async function deleteProjeto(id: string) {
  return supabase.from("projetos").delete().eq("id", id);
}

export async function createProjetoMidia(payload: ProjetoGaleriaRecord) {
  return supabase.from("projeto_galeria").insert(payload);
}

export async function deleteProjetoMidia(id: string) {
  return supabase.from("projeto_galeria").delete().eq("id", id);
}

export async function findProjetoPublicBySlugOrId(paramValue: string) {
  const PUBLIC_FILTER = "publicado_transparencia.eq.true";
  const columns = "id, slug, titulo, resumo, descricao, capa_url, cover_card_path, ano_lancamento, instagram_url, youtube_url, spotify_url, publicado_transparencia";

  const bySlug = await supabase.from("projetos").select(columns).eq("slug", paramValue).or(PUBLIC_FILTER).limit(1);
  if (!bySlug.error && bySlug.data?.length) return bySlug.data[0] as ProjetoRecord;

  const byId = await supabase.from("projetos").select(columns).eq("id", paramValue).or(PUBLIC_FILTER).limit(1);
  if (!byId.error && byId.data?.length) return byId.data[0] as ProjetoRecord;

  return null;
}
