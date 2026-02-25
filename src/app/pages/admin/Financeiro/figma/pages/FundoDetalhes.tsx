import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Search, Plus, Edit, Trash2, Paperclip } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { StatusBadge } from '../components/StatusBadge';
import { ModalMovimentacao } from '../components/ModalMovimentacao';
import { formatCurrency, formatDate } from '../data/financeiro-data';
import { useFinanceSupabase } from '../../hooks/useFinanceSupabase';
import { SupabaseHealth } from '../../components/SupabaseHealth';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Alert, AlertDescription } from '../components/ui/alert';

const FRIENDLY_RLS = "Seu usuário não é admin no Supabase. Verifique tabela profiles.role='admin'.";
const normalizeError = (error: unknown) => {
  const message = (error as Error)?.message || 'Erro inesperado.';
  return message.toLowerCase().includes('row-level security') ? FRIENDLY_RLS : message;
};

export function FundoDetalhes() {
  const { id } = useParams();
  const [modalOpen, setModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [fundo, setFundo] = useState<any>(null);
  const [movements, setMovements] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [funds, setFunds] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [deleting, setDeleting] = useState<any | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const { getFund, listMovementsByFund, listProjects, listFunds, createMovement, updateMovement, deleteMovementCascade, uploadAttachment, listAttachments, deleteAttachment } = useFinanceSupabase();

  const load = async () => {
    if (!id) return;
    try {
      let fundRes: any = null;
      try {
        fundRes = await getFund(id);
      } catch {
        const allFunds = await listFunds();
        fundRes = allFunds.find((fund) => fund.id === id) || null;
      }

      const [movRes, projRes, fundsRes] = await Promise.all([listMovementsByFund(id), listProjects(), listFunds()]);
      setFundo(fundRes);
      setMovements(movRes || []);
      setProjects(projRes || []);
      setFunds(fundsRes || []);
      setFeedback(null);
    } catch (error) {
      if (import.meta.env.DEV) console.error(error);
      setFeedback(normalizeError(error));
    }
  };

  const loadAttachments = async (movementId?: string) => {
    if (!movementId) {
      setAttachments([]);
      return;
    }
    try {
      const data = await listAttachments(movementId);
      setAttachments(data || []);
    } catch (error) {
      if (import.meta.env.DEV) console.error(error);
      setFeedback(normalizeError(error));
    }
  };

  useEffect(() => { void load(); }, [id]);
  useEffect(() => { void loadAttachments(editing?.id); }, [editing?.id]);

  const paidIn = useMemo(() => movements.filter((m) => m.type === 'entrada' && m.status === 'pago').reduce((a, b) => a + Number(b.total_value || 0), 0), [movements]);
  const paidOut = useMemo(() => movements.filter((m) => m.type === 'saida' && m.status === 'pago').reduce((a, b) => a + Number(b.total_value || 0), 0), [movements]);
  const pending = useMemo(() => movements.filter((m) => m.status === 'pendente').reduce((a, b) => a + Number(b.total_value || 0), 0), [movements]);
  const filtered = movements.filter((m) => `${m.description} ${m.status}`.toLowerCase().includes(searchTerm.toLowerCase()));

  const monthMap = new Map<string, { mes: string; real: number; saldo: number }>();
  let running = Number(fundo?.opening_balance || 0);
  [...movements].reverse().forEach((m) => {
    const mes = new Date(m.date).toLocaleDateString('pt-BR', { month: 'short' });
    const current = monthMap.get(mes) || { mes, real: 0, saldo: running };
    current.real += Number(m.total_value || 0);
    if (m.status === 'pago') running += m.type === 'entrada' ? Number(m.total_value || 0) : -Number(m.total_value || 0);
    current.saldo = running;
    monthMap.set(mes, current);
  });
  const mesData = Array.from(monthMap.values()).map((m) => ({ ...m, orcado: Number(fundo?.opening_balance || 0) / 12 }));

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-8">
      <SupabaseHealth />
      {feedback ? <Alert className="mb-6 border-red-200 bg-red-50 text-red-700"><AlertDescription>{feedback}</AlertDescription></Alert> : null}
      <div className="mb-8">
        <Link to="/admin/financeiro/fundos" className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4"><ArrowLeft className="w-4 h-4" />Voltar para Fundos</Link>
        <div className="flex items-center justify-between"><div><h1 className="text-3xl font-semibold text-gray-900 mb-2">{fundo?.name || 'Fundo'}</h1><p className="text-gray-600">Acompanhamento completo do fundo</p></div><button onClick={() => { setEditing(null); setModalOpen(true); }} className="flex items-center gap-2 px-6 py-3 bg-[#0f3d2e] text-white rounded-xl hover:bg-[#0a2b20] transition-colors shadow-sm"><Plus className="w-5 h-5" />Nova Movimentação</button></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
        <div className="bg-white rounded-xl border-2 border-[#0f3d2e] p-6 shadow-sm"><p className="text-sm text-gray-600 mb-1">Saldo Inicial</p><p className="text-2xl font-semibold text-[#0f3d2e]">{formatCurrency(Number(fundo?.opening_balance || 0))}</p></div>
        <div className="bg-white rounded-xl border-2 border-gray-200 p-6 shadow-sm"><p className="text-sm text-gray-600 mb-1">Saldo Atual</p><p className="text-2xl font-semibold text-gray-900">{formatCurrency(Number(fundo?.current_balance || 0))}</p></div>
        <div className="bg-white rounded-xl border-2 border-gray-200 p-6 shadow-sm"><p className="text-sm text-gray-600 mb-1">Entradas Pagas</p><p className="text-2xl font-semibold text-gray-900">{formatCurrency(paidIn)}</p></div>
        <div className="bg-white rounded-xl border-2 border-gray-200 p-6 shadow-sm"><p className="text-sm text-gray-600 mb-1">Saídas Pagas</p><p className="text-2xl font-semibold text-gray-900">{formatCurrency(paidOut)}</p></div>
        <div className="bg-white rounded-xl border-2 border-[#ffdd9a] p-6 shadow-sm"><p className="text-sm text-gray-600 mb-1">Pendências</p><p className="text-2xl font-semibold text-gray-900">{formatCurrency(pending)}</p></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8"><div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6"><h3 className="text-lg font-semibold text-gray-900 mb-6">Orçado vs Real por Mês</h3><ResponsiveContainer width="100%" height={300}><BarChart data={mesData}><CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" /><XAxis dataKey="mes" stroke="#6b7280" /><YAxis stroke="#6b7280" /><Tooltip formatter={(value: number) => formatCurrency(value)} /><Legend /><Bar dataKey="orcado" fill="#ffdd9a" name="Orçado" /><Bar dataKey="real" fill="#0f3d2e" name="Real" /></BarChart></ResponsiveContainer></div><div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6"><h3 className="text-lg font-semibold text-gray-900 mb-6">Saldo ao Longo do Tempo</h3><ResponsiveContainer width="100%" height={300}><LineChart data={mesData}><CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" /><XAxis dataKey="mes" stroke="#6b7280" /><YAxis stroke="#6b7280" /><Tooltip formatter={(value: number) => formatCurrency(value)} /><Legend /><Line type="monotone" dataKey="saldo" stroke="#0f3d2e" strokeWidth={3} name="Saldo" /></LineChart></ResponsiveContainer></div></div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-8">
        <div className="p-6 border-b border-gray-200"><h3 className="text-lg font-semibold text-gray-900 mb-4">Movimentações do Fundo</h3><div className="flex items-center gap-4"><div className="flex-1 relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" /><input type="text" placeholder="Buscar movimentações..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0f3d2e] focus:border-transparent" /></div></div></div>
        <div className="overflow-x-auto"><table className="w-full"><thead className="bg-gray-50 border-b border-gray-200 sticky top-0"><tr><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th><th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Descrição</th><th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Valor</th><th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th><th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th></tr></thead><tbody className="bg-white divide-y divide-gray-200">{filtered.map((mov) => (<tr key={mov.id} className="hover:bg-gray-50"><td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatDate(mov.date)}</td><td className="px-6 py-4 text-sm text-gray-900">{mov.description}</td><td className="px-6 py-4 whitespace-nowrap text-right"><span className={`text-sm font-medium ${mov.type === 'entrada' ? 'text-green-600' : 'text-red-600'}`}>{mov.type === 'entrada' ? '+' : '-'} {formatCurrency(Number(mov.total_value || 0))}</span></td><td className="px-6 py-4 whitespace-nowrap text-center"><StatusBadge status={mov.status} /></td><td className="px-6 py-4 whitespace-nowrap text-center"><div className="flex items-center justify-center gap-2"><button onClick={() => { setEditing(mov); setModalOpen(true); }} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg" title="Editar"><Edit className="w-4 h-4" /></button><button onClick={() => setDeleting(mov)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg" title="Excluir"><Trash2 className="w-4 h-4" /></button><button onClick={() => { setEditing(mov); setModalOpen(true); }} className="p-2 text-[#0f3d2e] hover:bg-[#e8f2ef] rounded-lg" title="Comprovantes"><Paperclip className="w-4 h-4" /></button></div></td></tr>))}</tbody></table></div>
      </div>

      <ModalMovimentacao
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        editData={editing || { fund_id: id }}
        projects={projects.map((p) => ({ id: p.id, name: p.name }))}
        funds={funds.map((f) => ({ id: f.id, name: f.name }))}
        attachments={attachments}
        onChanged={() => void load()}
        onSubmit={async (payload) => {
          try {
            if (editing?.id) return updateMovement(editing.id, payload);
            return createMovement({ ...payload, fund_id: id });
          } catch (error) {
            if (import.meta.env.DEV) console.error(error);
            setFeedback(normalizeError(error));
          }
        }}
        onDelete={async (movementId) => {
          try {
            await deleteMovementCascade({ id: movementId });
            await load();
          } catch (error) {
            if (import.meta.env.DEV) console.error(error);
            setFeedback(normalizeError(error));
          }
        }}
        onUploadAttachment={async (file, movementId) => {
          if (!movementId) return;
          try {
            await uploadAttachment(file, { movementId, fundId: id, projectId: editing?.project_id });
            await loadAttachments(movementId);
          } catch (error) {
            if (import.meta.env.DEV) console.error(error);
            setFeedback(normalizeError(error));
          }
        }}
        onDeleteAttachment={async (attachmentId) => {
          try {
            const target = attachments.find((a) => a.id === attachmentId);
            if (!target) return;
            await deleteAttachment(target);
            await loadAttachments(editing?.id);
          } catch (error) {
            if (import.meta.env.DEV) console.error(error);
            setFeedback(normalizeError(error));
          }
        }}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Excluir movimentação"
        description="Deseja realmente excluir esta movimentação?"
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting?.id) return;
          try {
            await deleteMovementCascade(deleting);
            setDeleting(null);
            await load();
          } catch (error) {
            if (import.meta.env.DEV) console.error(error);
            setFeedback(normalizeError(error));
          }
        }}
      />
    </div>
  );
}
