import { NextResponse } from "next/server";

const ALLOWED_IMAGE_HOSTNAMES = new Set(["img.olx.com.br"]);

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isAllowedImageUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && ALLOWED_IMAGE_HOSTNAMES.has(parsed.hostname);
  } catch {
    return false;
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sourceUrl = searchParams.get("src") || "";

  if (!isAllowedImageUrl(sourceUrl)) {
    return NextResponse.json({ error: "Invalid image source" }, { status: 400 });
  }

  try {
    const upstream = await fetch(sourceUrl, {
      headers: {
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        Referer: "https://www.olx.com.br/",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
      },
      cache: "force-cache",
    });

    if (!upstream.ok) {
      return new NextResponse(null, { status: upstream.status });
    }

    const contentType = upstream.headers.get("content-type") || "image/webp";
    const cacheControl =
      upstream.headers.get("cache-control") || "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800";
    const imageBuffer = await upstream.arrayBuffer();

    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        "Cache-Control": cacheControl,
        "Content-Type": contentType,
      },
    });
  } catch (error) {
    console.error("Image proxy GET error:", error);
    return new NextResponse(null, { status: 502 });
  }
}
