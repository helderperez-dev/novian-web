import { NextResponse } from "next/server";
import { requireInternalApiUser } from "@/lib/api-auth";
import { deletePropertyAdmin, listAllProperties, createPropertyAdmin, updatePropertyAdmin } from "@/lib/properties";
import { getProperties, getPropertyFields } from "@/lib/store";

export async function GET() {
    try {
        const [appUser, fields] = await Promise.all([requireInternalApiUser(), getPropertyFields()]);
        let degraded = false;
        let properties;

        if (appUser) {
            try {
                properties = await listAllProperties();
            } catch (error) {
                console.error("Error loading admin properties from Supabase:", error);
                properties = await getProperties();
                degraded = true;
            }
        } else {
            properties = (await getProperties()).filter((property) => property.status === "active");
        }

        return NextResponse.json({ properties, fields, degraded });
    } catch (error) {
        console.error("Error loading properties:", error);
        const [properties, fields] = await Promise.all([getProperties(), getPropertyFields()]);
        return NextResponse.json({
            properties: properties.filter((property) => property.status === "active"),
            fields,
            degraded: true,
            error: "Failed to load properties",
        });
    }
}

export async function POST(req: Request) {
    const appUser = await requireInternalApiUser();
    if (!appUser) {
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        
        // Never allow null status to reach Postgres (properties.status is NOT NULL).
        if (body?.id) {
            if (body.status == null || body.status === "") {
                delete body.status;
            }
        } else {
            if (body.status == null || body.status === "") {
                body.status = "active";
            }
        }
        
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
