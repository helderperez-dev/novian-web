import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

const defaultProperties = [
    {
        title: "Mansão Suspensa no Itaim",
        slug: "mansao-suspensa-itaim",
        description: "Exclusividade e luxo no coração de São Paulo. Ambientes integrados com vista panorâmica da cidade, projeto assinado por arquiteto renomado e acabamentos em mármore italiano.",
        price: 15000000,
        status: 'active',
        address: "Rua Amauri, 123 - Itaim Bibi, São Paulo - SP",
        map_embed_url: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3656.762963162063!2d-46.68537502444315!3d-23.576921378789512!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x94ce5771804f58c7%3A0x6b4fb6c172d1d053!2sR.%20Amauri%20-%20Itaim%20Bibi%2C%20S%C3%A3o%20Paulo%20-%20SP!5e0!3m2!1spt-BR!2sbr!4v1713364448552!5m2!1spt-BR!2sbr",
        cover_image: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&q=80&w=1200",
        images: [
            "https://images.unsplash.com/photo-1600607687931-cece5ce21448?auto=format&fit=crop&q=80&w=800",
            "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&q=80&w=800",
            "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&q=80&w=800",
            "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&q=80&w=800"
        ],
        custom_data: {
            "area": 450,
            "bedrooms": 4,
            "parking": 5
        },
        landing_page: {
            heroTitle: "Viva o Extraordinário",
            heroSubtitle: "A mansão suspensa que redefine o conceito de luxo urbano.",
            callToActionText: "Agendar Visita Exclusiva",
            primaryColor: "#DEC0A6",
            showLeadMagnet: true,
            leadMagnetTitle: "Baixar Book do Imóvel"
        }
    },
    {
        title: "Cobertura Duplex em Moema",
        slug: "cobertura-duplex-moema",
        description: "Cobertura recém-reformada, com piscina privativa, espaço gourmet e vista livre para o Parque Ibirapuera. Suíte master com closet sr e sra.",
        price: 8500000,
        status: 'active',
        address: "Av. Sabiá, 456 - Moema, São Paulo - SP",
        map_embed_url: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3656.326210345638!2d-46.66685162444265!3d-23.592618978778643!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x94ce5a183577d483%3A0xcb1dbec4c51b72a6!2sAv.%20Sabi%C3%A1%20-%20Indian%C3%B3polis%2C%20S%C3%A3o%20Paulo%20-%20SP!5e0!3m2!1spt-BR!2sbr!4v1713364660341!5m2!1spt-BR!2sbr",
        cover_image: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&q=80&w=1200",
        images: [
            "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&q=80&w=800",
            "https://images.unsplash.com/photo-1502672260266-1c1de2422008?auto=format&fit=crop&q=80&w=800",
            "https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&q=80&w=800"
        ],
        custom_data: {
            "area": 320,
            "bedrooms": 3,
            "parking": 4
        },
        landing_page: {
            heroTitle: "A Sua Vista Definitiva",
            heroSubtitle: "Sofisticação e conforto com o Parque Ibirapuera aos seus pés.",
            callToActionText: "Falar com um Consultor",
            primaryColor: "#5B7570",
            showLeadMagnet: false
        }
    }
];

async function seed() {
    console.log("Seeding properties...");
    const { data, error } = await supabase.from('properties').insert(defaultProperties).select();
    if (error) {
        console.error("Error inserting properties:", error);
    } else {
        console.log("Inserted properties:", data.length);
    }
}

seed().catch(console.error);
