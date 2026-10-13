import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { getSiteSettings } from "@/lib/siteSettings";
import { supabase } from "@/lib/supabase";
import { driveMediaUrl, driveSlug } from "@/lib/teamAvatar";

const SITE_URL = "https://kalungacomunicacoes.org";
const SITE_NAME = "Rede Kalunga Comunicações";

const routeDefaults: Record<string, { title: string; description: string }> = {
  "/materias": {
    title: "Matérias | Rede Kalunga Comunicações",
    description: "Jornalismo independente que nasce do Território Quilombola Kalunga e da Chapada dos Veadeiros.",
  },
  "/quem-somos": {
    title: "Quem Somos | Rede Kalunga Comunicações",
    description: "Conheça a Rede Kalunga Comunicações, iniciativa quilombola de jornalismo e comunicação no Território Kalunga.",
  },
  "/projetos": {
    title: "Projetos | Rede Kalunga Comunicações",
    description: "Conheça os projetos de comunicação, memória, cultura e formação da Rede Kalunga Comunicações.",
  },
  "/contato": {
    title: "Contato | Rede Kalunga Comunicações",
    description: "Fale com a Rede Kalunga Comunicações. Jornalismo, parcerias e comunicação a partir do Território Kalunga.",
  },
  "/newsletter": {
    title: "Newsletter | Rede Kalunga Comunicações",
    description: "Receba notícias e histórias do Território Quilombola Kalunga, da Chapada dos Veadeiros e do Cerrado.",
  },
};

function upsertMeta(selector: string, attributes: Record<string, string>) {
  let tag = document.head.querySelector<HTMLMetaElement>(selector);
  if (!tag) {
    tag = document.createElement("meta");
    document.head.appendChild(tag);
  }
  Object.entries(attributes).forEach(([key, value]) => tag!.setAttribute(key, value));
}

function upsertCanonical(url: string) {
  let tag = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!tag) {
    tag = document.createElement("link");
    tag.rel = "canonical";
    document.head.appendChild(tag);
  }
  tag.href = url;
}

