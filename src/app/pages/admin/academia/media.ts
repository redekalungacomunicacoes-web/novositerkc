// Only canonical provider IDs enter an iframe; arbitrary HTTPS URLs are never embedded.
export function videoEmbed(
  source: string,
  value: string | null | undefined,
): string | null {
  try {
    const url = new URL(value || "");
    if (url.protocol !== "https:" || url.username || url.password || url.port)
      return null;
    if (
      source === "youtube" &&
      ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"].includes(
        url.hostname,
      )
    ) {
      const id =
        url.hostname === "youtu.be"
          ? url.pathname.slice(1)
          : url.pathname === "/watch"
            ? url.searchParams.get("v")
            : url.pathname.match(/^\/(?:embed|shorts)\/([^/]+)$/)?.[1];
      return id && /^[\w-]{11}$/.test(id)
        ? `https://www.youtube-nocookie.com/embed/${id}`
        : null;
    }
    if (
      source === "vimeo" &&
      ["vimeo.com", "www.vimeo.com", "player.vimeo.com"].includes(url.hostname)
    ) {
      const id = url.pathname.match(
        /^\/(?:video\/)?(\d+)(?:\/([a-fA-F0-9]+))?$/,
      );
      const hash = id?.[2] || url.searchParams.get("h");
      return id && (!hash || /^[a-fA-F0-9]+$/.test(hash))
        ? `https://player.vimeo.com/video/${id[1]}${hash ? `?h=${hash}` : ""}`
        : null;
    }
  } catch {
    /* invalid URL */
  }
  return null;
}
