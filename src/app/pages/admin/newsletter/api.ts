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

type LegacyNewsletterFunction =
  | "newsletter-config"
  | "newsletter-validate-smtp"
  | "newsletter-send-test"
  | "newsletter-send-campaign";

async function readFunctionsError(error: any): Promise<ApiError> {
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
    // Fall through to the connector error message.
  }

  return {
    code: "edge_invoke_failed",
    message: "Falha ao chamar o serviço da Newsletter.",
    details: error?.message ? String(error.message) : undefined,
  };
}

async function callAdmin<T>(action: string, payload: Record<string, unknown> = {}): Promise<ApiResponse<T>> {
  const { data, error } = await supabase.functions.invoke("newsletter-admin", {
    method: "POST",
    body: { action, ...payload },
  });

  if (error) {
    const parsed = await readFunctionsError(error);
    console.error("Erro na Newsletter:", parsed);
    return { ok: false, error: parsed };
  }

  const response = (data || {}) as ApiResponse<T>;
  if (!response.ok) console.error("Erro retornado pela Newsletter:", response.error);
  return response;
}

export async function invokeNewsletter<T>(fn: LegacyNewsletterFunction, body?: any): Promise<ApiResponse<T>> {
  if (fn === "newsletter-config") {
    if (body) {
      return callAdmin<T>("save_settings", { settings: body });
    }
    return callAdmin<T>("get_settings");
  }

  if (fn === "newsletter-validate-smtp") {
    return callAdmin<T>("validate_smtp");
  }

  if (fn === "newsletter-send-test") {
    return callAdmin<T>("send_test", body || {});
  }

  if (fn === "newsletter-send-campaign") {
    let sent = 0;
    let failed = 0;
    let status = "sending";
    const errors: string[] = [];

    // Each Edge invocation processes a small idempotent batch.
    // The client continues until the campaign is complete, avoiding long-running requests.
    for (let batch = 0; batch < 250; batch += 1) {
      const result = await callAdmin<any>("send_campaign", {
        ...(body || {}),
        batch_size: 25,
      });

      if (!result.ok) return result as ApiResponse<T>;

      const data = result.data || {};
      sent = Number(data.sent_total ?? sent + Number(data.sent || 0));
      failed = Number(data.fail_total ?? failed + Number(data.failed || 0));
      status = String(data.status || status);

      if (Array.isArray(data.errors)) {
        for (const item of data.errors) {
          if (item && errors.length < 10) errors.push(String(item));
        }
      }

      if (data.done) {
        return {
          ok: true,
          data: {
            status,
            sent,
            failed,
            errors,
          } as T,
        };
      }
    }

    return {
      ok: false,
      error: {
        code: "batch_limit_reached",
        message: "O envio foi interrompido por segurança antes de concluir todos os lotes.",
        details: "Atualize a tela e continue o disparo da campanha.",
      },
    };
  }

  return {
    ok: false,
    error: {
      code: "unsupported_newsletter_function",
      message: "Operação de Newsletter não suportada.",
    },
  };
}

export function errorText(error?: ApiError) {
  if (!error) return "Erro desconhecido.";
  return error.details ? `${error.message} (${error.details})` : error.message;
}
