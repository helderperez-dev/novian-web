import { NextResponse } from "next/server";
import { requireInternalApiUser } from "@/lib/api-auth";
import { deletePropertyAdmin, listAllProperties, createPropertyAdmin, updatePropertyAdmin } from "@/lib/properties";
import { getProperties, getPropertyFields } from "@/lib/store";

export async function GET() {
    try {
        const [appUser, fields] = await Promise.all([requireInternalApiUser(), getPropertyFields()]);
        const properties = appUser ? await listAllProperties() : (await getProperties()).filter((property) => property.status === "active");

        return NextResponse.json({ properties, fields });
    } catch (error) {
        console.error("Error loading properties:", error);
        return NextResponse.json({ properties: [], fields: [], error: "Failed to load properties" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    const appUser = await requireInternalApiUser();
    if (!appUser) {
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        
        // Ensure slug is created if missing
        if (!body.slug && body.title) {
            body.slug = body.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");
        }
        
        if (body.id) {
            const updatedProperty = await updatePropertyAdmin(body.id, body);
            return NextResponse.json({ success: true, property: updatedProperty });
        } else {
            const newProperty = await createPropertyAdmin(body);
            return NextResponse.json({ success: true, property: newProperty });
        }
    } catch (error) {
        console.error("Error saving property:", error);
        return NextResponse.json({ success: false, error: "Failed to save property" }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    const appUser = await requireInternalApiUser();
    if (!appUser) {
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    try {
        const url = new URL(req.url);
        const id = url.searchParams.get("id");
        
        if (!id) {
            return NextResponse.json({ success: false, error: "Property ID is required" }, { status: 400 });
        }
        
        await deletePropertyAdmin(id);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error deleting property:", error);
        return NextResponse.json({ success: false, error: "Failed to delete property" }, { status: 500 });
    }
}
