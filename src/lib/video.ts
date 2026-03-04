export function normalizeVideoUrl(value?: string | null): string | null {
  const trimmed = (value || "").trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();

    if (host === "youtu.be") {
      const id = parsed.pathname.replace(/^\//, "").split("/")[0];
      if (!id) return null;
      parsed.hostname = "www.youtube.com";
      parsed.pathname = "/watch";
      parsed.search = "";
      parsed.searchParams.set("v", id);
      return parsed.toString();
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

export function getVideoEmbedUrl(url?: string | null): string {
  const normalized = normalizeVideoUrl(url);
  if (!normalized) return "";

  try {
    const parsed = new URL(normalized);
    const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();

    if (host.includes("youtube.com")) {
      const queryId = parsed.searchParams.get("v");
      if (queryId) return `https://www.youtube.com/embed/${queryId}`;

      const parts = parsed.pathname.split("/").filter(Boolean);
      const shortsIndex = parts.findIndex((p) => p === "shorts" || p === "embed" || p === "live");
      if (shortsIndex >= 0 && parts[shortsIndex + 1]) {
        return `https://www.youtube.com/embed/${parts[shortsIndex + 1]}`;
      }
    }

    if (host.includes("vimeo.com")) {
      const parts = parsed.pathname.split("/").filter(Boolean);
      const id = parts.reverse().find((part) => /^\d+$/.test(part));
      return id ? `https://player.vimeo.com/video/${id}` : "";
    }

    if (host.includes("drive.google.com")) {
      const parts = parsed.pathname.split("/").filter(Boolean);
      const fileIndex = parts.findIndex((part) => part === "d");
      const idFromPath = fileIndex >= 0 ? parts[fileIndex + 1] : "";
      const idFromQuery = parsed.searchParams.get("id") || "";
      const driveId = idFromPath || idFromQuery;
      return driveId ? `https://drive.google.com/file/d/${driveId}/preview` : "";
    }

    return "";
  } catch {
    return "";
  }
}

export function isYouTubeCollectionUrl(url?: string | null): boolean {
  const normalized = normalizeVideoUrl(url);
  if (!normalized) return false;

  try {
    const parsed = new URL(normalized);
    const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();
    if (!host.includes("youtube.com")) return false;
    if (parsed.searchParams.get("list")) return true;

    return /\/(channel|@|c\/|user\/)/i.test(parsed.pathname);
  } catch {
    return false;
  }
}
