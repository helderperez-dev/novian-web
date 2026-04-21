import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import OpenAI from 'openai';

// Configure OpenAI SDK to use OpenRouter
const openai = new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY,
    defaultHeaders: {
        "HTTP-Referer": "https://novian.com", // Your site URL
        "X-Title": "Novian CRM", // Your site name
    }
});

export async function POST(req: Request) {
    try {
        const { leadId } = await req.json();

        if (!leadId) {
            return NextResponse.json({ error: "Lead ID is required" }, { status: 400 });
        }

        // Fetch the captacao item/property
        const { data: lead, error } = await supabase
            .from('captacao_items')
            .select('*')
            .eq('id', leadId)
            .single();

        if (error || !lead) {
            throw new Error("Lead not found");
        }

        const customData = lead.custom_data as Record<string, unknown> || {};
        
        const propertyDetails = `
            Title: ${lead.title}
            Description: ${lead.preview}
            Price: ${customData?.price}
            Location: ${customData?.location}
            URL: ${customData?.url}
        `;

        const prompt = `
            Você é um agente imobiliário sênior e especializado em captação de imóveis de alto padrão.
            Sua imobiliária se chama Novian. O objetivo é mandar uma mensagem fria pelo WhatsApp para o proprietário deste imóvel,
            com o objetivo de conseguir a exclusividade ou a permissão para trabalhar a venda do imóvel.
            A mensagem deve ser educada, profissional, elogiar o imóvel e oferecer seus serviços com diferenciais (marketing digital forte, clientela premium).
            
            Detalhes do imóvel encontrado online:
            ${propertyDetails}

            Gere APENAS o texto da mensagem, pronto para ser enviado via WhatsApp.
        `;

        const completion = await openai.chat.completions.create({
            model: "openai/gpt-4o", // You can use "anthropic/claude-3.5-sonnet" or any other from OpenRouter
            messages: [{ role: "user", content: prompt }],
            temperature: 0.7,
        });

        const draftedMessage = completion.choices[0].message.content;

        // Move to next stage: "Análise da IA" or "Proposta Gerada"
        const { error: updateError } = await supabase
            .from('captacao_items')
            .update({
                status: "Proposta Gerada",
                custom_data: {
                    ...customData,
                    drafted_proposal: draftedMessage
                }
            })
            .eq('id', leadId);

        if (updateError) throw updateError;

        return NextResponse.json({ success: true, draft: draftedMessage });

    } catch (error: unknown) {
        console.error("Drafting error:", error);
        const errMessage = error instanceof Error ? error.message : "Failed to draft";
        return NextResponse.json({ error: errMessage }, { status: 500 });
    }
}
