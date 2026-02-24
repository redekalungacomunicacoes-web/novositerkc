import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFinance } from "./hooks/useFinance";

export function FinanceiroNovoProjeto() {
  const finance = useFinance();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", year: new Date().getFullYear(), funder: "", start_date: "", end_date: "", responsible: "", initial_amount: 0 });

  const save = async () => {
    const { error } = await finance.createProject({ ...form, current_balance: Number(form.initial_amount) });
    if (error) return alert(error.message);
    navigate("/admin/financeiro");
  };

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-3xl font-bold">Novo projeto financeiro</h1>
      <div className="grid grid-cols-2 gap-3">
        <input className="col-span-2 rounded border p-2" placeholder="Nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className="rounded border p-2" type="number" placeholder="Ano" value={form.year} onChange={(e) => setForm({ ...form, year: Number(e.target.value) })} />
        <input className="rounded border p-2" placeholder="Financiador" value={form.funder} onChange={(e) => setForm({ ...form, funder: e.target.value })} />
        <input className="rounded border p-2" type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
        <input className="rounded border p-2" type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
        <input className="rounded border p-2" placeholder="Responsável" value={form.responsible} onChange={(e) => setForm({ ...form, responsible: e.target.value })} />
        <input className="rounded border p-2" type="number" step="0.01" placeholder="Valor inicial" value={form.initial_amount} onChange={(e) => setForm({ ...form, initial_amount: Number(e.target.value) })} />
      </div>
      <button className="rounded bg-primary px-3 py-2 text-primary-foreground" onClick={save}>Salvar</button>
    </div>
  );
}
