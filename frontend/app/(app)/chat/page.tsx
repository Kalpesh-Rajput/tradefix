import { redirect } from "next/navigation";

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const question = params.q?.trim();
  redirect(question ? `/tradefiz-ai/chat?q=${encodeURIComponent(question)}` : "/tradefiz-ai/chat");
}
