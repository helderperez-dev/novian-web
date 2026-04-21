import { NextResponse } from 'next/server';
import { updateLeadStatus, updateLead, deleteLead } from '@/lib/chatStore';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const decodedId = decodeURIComponent(id);
        const body = await req.json();
        
        if (body.status !== undefined) {
            await updateLeadStatus(decodedId, body.status);
        } else {
            // General update
            await updateLead(decodedId, body);
        }

        return NextResponse.json({ success: true });
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const decodedId = decodeURIComponent(id);
        
        await deleteLead(decodedId);

        return NextResponse.json({ success: true });
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
