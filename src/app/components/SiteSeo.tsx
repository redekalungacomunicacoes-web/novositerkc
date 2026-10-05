import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { getSiteSettings } from "@/lib/siteSettings";
import { supabase } from "@/lib/supabase";

function upsertMeta(selector: string, attributes: Record<string, string>) {
  let tag = document.head.querySelector<HTMLMetaElement>(selector);
  if (!tag) {
    tag = document.createElement("meta");
    document.head.appendChild(tag);
  }

  Object.entries(attributes).forEach(([key, value]) => {
    tag!.setAttribute(key, value);
  });
}

export function SiteSeo() {
  const { pathname } = useLocation();
  useEffect(() => {
    let active = true;

    const fallbackTitle = "Rede Kalunga Comunicações";
    const fallbackDescription =
      document.head.querySelector<HTMLMetaElement>('meta[name="description"]')?.content?.trim() || "";

    (async () => {
      try {
        const settings = await getSiteSettings();
        if (!active) return;

        const pilotSlug = "folia-de-sao-joao-batista-fortalece-a-fe-e-preserva-a-tradicao-no-quilombo-capela";
        const isPilot = pathname.replace(/\/$/, "") === `/materias/${pilotSlug}`;
        const article = isPilot ? (await supabase.from("materias")
          .select("titulo,resumo,capa_url,published_at")
          .eq("slug", pilotSlug).eq("status", "published").maybeSingle()).data : null;
        if (!active) return;
        const title = article?.titulo ? `${article.titulo} | RKC` : settings.seo_title?.trim() || fallbackTitle;
        const description = article?.resumo || settings.seo_description?.trim() || fallbackDescription;
        const ogTitle = article?.titulo || settings.seo_og_title?.trim() || title;
        const ogDescription = article?.resumo || settings.seo_og_description?.trim() || description;

        document.title = title;
        if (description) upsertMeta('meta[name="description"]', { name: "description", content: description });
        if (settings.seo_keywords?.trim()) upsertMeta('meta[name="keywords"]', { name: "keywords", content: settings.seo_keywords.trim() });
        upsertMeta('meta[property="og:title"]', { property: "og:title", content: ogTitle });
        if (ogDescription) upsertMeta('meta[property="og:description"]', { property: "og:description", content: ogDescription });
        const image = article?.capa_url || settings.seo_og_image?.trim();
        if (image) upsertMeta('meta[property="og:image"]', { property: "og:image", content: image });
        else document.head.querySelector('meta[property="og:image"]')?.remove();
        upsertMeta('meta[property="og:type"]', { property: "og:type", content: article ? "article" : "website" });
        const canonical = `https://kalungacomunicacoes.org${article ? `/materias/${pilotSlug}/` : pathname}`;
        upsertMeta('meta[property="og:url"]', { property: "og:url", content: canonical });
        let canonicalTag = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
        if (!canonicalTag) { canonicalTag = document.createElement("link"); canonicalTag.rel = "canonical"; document.head.appendChild(canonicalTag); }
        canonicalTag.href = canonical;
        upsertMeta('meta[name="robots"]', { name: "robots", content: settings.seo_indexation === "noindex" ? "noindex" : "index" });
      } catch {
        if (!active) return;
        document.title = fallbackTitle;
        if (fallbackDescription) {
          upsertMeta('meta[name="description"]', { name: "description", content: fallbackDescription });
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [pathname]);

  return null;
}
