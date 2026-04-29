import { useEffect } from "react";
import { getSiteSettings } from "@/lib/siteSettings";

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
  useEffect(() => {
    let active = true;

    const fallbackTitle = document.title || "Institucional e Editorial Website";
    const fallbackDescription =
      document.head.querySelector<HTMLMetaElement>('meta[name="description"]')?.content?.trim() || "";

    (async () => {
      try {
        const settings = await getSiteSettings();
        if (!active) return;

        const title = settings.seo_title?.trim() || fallbackTitle;
        const description = settings.seo_description?.trim() || fallbackDescription;
        const ogTitle = settings.seo_og_title?.trim() || title;
        const ogDescription = settings.seo_og_description?.trim() || description;

        document.title = title;
        if (description) upsertMeta('meta[name="description"]', { name: "description", content: description });
        if (settings.seo_keywords?.trim()) upsertMeta('meta[name="keywords"]', { name: "keywords", content: settings.seo_keywords.trim() });
        upsertMeta('meta[property="og:title"]', { property: "og:title", content: ogTitle });
        if (ogDescription) upsertMeta('meta[property="og:description"]', { property: "og:description", content: ogDescription });
        if (settings.seo_og_image?.trim()) upsertMeta('meta[property="og:image"]', { property: "og:image", content: settings.seo_og_image.trim() });
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
  }, []);

  return null;
}
