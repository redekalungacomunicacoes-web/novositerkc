import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { ExternalLink, X } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Popup = {
  id: string;
  title: string;
  eyebrow: string | null;
  description: string | null;
  image_url: string | null;
  youtube_url: string | null;
  cta_label: string;
  cta_url: string | null;
};

const ARTICLE_POPUP_LABEL = "Última matéria publicada";

function youtubeId(url?: string | null) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtu.be")) return parsed.pathname.slice(1);
    if (parsed.hostname.includes("youtube.com")) return parsed.searchParams.get("v");
  } catch {
    // Ignore malformed URLs.
  }
  return null;
}

function popupStorageKey(popup: Popup) {
  return `rkc-popup-${popup.id}`;
}

function wasDismissed(popup: Popup) {
  try {
    const storage = popup.eyebrow === ARTICLE_POPUP_LABEL ? window.localStorage : window.sessionStorage;
    return storage.getItem(popupStorageKey(popup)) === "1";
  } catch {
    return false;
  }
}

function rememberDismissal(popup: Popup) {
  try {
    const storage = popup.eyebrow === ARTICLE_POPUP_LABEL ? window.localStorage : window.sessionStorage;
    storage.setItem(popupStorageKey(popup), "1");
  } catch {
    // The popup remains usable when browser storage is unavailable.
  }
}

function trackPopup(popupId: string, event: "impression" | "click" | "close") {
  void supabase.functions.invoke("site-popup-track", {
    body: { popup_id: popupId, event },
  });
}

export function SitePopup() {
  const location = useLocation();
  const [popup, setPopup] = useState<Popup | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    setPopup(null);
    setOpen(false);

    void (async () => {
      const { data, error } = await supabase
        .from("site_popups")
        .select("id,title,eyebrow,description,image_url,youtube_url,cta_label,cta_url")
        .eq("active", true)
        .eq("target_path", location.pathname)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!alive || error || !data) return;

      const nextPopup = data as Popup;
      if (wasDismissed(nextPopup)) return;

      setPopup(nextPopup);
      setOpen(true);
      trackPopup(nextPopup.id, "impression");
    })();

    return () => {
      alive = false;
    };
  }, [location.pathname]);

  if (!popup || !open) return null;

  const videoId = youtubeId(popup.youtube_url);
  const ctaUrl = popup.cta_url || popup.youtube_url;
  const internalCta = !!ctaUrl && (
    ctaUrl.startsWith("/") || ctaUrl.startsWith(window.location.origin)
  );

  const close = () => {
    rememberDismissal(popup);
    trackPopup(popup.id, "close");
    setOpen(false);
  };

  const clickCta = () => {
    rememberDismissal(popup);
    trackPopup(popup.id, "click");
    setOpen(false);
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={popup.title}
    >
      <div className="relative w-full max-w-[560px] overflow-hidden rounded-2xl bg-white shadow-2xl">
        <button
          onClick={close}
          className="absolute right-3 top-3 z-10 rounded-full bg-black/65 p-2 text-white"
          aria-label="Fechar"
        >
          <X className="h-5 w-5" />
        </button>

        {videoId ? (
          <div className="aspect-video bg-black">
            <iframe
              className="h-full w-full"
              src={`https://www.youtube.com/embed/${videoId}`}
              title={popup.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : popup.image_url ? (
          <img src={popup.image_url} alt="" className="h-[230px] w-full object-cover sm:h-[250px]" />
        ) : null}

        <div className="p-4 sm:p-5">
          {popup.eyebrow && (
            <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-green-800">
              {popup.eyebrow}
            </span>
          )}

          <h2 className="mt-2 text-xl font-bold leading-tight text-slate-900 sm:text-2xl">{popup.title}</h2>

          {popup.description && (
            <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-slate-600">{popup.description}</p>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {ctaUrl && (
              <a
                href={ctaUrl}
                target={internalCta ? undefined : "_blank"}
                rel={internalCta ? undefined : "noreferrer"}
                onClick={clickCta}
                className="inline-flex items-center gap-2 rounded-lg bg-[#0F7A3E] px-4 py-2.5 text-sm font-semibold text-white"
              >
                {popup.cta_label || "Saiba mais"}
                <ExternalLink className="h-4 w-4" />
              </a>
            )}

            <button onClick={close} className="rounded-lg border px-4 py-2.5 text-sm font-medium">
              Agora não
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
