/**
 * Extract a YouTube video ID from any common URL form, or return null.
 * Supported:
 *  - https://www.youtube.com/watch?v=VIDEOID
 *  - https://youtu.be/VIDEOID
 *  - https://www.youtube.com/embed/VIDEOID
 *  - https://www.youtube.com/shorts/VIDEOID
 */
export function getYoutubeId(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const trimmed = url.trim();
    // youtu.be/ID
    const short = trimmed.match(/youtu\.be\/([A-Za-z0-9_-]{6,})/);
    if (short?.[1]) return short[1];
    // youtube.com/watch?v=ID
    const watch = trimmed.match(/[?&]v=([A-Za-z0-9_-]{6,})/);
    if (watch?.[1]) return watch[1];
    // youtube.com/embed/ID or /shorts/ID
    const path = trimmed.match(/youtube\.com\/(?:embed|shorts)\/([A-Za-z0-9_-]{6,})/);
    if (path?.[1]) return path[1];
    return null;
  } catch {
    return null;
  }
}

export function getYoutubeEmbedUrl(url: string | null | undefined): string | null {
  const id = getYoutubeId(url);
  return id ? `https://www.youtube.com/embed/${id}` : null;
}

export function getYoutubeThumbnail(url: string | null | undefined): string | null {
  const id = getYoutubeId(url);
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
}
