import { type ReactNode } from "react";
import { useDndShim } from "./dnd-core";
export const verticalListSortingStrategy = {};
export function SortableContext({ children }: { items: (string | number)[]; strategy?: unknown; children: ReactNode }) { return <>{children}</>; }
export function useSortable({ id }: { id: string | number; data?: unknown }) {
  const ctx = useDndShim();
  return { attributes: { draggable: true }, listeners: { onDragStart: () => ctx?.setActive(id) }, setNodeRef: undefined, transform: null, transition: undefined };
}
