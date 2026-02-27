import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ExternalLink, Instagram, Linkedin, Facebook, Globe, MessageCircle } from "lucide-react";
import {
  getMemberBySlug,
  getMemberPortfolio,
  getMemberPosts,
  TeamMemberPortfolioItem,
  TeamMemberPost,
  TeamMemberPublic,
} from "./teamMember.repo";

function markdownToHtml(md?: string | null) {
  const source = (md || "").trim();
  if (!source) return "";

  return source
    .replace(/^###\s+(.*)$/gm, "<h3>$1</h3>")
    .replace(/^##\s+(.*)$/gm, "<h2>$1</h2>")
    .replace(/^#\s+(.*)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/\n/g, "<br />");
}

function socialLinks(member: TeamMemberPublic) {
  const links = [] as Array<{ href: string; label: string; icon: any }>;
  const ig = (member.instagram || "").trim();
  if (ig) {
    const handle = ig.replace("@", "").replace("https://instagram.com/", "").replace("https://www.instagram.com/", "");
    links.push({ href: ig.includes("http") ? ig : `https://instagram.com/${handle}`, label: "Instagram", icon: Instagram });
  }
  if (member.whatsapp?.trim()) {
    const onlyDigits = member.whatsapp.replace(/\D/g, "");
    links.push({ href: `https://wa.me/${onlyDigits}`, label: "WhatsApp", icon: MessageCircle });
  }
  if (member.facebook_url?.trim()) links.push({ href: member.facebook_url, label: "Facebook", icon: Facebook });
  if (member.linkedin_url?.trim()) links.push({ href: member.linkedin_url, label: "LinkedIn", icon: Linkedin });
  if (member.website_url?.trim()) links.push({ href: member.website_url, label: "Website", icon: Globe });
  return links;
}

export function TeamMemberPublicPage() {
  const { slug } = useParams();
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"curriculo" | "materias" | "portfolio">("curriculo");
  const [member, setMember] = useState<TeamMemberPublic | null>(null);
  const [portfolio, setPortfolio] = useState<TeamMemberPortfolioItem[]>([]);
  const [posts, setPosts] = useState<TeamMemberPost[]>([]);
  const [preview, setPreview] = useState<TeamMemberPortfolioItem | null>(null);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      setLoading(true);
      const memberRes = await getMemberBySlug(slug);
      if (memberRes.error || !memberRes.data) {
        setMember(null);
        setPortfolio([]);
        setPosts([]);
        setLoading(false);
        return;
      }

      setMember(memberRes.data);
      const [portfolioRes, postsRes] = await Promise.all([
        getMemberPortfolio(memberRes.data.id),
        getMemberPosts(memberRes.data.id),
      ]);

      if (!portfolioRes.error) setPortfolio(portfolioRes.data || []);

      if (!postsRes.error) {
        const mapped = (postsRes.data || [])
          .map((row: any) => row.materias)
          .filter(Boolean)
          .map((m: any) => ({
            id: m.id,
            slug: m.slug,
            titulo: m.titulo,
            capa_url: m.capa_url,
            published_at: m.published_at,
            created_at: m.created_at,
          }));
        setPosts(mapped);
      }

      setLoading(false);
    })();
  }, [slug]);

  const links = useMemo(() => (member ? socialLinks(member) : []), [member]);

  if (loading) return <div className="max-w-5xl mx-auto px-4 py-16">Carregando perfil...</div>;
  if (!member) return <div className="max-w-5xl mx-auto px-4 py-16">Perfil não encontrado.</div>;

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-8">
      <header className="flex flex-col md:flex-row gap-6 items-start md:items-center border-b pb-8">
        <div className="w-32 h-32 rounded-full overflow-hidden bg-muted border">
          {member.foto_url ? <img src={member.foto_url} alt={member.nome} className="w-full h-full object-cover" /> : null}
        </div>
        <div className="flex-1 space-y-2">
          <h1 className="text-3xl font-bold">{member.nome}</h1>
          <p className="text-muted-foreground">{member.cargo || "Integrante"}</p>
          {member.bio && <p>{member.bio}</p>}
          <div className="flex flex-wrap gap-3 pt-2">
            {links.map((item) => {
              const Icon = item.icon;
              return (
                <a key={item.label} href={item.href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm hover:underline">
                  <Icon className="w-4 h-4" /> {item.label}
                </a>
              );
            })}
          </div>
        </div>
      </header>

      <div className="flex gap-2 border-b">
        {[
          ["curriculo", "Currículo"],
          ["materias", "Matérias"],
          ["portfolio", "Portfólio"],
        ].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id as any)} className={`px-4 py-2 text-sm ${tab === id ? "border-b-2 border-primary font-semibold" : "text-muted-foreground"}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === "curriculo" && (
        <section>
          {member.curriculo_md ? (
            <article className="prose max-w-none" dangerouslySetInnerHTML={{ __html: markdownToHtml(member.curriculo_md) }} />
          ) : (
            <p className="text-sm text-muted-foreground">Currículo ainda não informado.</p>
          )}
        </section>
      )}

      {tab === "materias" && (
        <section className="grid sm:grid-cols-2 gap-4">
          {posts.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma matéria vinculada.</p>}
          {posts.map((post) => (
            <Link to={`/materias/${post.slug || post.id}`} key={post.id} className="border rounded-lg overflow-hidden hover:shadow-sm transition">
              {post.capa_url && <img src={post.capa_url} alt={post.titulo} className="h-40 w-full object-cover" />}
              <div className="p-4">
                <h3 className="font-semibold">{post.titulo}</h3>
                <p className="text-xs text-muted-foreground">{new Date(post.published_at || post.created_at).toLocaleDateString("pt-BR")}</p>
              </div>
            </Link>
          ))}
        </section>
      )}

      {tab === "portfolio" && (
        <section className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {portfolio.length === 0 && <p className="text-sm text-muted-foreground">Portfólio vazio.</p>}
          {portfolio.map((item) => (
            <button key={item.id} onClick={() => setPreview(item)} className="text-left border rounded-lg overflow-hidden">
              {item.kind === "image" ? (
                <img src={item.thumb_url || item.file_url} alt={item.title || "Portfólio"} className="h-40 w-full object-cover" />
              ) : (
                <div className="h-40 w-full bg-black/80 text-white flex items-center justify-center gap-2 text-sm"><ExternalLink className="w-4 h-4" /> Vídeo</div>
              )}
              <div className="p-2 text-sm">{item.title || "Sem título"}</div>
            </button>
          ))}
        </section>
      )}

      {preview && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setPreview(null)}>
          <div className="bg-white max-w-3xl w-full rounded-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {preview.kind === "image" ? (
              <img src={preview.file_url} alt={preview.title || "Portfólio"} className="w-full max-h-[70vh] object-contain bg-black" />
            ) : (
              <video src={preview.file_url} controls className="w-full max-h-[70vh] bg-black" />
            )}
            <div className="p-4">
              <p className="font-semibold">{preview.title || "Item"}</p>
              {preview.description && <p className="text-sm text-muted-foreground">{preview.description}</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
