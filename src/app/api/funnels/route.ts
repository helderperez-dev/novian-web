import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { funnelsStore, Funnel, FunnelType } from '@/lib/store';

export const dynamic = 'force-dynamic';

const isUuid = (value: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const mapStageColorToClass = (title: string, color: string | null) => {
    if (color?.includes('border-')) {
        return color;
    }

    const byTitle: Record<string, string> = {
        'novo lead': 'border-blue-500/30 text-blue-400 bg-blue-500/10',
        'qualificação': 'border-purple-500/30 text-purple-400 bg-purple-500/10',
        'qualificacao': 'border-purple-500/30 text-purple-400 bg-purple-500/10',
        'agendado': 'border-yellow-500/30 text-yellow-400 bg-yellow-500/10',
        'atendimento': 'border-yellow-500/30 text-yellow-400 bg-yellow-500/10',
        'proposta': 'border-orange-500/30 text-orange-400 bg-orange-500/10',
        'proposta gerada': 'border-orange-500/30 text-orange-400 bg-orange-500/10',
        'fechado': 'border-green-500/30 text-green-400 bg-green-500/10',
        'captado': 'border-green-500/30 text-green-400 bg-green-500/10',
        'análise de ia': 'border-purple-500/30 text-purple-400 bg-purple-500/10',
        'analise da ia': 'border-purple-500/30 text-purple-400 bg-purple-500/10',
        'contato feito': 'border-orange-500/30 text-orange-400 bg-orange-500/10',
        'oportunidades (web)': 'border-blue-500/30 text-blue-400 bg-blue-500/10',
    };

    return byTitle[title.trim().toLowerCase()] || 'border-blue-500/30 text-blue-400 bg-blue-500/10';
};

const normalizeDbFunnel = (row: {
    id: string;
    name: string;
    type: string;
    stages?: Array<{ id: string; title: string; color: string | null; order: number }>;
}): Funnel => ({
    id: row.id,
    name: row.name,
    type: row.type === 'captacao' ? 'captacao' : 'lead',
    columns: (row.stages || [])
        .sort((a, b) => a.order - b.order)
        .map((stage) => ({
            id: stage.id,
            title: stage.title,
            color: mapStageColorToClass(stage.title, stage.color || null),
        })),
});

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const requestedType = searchParams.get('type') as FunnelType | null;

        const { data, error } = await supabase
            .from('funnels')
            .select('id, name, type, stages:funnel_stages(id, title, color, order)')
            .order('id', { ascending: true });

        if (error) {
            throw error;
        }

        const dbFunnels = (data || []).map((row) =>
            normalizeDbFunnel({
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

        const leadFunnels = dbFunnels.filter((funnel) => funnel.type === 'lead');
        const captacaoFunnels = dbFunnels.filter((funnel) => funnel.type === 'captacao');

        const funnels =
            requestedType === 'lead'
                ? leadFunnels
                : requestedType === 'captacao'
                    ? captacaoFunnels
                    : [...leadFunnels, ...captacaoFunnels];

        if (requestedType === 'lead' && funnels.length === 0) {
            return NextResponse.json({ funnels: Array.from(funnelsStore.values()) });
        }

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

        const funnelId = isUuid(funnel.id) ? funnel.id : crypto.randomUUID();
        const { error: funnelError } = await supabase
            .from('funnels')
            .upsert({
                id: funnelId,
                name: funnel.name.trim(),
                type: funnelType,
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
                type: funnelType,
                columns: normalizedColumns,
            } satisfies Funnel,
        });
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
