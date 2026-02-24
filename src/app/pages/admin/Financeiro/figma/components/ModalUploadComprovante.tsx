import { useState } from 'react';
import { X, Upload, FileText, Image as ImageIcon } from 'lucide-react';

interface ModalUploadComprovanteProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (file: File, description: string) => void;
}

export function ModalUploadComprovante({ isOpen, onClose, onUpload }: ModalUploadComprovanteProps) {
  const [description, setDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);

    // Gerar preview para imagens
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const handleSubmit = () => {
    if (selectedFile) {
      onUpload(selectedFile, description);
      handleClose();
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setPreview(null);
    setDescription('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-[#0f3d2e] to-[#0a2b20]">
          <h2 className="text-xl font-semibold text-white">Upload de Comprovante</h2>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Drag & Drop Area */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-8 transition-all ${
              dragActive
                ? 'border-[#0f3d2e] bg-[#0f3d2e]/5'
                : 'border-gray-300 hover:border-[#0f3d2e]'
            }`}
          >
            <input
              type="file"
              id="file-upload-modal"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={handleFileInputChange}
              className="hidden"
            />

            {!selectedFile ? (
              <label
                htmlFor="file-upload-modal"
                className="flex flex-col items-center cursor-pointer"
              >
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                  <Upload className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-base font-medium text-gray-700 mb-2">
                  Arraste e solte o arquivo aqui
                </p>
                <p className="text-sm text-gray-500 mb-4">ou clique para selecionar</p>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <span>PDF, JPG ou PNG</span>
                  <span>•</span>
                  <span>Máximo 10MB</span>
                </div>
              </label>
            ) : (
              <div className="flex flex-col items-center">
                {preview ? (
                  <div className="mb-4 rounded-lg overflow-hidden border border-gray-200">
                    <img
                      src={preview}
                      alt="Preview"
                      className="max-w-full max-h-64 object-contain"
                    />
                  </div>
                ) : (
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <FileText className="w-8 h-8 text-gray-400" />
                  </div>
                )}
                <p className="text-sm font-medium text-gray-700 mb-1">{selectedFile.name}</p>
                <p className="text-xs text-gray-500 mb-4">
                  {(selectedFile.size / 1024).toFixed(2)} KB
                </p>
                <label
                  htmlFor="file-upload-modal"
                  className="text-sm text-[#0f3d2e] hover:underline cursor-pointer"
                >
                  Selecionar outro arquivo
                </label>
              </div>
            )}
          </div>

          {/* Descrição */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Descrição (opcional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Adicione uma descrição ou observação sobre o comprovante..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0f3d2e] focus:border-transparent resize-none"
            />
          </div>

          {/* Info */}
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
            <div className="flex gap-3">
              <div className="flex-shrink-0">
                <ImageIcon className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h4 className="text-sm font-medium text-blue-900 mb-1">
                  Dicas para um bom comprovante
                </h4>
                <ul className="text-xs text-blue-700 space-y-1">
                  <li>• Certifique-se de que o documento está legível</li>
                  <li>• Inclua todas as informações relevantes (valor, data, favorecido)</li>
                  <li>• Evite arquivos muito grandes (máx. 10MB)</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={handleClose}
            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={!selectedFile}
            className="px-6 py-2 bg-[#0f3d2e] text-white rounded-lg hover:bg-[#0a2b20] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Enviar Comprovante
          </button>
        </div>
      </div>
    </div>
  );
}
