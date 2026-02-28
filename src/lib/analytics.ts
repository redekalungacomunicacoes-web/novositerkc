import { supabase } from "@/lib/supabase";

const SESSION_KEY = "rkc_analytics_session_id";

function getSessionId() {
  if (typeof window === "undefined") return "";

  const fromStorage = window.localStorage.getItem(SESSION_KEY);
  if (fromStorage) return fromStorage;

  const random = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  window.localStorage.setItem(SESSION_KEY, random);
  return random;
}

export async function trackPageView(payload: {
  pageType: "site" | "materia" | "projeto";
  path?: string;
  contentId?: string | null;
  contentSlug?: string | null;
}) {
  const sessionId = getSessionId();

  const { error } = await supabase.rpc("track_page_view", {
    p_page_type: payload.pageType,
    p_path: payload.path ?? null,
    p_content_id: payload.contentId ?? null,
    p_content_slug: payload.contentSlug ?? null,
    p_session_id: sessionId,
    p_meta: {
      screen: typeof window !== "undefined" ? `${window.innerWidth}x${window.innerHeight}` : null,
    },
  });

  if (error) {
    console.warn("[track_page_view] Falha ao registrar visualização:", error.message);
  }
}

export async function getPublicContentViewCount(payload: {
  pageType: "materia" | "projeto";
  contentId?: string | null;
  contentSlug?: string | null;
}) {
  const { data, error } = await supabase.rpc("public_content_view_count", {
    p_page_type: payload.pageType,
    p_content_id: payload.contentId ?? null,
    p_content_slug: payload.contentSlug ?? null,
  });

  if (error) {
    console.warn("[public_content_view_count] Falha ao consultar visualizações:", error.message);
    return null;
  }

  if (typeof data === "number" && Number.isFinite(data)) return data;
  if (typeof data === "string") {
    const n = Number(data);
    return Number.isFinite(n) ? n : null;
  }

  return null;
}
