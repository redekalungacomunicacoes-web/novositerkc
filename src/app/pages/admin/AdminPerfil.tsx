import { useEffect, useState } from "react";
import { AdminEquipeForm } from "@/app/pages/admin/AdminEquipeForm";
import { supabase } from "@/lib/supabase";

type MemberLink = {
  id: string;
};

export function AdminPerfil() {
  const [loading, setLoading] = useState(true);
  const [member, setMember] = useState<MemberLink | null>(null);
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    let mounted = true;

    async function loadOwnMember() {
      setLoading(true);
      setMessage("");

      const { data: authData, error: authError } = await supabase.auth.getSession();
      const userId = authData.session?.user.id;

      if (!mounted) return;

      if (authError || !userId) {
        setMessage("Não foi possível identificar sua sessão. Faça login novamente.");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("equipe")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      if (!mounted) return;

      if (error) {
        setMessage(error.message || "Não foi possível carregar seu perfil.");
        setLoading(false);
        return;
      }

      if (!data) {
        setMessage("Seu usuário autenticado ainda não está vinculado a um integrante da equipe (equipe.user_id). Procure um administrador para realizar esse vínculo.");
        setLoading(false);
        return;
      }

      setMember(data);
      setLoading(false);
    }

    void loadOwnMember();

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Carregando perfil...</div>;
  }

  if (!member) {
    return (
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Perfil</h1>
        <p className="text-muted-foreground">Edite aqui apenas seu próprio perfil público.</p>
        <div className="rounded-md border bg-card p-4 text-sm text-muted-foreground">{message}</div>
      </div>
    );
  }

  return <AdminEquipeForm mode="self" memberId={member.id} />;
}
