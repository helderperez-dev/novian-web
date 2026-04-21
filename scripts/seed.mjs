import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log("Supabase URL:", supabaseUrl);

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
        title: "Apartamento Vista Centrale - Malota",
        slug: "apartamento-vista-centrale-malota",
        description: "Descubra o conforto e a praticidade de viver no Condomínio Vista Centrale...",
        price: 700000,
        status: 'active',
        address: "Condomínio Vista Centrale - Bairro Malota, Jundiaí - SP",
        map_embed_url: "",
        cover_image: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&q=80&w=1200",
        images: [],
        custom_data: {
            "area": 71,
            "bedrooms": 3,
            "parking": 1
        },
        landing_page: {
            heroTitle: "Seu Novo Lar na Malota",
            heroSubtitle: "Praticidade, conforto e economia no Condomínio Vista Centrale. Pronto para morar.",
            callToActionText: "Agendar Visita Agora",
            primaryColor: "#9B8A7A",
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
