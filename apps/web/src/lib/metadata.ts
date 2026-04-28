export interface CreatorLink {
  label: string;
  url: string;
}

export interface TipGoal {
  label: string;  // e.g. "New microphone"
  target: string; // amount as string, in the chosen token's unit
  token: string;  // "CELO" | "cUSD" | "USDC" | "USDT"
}

export interface CreatorProfile {
  name: string;
  bio: string;
  avatar: string;
  links: CreatorLink[];
  goal?: TipGoal;
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

    return {
      name: typeof obj.name === "string" ? obj.name.trim() : "",
      bio: typeof obj.bio === "string" ? obj.bio.trim() : "",
      avatar: typeof obj.avatar === "string" ? obj.avatar.trim() : "",
      links,
      goal,
    };
  } catch {
    return null;
  }
}
