import { requireInternalUser } from "@/lib/auth";
import AdminShell from "@/components/AdminShell";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireInternalUser();
  
  return (
    <AdminShell>
      {children}
    </AdminShell>
  );
}
