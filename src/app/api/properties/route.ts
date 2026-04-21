import { NextResponse } from 'next/server';
import { getProperties, getPropertyFields, createProperty, updateProperty, deleteProperty } from '@/lib/store';

export async function GET() {
    const properties = await getProperties();
    const fields = await getPropertyFields();
    
    return NextResponse.json({ properties, fields });
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        
        // Ensure slug is created if missing
        if (!body.slug && body.title) {
            body.slug = body.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
        }
        
        if (body.id) {
            const updatedProperty = await updateProperty(body.id, body);
            return NextResponse.json({ success: true, property: updatedProperty });
        } else {
            const newProperty = await createProperty(body);
            return NextResponse.json({ success: true, property: newProperty });
        }
    } catch (error) {
        console.error("Error saving property:", error);
        return NextResponse.json({ success: false, error: "Failed to save property" }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const url = new URL(req.url);
        const id = url.searchParams.get('id');
        
        if (!id) {
            return NextResponse.json({ success: false, error: "Property ID is required" }, { status: 400 });
        }
        
        await deleteProperty(id);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error deleting property:", error);
        return NextResponse.json({ success: false, error: "Failed to delete property" }, { status: 500 });
    }
}
