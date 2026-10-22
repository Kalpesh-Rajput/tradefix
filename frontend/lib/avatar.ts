export type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl" | "profile";

export const AVATAR_SIZES: Record<AvatarSize, number> = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 56,
  xl: 80,
  profile: 120,
};

export function resolveAvatarSize(size: AvatarSize | number): number {
  return typeof size === "number" ? size : AVATAR_SIZES[size];
}

function identitySource(name?: string | null, email?: string | null): string {
  const trimmed = (name ?? "").trim();
  if (trimmed) return trimmed;
  return (email ?? "").split("@")[0].trim();
}

/** "Kalpesh Rajput" -> "KR", "Kalpesh" -> "K", nothing -> "". */
export function avatarInitials(name?: string | null, email?: string | null): string {
  const parts = identitySource(name, email)
    .split(/[\s._-]+/)
    .filter(Boolean);
  if (parts.length === 0) return "";
  const first = Array.from(parts[0])[0] ?? "";
  const last = parts.length > 1 ? (Array.from(parts[parts.length - 1])[0] ?? "") : "";
  return (first + last).toUpperCase();
}

const HUES = [262, 222, 190, 160, 28, 340, 292, 205] as const;

function hash(value: string): number {
  let h = 5381;
  for (let i = 0; i < value.length; i += 1) h = ((h << 5) + h + value.charCodeAt(i)) >>> 0;
  return h;
}

/** Deterministic background for initials; white text keeps AA contrast on every hue. */
export function avatarColors(name?: string | null, email?: string | null): { from: string; to: string } {
  const key = identitySource(name, email).toLowerCase() || (email ?? "").toLowerCase();
  const hue = HUES[hash(key) % HUES.length];
  return { from: `hsl(${hue} 52% 40%)`, to: `hsl(${(hue + 24) % 360} 48% 30%)` };
}
