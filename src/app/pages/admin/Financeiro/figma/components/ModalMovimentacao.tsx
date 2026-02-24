import { useState } from 'react';
import { X, Upload, FileText, Download, Trash2 } from 'lucide-react';
import { PLANEJAMENTO_ITEMS, PROJETOS, FUNDOS } from '../data/financeiro-data';

interface ModalMovimentacaoProps {
  isOpen: boolean;
  onClose: () => void;
  editData?: any;
}

export function ModalMovimentacao({ isOpen, onClose, editData }: ModalMovimentacaoProps) {
  const [formData, setFormData] = useState({
    data: editData?.data || '',
    tipo: editData?.tipo || 'saida',
    projetoId: editData?.projetoId || '',
    fundoId: editData?.fundoId || '',
    itemPlanejamentoId: editData?.itemPlanejamentoId || '',
    categoria: editData?.categoria || '',
    descricao: editData?.descricao || '',
    valorUnitario: editData?.valorUnitario || '',
    quantidade: editData?.quantidade || 1,
    status: editData?.status || 'pendente',
    favorecido: editData?.favorecido || '',
    tipoDocumento: editData?.tipoDocumento || 'CPF',
    numeroDocumento: editData?.numeroDocumento || '',
    observacoes: editData?.observacoes || '',
  });

  const [comprovantes, setComprovantes] = useState<string[]>(editData?.comprovantes || []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Salvando movimentação:', formData, comprovantes);
    onClose();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newFiles = Array.from(files).map(f => f.name);
      setComprovantes([...comprovantes, ...newFiles]);
    }
  };

  const removeComprovante = (index: number) => {
    setComprovantes(comprovantes.filter((_, i) => i !== index));
  };

  const selectedItem = PLANEJAMENTO_ITEMS.find(item => item.id === formData.itemPlanejamentoId);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-[#0f3d2e] to-[#0a2b20]">
          <h2 className="text-xl font-semibold text-white">
            {editData ? 'Editar Movimentação' : 'Nova Movimentação'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Data */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Data <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={formData.data}
                onChange={(e) => setFormData({ ...formData, data: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0f3d2e] focus:border-transparent"
              />
            </div>

            {/* Tipo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formData.tipo}
                onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0f3d2e] focus:border-transparent"
              >
                <option value="entrada">Entrada</option>
                <option value="saida">Saída</option>
              </select>
            </div>

            {/* Projeto */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Projeto <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formData.projetoId}
                onChange={(e) => setFormData({ ...formData, projetoId: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0f3d2e] focus:border-transparent"
              >
                <option value="">Selecione um projeto</option>
                {PROJETOS.map((proj) => (
                  <option key={proj.id} value={proj.id}>{proj.nome}</option>
                ))}
              </select>
            </div>

            {/* Fundo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fundo <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formData.fundoId}
                onChange={(e) => setFormData({ ...formData, fundoId: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0f3d2e] focus:border-transparent"
              >
                <option value="">Selecione um fundo</option>
                {FUNDOS.map((fundo) => (
                  <option key={fundo.id} value={fundo.id}>{fundo.nome}</option>
                ))}
              </select>
            </div>

            {/* Item do Planejamento */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Item do Planejamento
              </label>
              <select
                value={formData.itemPlanejamentoId}
                onChange={(e) => {
                  const item = PLANEJAMENTO_ITEMS.find(i => i.id === e.target.value);
                  setFormData({
                    ...formData,
                    itemPlanejamentoId: e.target.value,
                    categoria: item?.categoria || '',
                  });
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0f3d2e] focus:border-transparent"
              >
                <option value="">Não vincular a item específico</option>
                {PLANEJAMENTO_ITEMS.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.item} - {item.categoria}
                  </option>
                ))}
              </select>
              {selectedItem && (
                <div className="mt-2 p-3 bg-[#0f3d2e]/5 rounded-lg border border-[#0f3d2e]/10">
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Categoria:</span> {selectedItem.categoria}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    <span className="font-medium">Orçado:</span> R$ {selectedItem.totalOrcado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              )}
            </div>

            {/* Categoria (manual se não vincular) */}
            {!formData.itemPlanejamentoId && (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Categoria <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.categoria}
                  onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                  placeholder="Ex: DESPESA DE PESSOAL"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0f3d2e] focus:border-transparent"
                />
              </div>
            )}

            {/* Descrição */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Descrição <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                placeholder="Descrição da movimentação"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0f3d2e] focus:border-transparent"
              />
            </div>

            {/* Valor Unitário */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Valor Unitário <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required
                step="0.01"
                value={formData.valorUnitario}
                onChange={(e) => setFormData({ ...formData, valorUnitario: e.target.value })}
                placeholder="0,00"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0f3d2e] focus:border-transparent"
              />
            </div>

            {/* Quantidade */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Quantidade <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                required
                min="1"
                value={formData.quantidade}
                onChange={(e) => setFormData({ ...formData, quantidade: parseInt(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0f3d2e] focus:border-transparent"
              />
            </div>

            {/* Total Calculado */}
            <div className="md:col-span-2 p-4 bg-[#ffdd9a]/10 rounded-lg border border-[#ffdd9a]">
              <p className="text-lg font-semibold text-gray-900">
                Valor Total: R$ {((parseFloat(formData.valorUnitario) || 0) * formData.quantidade).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0f3d2e] focus:border-transparent"
              >
                <option value="pendente">Pendente</option>
                <option value="pago">Pago</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </div>

            {/* Favorecido */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Favorecido <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.favorecido}
                onChange={(e) => setFormData({ ...formData, favorecido: e.target.value })}
                placeholder="Nome do favorecido"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0f3d2e] focus:border-transparent"
              />
            </div>

            {/* Tipo de Documento */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo de Documento
              </label>
              <select
                value={formData.tipoDocumento}
                onChange={(e) => setFormData({ ...formData, tipoDocumento: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0f3d2e] focus:border-transparent"
              >
                <option value="CPF">CPF</option>
                <option value="CNPJ">CNPJ</option>
              </select>
            </div>

            {/* Número do Documento */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Número do Documento
              </label>
              <input
                type="text"
                value={formData.numeroDocumento}
                onChange={(e) => setFormData({ ...formData, numeroDocumento: e.target.value })}
                placeholder={formData.tipoDocumento === 'CPF' ? '000.000.000-00' : '00.000.000/0000-00'}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0f3d2e] focus:border-transparent"
              />
            </div>

            {/* Observações */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Observações
              </label>
              <textarea
                value={formData.observacoes}
                onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                rows={3}
                placeholder="Observações adicionais..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0f3d2e] focus:border-transparent resize-none"
              />
            </div>

            {/* Comprovantes */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Comprovantes
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-[#0f3d2e] transition-colors">
                <input
                  type="file"
                  id="file-upload"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <label
                  htmlFor="file-upload"
                  className="flex flex-col items-center cursor-pointer"
                >
                  <Upload className="w-10 h-10 text-gray-400 mb-2" />
                  <p className="text-sm text-gray-600 font-medium mb-1">Clique para fazer upload</p>
                  <p className="text-xs text-gray-500">PDF, JPG ou PNG (máx. 10MB)</p>
                </label>
              </div>

              {/* Lista de Comprovantes */}
              {comprovantes.length > 0 && (
                <div className="mt-4 space-y-2">
                  {comprovantes.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-gray-500" />
                        <span className="text-sm text-gray-700">{file}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                        >
                          <Download className="w-4 h-4 text-gray-600" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeComprovante(index)}
                          className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            className="px-6 py-2 bg-[#0f3d2e] text-white rounded-lg hover:bg-[#0a2b20] transition-colors"
          >
            {editData ? 'Salvar Alterações' : 'Criar Movimentação'}
          </button>
        </div>
      </div>
    </div>
  );
}
