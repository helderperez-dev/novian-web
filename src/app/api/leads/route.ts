import { NextResponse } from 'next/server';
import { createLead } from '@/lib/chatStore';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const supabase = createAdminSupabaseClient();
        const { data, error } = await supabase
            .from('leads')
            .select('*')
            .neq('status', 'Oportunidades (Web)')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        // Merge Supabase leads with local memory threads if needed, or just return DB leads
        const dbLeads = data.map(row => ({
            id: row.id,
            title: row.name && row.name !== "Lead" ? row.name : `Lead: ${row.phone}`,
            phone: row.phone,
            preview: row.preview || 'Sem mensagens',
            status: row.status,
            unread: row.unread,
            score: row.score,
            funnelId: row.funnel_id,
            customData: row.custom_data || {},
            time: new Date(row.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            agentIds: [] // Will be populated dynamically if needed
        }));
        
        return NextResponse.json({ leads: dbLeads });
    } catch (e) {
        console.error('Error fetching leads:', e);
        return NextResponse.json({ leads: [] });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        
        if (!body.phone) {
            return NextResponse.json({ error: "Phone number is required" }, { status: 400 });
        }

        const newLead = await createLead({
            phone: body.phone,
            title: body.name,
            status: body.status,
            funnelId: body.funnelId,
            customData: body.customData
        });

        return NextResponse.json({ success: true, lead: newLead });
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
