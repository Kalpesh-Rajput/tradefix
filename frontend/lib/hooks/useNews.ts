"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { buildNewsQueryString } from "@/lib/news/format";
import type { NewsArticle, NewsFeedResponse, NewsFilterState } from "@/lib/news/types";

export const NEWS_FEED_QUERY_KEY = "news-feed";
export const NEWS_BOOKMARKS_QUERY_KEY = "news-bookmarks";

export function useNewsFeed(filters: NewsFilterState, page = 1, pageSize = 20) {
  const qc = useQueryClient();
  const qs = buildNewsQueryString(filters, page, pageSize, false);

  const query = useQuery({
    queryKey: [NEWS_FEED_QUERY_KEY, filters, page, pageSize],
    queryFn: ({ signal }) => api.get<NewsFeedResponse>(`/api/news?${qs}`, { signal }),
    staleTime: 2 * 60_000,
    retry: 1,
  });

  const forceRefresh = useMutation({
    mutationFn: () => {
      const refreshQs = buildNewsQueryString(filters, 1, pageSize, true);
      return api.get<NewsFeedResponse>(`/api/news?${refreshQs}`);
    },
    onSuccess: (data) => {
      qc.setQueryData([NEWS_FEED_QUERY_KEY, filters, 1, pageSize], data);
      qc.invalidateQueries({ queryKey: [NEWS_FEED_QUERY_KEY] });
    },
  });

  return {
    data: query.data,
    isLoading: query.isPending && !query.data,
    isFetching: query.isFetching,
    error: forceRefresh.error ?? query.error,
    refetch: query.refetch,
    refresh: () => forceRefresh.mutateAsync(),
    isRefreshing: forceRefresh.isPending,
  };
}

export function useNewsBookmarks() {
  return useQuery({
    queryKey: [NEWS_BOOKMARKS_QUERY_KEY],
    queryFn: ({ signal }) => api.get<NewsArticle[]>("/api/news/bookmarks", { signal }),
    staleTime: 60_000,
  });
}

export function useToggleNewsBookmark() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (article: NewsArticle) => {
      if (article.is_bookmarked) {
        await api.delete<void>(`/api/news/bookmarks/${encodeURIComponent(article.id)}`);
        return { action: "removed" as const, id: article.id };
      }
      const saved = await api.post<NewsArticle>("/api/news/bookmarks", {
        article_id: article.id,
        title: article.title,
        summary: article.summary ?? null,
        url: article.url,
        source: article.source,
        source_domain: article.source_domain ?? null,
        published_at: article.published_at,
        category: article.category,
        symbols: article.symbols,
        symbols_source: article.symbols_source,
        sentiment: article.sentiment ?? null,
        sentiment_score: article.sentiment_score ?? null,
        provider: article.provider,
      });
      return { action: "saved" as const, id: article.id, saved };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [NEWS_BOOKMARKS_QUERY_KEY] });
      qc.invalidateQueries({ queryKey: [NEWS_FEED_QUERY_KEY] });
    },
  });
}
