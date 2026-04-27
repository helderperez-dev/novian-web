import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { createAdminSupabaseClient } from "../supabase/admin";
import { getProperties, type Property } from "../store";
import { getPrimaryPropertyOffer } from "../property-utils";

type SupportedPropertyType = "apartment" | "house" | "land" | "commercial";

function normalizeText(value: string | null | undefined) {
    return (value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

function tokenize(value: string | null | undefined) {
    return normalizeText(value)
        .split(/\s+/)
        .filter((token) => token.length > 1);
}

function parseNumber(value: unknown): number | null {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }

    if (typeof value !== "string") {
        return null;
    }

    const trimmed = value.trim();
    if (!trimmed) {
        return null;
    }

    let normalized = trimmed.replace(/[^\d,.-]/g, "");

    if (normalized.includes(",") && normalized.includes(".")) {
        normalized = normalized.replace(/\./g, "").replace(",", ".");
    } else if (normalized.includes(",")) {
        normalized = normalized.replace(",", ".");
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
}

function normalizePropertyType(value: unknown): SupportedPropertyType | null {
    const normalized = normalizeText(typeof value === "string" ? value : "");

    if (!normalized) {
        return null;
    }

    if (["apartamento", "apartment", "apto", "cobertura", "penthouse", "flat", "loft", "studio"].some((term) => normalized.includes(term))) {
        return "apartment";
    }

    if (["casa", "house", "sobrado", "mansao", "condominio", "chacara"].some((term) => normalized.includes(term))) {
        return "house";
    }

    if (["terreno", "land", "lote"].some((term) => normalized.includes(term))) {
        return "land";
    }

    if (["comercial", "commercial", "sala comercial", "galpao", "office"].some((term) => normalized.includes(term))) {
        return "commercial";
    }

    return null;
}

function inferOfficialPropertyType(property: Property): SupportedPropertyType | null {
    const customType =
        normalizePropertyType(property.customData?.property_type) ||
        normalizePropertyType(property.customData?.propertyType);

    if (customType) {
        return customType;
    }

    return normalizePropertyType(`${property.title} ${property.description} ${property.address}`);
}

function matchesLocation(haystackParts: Array<string | null | undefined>, location: string | undefined) {
    if (!location) {
        return true;
    }

    const tokens = tokenize(location);
    if (tokens.length === 0) {
        return true;
    }

    const haystack = normalizeText(haystackParts.join(" "));
    return tokens.every((token) => haystack.includes(token));
}

function buildOfficialPropertyUrl(property: Property) {
    const customUrl = typeof property.customData?.url === "string" ? property.customData.url : null;

    if (customUrl) {
        return customUrl;
    }

    const baseUrl = process.env.NEXT_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    return property.slug ? `${baseUrl}/imoveis/${property.slug}` : undefined;
}

export const searchPropertiesTool = new DynamicStructuredTool({
    name: "search_properties",
    description: "Search for properties in the real estate database based on criteria like location, price, bedrooms, and property type.",
    schema: z.object({
        location: z.string().optional().describe("City, neighborhood, or region (e.g. 'Malota', 'Jundiaí')"),
        minPrice: z.number().optional().describe("Minimum price in BRL"),
        maxPrice: z.number().optional().describe("Maximum price in BRL"),
        minBedrooms: z.number().optional().describe("Minimum number of bedrooms"),
        propertyType: z.string().optional().describe("Desired property type. Use values like 'apartment' or 'house' when the lead specifies apartamento/casa.")
    }),
    func: async ({ location, minPrice, maxPrice, minBedrooms, propertyType }) => {
        try {
            const requestedType = normalizePropertyType(propertyType);
            const officialProperties = await getProperties();

            const combinedData: {
                id: string;
                title: string;
                price: number | null;
                offerType?: "sale" | "rent";
                address: string;
                bedrooms: number | null;
                description?: string;
                source: string;
                url?: string;
            }[] = officialProperties
                .filter((property) => property.status === "active")
                .filter((property) =>
                    matchesLocation(
                        [
                            property.title,
                            property.address,
                            property.description,
                            String(property.customData?.neighborhood || ""),
                            String(property.customData?.city || ""),
                        ],
                        location,
                    ),
                )
                .filter((property) => {
                    const primaryOffer = getPrimaryPropertyOffer(property);
                    const comparablePrice = primaryOffer?.price ?? property.price;
                    return minPrice ? comparablePrice >= minPrice : true;
                })
                .filter((property) => {
                    const primaryOffer = getPrimaryPropertyOffer(property);
                    const comparablePrice = primaryOffer?.price ?? property.price;
                    return maxPrice ? comparablePrice <= maxPrice : true;
                })
                .filter((property) => {
                    const bedrooms = parseNumber(property.customData?.bedrooms);
                    return minBedrooms ? bedrooms !== null && bedrooms >= minBedrooms : true;
                })
                .filter((property) => (requestedType ? inferOfficialPropertyType(property) === requestedType : true))
                .map((property) => {
                    const primaryOffer = getPrimaryPropertyOffer(property);
                    return {
                    id: property.id,
                    title: property.title,
                    price: primaryOffer?.price ?? property.price,
                    offerType: primaryOffer?.offerType,
                    propertyOffers: property.offers?.length
                        ? property.offers
                        : primaryOffer
                          ? [primaryOffer]
                          : [],
                    address: property.address,
                    bedrooms: parseNumber(property.customData?.bedrooms),
                    description: property.description?.substring(0, 150),
                    source: "Official Portfolio",
                    url: buildOfficialPropertyUrl(property),
                    };
                });

            const filteredData = combinedData.slice(0, 5);

            if (filteredData.length === 0) {
                return `Atenção agente: Não foi encontrado NENHUM imóvel com a localização '${location || 'todas'}' e preço '${minPrice || 0} - ${maxPrice || 'sem limite'}'. INFORME O CLIENTE QUE NÃO TEMOS NADA COM ESSAS CARACTERÍSTICAS EXATAS. NUNCA INVENTE UM IMÓVEL.`;
            }

            return JSON.stringify(filteredData);
        } catch (err) {
            return `System error: ${err}`;
        }
    },
});

export const searchLeadsTool = new DynamicStructuredTool({
    name: "search_leads",
    description: "Search for leads (potential clients or captured properties from web) in the database.",
    schema: z.object({
        query: z.string().optional().describe("Name, phone, or location to search for")
    }),
    func: async ({ query }) => {
        try {
            const leadsSupabase = createAdminSupabaseClient();
            let dbQuery = leadsSupabase
                .from("people")
                .select("id, full_name, primary_phone, crm_status, metadata")
                .not("crm_status", "is", null)
                .order("updated_at", { ascending: false });

            if (query) {
                dbQuery = dbQuery.or(`full_name.ilike.%${query}%,primary_phone.ilike.%${query}%`);
            }

            const { data, error } = await dbQuery.limit(5);

            if (error) {
                return `Error searching leads: ${error.message}`;
            }

            if (!data || data.length === 0) {
                return "No leads found.";
            }

            return JSON.stringify(data.map((lead) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const customData = lead.metadata as Record<string, any>;
                return {
                    id: lead.id,
                    name: lead.full_name,
                    phone: lead.primary_phone,
                    status: lead.crm_status,
                    price: customData?.price,
                    city: customData?.city,
                    bedrooms: customData?.bedrooms
                };
            }));
        } catch (err) {
            return `System error: ${err}`;
        }
    },
});