export function SiteSeo() {
  const { pathname } = useLocation();
  useEffect(() => {
    // MateriaDetalhes owns article metadata; the global async settings request
    // must never replace an article's title, description, or canonical URL.
    if (/^\/materias\/[^/]+\/?$/.test(pathname)) return;

    let active = true;
    const normalizedPath = pathname === "/" ? "/" : pathname.replace(/\/+$/, "");
    const isHome = normalizedPath === "/";
    const page = routeDefaults[normalizedPath];
    const projectSlug = normalizedPath.match(/^\/projetos\/([^/]+)$/)?.[1];
    const teamSlug = normalizedPath.match(/^\/equipe\/([^/]+)$/)?.[1];
    const teamId = normalizedPath.match(/^\/equipe\/id\/([^/]+)$/)?.[1];
    const fallbackTitle = isHome ? "Rede Kalunga Comunicações | Jornalismo quilombola" : page?.title || SITE_NAME;
    const fallbackDescription = page?.description ||
      "Jornalismo independente produzido no Território Quilombola Kalunga, na Chapada dos Veadeiros. Cultura, direitos, meio ambiente e vida no Cerrado.";

    (async () => {
      try {
        const [settings, projectResult, teamResult] = await Promise.all([
          getSiteSettings(),
          projectSlug
            ? supabase.from("projetos").select("slug,titulo,resumo,descricao,capa_url,cover_card_path").eq("slug", decodeURIComponent(projectSlug)).eq("publicado_transparencia", true).maybeSingle()
            : Promise.resolve({ data: null }),
          teamSlug || teamId
            ? supabase.from("equipe").select("id,slug,nome,cargo,bio,foto_url,avatar_thumb_drive:drive_files!equipe_avatar_thumb_drive_file_id_fkey(public_slug),avatar_drive:drive_files!equipe_avatar_drive_file_id_fkey(public_slug)").eq("ativo", true).eq("is_public", true).eq(teamId ? "id" : "slug", decodeURIComponent(teamId || teamSlug || "")).maybeSingle()
            : Promise.resolve({ data: null }),
        ]);
        if (!active) return;

        const project = projectResult.data;
        const teamMember = teamResult.data;
        const projectTitle = project?.titulo ? `${project.titulo} | ${SITE_NAME}` : "";
        const teamTitle = teamMember?.nome ? `${teamMember.nome} | ${SITE_NAME}` : "";
        const title = projectTitle || teamTitle || (isHome ? settings.seo_title?.trim() : "") || fallbackTitle;
        const description = project
          ? project.resumo?.trim() || project.descricao?.trim() || fallbackDescription
          : teamMember
            ? teamMember.bio?.replace(/[#*_`~]/g, "").replace(/\s+/g, " ").trim() || `${teamMember.cargo || "Integrante"} da ${SITE_NAME}, comunicação quilombola no Território Kalunga.`
            : (isHome ? settings.seo_description?.trim() : "") || fallbackDescription;
        const ogTitle = (isHome ? settings.seo_og_title?.trim() : "") || title;
        const ogDescription = (isHome ? settings.seo_og_description?.trim() : "") || description;
        const teamDrive = driveSlug(teamMember?.avatar_thumb_drive) || driveSlug(teamMember?.avatar_drive);
        const rawProjectImage = project?.cover_card_path || project?.capa_url || "";
        const projectImage = /^https?:\/\//i.test(rawProjectImage)
          ? rawProjectImage
          : rawProjectImage
            ? `${String(import.meta.env.VITE_SUPABASE_URL || "").replace(/\/$/, "")}/storage/v1/object/public/projetos/${rawProjectImage.split("/").map(encodeURIComponent).join("/")}`
            : "";
        const routeImage = teamDrive ? driveMediaUrl(teamDrive) : teamMember?.foto_url || projectImage;
        const image = routeImage || (isHome ? settings.seo_og_image?.trim() : "");
        const canonicalPath = teamMember?.slug ? `/equipe/${encodeURIComponent(teamMember.slug)}` : normalizedPath;
        const canonical = `${SITE_URL}${canonicalPath === "/" ? "/" : canonicalPath}`;

        document.title = title;
        upsertMeta('meta[name="description"]', { name: "description", content: description });
        upsertMeta('meta[name="robots"]', {
          name: "robots",
          content: settings.seo_indexation === "noindex" ? "noindex" : "index, follow",
        });
        upsertMeta('meta[property="og:type"]', { property: "og:type", content: project ? "article" : teamMember ? "profile" : "website" });
        upsertMeta('meta[property="og:title"]', { property: "og:title", content: ogTitle });
        upsertMeta('meta[property="og:description"]', { property: "og:description", content: ogDescription });
        upsertMeta('meta[property="og:url"]', { property: "og:url", content: canonical });
        upsertMeta('meta[property="og:site_name"]', { property: "og:site_name", content: SITE_NAME });
        upsertMeta('meta[property="og:locale"]', { property: "og:locale", content: "pt_BR" });
        upsertMeta('meta[name="twitter:card"]', { name: "twitter:card", content: image ? "summary_large_image" : "summary" });
        upsertMeta('meta[name="twitter:title"]', { name: "twitter:title", content: ogTitle });
        upsertMeta('meta[name="twitter:description"]', { name: "twitter:description", content: ogDescription });
        if (image) {
          upsertMeta('meta[property="og:image"]', { property: "og:image", content: image });
          upsertMeta('meta[name="twitter:image"]', { name: "twitter:image", content: image });
        } else {
          document.head.querySelector('meta[property="og:image"]')?.remove();
          document.head.querySelector('meta[name="twitter:image"]')?.remove();
        }
        upsertCanonical(canonical);
      } catch {
        if (!active) return;
        document.title = fallbackTitle;
        upsertMeta('meta[name="description"]', { name: "description", content: fallbackDescription });
      }
    })();

    return () => {
      active = false;
    };
  }, [pathname]);

  return null;
}
