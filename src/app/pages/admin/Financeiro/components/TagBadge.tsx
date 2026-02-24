import { Tag } from "../types/financial";

export function TagBadge({ tag }: { tag: Tag }) {
  return (
    <span className="rounded-full px-2 py-0.5 text-xs font-medium text-white" style={{ backgroundColor: tag.color || "#6B7280" }}>
      {tag.name}
    </span>
  );
}
