import "server-only";

import type { Database } from "@/lib/database.types";
import type { LandingPageConfig, Property } from "@/lib/store";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

type PropertyInsert = Database["public"]["Tables"]["properties"]["Insert"];
type PropertyUpdate = Database["public"]["Tables"]["properties"]["Update"];
type PropertyRow = Database["public"]["Tables"]["properties"]["Row"];

function mapPropertyRow(row: PropertyRow): Property {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug || row.id,
    description: row.description || "",
    price: row.price,
    status: row.status,
    coverImage: row.cover_image || "",
    images: row.images || [],
    address: row.address,
    mapEmbedUrl: row.map_embed_url || undefined,
    customData: (row.custom_data as Record<string, string | number | boolean>) || {},
    landingPage: (row.landing_page as unknown as LandingPageConfig) || {},
  };
}

function toPropertyInsert(data: Omit<Property, "id">): PropertyInsert {
  return {
    title: data.title,
    slug: data.slug,
    description: data.description,
    price: data.price,
    status: data.status,
    cover_image: data.coverImage,
    images: data.images,
    address: data.address,
    map_embed_url: data.mapEmbedUrl,
    custom_data: data.customData as PropertyInsert["custom_data"],
    landing_page: data.landingPage as unknown as PropertyInsert["landing_page"],
  };
}

function toPropertyUpdate(data: Partial<Property>): PropertyUpdate {
  const next: PropertyUpdate = {};

  if (data.title !== undefined) next.title = data.title;
  if (data.slug !== undefined) next.slug = data.slug;
  if (data.description !== undefined) next.description = data.description;
  if (data.price !== undefined) next.price = data.price;
  if (data.status !== undefined) next.status = data.status;
  if (data.coverImage !== undefined) next.cover_image = data.coverImage;
  if (data.images !== undefined) next.images = data.images;
  if (data.address !== undefined) next.address = data.address;
  if (data.mapEmbedUrl !== undefined) next.map_embed_url = data.mapEmbedUrl;
  if (data.customData !== undefined) next.custom_data = data.customData as PropertyUpdate["custom_data"];
  if (data.landingPage !== undefined) next.landing_page = data.landingPage as unknown as PropertyUpdate["landing_page"];

  return next;
}

export async function listAllProperties() {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase.from("properties").select("*").order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data || []).map((row) => mapPropertyRow(row as PropertyRow));
}

export async function createPropertyAdmin(data: Omit<Property, "id">) {
  const supabase = createAdminSupabaseClient();
  const { data: result, error } = await supabase
    .from("properties")
    .insert([toPropertyInsert(data)])
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return mapPropertyRow(result as PropertyRow);
}

export async function updatePropertyAdmin(id: string, data: Partial<Property>) {
  const supabase = createAdminSupabaseClient();
  const { data: result, error } = await supabase
    .from("properties")
    .update(toPropertyUpdate(data))
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return mapPropertyRow(result as PropertyRow);
}

export async function deletePropertyAdmin(id: string) {
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase.from("properties").delete().eq("id", id);

  if (error) {
    throw error;
  }
}
