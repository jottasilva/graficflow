import { redirect } from "next/navigation";

export default async function LegacyPublicQuotePage({
  params,
  searchParams,
}: {
  params: Promise<{ quoteId: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { quoteId } = await params;
  const { token } = await searchParams;
  const query = token ? `?token=${encodeURIComponent(token)}` : "";

  redirect(`/orcamentos/${encodeURIComponent(quoteId)}${query}`);
}
