import { NextResponse } from "next/server";
import { requireInternalApiUser } from "@/lib/api-auth";
import { listBrokerSummaries } from "@/lib/brokers";

export const dynamic = "force-dynamic";

export async function GET() {
  const appUser = await requireInternalApiUser();
  if (!appUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const brokers = await listBrokerSummaries();
    return NextResponse.json({ brokers });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to load brokers" }, { status: 500 });
  }
}
