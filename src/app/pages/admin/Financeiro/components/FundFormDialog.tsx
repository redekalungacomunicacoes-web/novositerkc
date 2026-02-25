import { useEffect, useMemo, useState } from "react";
import { Button } from "../figma/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../figma/components/ui/dialog";
import { Input } from "../figma/components/ui/input";
import { Textarea } from "../figma/components/ui/textarea";

interface FundFormDialogProps {
  open: boolean;
  mode: "create" | "edit";
  initialData?: any;
  onClose: () => void;
  onSubmit: (payload: { name: string; year: number | null; description: string | null; opening_balance: number }) => Promise<void>;
}

export function FundFormDialog({ open, mode, initialData, onClose, onSubmit }: FundFormDialogProps) {
  const [name, setName] = useState("");
  const [year, setYear] = useState<string>("");
  const [description, setDescription] = useState("");
  const [openingBalance, setOpeningBalance] = useState<string>("0");
  const [errors, setErrors] = useState<{ name?: string; opening_balance?: string }>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(initialData?.name ?? "");
    setYear(initialData?.year ? String(initialData.year) : "");
    setDescription(initialData?.description ?? "");
    setOpeningBalance(String(initialData?.opening_balance ?? 0));
    setErrors({});
  }, [open, initialData]);

  const parsedOpening = useMemo(() => Number(openingBalance), [openingBalance]);

  const submit = async () => {
    const nextErrors: { name?: string; opening_balance?: string } = {};
    if (!name.trim()) nextErrors.name = "Nome é obrigatório";
    if (Number.isNaN(parsedOpening) || parsedOpening < 0) nextErrors.opening_balance = "Saldo inicial deve ser maior ou igual a zero";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSaving(true);
    try {
      await onSubmit({
        name: name.trim(),
        year: year ? Number(year) : null,
        description: description.trim() || null,
        opening_balance: parsedOpening,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Novo Fundo" : "Editar Fundo"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Nome</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
            {errors.name ? <p className="mt-1 text-xs text-red-600">{errors.name}</p> : null}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Ano</label>
            <Input type="number" value={year} onChange={(e) => setYear(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Descrição</label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Saldo Inicial</label>
            <Input type="number" min="0" step="0.01" value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value)} />
            {errors.opening_balance ? <p className="mt-1 text-xs text-red-600">{errors.opening_balance}</p> : null}
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="button" onClick={() => void submit()} disabled={saving} className="bg-[#0f3d2e] hover:bg-[#0a2b20]">{saving ? "Salvando..." : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
