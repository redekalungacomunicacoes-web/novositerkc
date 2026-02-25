import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFinanceSupabase } from "./hooks/useFinanceSupabase";

const FRIENDLY_RLS = "Seu usuário não é admin no Supabase. Verifique tabela profiles.role='admin'.";
const normalizeError = (error: unknown) => {
  const message = (error as Error)?.message || 'Erro inesperado.';
  return message.toLowerCase().includes('row-level security') ? FRIENDLY_RLS : message;
};

export function FinanceiroNovoProjeto() {
  const { createProject, listFunds } = useFinanceSupabase();
  const navigate = useNavigate();
  const [funds, setFunds] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", year: new Date().getFullYear(), description: "", fund_id: "", initial_amount: 0, current_balance: 0, status: "em_andamento" });

  useEffect(() => {
    const load = async () => {
      try {
        setFunds(await listFunds());
      } catch (err) {
        setError(normalizeError(err));
      }
    };
    void load();
  }, []);

  const save = async () => {
    try {
      await createProject({ ...form, description: form.description || null, fund_id: form.fund_id || null, current_balance: Number(form.current_balance || form.initial_amount) });
      navigate("/admin/financeiro/projetos");
    } catch (err) {
      setError(normalizeError(err));
    }
  };

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-3xl font-bold">Novo projeto financeiro</h1>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="grid grid-cols-2 gap-3">
        <input className="col-span-2 rounded border p-2" placeholder="Nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className="rounded border p-2" type="number" placeholder="Ano" value={form.year} onChange={(e) => setForm({ ...form, year: Number(e.target.value) })} />
        <select className="rounded border p-2" value={form.fund_id} onChange={(e) => setForm({ ...form, fund_id: e.target.value })}>
          <option value="">Selecione um fundo</option>
          {funds.map((fund) => <option key={fund.id} value={fund.id}>{fund.name}</option>)}
        </select>
        <textarea className="col-span-2 rounded border p-2" placeholder="Descrição" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <input className="rounded border p-2" type="number" step="0.01" placeholder="Valor inicial" value={form.initial_amount} onChange={(e) => setForm({ ...form, initial_amount: Number(e.target.value) })} />
        <input className="rounded border p-2" type="number" step="0.01" placeholder="Saldo atual" value={form.current_balance} onChange={(e) => setForm({ ...form, current_balance: Number(e.target.value) })} />
      </div>
      <button className="rounded bg-primary px-3 py-2 text-primary-foreground" onClick={() => void save()}>Salvar</button>
    </div>
  );
}
