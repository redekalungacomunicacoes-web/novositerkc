import { X } from 'lucide-react';
import type { FinanceiroFundo, FinanceiroProjeto } from '../data/financeiro.repo';
import type { FinanceCategory } from '../hooks/useFinanceSupabase';

export type MovementFormValues = {
  date: string;
  type: 'entrada' | 'saida';
  project_id: string;
  fund_id: string;
  title: string;
  description: string;
  unit_value: number;
  quantity: number;
  status: string;
  category: string;
  category_id?: string;
  payment_method: string;
  payee: string;
  notes: string;
};

type Props = {
  open: boolean;
  title: string;
  saving?: boolean;
  form: MovementFormValues;
  funds: FinanceiroFundo[];
  projects: FinanceiroProjeto[];
  categories: FinanceCategory[];
  onChange: (next: MovementFormValues) => void;
  onClose: () => void;
  onSubmit: () => void;
};

const paymentMethods = ['Pix', 'Transferência', 'Cartão', 'Dinheiro'];

export function ModalMovimentacao({ open, title, saving = false, form, funds, projects, categories, onChange, onClose, onSubmit }: Props) {
  if (!open) return null;
  const total = (Number(form.unit_value) || 0) * (Number(form.quantity) || 0);
  const fundProjects = projects.filter((project) => !form.fund_id || project.fundoId === form.fund_id);

  return (
    <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl rounded-xl bg-white p-6">
        <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold">{title}</h2><button onClick={onClose} className="rounded p-1 hover:bg-gray-100"><X className="h-4 w-4" /></button></div>
        <form className="grid grid-cols-2 gap-3" onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
          <input required type="date" value={form.date} onChange={(e) => onChange({ ...form, date: e.target.value })} className="rounded border px-3 py-2 text-sm" />
          <select value={form.type} onChange={(e) => onChange({ ...form, type: e.target.value as 'entrada' | 'saida' })} className="rounded border px-3 py-2 text-sm"><option value="entrada">Entrada</option><option value="saida">Saída</option></select>

          <select required value={form.fund_id} onChange={(e) => onChange({ ...form, fund_id: e.target.value, project_id: '' })} className="rounded border px-3 py-2 text-sm"><option value="">Fundo</option>{funds.map((fund) => <option key={fund.id} value={fund.id}>{fund.nome}</option>)}</select>
          <select value={form.project_id} onChange={(e) => onChange({ ...form, project_id: e.target.value })} className="rounded border px-3 py-2 text-sm"><option value="">Projeto (opcional)</option>{fundProjects.map((project) => <option key={project.id} value={project.id}>{project.nome}</option>)}</select>

          <input required value={form.title} onChange={(e) => onChange({ ...form, title: e.target.value })} placeholder="Título" className="rounded border px-3 py-2 text-sm" />
          <input value={form.description} onChange={(e) => onChange({ ...form, description: e.target.value })} placeholder="Descrição" className="rounded border px-3 py-2 text-sm" />

          <input required min={0} type="number" value={form.unit_value} onChange={(e) => onChange({ ...form, unit_value: Number(e.target.value) })} placeholder="Valor unitário" className="rounded border px-3 py-2 text-sm" />
          <input required min={1} type="number" value={form.quantity} onChange={(e) => onChange({ ...form, quantity: Number(e.target.value) })} placeholder="Quantidade" className="rounded border px-3 py-2 text-sm" />

          <div className="rounded border px-3 py-2 text-sm bg-gray-50">Total: <strong>{total.toFixed(2)}</strong></div>
          <select value={form.status} onChange={(e) => onChange({ ...form, status: e.target.value })} className="rounded border px-3 py-2 text-sm"><option value="pendente">Pendente</option><option value="pago">Pago</option><option value="cancelado">Cancelado</option></select>

          <select value={form.category_id || ''} onChange={(e) => {
            const category = categories.find((item) => item.id === e.target.value);
            onChange({ ...form, category_id: e.target.value || undefined, category: category?.name ?? '' });
          }} className="rounded border px-3 py-2 text-sm">
            <option value="">Categoria</option>
            {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
          <select value={form.payment_method} onChange={(e) => onChange({ ...form, payment_method: e.target.value })} className="rounded border px-3 py-2 text-sm"><option value="">Forma de pagamento</option>{paymentMethods.map((item) => <option key={item} value={item}>{item}</option>)}</select>
          <input value={form.payee} onChange={(e) => onChange({ ...form, payee: e.target.value })} placeholder="Favorecido" className="rounded border px-3 py-2 text-sm" />
          <textarea value={form.notes} onChange={(e) => onChange({ ...form, notes: e.target.value })} placeholder="Observações" className="col-span-2 rounded border px-3 py-2 text-sm" />

          <div className="col-span-2 flex justify-end gap-2 pt-2"><button type="button" onClick={onClose} className="rounded border px-4 py-2 text-sm">Cancelar</button><button disabled={saving} type="submit" className="rounded bg-[#0f3d2e] px-4 py-2 text-sm text-white disabled:opacity-60">{saving ? 'Salvando...' : 'Salvar'}</button></div>
        </form>
      </div>
    </div>
  );
}
