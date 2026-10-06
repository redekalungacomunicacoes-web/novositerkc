import { supabase } from "@/lib/supabase";

export type NewsletterApiError = {
  code: string;
  message: string;
  details?: string;
};

export type NewsletterApiResponse<T> = {
  ok: boolean;
  data?: T;
  error?: NewsletterApiError;
};

async function readFunctionsError(error: any): Promise<NewsletterApiError> {
  try {
    const context = error?.context;
    if (context && typeof context.json === "function") {
      const payload = await context.json();
      if (payload?.error?.message) {
        return {
          code: String(payload.error.code || "edge_error"),
          message: String(payload.error.message),
          details: payload.error.details ? String(payload.error.details) : undefined,
        };
      }
    }
  } catch {
    // Keep the connector error as a fallback.
  }

  return {
    code: "edge_invoke_failed",
    message: "Não foi possível falar com o serviço da Newsletter.",
    details: error?.message ? String(error.message) : undefined,
  };
}

export async function newsletterAdmin<T>(
  action: string,
  payload: Record<string, unknown> = {},
): Promise<NewsletterApiResponse<T>> {
  const { data, error } = await supabase.functions.invoke("newsletter-admin", {
    method: "POST",
    body: { action, ...payload },
  });

  if (error) {
    const parsed = await readFunctionsError(error);
    console.error(`Erro ao invocar newsletter-admin/${action}:`, parsed);
    return { ok: false, error: parsed };
  }

  const response = (data || {}) as NewsletterApiResponse<T>;
  if (!response.ok) {
    console.error(`Erro retornado por newsletter-admin/${action}:`, response.error);
  }
  return response;
}

export function newsletterErrorText(error?: NewsletterApiError) {
  if (!error) return "Erro desconhecido.";
  return error.details ? `${error.message} (${error.details})` : error.message;
}
