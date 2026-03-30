import { supabase } from "@/lib/supabase";

type ApiError = {
  code: string;
  message: string;
  details?: string;
};

type ApiResponse<T> = {
  ok: boolean;
  data?: T;
  error?: ApiError;
};

export async function invokeNewsletter<T>(fn: string, body?: unknown): Promise<ApiResponse<T>> {
  const { data, error } = await supabase.functions.invoke(fn, {
    method: body ? "POST" : "GET",
    ...(body ? { body } : {}),
  });

  if (error) {
    console.error(`Erro ao invocar função ${fn}:`, error);
    return {
      ok: false,
      error: {
        code: "edge_invoke_failed",
        message: "Falha ao chamar Edge Function.",
        details: error.message,
      },
    };
  }

  const payload = (data || {}) as ApiResponse<T>;
  if (!payload.ok) {
    console.error(`Erro retornado por ${fn}:`, payload.error);
  }
  return payload;
}

export function errorText(error?: ApiError) {
  if (!error) return "Erro desconhecido.";
  return error.details ? `${error.message} (${error.details})` : error.message;
}
