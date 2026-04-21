import { requireClientUser } from "@/lib/auth";

export default async function ClientLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireClientUser();
  return children;
}
