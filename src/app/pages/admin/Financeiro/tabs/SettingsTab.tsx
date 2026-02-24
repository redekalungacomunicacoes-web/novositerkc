import { useState } from "react";
import { Category, Tag } from "../types/financial";

export function SettingsTab({ categories, tags, onSave }: { categories: Category[]; tags: Tag[]; onSave: (nextCategories: Partial<Category>[], nextTags: Partial<Tag>[]) => Promise<void> }) {
  const [cats, setCats] = useState(categories);
  const [tagList, setTagList] = useState(tags);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold">Categorias</h3>
        {cats.map((c, i) => <input key={c.id || i} className="mt-2 w-full rounded border p-2" value={c.name} onChange={(e) => setCats(cats.map((x, idx) => idx === i ? { ...x, name: e.target.value } : x))} />)}
        <button className="mt-2 rounded border px-3 py-1" onClick={() => setCats([...cats, { id: "", name: "", color: "#6B7280", created_at: "" } as any])}>+ Categoria</button>
      </div>
      <div>
        <h3 className="font-semibold">Tags</h3>
        {tagList.map((t, i) => <input key={t.id || i} className="mt-2 w-full rounded border p-2" value={t.name} onChange={(e) => setTagList(tagList.map((x, idx) => idx === i ? { ...x, name: e.target.value } : x))} />)}
        <button className="mt-2 rounded border px-3 py-1" onClick={() => setTagList([...tagList, { id: "", name: "", color: "#6B7280", created_at: "" } as any])}>+ Tag</button>
      </div>
      <button className="rounded bg-primary px-3 py-2 text-primary-foreground" onClick={() => onSave(cats, tagList)}>Salvar configurações</button>
    </div>
  );
}
