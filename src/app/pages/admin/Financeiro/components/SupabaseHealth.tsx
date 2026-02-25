import { useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Alert, AlertDescription, AlertTitle } from "../figma/components/ui/alert";

export function SupabaseHealth() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const check = async () => {
      const { error } = await supabase.from("finance_funds").select("id").limit(1);
      if (error) {
        const isRlsError = error.message.toLowerCase().includes("row-level security");
        setErrorMessage(isRlsError ? "Acesso negado (RLS). Verifique profiles.role = 'admin'." : error.message);
        if (import.meta.env.DEV) {
          console.error("Finance Supabase healthcheck failed", error);
        }
      }
    };

    void check();
  }, []);

  if (!errorMessage) return null;

  return (
    <Alert variant="destructive" className="mb-6 border-red-200 bg-red-50 text-red-800">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Falha ao conectar no Supabase Financeiro</AlertTitle>
      <AlertDescription>{errorMessage}</AlertDescription>
    </Alert>
  );
}
