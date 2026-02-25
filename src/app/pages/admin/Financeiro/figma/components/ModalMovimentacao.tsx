import { useEffect, useMemo, useState } from 'react';
import { X, Upload, FileText, Trash2, Eye } from 'lucide-react';
import { useFinanceSupabase } from '../../hooks/useFinanceSupabase';
import { formatCurrency } from '../data/financeiro-data';
import { AttachmentViewerDialog } from '../../components/AttachmentViewerDialog';

interface ModalMovimentacaoProps {
  isOpen: boolean;
  onClose: () => void;
  editData?: any;
  projects?: Array<{ id: string; name: string; fund_id?: string | null }>;
  funds?: Array<{ id: string; name: string }>;
  attachments?: any[];
  onSubmit?: (payload: any) => Promise<any> | any;
  onDelete?: (movementId: string) => Promise<void> | void;
  onChanged?: () => Promise<void> | void;
  onUploadAttachment?: (file: File, movementId?: string, payload?: any) => Promise<void> | void;
  onDeleteAttachment?: (attachmentId: string) => Promise<void> | void;
}

export function ModalMovimentacao({ isOpen, onClose, editData, projects = [], funds = [], attachments = [], onSubmit, onDelete, onChanged, onUploadAttachment, onDeleteAttachment }: ModalMovimentacaoProps) {
  const [formData, setFormData] = useState<any>({});
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [savedAttachments, setSavedAttachments] = useState<any[]>([]);
  const [loadedFunds, setLoadedFunds] = useState<any[]>([]);
  const [loadedProjects, setLoadedProjects] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [previewAttachment, setPreviewAttachment] = useState<any | null>(null);
  const { listFunds, listProjects, listCategories, listAttachments } = useFinanceSupabase();

  useEffect(() => {
    setFormData({
      date: editData?.date || '',
      type: editData?.type || 'saida',
      project_id: editData?.project_id || '',
      fund_id: editData?.fund_id || '',
      category_id: editData?.category_id || '',
      description: editData?.description || '',
      unit_value: Number(editData?.unit_value || 0),
      quantity: Number(editData?.quantity || 1),
      status: editData?.status || 'pendente',
      notes: editData?.notes || '',
    });
  }, [editData, isOpen]);

  useEffect(() => setSavedAttachments(attachments || []), [attachments]);

  useEffect(() => {
    if (isOpen) return;
    setPendingFiles([]);
    setSavedAttachments([]);
    setPreviewAttachment(null);
  }, [isOpen]);

  useEffect(() => {
    const loadSelects = async () => {
      if (!isOpen) return;
      const [fundRows, projectRows, categoryRows] = await Promise.all([listFunds(), listProjects(), listCategories()]);
      setLoadedFunds(fundRows || []);
      setLoadedProjects(projectRows || []);
      setCategories(categoryRows || []);
    };
    void loadSelects();
  }, [isOpen]);

  const fundOptions = loadedFunds.length ? loadedFunds : funds;
  const projectOptions = loadedProjects.length ? loadedProjects : projects;
  const totalValue = useMemo(() => Number(formData.unit_value || 0) * Number(formData.quantity || 0), [formData.unit_value, formData.quantity]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextPayload = {
      ...formData,
      unit_value: Number(formData.unit_value || 0),
      quantity: Number(formData.quantity || 0),
      total_value: totalValue,
      project_id: formData.project_id || null,
      fund_id: formData.fund_id || null,
      category_id: formData.category_id || null,
    };

    const movement = await onSubmit?.(nextPayload);
    const movementId = editData?.id || movement?.id;

    if (pendingFiles.length && movementId) {
      for (const file of pendingFiles) await onUploadAttachment?.(file, movementId, nextPayload);
    }

    if (movementId) {
      const latestAttachments = await listAttachments(movementId);
      setSavedAttachments(latestAttachments || []);
    }

    await onChanged?.();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-[#0f3d2e] to-[#0a2b20]">
          <h2 className="text-xl font-semibold text-white">{editData?.id ? 'Editar Movimentação' : 'Nova Movimentação'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors"><X className="w-5 h-5 text-white" /></button>
        </div>
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div><label className="block text-sm font-medium text-gray-700 mb-2">Data</label><input type="date" required value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0f3d2e] focus:border-transparent" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-2">Tipo</label><select value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0f3d2e] focus:border-transparent"><option value="entrada">Entrada</option><option value="saida">Saída</option></select></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-2">Projeto</label><select value={formData.project_id} onChange={(e) => setFormData({ ...formData, project_id: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0f3d2e] focus:border-transparent"><option value="">Selecione um projeto</option>{projectOptions.map((proj) => <option key={proj.id} value={proj.id}>{proj.name}</option>)}</select></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-2">Fundo</label><select value={formData.fund_id} onChange={(e) => setFormData({ ...formData, fund_id: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0f3d2e] focus:border-transparent"><option value="">Selecione um fundo</option>{fundOptions.map((fundo) => <option key={fundo.id} value={fundo.id}>{fundo.name}</option>)}</select></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-2">Categoria</label><select value={formData.category_id} onChange={(e) => setFormData({ ...formData, category_id: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0f3d2e] focus:border-transparent"><option value="">Selecione uma categoria</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-2">Status</label><select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0f3d2e] focus:border-transparent"><option value="pendente">Pendente</option><option value="pago">Pago</option><option value="cancelado">Cancelado</option></select></div>
            <div className="md:col-span-2"><label className="block text-sm font-medium text-gray-700 mb-2">Descrição</label><input required value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0f3d2e] focus:border-transparent" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-2">Valor unitário</label><input type="number" step="0.01" value={formData.unit_value} onChange={(e) => setFormData({ ...formData, unit_value: Number(e.target.value) })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0f3d2e] focus:border-transparent" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-2">Quantidade</label><input type="number" step="0.01" value={formData.quantity} onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0f3d2e] focus:border-transparent" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-2">Valor total</label><input type="text" readOnly value={formatCurrency(totalValue)} className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 focus:ring-2 focus:ring-[#0f3d2e] focus:border-transparent" /></div>
            <div className="md:col-span-2"><label className="block text-sm font-medium text-gray-700 mb-2">Observações</label><textarea rows={3} value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0f3d2e] focus:border-transparent resize-none" /></div>
          </div>

          <div className="mt-6 p-4 border border-gray-200 rounded-xl">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Comprovantes: {savedAttachments.length + pendingFiles.length}</h3>
            <label className="inline-flex items-center gap-2 px-4 py-2 bg-[#0f3d2e] text-white rounded-lg hover:bg-[#0a2b20] transition-colors cursor-pointer"><Upload className="w-4 h-4" />Upload<input type="file" multiple className="hidden" onChange={async (e) => {
              const files = e.target.files;
              if (!files?.length) return;
              const fileList = Array.from(files);
              if (!editData?.id) setPendingFiles((current) => [...current, ...fileList]);
              else for (const file of fileList) await onUploadAttachment?.(file, editData.id, formData);
              e.target.value = '';
            }} /></label>
            <div className="mt-3 space-y-2">
              {pendingFiles.map((file, index) => (<div key={`${file.name}-${index}`} className="flex items-center justify-between p-2 bg-amber-50 rounded-lg"><div className="flex items-center gap-2"><FileText className="w-4 h-4 text-amber-600" /><span className="text-sm text-amber-700">{file.name} <span className="text-xs">(pendente)</span></span></div><button type="button" onClick={() => setPendingFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))} className="p-1 text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button></div>))}
              {savedAttachments.map((a) => (
                <div key={a.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"><div className="flex items-center gap-2"><FileText className="w-4 h-4 text-gray-500" /><span className="text-sm text-gray-700">{a.file_name}</span></div><div className="flex items-center gap-1"><button type="button" onClick={() => setPreviewAttachment(a)} className="p-1 text-[#0f3d2e] hover:bg-[#e8f2ef] rounded"><Eye className="w-4 h-4" /></button><button type="button" onClick={() => void onDeleteAttachment?.(a.id)} className="p-1 text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button></div></div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 mt-6 pt-6 border-t border-gray-200">
            <div>{editData?.id ? <button type="button" onClick={async () => { await onDelete?.(editData.id); await onChanged?.(); onClose(); }} className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">Excluir</button> : null}</div>
            <div className="flex items-center gap-3"><button type="button" onClick={onClose} className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors">Cancelar</button><button type="submit" className="px-6 py-2 bg-[#0f3d2e] text-white rounded-lg hover:bg-[#0a2b20] transition-colors">Salvar Movimentação</button></div>
          </div>
        </form>
      </div>
      <AttachmentViewerDialog open={Boolean(previewAttachment)} attachment={previewAttachment} onClose={() => setPreviewAttachment(null)} />
    </div>
  );
}
