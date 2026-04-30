// Encode media URL + reaction + text into a single on-chain message string.
// Format: [m]<url> <reaction> <text>  (reaction/text optional)
// The [m] prefix lets the overlay detect and extract the media URL.

export function buildMessage(text: string, reaction: string, mediaUrl: string): string {
  const body = reaction ? `${reaction} ${text}`.trim() : text.trim();
  if (!mediaUrl.trim()) return body;
  const encoded = `[m]${mediaUrl.trim()} ${body}`.trimEnd();
  return encoded.slice(0, 400);
}

export function parseMedia(msg: string): {mediaUrl: string; text: string} {
  if (!msg.startsWith("[m]")) return {mediaUrl: "", text: msg};
  const rest = msg.slice(3);
  const spaceIdx = rest.indexOf(" ");
  if (spaceIdx < 0) return {mediaUrl: rest, text: ""};
  return {mediaUrl: rest.slice(0, spaceIdx), text: rest.slice(spaceIdx + 1)};
}

export function getYoutubeId(url: string): string | null {
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
  );
  return m ? m[1] : null;
}

export type MediaKind = "youtube" | "image";

export function getMediaKind(url: string): MediaKind | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (host.includes("youtube.com") || host.includes("youtu.be")) return "youtube";
    if (
      host.includes("giphy.com") ||
      host.includes("tenor.com") ||
      host.includes("imgur.com") ||
      /\.(gif|jpe?g|png|webp)(\?|$)/i.test(u.pathname)
    )
      return "image";
    return null;
  } catch {
    return null;
  }
}

export function isValidMediaUrl(url: string): boolean {
  if (!url.trim()) return true;
  return getMediaKind(url) !== null;
}

export function mediaHint(url: string): string {
  const kind = getMediaKind(url);
  if (kind === "youtube") return "✓ YouTube video";
  if (kind === "image") return "✓ Image / GIF";
  if (url.trim()) return "Paste a YouTube link, GIF URL, or image URL";
  return "";
}
