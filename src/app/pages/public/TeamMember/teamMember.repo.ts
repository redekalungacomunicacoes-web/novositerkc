import { supabase } from "@/lib/supabase";

export type TeamMemberPublic = {
  id: string;
  nome: string;
  cargo: string | null;
  bio: string | null;
  curriculo_md: string | null;
  foto_url: string | null;
  slug: string;
  instagram: string | null;
  whatsapp: string | null;
  facebook_url: string | null;
  linkedin_url: string | null;
  website_url: string | null;
};

export type TeamMemberPortfolioItem = {
  id: string;
  member_id: string;
  kind: "image" | "video";
  title: string | null;
  description: string | null;
  file_url: string;
  thumb_url: string | null;
  order_index: number;
  is_public: boolean;
};

export type TeamMemberPost = {
  id: string;
  slug: string | null;
  titulo: string;
  capa_url: string | null;
  published_at: string | null;
  created_at: string;
};

export async function getMemberBySlug(slug: string) {
  return supabase
    .from("equipe")
    .select(
      "id, nome, cargo, bio, curriculo_md, foto_url, slug, instagram, whatsapp, facebook_url, linkedin_url, website_url"
    )
    .eq("slug", slug)
    .eq("ativo", true)
    .eq("is_public", true)
    .maybeSingle<TeamMemberPublic>();
}

export async function getMemberPortfolio(memberId: string) {
  return supabase
    .from("team_member_portfolio")
    .select("id, member_id, kind, title, description, file_url, thumb_url, order_index, is_public")
    .eq("member_id", memberId)
    .eq("is_public", true)
    .order("order_index", { ascending: true })
    .returns<TeamMemberPortfolioItem[]>();
}

export async function getMemberPosts(memberId: string) {
  return supabase
    .from("team_member_posts")
    .select(
      "materias!inner(id, slug, titulo, capa_url, published_at, created_at, status)"
    )
    .eq("member_id", memberId)
    .eq("materias.status", "published");
}
