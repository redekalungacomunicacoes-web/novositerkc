import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { RKCButton } from "@/app/components/RKCButton";
import { RKCTag } from "@/app/components/RKCTag";
import { RKCCard, RKCCardImage, RKCCardContent } from "@/app/components/RKCCard";
import { ArrowLeft, Calendar, User, Share2, Facebook, Instagram, Mail, Eye } from "lucide-react";
import { MateriaContentBlock } from "@/lib/cms";
import { supabase } from "@/lib/supabase";
import { getPublicContentViewCount, trackPageView } from "@/lib/analytics";

type MateriaUI = {
  id: string;
  slug: string;
  titulo: string;
  resumo: string;
  imagem: string;
  autor: string;
  data: string;
  categoria: string;
  conteudo: string;
  contentBlocks: MateriaContentBlock[];
  hashtags: string[];
  audioUrl: string;
  autorPerfil: {
    id: string;
    slug: string | null;
    nome: string;
    cargo: string | null;
    bio: string | null;
    foto: string | null;
  } | null;
};

function getEquipeHref(author: MateriaUI["autorPerfil"]) {
  if (!author) return "";
  return author.slug ? `/equipe/${author.slug}` : `/equipe/id/${author.id}`;
}

function getTeamAvatarThumbUrl(path?: string | null) {
  if (!path) return null;
  return supabase.storage.from("team-avatars").getPublicUrl(path).data.publicUrl;
}

function formatDateBR(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

function sanitizeHtml(input: string) {
  if (!input) return "";
  return input
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/on\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/on\w+\s*=\s*'[^']*'/gi, "");
}

function normalizeBlocks(raw: any): MateriaContentBlock[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((block: any, idx: number) => {
      if (!block || typeof block !== "object" || !block.type) return null;
      if (block.type === "image") {
        if (!block.url) return null;
        return {
          id: block.id || `image-${idx}`,
          type: "image" as const,
          url: String(block.url),
          caption: block.caption ? String(block.caption) : "",
          credit: block.credit ? String(block.credit) : "",
        };
      }

      if (["paragraph", "heading", "quote", "highlight"].includes(block.type)) {
        return {
          id: block.id || `text-${idx}`,
          type: block.type,
          text: block.text ? String(block.text) : "",
          size: block.size === "sm" || block.size === "lg" ? block.size : "md",
          author: block.author ? String(block.author) : "",
        } as MateriaContentBlock;
      }

      return null;
    })
    .filter(Boolean) as MateriaContentBlock[];
}

function textSizeClass(size?: string) {
  if (size === "sm") return "text-base";
  if (size === "lg") return "text-2xl";
  return "text-lg";
}

function renderBlock(block: MateriaContentBlock) {
  if (block.type === "image") {
    return (
      <figure key={block.id} className="my-8">
        <img src={block.url} alt={block.caption || "Imagem da matéria"} className="w-full rounded-xl border object-cover" />
        {(block.caption || block.credit) && (
          <figcaption className="text-sm text-gray-500 mt-2">
            {block.caption || ""}
            {block.caption && block.credit ? " • " : ""}
            {block.credit ? `Crédito: ${block.credit}` : ""}
          </figcaption>
        )}
      </figure>
    );
  }

  if (block.type === "heading") {
    return (
      <h2
        key={block.id}
        className={`font-bold text-[#0F7A3E] mt-10 mb-4 ${textSizeClass(block.size)}`}
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(block.text || "") }}
      />
    );
  }

  if (block.type === "quote") {
    return (
      <blockquote key={block.id} className="my-6 border-l-4 border-[#0F7A3E] pl-4 italic text-gray-700">
        <p className={textSizeClass(block.size)} dangerouslySetInnerHTML={{ __html: sanitizeHtml(block.text || "") }} />
        {block.author ? <cite className="block mt-2 text-sm not-italic text-gray-500">— {block.author}</cite> : null}
      </blockquote>
    );
  }

  if (block.type === "highlight") {
    return (
      <aside key={block.id} className="my-6 border-l-4 border-[#F2B705] bg-[#FDF8E5] text-[#5f4b00] pl-4 py-3 pr-3 rounded-r-lg ml-2">
        <p className={`${textSizeClass(block.size)} mb-0`} dangerouslySetInnerHTML={{ __html: sanitizeHtml(block.text || "") }} />
      </aside>
    );
  }

  return (
    <p
      key={block.id}
      className={`${textSizeClass(block.size)} text-gray-700 leading-relaxed mb-6`}
      dangerouslySetInnerHTML={{ __html: sanitizeHtml(block.text || "") }}
    />
  );
}

