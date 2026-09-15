"use client";

import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";

export type GiphyKind = "gifs" | "stickers";

export type GiphyMediaItem = {
  id: string;
  title: string;
  preview_url: string;
  url: string;
  width: number;
  height: number;
  kind: GiphyKind;
};

export type GiphySearchResponse = {
  items: GiphyMediaItem[];
  source: "giphy" | "catalog";
};

export function useGiphy(kind: GiphyKind, query: string, enabled: boolean) {
  const q = query.trim();
  return useQuery({
    queryKey: ["giphy", kind, q],
    queryFn: () =>
      api.get<GiphySearchResponse>(
        `/api/media/giphy?kind=${kind}&q=${encodeURIComponent(q)}`
      ),
    enabled,
    staleTime: 60_000,
  });
}
