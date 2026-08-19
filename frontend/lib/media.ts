const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8001";

/** Resolve API-relative media paths (e.g. /uploads/…) for <img src>. */
export function mediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (
    path.startsWith("http://") ||
    path.startsWith("https://") ||
    path.startsWith("blob:") ||
    path.startsWith("data:")
  ) {
    return path;
  }
  return `${API_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export { API_URL };
