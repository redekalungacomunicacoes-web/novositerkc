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

export async function newsletterAdmin<T>(
  action: string,
  payload: Record<string, unknown> = {},
): Promise<NewsletterApiResponse<T>> {
  const { data, error } = await supabase.functions.invoke("newsletter-admin", {
    body: { action, ...payload },
  });

  if (error) {
    console.error(`Erro ao invocar newsletter-admin/${action}:`, error);
    return {
      ok: false,
      error: {
        code: "edge_invoke_failed",
        message: "Não foi possível falar com o serviço da Newsletter.",
        details: error.message,
      },
    };
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
