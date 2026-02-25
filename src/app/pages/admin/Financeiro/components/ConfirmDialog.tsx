import { useState } from "react";
import { Button } from "../figma/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../figma/components/ui/dialog";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}

export function ConfirmDialog({ open, title, description, onCancel, onConfirm }: ConfirmDialogProps) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-gray-600">{description}</p>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>Cancelar</Button>
          <Button type="button" onClick={() => void handleConfirm()} disabled={loading} className="bg-red-600 hover:bg-red-700">{loading ? "Excluindo..." : "Excluir"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
