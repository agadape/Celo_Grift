export interface CreatorLink {
  label: string;
  url: string;
}

export interface TipGoal {
  label: string;  // e.g. "New microphone"
  target: string; // amount as string, in the chosen token's unit
  token: string;  // "CELO" | "cUSD" | "USDC" | "USDT"
}

export interface UnlockItem {
  id: string;      // stable id, used in the unlock routeId
  title: string;   // shown while locked
  price: string;   // amount as string, in the chosen token's unit
  token: string;   // "CELO" | "cUSD" | "USDC" | "USDT"
  content: string; // gated payload (URL or message) revealed after payment
}

export interface CreatorProfile {
  name: string;
  bio: string;
  avatar: string;
  links: CreatorLink[];
  goal?: TipGoal;
  unlocks?: UnlockItem[];
}

const DATA_URI_PREFIX = "data:application/json;utf8,";

export function encodeMetadata(profile: CreatorProfile): string {
  return DATA_URI_PREFIX + JSON.stringify(profile);
}

export function decodeMetadata(uri: string): CreatorProfile | null {
  if (!uri.startsWith(DATA_URI_PREFIX)) return null;
  try {
    const json = uri.slice(DATA_URI_PREFIX.length);
    const parsed = JSON.parse(json) as unknown;
    if (typeof parsed !== "object" || parsed === null) return null;
    const obj = parsed as Record<string, unknown>;

    const rawLinks = Array.isArray(obj.links) ? obj.links : [];
    const links: CreatorLink[] = rawLinks
      .filter(
        (l): l is {label: string; url: string} =>
          typeof l === "object" &&
          l !== null &&
          typeof (l as Record<string, unknown>).label === "string" &&
          typeof (l as Record<string, unknown>).url === "string",
      )
      .slice(0, 8)
      .map((l) => ({label: l.label.trim().slice(0, 40), url: l.url.trim().slice(0, 200)}));

    let goal: TipGoal | undefined;
    if (typeof obj.goal === "object" && obj.goal !== null) {
      const g = obj.goal as Record<string, unknown>;
      if (typeof g.label === "string" && typeof g.target === "string" && typeof g.token === "string") {
        goal = {label: g.label.trim().slice(0, 80), target: g.target.trim(), token: g.token.trim()};
      }
    }

    const rawUnlocks = Array.isArray(obj.unlocks) ? obj.unlocks : [];
    const unlocks: UnlockItem[] = rawUnlocks
      .filter(
        (u): u is Record<string, unknown> =>
          typeof u === "object" &&
          u !== null &&
          typeof (u as Record<string, unknown>).id === "string" &&
          typeof (u as Record<string, unknown>).title === "string" &&
          typeof (u as Record<string, unknown>).price === "string" &&
          typeof (u as Record<string, unknown>).token === "string" &&
          typeof (u as Record<string, unknown>).content === "string",
      )
      .slice(0, 12)
      .map((u) => ({
        id: String(u.id).trim().slice(0, 32),
        title: String(u.title).trim().slice(0, 80),
        price: String(u.price).trim().slice(0, 20),
        token: String(u.token).trim(),
        content: String(u.content).trim().slice(0, 500),
      }));

    return {
      name: typeof obj.name === "string" ? obj.name.trim() : "",
      bio: typeof obj.bio === "string" ? obj.bio.trim() : "",
      avatar: typeof obj.avatar === "string" ? obj.avatar.trim() : "",
      links,
      goal,
      unlocks: unlocks.length > 0 ? unlocks : undefined,
    };
  } catch {
    return null;
  }
}