export function MateriaDetalhes() {
  const params = useParams();
  const paramValue = (params as any).slug || (params as any).id;

  const [loading, setLoading] = useState(true);
  const [materia, setMateria] = useState<MateriaUI | null>(null);
  const [outrasMateria, setOutrasMateria] = useState<Array<{ id: string; slug: string; titulo: string; imagem: string; categoria: string }>>([]);
  const [viewCount, setViewCount] = useState<number | null>(null);

  const fallbackMateria = useMemo<MateriaUI>(() => ({
    id: "",
    slug: "",
    titulo: "",
    resumo: "",
    imagem: "",
    autor: "",
    data: "",
    categoria: "",
    conteudo: "",
    contentBlocks: [],
    hashtags: [],
    audioUrl: "",
    autorPerfil: null,
  }), []);

  useEffect(() => {
    if (!paramValue) return;

    (async () => {
      setLoading(true);
      setViewCount(null);
      let found: any = null;

      const bySlug = await supabase
        .from("materias")
        .select("id, slug, titulo, resumo, capa_url, autor_nome, autor_id, autor_equipe_id, tags, conteudo, content_blocks, hashtags, audio_url, published_at, created_at, status")
        .eq("slug", paramValue)
        .eq("status", "published")
        .limit(1);

      if (!bySlug.error && bySlug.data && bySlug.data.length > 0) {
        found = bySlug.data[0];
      } else {
        const byId = await supabase
          .from("materias")
          .select("id, slug, titulo, resumo, capa_url, autor_nome, autor_id, autor_equipe_id, tags, conteudo, content_blocks, hashtags, audio_url, published_at, created_at, status")
          .eq("id", paramValue)
          .eq("status", "published")
          .limit(1);

        if (!byId.error && byId.data && byId.data.length > 0) {
          found = byId.data[0];
        }
      }

      if (!found) {
        setLoading(false);
        setMateria(null);
        setOutrasMateria([]);
        return;
      }

      const resolvedAuthorId = found.autor_equipe_id || found.autor_id;
      let authorProfile: MateriaUI["autorPerfil"] = null;

      if (resolvedAuthorId) {
        const detailedAuthor = await supabase
          .from("equipe")
          .select("id, nome, slug, cargo, bio, foto_url, avatar_url, avatar_thumb_path")
          .eq("id", resolvedAuthorId)
          .eq("is_public", true)
          .maybeSingle();

        const shouldFallbackAuthorLookup = !!detailedAuthor.error && /column .* does not exist/i.test(detailedAuthor.error.message || "");
        const fallbackAuthor = shouldFallbackAuthorLookup
          ? await supabase.from("equipe").select("id, nome, slug, cargo, bio, foto_url").eq("id", resolvedAuthorId).maybeSingle()
          : null;

        const authorData = detailedAuthor.data || fallbackAuthor?.data;

        if (authorData) {
          authorProfile = {
            id: authorData.id,
            slug: authorData.slug || null,
            nome: authorData.nome || found.autor_nome || "",
            cargo: authorData.cargo || null,
            bio: authorData.bio || null,
            foto: getTeamAvatarThumbUrl((authorData as any).avatar_thumb_path) || (authorData as any).avatar_url || authorData.foto_url || null,
          };
        }
      }

      const mapped: MateriaUI = {
        id: found.id,
        slug: found.slug,
        titulo: found.titulo || "",
        resumo: found.resumo || "",
        imagem: found.capa_url || "",
        autor: authorProfile?.nome || found.autor_nome || "",
        data: formatDateBR(found.published_at || found.created_at),
        categoria: (found.tags && found.tags[0]) ? found.tags[0] : "Geral",
        conteudo: found.conteudo || "",
        contentBlocks: normalizeBlocks(found.content_blocks),
        hashtags: Array.isArray(found.hashtags) ? found.hashtags.filter(Boolean) : [],
        audioUrl: found.audio_url || "",
        autorPerfil: authorProfile,
      };

      setMateria(mapped);

      await trackPageView({
        pageType: "materia",
        path: `/materias/${mapped.slug || mapped.id}`,
        contentId: mapped.id,
        contentSlug: mapped.slug,
      });

      const freshCount = await getPublicContentViewCount({ pageType: "materia", contentId: mapped.id, contentSlug: mapped.slug });
      setViewCount(freshCount);

      const { data: rel, error: relErr } = await supabase
        .from("materias")
        .select("id, slug, titulo, capa_url, tags, published_at, created_at, status")
        .eq("status", "published")
        .neq("id", found.id)
        .order("published_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(3);

      setOutrasMateria(
        !relErr
          ? (rel || []).map((m: any) => ({
              id: m.id,
              slug: m.slug,
              titulo: m.titulo || "",
              imagem: m.capa_url || "",
              categoria: (m.tags && m.tags[0]) ? m.tags[0] : "Geral",
            }))
          : []
      );

      setLoading(false);
    })();
  }, [paramValue]);

  const m = materia || fallbackMateria;
  const hasBlocks = m.contentBlocks.length > 0;

  return (
    <div>
      <section className="relative h-[70vh] flex items-end overflow-hidden">
        <div className="absolute inset-0">
          <img src={m.imagem} alt={m.titulo} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
        </div>

        <div className="relative z-10 w-full pb-16">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <Link to="/materias" className="inline-flex items-center gap-2 text-white/90 hover:text-white mb-6 transition-colors">
              <ArrowLeft className="w-4 h-4" />
              Voltar para Matérias
            </Link>

            <RKCTag variant="yellow" className="mb-4">{m.categoria}</RKCTag>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white mb-6 leading-tight max-w-3xl break-words">
              {m.titulo}
            </h1>
            <p className="text-xl text-white/90 mb-6 leading-relaxed max-w-2xl">{m.resumo}</p>
            <div className="flex items-center gap-6 text-white/80">
              <div className="flex items-center gap-2">
                <User className="w-5 h-5" />
                {m.autorPerfil ? <Link to={getEquipeHref(m.autorPerfil)} className="hover:underline font-medium">{m.autor}</Link> : <span>{m.autor}</span>}
              </div>
              <div className="flex items-center gap-2"><Calendar className="w-5 h-5" /><span>{m.data}</span></div>
              <div className="flex items-center gap-2"><Eye className="w-5 h-5" /><span>{viewCount ?? "—"} visualizações</span></div>
            </div>
          </div>
        </div>
      </section>

      <article className="py-16 md:py-24 bg-white">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          {loading && <div className="text-sm text-gray-500 mb-8">Carregando matéria...</div>}
          {!loading && !materia && <div className="text-sm text-gray-500 mb-8">Matéria não encontrada ou não publicada.</div>}

          {!!materia && (
            <>
              <div className="prose prose-lg max-w-none">
                {hasBlocks ? (
                  <div className="article-content">{m.contentBlocks.map((block) => renderBlock(block))}</div>
                ) : (
                  <div className="article-content text-gray-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: sanitizeHtml(m.conteudo) }} style={{ fontSize: "1.125rem", lineHeight: "1.8" }} />
                )}
              </div>

              {m.hashtags.length > 0 && (
                <div className="mt-10 pt-6 border-t border-gray-200">
                  <h3 className="font-semibold text-base text-[#2E2E2E] mb-3">Hashtags</h3>
                  <div className="flex flex-wrap gap-2">
                    {m.hashtags.map((tag) => (
                      <span key={tag} className="px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-700">{tag}</span>
                    ))}
                  </div>
                </div>
              )}

              {m.audioUrl && (
                <div className="mt-8 p-4 rounded-xl border bg-gray-50">
                  <h3 className="font-semibold text-base text-[#2E2E2E] mb-2">Ouça esta matéria</h3>
                  <audio controls preload="none" className="w-full">
                    <source src={m.audioUrl} />
                    Seu navegador não suporta áudio.
                  </audio>
                </div>
              )}

              <div className="mt-12 pt-8 border-t border-gray-200">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <h3 className="font-bold text-lg text-[#2E2E2E]">Compartilhe esta matéria</h3>
                  <div className="flex gap-3">
                    <button className="w-10 h-10 rounded-full bg-[#0F7A3E] hover:bg-[#0d6633] transition-colors flex items-center justify-center"><Facebook className="w-5 h-5 text-white" /></button>
                    <button className="w-10 h-10 rounded-full bg-[#0F7A3E] hover:bg-[#0d6633] transition-colors flex items-center justify-center"><Instagram className="w-5 h-5 text-white" /></button>
                    <button className="w-10 h-10 rounded-full bg-[#0F7A3E] hover:bg-[#0d6633] transition-colors flex items-center justify-center"><Mail className="w-5 h-5 text-white" /></button>
                    <button className="w-10 h-10 rounded-full bg-[#0F7A3E] hover:bg-[#0d6633] transition-colors flex items-center justify-center"><Share2 className="w-5 h-5 text-white" /></button>
                  </div>
                </div>
              </div>

              <div className="mt-12">
                <RKCCard className="bg-gradient-to-br from-[#0F7A3E]/5 to-[#2FA866]/5">
                  <RKCCardContent className="p-8">
                    {m.autorPerfil ? (
                      <Link to={getEquipeHref(m.autorPerfil)} className="flex items-start gap-4 group">
                        <div className="w-16 h-16 rounded-full overflow-hidden bg-gradient-to-br from-[#0F7A3E] to-[#2FA866] flex items-center justify-center flex-shrink-0">
                          {m.autorPerfil.foto ? <img src={m.autorPerfil.foto} alt={m.autorPerfil.nome} className="w-full h-full object-cover" /> : <User className="w-8 h-8 text-white" />}
                        </div>
                        <div>
                          <h4 className="font-bold text-lg text-[#2E2E2E] mb-1 group-hover:underline">{m.autorPerfil.nome}</h4>
                          {m.autorPerfil.cargo && <p className="text-sm text-gray-500 mb-1">{m.autorPerfil.cargo}</p>}
                          <p className="text-gray-600 leading-relaxed">{m.autorPerfil.bio || "Conheça mais sobre este integrante da Rede Kalunga Comunicações."}</p>
                        </div>
                      </Link>
                    ) : (
                      <div className="flex items-start gap-4">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#0F7A3E] to-[#2FA866] flex items-center justify-center flex-shrink-0"><User className="w-8 h-8 text-white" /></div>
                        <div><h4 className="font-bold text-lg text-[#2E2E2E] mb-2">{m.autor}</h4></div>
                      </div>
                    )}
                  </RKCCardContent>
                </RKCCard>
              </div>
            </>
          )}
        </div>
      </article>

      <section className="py-16 bg-gradient-to-br from-[#0F7A3E] to-[#2FA866]">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Gostou desta matéria?</h2>
          <p className="text-lg text-white/90 mb-8">Assine nossa newsletter e receba mais histórias do Território Kalunga</p>
          <Link to="/newsletter"><RKCButton variant="accent" size="lg">Assinar Newsletter</RKCButton></Link>
        </div>
      </section>

      <section className="py-16 md:py-24 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-[#2E2E2E] mb-8">Leia também</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {outrasMateria.map((outra) => (
              <Link key={outra.id} to={`/materias/${outra.slug}`}>
                <RKCCard className="h-full hover:scale-[1.02] transition-transform">
                  <RKCCardImage src={outra.imagem} alt={outra.titulo} />
                  <RKCCardContent>
                    <RKCTag variant="green" className="mb-3">{outra.categoria}</RKCTag>
                    <h3 className="font-bold text-lg text-[#2E2E2E]">{outra.titulo}</h3>
                  </RKCCardContent>
                </RKCCard>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <style>{`
        .article-content p:first-child::first-letter {
          font-size: 3.5rem;
          font-weight: 700;
          line-height: 1;
          float: left;
          margin-right: 0.5rem;
          margin-top: 0.1rem;
          color: #0F7A3E;
        }
      `}</style>
    </div>
  );
}
