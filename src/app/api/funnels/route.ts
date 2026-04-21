import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { funnelsStore, Funnel, FunnelType } from '@/lib/store';

export const dynamic = 'force-dynamic';

const isUuid = (value: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const normalizeLeadFunnel = (funnel: Funnel): Funnel => ({
    ...funnel,
    type: funnel.type || 'lead',
});

const normalizeCaptacaoFunnel = (row: {
    id: string;
    name: string;
    type: string;
    stages?: Array<{ id: string; title: string; color: string | null; order: number }>;
}): Funnel => ({
    id: row.id,
    name: row.name,
    type: 'captacao',
    columns: (row.stages || [])
        .sort((a, b) => a.order - b.order)
        .map((stage) => ({
            id: stage.id,
            title: stage.title,
            color: stage.color || 'border-blue-500/30 text-blue-400 bg-blue-500/10',
        })),
});

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const requestedType = searchParams.get('type') as FunnelType | null;

        const leadFunnels = Array.from(funnelsStore.values()).map(normalizeLeadFunnel);

        let captacaoFunnels: Funnel[] = [];
        if (!requestedType || requestedType === 'captacao') {
            const { data, error } = await supabase
                .from('funnels')
                .select('id, name, type, stages:funnel_stages(id, title, color, order)')
                .eq('type', 'captacao')
                .order('created_at', { ascending: true });

            if (error) {
                throw error;
            }

            captacaoFunnels = (data || []).map((row) =>
                normalizeCaptacaoFunnel({
                    id: String(row.id),
                    name: String(row.name),
                    type: String(row.type),
                    stages: Array.isArray(row.stages)
                        ? row.stages.map((stage: { id: string; title: string; color: string | null; order: number }) => ({
                            id: String(stage.id),
                            title: String(stage.title),
                            color: stage.color ? String(stage.color) : null,
                            order: Number(stage.order),
                        }))
                        : [],
                })
            );
        }

        const funnels =
            requestedType === 'lead'
                ? leadFunnels
                : requestedType === 'captacao'
                    ? captacaoFunnels
                    : [...leadFunnels, ...captacaoFunnels];

        return NextResponse.json({ funnels });
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const funnel: Funnel = await req.json();
        const funnelType: FunnelType = funnel.type === 'captacao' ? 'captacao' : 'lead';
        const normalizedColumns = Array.isArray(funnel.columns)
            ? funnel.columns.map((column, index) => ({
                id: isUuid(column.id) ? column.id : crypto.randomUUID(),
                title: column.title || `Etapa ${index + 1}`,
                color: column.color || 'border-blue-500/30 text-blue-400 bg-blue-500/10',
            }))
            : [];

        if (!funnel.name?.trim()) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        if (funnelType === 'lead') {
            const normalizedFunnel: Funnel = {
                id: funnel.id || `funnel-${Date.now()}`,
                name: funnel.name.trim(),
                type: 'lead',
                columns: normalizedColumns,
            };

            funnelsStore.set(normalizedFunnel.id, normalizedFunnel);

            return NextResponse.json({ success: true, funnel: normalizedFunnel });
        }

        const funnelId = isUuid(funnel.id) ? funnel.id : crypto.randomUUID();
        const { error: funnelError } = await supabase
            .from('funnels')
            .upsert({
                id: funnelId,
                name: funnel.name.trim(),
                type: 'captacao',
            });

        if (funnelError) {
            throw funnelError;
        }

        const { error: deleteStagesError } = await supabase
            .from('funnel_stages')
            .delete()
            .eq('funnel_id', funnelId);

        if (deleteStagesError) {
            throw deleteStagesError;
        }

        if (normalizedColumns.length > 0) {
            const { error: stagesError } = await supabase
                .from('funnel_stages')
                .insert(
                    normalizedColumns.map((column, index) => ({
                        id: column.id,
                        funnel_id: funnelId,
                        title: column.title,
                        color: column.color,
                        order: index,
                    }))
                );

            if (stagesError) {
                throw stagesError;
            }
        }

        return NextResponse.json({
            success: true,
            funnel: {
                id: funnelId,
                name: funnel.name.trim(),
                type: 'captacao',
                columns: normalizedColumns,
            } satisfies Funnel,
        });
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
