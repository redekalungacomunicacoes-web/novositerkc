import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/app/components/ui/dialog";
import { Category, Movement, MovementInput, Tag } from "../types/financial";
import { useFinance } from "../hooks/useFinance";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId: string;
  movement?: Movement | null;
  categories: Category[];
  tags: Tag[];
  onSaved: () => void;
}

export function MovementModal({ open, onOpenChange, projectId, movement, categories, tags, onSaved }: Props) {
  const finance = useFinance();
  const [form, setForm] = useState<MovementInput>({
    date: new Date().toISOString().slice(0, 10),
    type: "saida",
    description: "",
    category_id: null,
    unit_value: 0,
    quantity: 1,
    status: "pendente",
    cost_center: "",
    notes: "",
    tag_ids: [],
  });
  const [files, setFiles] = useState<FileList | null>(null);

  useEffect(() => {
    if (movement) {
      setForm({
        date: movement.date,
        type: movement.type,
        description: movement.description,
        category_id: movement.category_id,
        unit_value: Number(movement.unit_value),
        quantity: Number(movement.quantity),
        status: movement.status,
        cost_center: movement.cost_center || "",
        notes: movement.notes || "",
        tag_ids: (movement.tags || []).map((t) => t.id),
      });
    }
  }, [movement]);

  const save = async () => {
    const res = movement
      ? await finance.updateMovement(movement.id, form)
      : await finance.createMovement(projectId, form);

    if ((res as any).error) {
      alert((res as any).error.message);
      return;
    }

    const movementId = movement?.id || (res as any).data?.id;
    if (files?.length && movementId) {
      for (const file of Array.from(files)) {
        await finance.uploadAttachment(file, projectId, movementId);
      }
    }

    onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{movement ? "Editar movimentação" : "Nova movimentação"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <input type="date" className="rounded border p-2" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <select className="rounded border p-2" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as any })}>
            <option value="entrada">Entrada</option><option value="saida">Saída</option>
          </select>
          <input className="col-span-2 rounded border p-2" placeholder="Descrição" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <select className="rounded border p-2" value={form.category_id || ""} onChange={(e) => setForm({ ...form, category_id: e.target.value || null })}>
            <option value="">Sem categoria</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="rounded border p-2" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as any })}>
            <option value="pendente">Pendente</option><option value="pago">Pago</option><option value="cancelado">Cancelado</option>
          </select>
          <input type="number" step="0.01" className="rounded border p-2" placeholder="Valor unitário" value={form.unit_value} onChange={(e) => setForm({ ...form, unit_value: Number(e.target.value) })} />
          <input type="number" step="0.01" className="rounded border p-2" placeholder="Quantidade" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} />
          <input className="rounded border p-2" placeholder="Centro de custo" value={form.cost_center || ""} onChange={(e) => setForm({ ...form, cost_center: e.target.value })} />
          <select multiple className="rounded border p-2 h-24" value={form.tag_ids || []} onChange={(e) => setForm({ ...form, tag_ids: Array.from(e.target.selectedOptions).map((v) => v.value) })}>
            {tags.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <textarea className="col-span-2 rounded border p-2" placeholder="Observações" value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <input type="file" multiple className="col-span-2" onChange={(e) => setFiles(e.target.files)} />
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <button className="rounded border px-3 py-2 text-sm" onClick={() => onOpenChange(false)}>Cancelar</button>
          <button className="rounded bg-primary px-3 py-2 text-sm text-primary-foreground" onClick={save}>Salvar</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
