import { useEffect } from "react";
import defaultFavicon from "@/assets/avatar-placeholder.svg";
import { buildPublicStorageUrl, getFaviconMimeType, getFooterSettings } from "@/lib/footerSettings";

function upsertFaviconLink(rel: "icon" | "shortcut icon", href: string, type?: string) {
  const selector = rel === "icon" ? 'link[rel="icon"]' : 'link[rel="shortcut icon"]';
  let link = document.head.querySelector<HTMLLinkElement>(selector);

  if (!link) {
    link = document.createElement("link");
    link.setAttribute("rel", rel);
    document.head.appendChild(link);
  }

  link.setAttribute("href", href);
  if (type) link.setAttribute("type", type);
  else link.removeAttribute("type");
}

export function SiteFavicon() {
  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const settings = await getFooterSettings();
        if (!active) return;

        const faviconUrl = settings.favicon_path ? buildPublicStorageUrl(settings.favicon_path) : defaultFavicon;
        const mimeType = getFaviconMimeType(settings.favicon_path ?? faviconUrl);

        upsertFaviconLink("icon", faviconUrl, mimeType);
        upsertFaviconLink("shortcut icon", faviconUrl, mimeType);
      } catch {
        if (!active) return;
        upsertFaviconLink("icon", defaultFavicon, "image/svg+xml");
        upsertFaviconLink("shortcut icon", defaultFavicon, "image/svg+xml");
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  return null;
}
