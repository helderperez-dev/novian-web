import { redirect } from "next/navigation";

export default function AdminAccountPage() {
  redirect("/admin/settings?tab=profile");
}
