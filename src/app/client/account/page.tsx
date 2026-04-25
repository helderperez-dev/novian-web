import Link from "next/link";
import AccountProfileForm from "@/components/AccountProfileForm";

export default function ClientAccountPage() {
  return (
    <div className="min-h-screen bg-[#081210] px-6 py-10 text-novian-text">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6">
          <Link
            href="/client"
            className="inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-novian-text transition-colors hover:bg-white/10"
          >
            Voltar ao portal
          </Link>
        </div>

        <AccountProfileForm />
      </div>
    </div>
  );
}
