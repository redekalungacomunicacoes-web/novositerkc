import { supabase } from "@/lib/supabase";

export type TeamMemberPublic = {
  id: string;
  nome: string;
  cargo: string | null;
  bio: string | null;
  curriculo_md: string | null;
  foto_url: string | null;
  avatar_url?: string | null;
  avatar_path?: string | null;
  avatar_thumb_path?: string | null;
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
      "id, nome, cargo, bio, curriculo_md, foto_url, avatar_url, avatar_path, avatar_thumb_path, slug, instagram, whatsapp, facebook_url, linkedin_url, website_url"
    )
    .eq("slug", slug)
    .maybeSingle<TeamMemberPublic>();
}

export async function getMemberById(id: string) {
  return supabase
    .from("equipe")
    .select(
      "id, nome, cargo, bio, curriculo_md, foto_url, avatar_url, avatar_path, avatar_thumb_path, slug, instagram, whatsapp, facebook_url, linkedin_url, website_url"
    )
    .eq("id", id)
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
  const memberRes = await supabase
    .from("equipe")
    .select("id,nome")
    .eq("id", memberId)
    .maybeSingle<{ id: string; nome: string | null }>();

  const memberName = memberRes.data?.nome || null;

  const direct = await supabase
    .from("materias")
    .select("id, slug, titulo, capa_url, published_at, created_at, status")
    .eq("autor_equipe_id", memberId)
    .eq("status", "published")
    .order("created_at", { ascending: false });

  if (!direct.error && (direct.data || []).length > 0) {
    return {
      data: (direct.data || []) as TeamMemberPost[],
      error: null,
    };
  }

  if (memberName) {
    const byName = await supabase
      .from("materias")
      .select("id, slug, titulo, capa_url, published_at, created_at, status")
      .ilike("autor_nome", memberName)
      .eq("status", "published")
      .order("created_at", { ascending: false });

    if (!byName.error && (byName.data || []).length > 0) {
      return {
        data: (byName.data || []) as TeamMemberPost[],
        error: null,
      };
    }
  }

  return supabase
    .from("team_member_posts")
    .select(
      "materias!inner(id, slug, titulo, capa_url, published_at, created_at, status)"
    )
    .eq("member_id", memberId)
    .eq("materias.status", "published");
}
