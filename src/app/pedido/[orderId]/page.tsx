import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ token?: string }>;
};

export default async function LegacyPublicOrderPage({ params, searchParams }: PageProps) {
  const { orderId } = await params;
  const { token } = await searchParams;
  const query = token ? `?token=${encodeURIComponent(token)}` : "";
  redirect(`/pedidos/${encodeURIComponent(orderId)}${query}`);
}
