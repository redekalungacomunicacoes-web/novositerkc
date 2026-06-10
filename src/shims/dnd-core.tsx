import { createContext, useContext, useState, type DragEvent, type ReactNode } from "react";
export type DragEndEvent = { active: { id: string | number }; over: { id: string | number } | null };
type Ctx = { setActive: (id: string | number) => void };
const DndCtx = createContext<Ctx | null>(null);
export function DndContext({ children, onDragEnd }: { children: ReactNode; onDragEnd?: (event: DragEndEvent) => void }) {
  const [active, setActive] = useState<string | number | null>(null);
  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const section = (event.target as HTMLElement).closest("section[id]");
    if (active) onDragEnd?.({ active: { id: active }, over: section?.id ? { id: section.id } : null });
    setActive(null);
  }
  return <DndCtx.Provider value={{ setActive }}><div onDragOver={(event) => event.preventDefault()} onDrop={handleDrop}>{children}</div></DndCtx.Provider>;
}
export function useDndShim() { return useContext(DndCtx); }
