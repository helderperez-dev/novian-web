import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/lib/database.types';

type CaptacaoLeadInsert = {
    title: string;
    preview: string;
    status: string;
    funnel_id: string;
    source: string;
    external_id: string;
    listing_url: string;
    dedupe_key: string;
    custom_data: Record<string, unknown>;
};

type NormalizedCaptacaoItem = CaptacaoLeadInsert & {
    externalId: string;
    listingUrl: string;
    dedupeKey: string;
};

const sanitizeText = (value: unknown) =>
    String(value ?? "")
        .replace(/[`"]/g, "")
        .trim();

const sanitizeUrl = (value: unknown) => {
    const cleaned = sanitizeText(value);
    return cleaned.startsWith("http") ? cleaned : "";
};

const sanitizeImages = (value: unknown) => {
    if (!Array.isArray(value)) return [];
    return value
        .map(sanitizeUrl)
        .filter(Boolean);
};

export async function POST(req: Request) {
    try {
        const apifyToken = process.env.APIFY_API_TOKEN;
        const payload = await req.json();
        const maxItems = Math.max(1, Number(payload?.maxListings || 10));
        const funnelId = sanitizeText(payload?.funnelId);

        if (!apifyToken) {
            return NextResponse.json({ error: "APIFY_API_TOKEN nao configurado no ambiente" }, { status: 500 });
        }

        if (!payload?.city || !payload?.state || !payload?.sources || !funnelId) {
            return NextResponse.json({ error: "Parametros obrigatorios ausentes" }, { status: 400 });
        }

        const funnelResponse = await supabase
            .from('funnels')
            .select('id, type, stages:funnel_stages(title, order)')
            .eq('id', funnelId)
            .eq('type', 'captacao')
            .single();

        if (funnelResponse.error || !funnelResponse.data) {
            return NextResponse.json({ error: "Funil de captação inválido." }, { status: 400 });
        }

        const firstStageTitle =
            [...(funnelResponse.data.stages || [])]
                .sort((a: { order: number }, b: { order: number }) => Number(a.order) - Number(b.order))[0]?.title ||
            "Oportunidades (Web)";

        console.log("Starting Apify scrape with payload:", payload);

        // We use Apify API to trigger the actor and get the results synchronously
        // For memory limit issues on free tier, we request a smaller memory allocation or let it default.
        // Using "run-sync-get-dataset-items" waits for completion and returns data.
        const apifyApiUrl = `https://api.apify.com/v2/acts/viralanalyzer~brazil-real-estate-scraper/run-sync-get-dataset-items?token=${apifyToken}&memory=4096`;
        
        const response = await fetch(apifyApiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Apify error:", errorText);
            throw new Error("Failed to fetch from Apify: " + errorText);
        }

        const items = await response.json();
        console.log("Apify scraped items:", items?.length);

        if (!items || items.length === 0) {
             return NextResponse.json({ message: "No items found", count: 0 });
        }

        const normalizedItems: NormalizedCaptacaoItem[] = items.slice(0, maxItems).map((item: Record<string, unknown>) => {
            const source = sanitizeText(item.source || payload.sources || "apify");
            const images = sanitizeImages(item.images);
            const listingUrl = sanitizeUrl(item.url);
            const description = sanitizeText(item.description);
            const image = sanitizeUrl(
                item.image ||
                item.coverImage ||
                item.mainImage ||
                item.imageUrl ||
                images[0] ||
                ""
            );
            const locationParts = [
                sanitizeText(item.neighborhood),
                sanitizeText(item.city),
                sanitizeText(item.state),
            ].filter(Boolean);
            const descriptionParts = [
                sanitizeText(item.title),
                sanitizeText(item.amenities),
                sanitizeText(item.complexAmenities),
            ].filter(Boolean);

            return {
                externalId: sanitizeText(item.id),
                listingUrl,
                dedupeKey: listingUrl || `${sanitizeText(item.title)}|${sanitizeText(item.city || payload.city)}|${sanitizeText(item.priceFormatted || item.price)}`,
                title: sanitizeText(item.title || "Imóvel sem título"),
                preview: (description || sanitizeText(descriptionParts.join(" | "))).substring(0, 180),
                status: firstStageTitle,
                funnel_id: funnelId,
                source,
                external_id: sanitizeText(item.id),
                listing_url: listingUrl,
                dedupe_key: listingUrl || `${sanitizeText(item.title)}|${sanitizeText(item.city || payload.city)}|${sanitizeText(item.priceFormatted || item.price)}`,
                custom_data: {
                    description,
                    price: item.price || 0,
                    priceFormatted: sanitizeText(item.priceFormatted),
                    condominiumFee: item.condominiumFee || 0,
                    iptu: item.iptu || 0,
                    pricePerSqm: item.pricePerSqm || 0,
                    url: listingUrl,
                    location: locationParts.join(", "),
                    neighborhood: sanitizeText(item.neighborhood),
                    bedrooms: item.bedrooms || 0,
                    bathrooms: item.bathrooms || 0,
                    parkingSpaces: item.parkingSpaces || 0,
                    area: item.area || 0,
                    source,
                    image,
                    images,
                    imageCount: item.imageCount || images.length,
                    city: sanitizeText(item.city || payload.city),
                    state: sanitizeText(item.state || payload.state),
                    region: sanitizeText(payload.region),
                    amenities: sanitizeText(item.amenities),
                    complexAmenities: sanitizeText(item.complexAmenities),
                    publishedAt: sanitizeText(item.publishedAt),
                    scrapedAt: sanitizeText(item.scrapedAt),
                    transactionType: sanitizeText(item.transactionType || payload.transactionType || "sale"),
                    propertyType: sanitizeText(item.propertyType || payload.propertyType || "all"),
                    propertySubType: sanitizeText(item.propertySubType)
                }
            };
        });

        const existingLeadsResponse = await supabase
            .from('captacao_items')
            .select('title, dedupe_key, listing_url, custom_data')
            .eq('funnel_id', funnelId);

        if (existingLeadsResponse.error) {
            console.error("Error loading existing captacao leads:", existingLeadsResponse.error);
            throw existingLeadsResponse.error;
        }

        const existingKeys = new Set(
            (existingLeadsResponse.data || []).map((lead) => {
                const customData = (lead.custom_data || {}) as Record<string, unknown>;
                const existingUrl = sanitizeUrl(lead.listing_url || customData.url);
                return lead.dedupe_key || existingUrl || `${sanitizeText(lead.title)}|${sanitizeText(customData.city)}|${sanitizeText(customData.priceFormatted || customData.price)}`;
            }).filter(Boolean)
        );

        const seenKeys = new Set<string>();
        const newLeads: Database["public"]["Tables"]["captacao_items"]["Insert"][] = normalizedItems
            .filter((item: NormalizedCaptacaoItem) => {
                if (!item.dedupeKey) return false;
                if (existingKeys.has(item.dedupeKey)) return false;
                if (seenKeys.has(item.dedupeKey)) return false;
                seenKeys.add(item.dedupeKey);
                return true;
            })
            .map((lead: NormalizedCaptacaoItem) => ({
                title: lead.title,
                preview: lead.preview,
                status: lead.status,
                funnel_id: lead.funnel_id,
                source: lead.source,
                external_id: lead.external_id,
                listing_url: lead.listing_url,
                dedupe_key: lead.dedupe_key,
                custom_data: {
                    ...lead.custom_data,
                    externalId: lead.externalId,
                    dedupeKey: lead.dedupeKey,
                },
            }));

        if (newLeads.length === 0) {
            return NextResponse.json({
                success: true,
                count: 0,
                inserted: 0,
                skippedDuplicates: normalizedItems.length,
                message: "Todos os imóveis já estavam na captação."
            });
        }

        const { error } = await supabase.from('captacao_items').insert(newLeads);

        if (error) {
            console.error("Error inserting leads:", error);
            throw error;
        }

        return NextResponse.json({
            success: true,
            count: newLeads.length,
            inserted: newLeads.length,
            skippedDuplicates: normalizedItems.length - newLeads.length
        });

    } catch (error: unknown) {
        console.error("Captacao Scrape Error:", error);
        const errMessage = error instanceof Error ? error.message : "Failed to scrape";
        return NextResponse.json({ error: errMessage }, { status: 500 });
    }
}
