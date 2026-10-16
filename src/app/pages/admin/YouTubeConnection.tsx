import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type ConnectionStatus = { connected: boolean; channel?: { channel_title: string; channel_id: string } | null };
export function YouTubeConnection() {
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const code = new URLSearchParams(window.location.search).get("youtube");
  async function call(action: "connect" | "status") {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Entre novamente no painel.");
    const { data, error: invokeError } = await supabase.functions.invoke("youtube-oauth", {
      body: { action },
      headers: { Authorization: `Bearer ${session.access_token}` }
    });
    if (invokeError || data?.error) throw new Error(data?.error || invokeError?.message || "Conexão indisponível.");
    return data;
  }
  useEffect(() => {
    let active = true;
    call("status").then(data => {if(active) setStatus(data);}).catch(e=>{if(active) setError(e.message);});
    return ()=>{active=false;};
  }, []);
  async function connect() {
    try {
      setLoading(true);
      setError("");
      const data = await call("connect");
      if (!data.authorization_url?.startsWith("https://accounts.google.com/")) throw new Error("Autorização inválida.");
      window.location.assign(data.authorization_url);
    } catch(e) {
      setError(e instanceof Error ? e.message : "Falha de conexão.");
      setLoading(false);
    }
  }
  return <section aria-label="Integração YouTube" className="rounded-xl border bg-card p-5 space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-lg font-semibold">YouTube — Canal RKC</h2>
        <p className="text-sm text-muted-foreground">Conta oficial @kalungacomunicacoes · conexão independente do Google Drive.</p>
      </div>
      <button type="button" onClick={connect} disabled={loading || status?.connected} className="rounded-lg bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50">
        {status?.connected ? "Conectado" : loading ? "Aguarde..." : "Conectar YouTube"}
      </button>
    </div>
    {status?.connected && <p className="text-sm text-green-700">Canal autorizado: {status.channel?.channel_title || "Rede Kalunga Comunicações"}</p>}
    {code === "connected" && <p className="text-sm text-green-700">Autorização concluída. Atualize o painel para conferir o status.</p>}
    {code && code !== "connected" && <p role="alert" className="text-sm text-red-600">O Google não concluiu a autorização ({code}). Verifique a conta e tente novamente.</p>}
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
  </section>;
}
