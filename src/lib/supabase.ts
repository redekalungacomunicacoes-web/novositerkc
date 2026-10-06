import { createClient } from "@supabase/supabase-js";
import { optimizeMateriaDriveForm } from "@/lib/materiaMediaOptimization";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

function resolveRequestUrl(input: RequestInfo | URL) {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  if (typeof Request !== "undefined" && input instanceof Request) return input.url;
  return "";
}

async function optimizedSupabaseFetch(input: RequestInfo | URL, init?: RequestInit) {
  let nextInit = init;
  const url = resolveRequestUrl(input);

  if (
    url.includes("/functions/v1/drive-files") &&
    init?.body instanceof FormData &&
    typeof File !== "undefined"
  ) {
    try {
      nextInit = {
        ...init,
        body: await optimizeMateriaDriveForm(init.body),
      };
    } catch (error) {
      // Nunca impede a publicação: se a otimização local falhar, o backend
      // continua validando e recebendo o arquivo original.
      console.warn("[materia-media] falha na otimização local", error);
    }
  }

  return fetch(input, nextInit);
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  global: {
    fetch: optimizedSupabaseFetch,
  },
});
