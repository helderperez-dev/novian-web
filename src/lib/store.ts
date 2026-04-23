import { supabase } from "./supabase";
import { Database } from "./database.types";

export interface ChatMessage {
    id: string;
    threadId: string;
    agent: string;
    role: string;
    content: string;
    time: string;
    isSystem?: boolean;
}

export interface CustomField {
    id: string;
    name: string;
    type: 'text' | 'number' | 'dropdown' | 'date';
    options?: string[]; // For dropdowns
    required: boolean;
}

export interface FunnelColumn {
    id: string;
    title: string;
    color: string;
}

export type FunnelType = 'lead' | 'captacao';

export interface Funnel {
    id: string;
    name: string;
    type: FunnelType;
    columns: FunnelColumn[];
}

export interface Thread {
    id: string;
    title: string;
    preview: string;
    time: string;
    unread: boolean;
    phone: string;
    agentIds: string[];
    status?: string; // e.g., 'novo', 'qualificacao', 'atendimento', 'proposta', 'fechado'
    score?: number;
    funnelId?: string;
    customData?: Record<string, string | number | boolean | string[] | null>;
}

export interface AgentConfig {
    id: string;
    name: string;
    role: string;
    systemPrompt: string;
    modules?: string[];
    knowledgeBase?: string;
}

export interface LandingPageConfig {
    heroTitle: string;
    heroSubtitle: string;
    callToActionText: string;
    primaryColor: string;
    showLeadMagnet: boolean;
    leadMagnetTitle?: string;
    leadMagnetFileUrl?: string;
}

export interface Property {
    id: string;
    title: string;
    slug: string;
    description: string;
    price: number;
    status: 'active' | 'inactive' | 'sold';
    coverImage: string;
    images: string[];
    address: string;
    mapEmbedUrl?: string;
    customData: Record<string, string | number | boolean>;
    landingPage: LandingPageConfig;
}

const globalForStore = globalThis as unknown as {
    messages: ChatMessage[];
    threads: Map<string, Thread>;
    agents: Map<string, AgentConfig>;
    typing: Map<string, string | null>;
    customFields: CustomField[];
    funnels: Map<string, Funnel>;
    properties: Map<string, Property>;
    propertyFields: CustomField[];
};

const defaultProperties = new Map<string, Property>([
    ["prop-1", {
        id: "prop-1",
        title: "Mansão Suspensa no Itaim",
        slug: "mansao-suspensa-itaim",
        description: "Exclusividade e luxo no coração de São Paulo. Ambientes integrados com vista panorâmica da cidade, projeto assinado por arquiteto renomado e acabamentos em mármore italiano.",
        price: 15000000,
        status: 'active',
        address: "Rua Amauri, 123 - Itaim Bibi, São Paulo - SP",
        mapEmbedUrl: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3656.762963162063!2d-46.68537502444315!3d-23.576921378789512!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x94ce5771804f58c7%3A0x6b4fb6c172d1d053!2sR.%20Amauri%20-%20Itaim%20Bibi%2C%20S%C3%A3o%20Paulo%20-%20SP!5e0!3m2!1spt-BR!2sbr!4v1713364448552!5m2!1spt-BR!2sbr",
        coverImage: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&q=80&w=1200",
        images: [
            "https://images.unsplash.com/photo-1600607687931-cece5ce21448?auto=format&fit=crop&q=80&w=800",
            "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&q=80&w=800",
            "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&q=80&w=800",
            "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&q=80&w=800"
        ],
        customData: {
            "area": 450,
            "bedrooms": 4,
            "parking": 5
        },
        landingPage: {
            heroTitle: "Viva o Extraordinário",
            heroSubtitle: "A mansão suspensa que redefine o conceito de luxo urbano.",
            callToActionText: "Agendar Visita Exclusiva",
            primaryColor: "#DEC0A6",
            showLeadMagnet: true,
            leadMagnetTitle: "Baixar Book do Imóvel"
        }
    }],
    ["prop-2", {
        id: "prop-2",
        title: "Cobertura Duplex em Moema",
        slug: "cobertura-duplex-moema",
        description: "Cobertura recém-reformada, com piscina privativa, espaço gourmet e vista livre para o Parque Ibirapuera. Suíte master com closet sr e sra.",
        price: 8500000,
        status: 'active',
        address: "Av. Sabiá, 456 - Moema, São Paulo - SP",
        mapEmbedUrl: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3656.326210345638!2d-46.66685162444265!3d-23.592618978778643!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x94ce5a183577d483%3A0xcb1dbec4c51b72a6!2sAv.%20Sabi%C3%A1%20-%20Indian%C3%B3polis%2C%20S%C3%A3o%20Paulo%20-%20SP!5e0!3m2!1spt-BR!2sbr!4v1713364660341!5m2!1spt-BR!2sbr",
        coverImage: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&q=80&w=1200",
        images: [
            "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&q=80&w=800",
            "https://images.unsplash.com/photo-1502672260266-1c1de2422008?auto=format&fit=crop&q=80&w=800",
            "https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&q=80&w=800"
        ],
        customData: {
            "area": 320,
            "bedrooms": 3,
            "parking": 4
        },
        landingPage: {
            heroTitle: "A Sua Vista Definitiva",
            heroSubtitle: "Sofisticação e conforto com o Parque Ibirapuera aos seus pés.",
            callToActionText: "Falar com um Consultor",
            primaryColor: "#5B7570",
            showLeadMagnet: false
        }
    }],
    ["prop-3", {
        id: "prop-3",
        title: "Casa de Campo - Fazenda Boa Vista",
        slug: "casa-de-campo-fazenda-boa-vista",
        description: "O refúgio perfeito no interior paulista. Casa térrea contemporânea, assinada por Marcio Kogan. Conta com piscina com borda infinita, lago privativo e automação completa.",
        price: 25000000,
        status: 'active',
        address: "Rodovia Castello Branco, km 102 - Porto Feliz - SP",
        mapEmbedUrl: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3663.784534129532!2d-47.50201862445107!3d-23.32354427896431!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x94c5f94b15093951%3A0xcf82c40c8d17ddcc!2sFazenda%20Boa%20Vista!5e0!3m2!1spt-BR!2sbr!4v1713364746483!5m2!1spt-BR!2sbr",
        coverImage: "https://images.unsplash.com/photo-1510798831971-661eb04b3739?auto=format&fit=crop&q=80&w=1200",
        images: [
            "https://images.unsplash.com/photo-1501183638710-841dd1904471?auto=format&fit=crop&q=80&w=800",
            "https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&q=80&w=800",
            "https://images.unsplash.com/photo-1448630360428-65456885c650?auto=format&fit=crop&q=80&w=800"
        ],
        customData: {
            "area": 1200,
            "bedrooms": 6,
            "parking": 10
        },
        landingPage: {
            heroTitle: "O Seu Refúgio de Luxo",
            heroSubtitle: "Design contemporâneo imerso na natureza da Fazenda Boa Vista.",
            callToActionText: "Receber Apresentação VIP",
            primaryColor: "#2C3E3B",
            showLeadMagnet: true,
            leadMagnetTitle: "Baixar Tour Virtual"
        }
    }],
    ["prop-4", {
        id: "prop-4",
        title: "Apartamento Garden em Pinheiros",
        slug: "apartamento-garden-pinheiros",
        description: "Um oásis particular no meio de Pinheiros. Apartamento estilo garden com 150m² de área externa privativa, paisagismo impecável e varanda gourmet integrada ao living.",
        price: 4200000,
        status: 'active',
        address: "Rua dos Pinheiros, 1000 - Pinheiros, São Paulo - SP",
        mapEmbedUrl: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3657.197541604907!2d-46.69234852444367!3d-23.561348078800164!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x94ce579cf021bb55%3A0xcb1dbec4c51b72a6!2sR.%20dos%20Pinheiros%2C%201000%20-%20Pinheiros%2C%20S%C3%A3o%20Paulo%20-%20SP!5e0!3m2!1spt-BR!2sbr!4v1713364800000!5m2!1spt-BR!2sbr",
        coverImage: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&q=80&w=1200",
        images: [
            "https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?auto=format&fit=crop&q=80&w=800",
            "https://images.unsplash.com/photo-1554995207-c18c203602cb?auto=format&fit=crop&q=80&w=800"
        ],
        customData: {
            "area": 280,
            "bedrooms": 3,
            "parking": 3
        },
        landingPage: {
            heroTitle: "Sua Casa Suspensa",
            heroSubtitle: "Privacidade de uma casa com a segurança de um apartamento.",
            callToActionText: "Agendar Visita",
            primaryColor: "#A6C1DE",
            showLeadMagnet: false
        }
    }],
    ["prop-5", {
        id: "prop-5",
        title: "Penthouse com Piscina nos Jardins",
        slug: "penthouse-piscina-jardins",
        description: "Penthouse espetacular nos Jardins com vista 360º. Possui piscina aquecida de borda infinita no rooftop, área de convivência completa e suíte master de 100m².",
        price: 22000000,
        status: 'active',
        address: "Rua Oscar Freire, 500 - Cerqueira César, São Paulo - SP",
        mapEmbedUrl: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3657.197541604907!2d-46.66685162444265!3d-23.561348078800164!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x94ce59cd38a20999%3A0xcb1dbec4c51b72a6!2sR.%20Oscar%20Freire%2C%20500%20-%20Cerqueira%20C%C3%A9sar%2C%20S%C3%A3o%20Paulo%20-%20SP!5e0!3m2!1spt-BR!2sbr!4v1713364900000!5m2!1spt-BR!2sbr",
        coverImage: "https://images.unsplash.com/photo-1613490900233-141c5560d75d?auto=format&fit=crop&q=80&w=1200",
        images: [
            "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&q=80&w=800",
            "https://images.unsplash.com/photo-1512918728675-ed5a9ecdebfd?auto=format&fit=crop&q=80&w=800",
            "https://images.unsplash.com/photo-1600210492493-0946911123ea?auto=format&fit=crop&q=80&w=800"
        ],
        customData: {
            "area": 600,
            "bedrooms": 5,
            "parking": 6
        },
        landingPage: {
            heroTitle: "O Ápice do Design",
            heroSubtitle: "O céu de São Paulo como extensão da sua sala.",
            callToActionText: "Solicitar Valores e Planta",
            primaryColor: "#DEB887",
            showLeadMagnet: true,
            leadMagnetTitle: "Planta Baixa em Alta Resolução"
        }
    }],
    ["prop-6", {
        id: "prop-6",
        title: "Casa em Condomínio - Alphaville",
        slug: "casa-condominio-alphaville",
        description: "Projeto contemporâneo impecável no Residencial 1. Ambientes em conceito aberto, esquadrias do chão ao teto, piscina com borda infinita e fire pit.",
        price: 18500000,
        status: 'active',
        address: "Alphaville Residencial 1, Barueri - SP",
        mapEmbedUrl: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3658.261957545638!2d-46.852234!3d-23.498421!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x94cf023472d42bb7%3A0xc485121404128f11!2sAlphaville%2C%20Barueri%20-%20SP!5e0!3m2!1spt-BR!2sbr!4v1713365000000!5m2!1spt-BR!2sbr",
        coverImage: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&q=80&w=1200",
        images: [
            "https://images.unsplash.com/photo-1600607687931-cece5ce21448?auto=format&fit=crop&q=80&w=800",
            "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&q=80&w=800",
            "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&q=80&w=800"
        ],
        customData: {
            "area": 850,
            "bedrooms": 5,
            "parking": 8
        },
        landingPage: {
            heroTitle: "Exclusividade em Alphaville",
            heroSubtitle: "Viva o melhor do design contemporâneo no condomínio mais desejado.",
            callToActionText: "Falar com Especialista",
            primaryColor: "#A8BCA1",
            showLeadMagnet: false
        }
    }],
    ["prop-7", {
        id: "prop-7",
        title: "Flat Moderno - Vila Olímpia",
        slug: "flat-moderno-vila-olimpia",
        description: "Excelente oportunidade de investimento. Flat totalmente mobiliado e decorado, pronto para morar ou rentabilizar no polo financeiro de São Paulo.",
        price: 1250000,
        status: 'active',
        address: "Rua Funchal, 200 - Vila Olímpia, São Paulo - SP",
        mapEmbedUrl: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3656.402488478442!2d-46.68747442444274!3d-23.58988637878021!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x94ce574f76203d93%3A0xcb1dbec4c51b72a6!2sR.%20Funchal%2C%20200%20-%20Vila%20Ol%C3%ADmpia%2C%20S%C3%A3o%20Paulo%20-%20SP!5e0!3m2!1spt-BR!2sbr!4v1713365100000!5m2!1spt-BR!2sbr",
        coverImage: "https://images.unsplash.com/photo-1502672260266-1c1de2422008?auto=format&fit=crop&q=80&w=1200",
        images: [
            "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&q=80&w=800",
            "https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&q=80&w=800"
        ],
        customData: {
            "area": 45,
            "bedrooms": 1,
            "parking": 1
        },
        landingPage: {
            heroTitle: "Invista na Vila Olímpia",
            heroSubtitle: "Rentabilidade garantida no coração do centro financeiro.",
            callToActionText: "Receber Tabela de Rentabilidade",
            primaryColor: "#E2C8A8",
            showLeadMagnet: true,
            leadMagnetTitle: "Planilha de Projeção de ROI"
        }
    }],
    ["prop-8", {
        id: "prop-8",
        title: "Loft Alto Padrão - Leblon",
        slug: "loft-alto-padrao-leblon",
        description: "Loft espetacular de frente para a praia do Leblon. Ambientes integrados, vista livre para o mar, acabamentos em madeira de demolição e automação.",
        price: 9800000,
        status: 'active',
        address: "Av. Delfim Moreira, 500 - Leblon, Rio de Janeiro - RJ",
        mapEmbedUrl: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3672.63753545638!2d-43.225567!3d-22.985421!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x9bd5012472d42bb7%3A0xc485121404128f11!2sAv.%20Delfim%20Moreira%2C%20500%20-%20Leblon%2C%20Rio%20de%20Janeiro%20-%20RJ!5e0!3m2!1spt-BR!2sbr!4v1713365200000!5m2!1spt-BR!2sbr",
        coverImage: "https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?auto=format&fit=crop&q=80&w=1200",
        images: [
            "https://images.unsplash.com/photo-1554995207-c18c203602cb?auto=format&fit=crop&q=80&w=800",
            "https://images.unsplash.com/photo-1502672260266-1c1de2422008?auto=format&fit=crop&q=80&w=800"
        ],
        customData: {
            "area": 120,
            "bedrooms": 1,
            "parking": 2
        },
        landingPage: {
            heroTitle: "O Charme do Leblon",
            heroSubtitle: "Acorde todos os dias com a vista mais desejada do Brasil.",
            callToActionText: "Agendar Visita Presencial",
            primaryColor: "#85B0B8",
            showLeadMagnet: false
        }
    }],
    ["prop-9", {
        id: "prop-9",
        title: "Apartamento Vista Centrale - Malota",
        slug: "apartamento-vista-centrale-malota",
        description: "Descubra o conforto e a praticidade de viver no Condomínio Vista Centrale, localizado no cobiçado bairro da Malota. Este belíssimo apartamento de 71m², situado no 1º andar, oferece uma planta inteligente com 3 dormitórios, sendo 1 suíte aconchegante.\n\nA cozinha já vem mobiliada, equipada com pia e cooktop, pronta para inspirar suas melhores receitas. Os banheiros também estão completos, com móveis planejados e box de vidro.\n\nUma oportunidade rara com excelente custo-benefício: condomínio econômico (R$ 550,00 com água e gás inclusos) e IPTU acessível (R$ 1.300/ano). Inclui 1 vaga de garagem coberta. Perfeito para quem busca qualidade de vida e um excelente investimento.",
        price: 700000,
        status: 'active',
        address: "Condomínio Vista Centrale - Bairro Malota, Jundiaí - SP",
        mapEmbedUrl: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3667.404285814529!2d-46.9100146!3d-23.191838!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x94cf26922982d6b3%3A0xc3e652ec0b633018!2sMalota%2C%20Jundia%C3%AD%20-%20SP!5e0!3m2!1spt-BR!2sbr!4v1713365300000!5m2!1spt-BR!2sbr",
        coverImage: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&q=80&w=1200",
        images: [
            "https://images.unsplash.com/photo-1502672260266-1c1de2422008?auto=format&fit=crop&q=80&w=800",
            "https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&q=80&w=800",
            "https://images.unsplash.com/photo-1560185127-6ed189bf02f4?auto=format&fit=crop&q=80&w=800"
        ],
        customData: {
            "area": 71,
            "bedrooms": 3,
            "parking": 1
        },
        landingPage: {
            heroTitle: "Seu Novo Lar na Malota",
            heroSubtitle: "Praticidade, conforto e economia no Condomínio Vista Centrale. Pronto para morar.",
            callToActionText: "Agendar Visita Agora",
            primaryColor: "#9B8A7A",
            showLeadMagnet: false
        }
    }],
    ["prop-10", {
        id: "prop-10",
        title: "Apartamento Térreo - Vila Hortolândia",
        slug: "apartamento-terreo-vila-hortolandia",
        description: "Excelente oportunidade na Vila Hortolândia! Apartamento térreo com 64m², oferecendo praticidade e conforto. \n\nO imóvel conta com 2 dormitórios, sala aconchegante, e já vem equipado com móveis planejados de excelente qualidade nos quartos, cozinha e banheiro. \n\nInclui 1 vaga de garagem coberta. Ideal para quem busca um lar pronto para morar com ótimo custo-benefício.",
        price: 375000,
        status: 'active',
        address: "Vila Hortolândia, Jundiaí - SP",
        mapEmbedUrl: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3667.653457!2d-46.89!3d-23.18!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zVmlsYSBIb3J0b2zDom5kaWEsIEp1bmRpYcOtIC0gU1A!5e0!3m2!1spt-BR!2sbr!4v1713365400000!5m2!1spt-BR!2sbr",
        coverImage: "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&q=80&w=1200",
        images: [],
        customData: {
            "area": 64,
            "bedrooms": 2,
            "parking": 1
        },
        landingPage: {
            heroTitle: "Seu Primeiro Imóvel",
            heroSubtitle: "Apartamento térreo com móveis planejados na Vila Hortolândia.",
            callToActionText: "Quero Agendar Visita",
            primaryColor: "#7A8B9B",
            showLeadMagnet: false
        }
    }]
]);

// Helper to check if we already initialized the global store to avoid overwriting
if (!globalForStore.properties || globalForStore.properties.size < 10) {
    globalForStore.properties = defaultProperties;
}

export const messagesStore = globalForStore.messages ?? [];
export const threadsStore = globalForStore.threads ?? new Map<string, Thread>();
export const propertiesStore = globalForStore.properties;
export const propertyFieldsStore = globalForStore.propertyFields ?? [
    { id: "area", name: "Área (m²)", type: "number", required: true },
    { id: "bedrooms", name: "Quartos", type: "number", required: true },
    { id: "parking", name: "Vagas", type: "number", required: true },
];

export const customFieldsStore = globalForStore.customFields ?? [
    { id: "email", name: "E-mail", type: "text", required: false },
    { id: "budget", name: "Orçamento (R$)", type: "number", required: false },
    { id: "property_type", name: "Tipo de Imóvel", type: "dropdown", options: ["Apartamento", "Casa", "Terreno", "Comercial"], required: false },
];
export const funnelsStore = globalForStore.funnels ?? new Map<string, Funnel>([
    ["default", {
        id: "default",
        name: "Funil Padrão",
        type: 'lead',
        columns: [
            { id: 'novo', title: 'Novo Lead', color: 'border-blue-500/30 text-blue-400 bg-blue-500/10' },
            { id: 'qualificacao', title: 'Qualificação', color: 'border-purple-500/30 text-purple-400 bg-purple-500/10' },
            { id: 'atendimento', title: 'Atendimento', color: 'border-yellow-500/30 text-yellow-400 bg-yellow-500/10' },
            { id: 'proposta', title: 'Proposta', color: 'border-orange-500/30 text-orange-400 bg-orange-500/10' },
            { id: 'fechado', title: 'Fechado', color: 'border-green-500/30 text-green-400 bg-green-500/10' },
        ]
    }]
]);
export const defaultAgentConfigs: AgentConfig[] = [
    { id: "daniel-dir", name: "Daniel Rocha", role: "Diretor de Growth & IA", systemPrompt: "Você é Daniel Rocha, Diretor de Growth & IA na Novian. Você lidera a equipe de IA, focado em estratégia, otimização de conversão e excelência. Seja direto, estratégico e profissional. Responda APENAS em Português do Brasil (PT-BR).", modules: ["leads", "captacao", "imoveis"], knowledgeBase: "" },
    { id: "mariana-sdr", name: "Mariana Silva", role: "SDR (Primeiro Contato)", systemPrompt: "Você é Mariana Silva, a SDR (Sales Development Representative) na Novian. Você é amigável, acolhedora e rápida. Seu objetivo é engajar o lead inicialmente. Responda APENAS em Português do Brasil (PT-BR).", modules: ["leads", "imoveis", "captacao"], knowledgeBase: "" },
    { id: "lucas-qual", name: "Lucas Andrade", role: "Qualificação", systemPrompt: "Você é Lucas Andrade, Especialista em Qualificação na Novian. Seu objetivo é fazer perguntas precisas para entender o perfil do cliente (orçamento, localização, tipo de imóvel). Seja analítico e objetivo. NUNCA revele seus pensamentos internos. NUNCA fale em inglês. Responda APENAS em Português do Brasil (PT-BR).", modules: ["leads"], knowledgeBase: "" },
    { id: "camila-prop", name: "Camila Rocha", role: "Consultora de Imóveis", systemPrompt: "Você é Camila Rocha, Consultora de Imóveis na Novian. Você apresenta opções de imóveis que combinam com o perfil do cliente de forma elegante e persuasiva. Responda APENAS em Português do Brasil (PT-BR).", modules: ["imoveis"], knowledgeBase: "" },
    { id: "rafael-cs", name: "Rafael Martins", role: "Sucesso do Cliente", systemPrompt: "Você é Rafael Martins, do Sucesso do Cliente na Novian. Você garante que a jornada do cliente seja perfeita, ajudando com dúvidas finais e processos burocráticos. Responda APENAS em Português do Brasil (PT-BR).", modules: [], knowledgeBase: "" },
];

export const agentsStore = globalForStore.agents ?? new Map<string, AgentConfig>(
    defaultAgentConfigs.map((agent) => [agent.id, agent])
);
export const typingStore = globalForStore.typing ?? new Map<string, string | null>();

if (process.env.NODE_ENV !== 'production') {
    globalForStore.messages = messagesStore;
    globalForStore.threads = threadsStore;
    globalForStore.agents = agentsStore;
    globalForStore.typing = typingStore;
    globalForStore.customFields = customFieldsStore;
    globalForStore.funnels = funnelsStore;
    globalForStore.properties = propertiesStore;
    globalForStore.propertyFields = propertyFieldsStore;
}

export function setTyping(threadId: string, agentLabel: string | null) {
    if (agentLabel) {
        typingStore.set(threadId, agentLabel);
    } else {
        typingStore.delete(threadId);
    }
}

export function getTyping(threadId: string): string | null {
    return typingStore.get(threadId) || null;
}

export function createLead(data: Partial<Thread> & { phone: string, title?: string }) {
    const threadId = data.phone;
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    const thread: Thread = {
        id: threadId,
        title: data.title || `Lead: ${threadId}`,
        preview: 'Lead criado manualmente',
        time,
        unread: false,
        phone: data.phone,
        agentIds: [],
        status: data.status || 'novo',
        score: data.score || Math.floor(Math.random() * 50),
        funnelId: data.funnelId || 'default',
        customData: data.customData || {}
    };

    threadsStore.set(threadId, thread);
    return thread;
}

export function updateLeadStatus(threadId: string, status: string) {
    const thread = threadsStore.get(threadId);
    if (thread) {
        thread.status = status;
        threadsStore.set(threadId, thread);
    }
}

export function updateLead(threadId: string, data: Partial<Thread>) {
    const thread = threadsStore.get(threadId);
    if (thread) {
        const updatedThread = { ...thread, ...data };
        threadsStore.set(threadId, updatedThread);
        return updatedThread;
    }
    return null;
}

export async function getProperties() {
    const { data, error } = await supabase.from('properties').select('*');
    if (error) {
        console.error('Error fetching properties from Supabase:', error);
        // Fallback to local store if Supabase fails (e.g., during migration or network issue)
        return Array.from(propertiesStore.values());
    }
    
    // Convert snake_case to camelCase
    return data.map((row: Record<string, unknown>) => ({
        id: row.id,
        title: row.title,
        slug: row.slug,
        description: row.description,
        price: row.price,
        status: row.status,
        coverImage: row.cover_image,
        images: row.images,
        address: row.address,
        mapEmbedUrl: row.map_embed_url,
        customData: (row.custom_data as unknown as Record<string, string | number | boolean>) || {},
        landingPage: (row.landing_page as unknown as LandingPageConfig) || {}
    })) as Property[];
}

export async function createProperty(data: Omit<Property, "id">) {
    const snakeCaseData: Database['public']['Tables']['properties']['Insert'] = {
        title: data.title,
        slug: data.slug,
        description: data.description,
        price: data.price,
        status: data.status,
        cover_image: data.coverImage,
        images: data.images,
        address: data.address,
        map_embed_url: data.mapEmbedUrl,
        custom_data: data.customData as Database['public']['Tables']['properties']['Insert']['custom_data'],
        landing_page: data.landingPage as unknown as Database['public']['Tables']['properties']['Insert']['landing_page']
    };

    const { data: result, error } = await supabase.from('properties').insert([snakeCaseData]).select().single();
    
    if (error) {
        console.error('Error creating property in Supabase:', error);
        throw error;
    }

    return {
        ...data,
        id: result.id,
    } as Property;
}

export async function updateProperty(id: string, data: Partial<Property>) {
    const snakeCaseData: Database['public']['Tables']['properties']['Update'] = {};
    if (data.title !== undefined) snakeCaseData.title = data.title;
    if (data.slug !== undefined) snakeCaseData.slug = data.slug;
    if (data.description !== undefined) snakeCaseData.description = data.description;
    if (data.price !== undefined) snakeCaseData.price = data.price;
    if (data.status !== undefined) snakeCaseData.status = data.status;
    if (data.coverImage !== undefined) snakeCaseData.cover_image = data.coverImage;
    if (data.images !== undefined) snakeCaseData.images = data.images;
    if (data.address !== undefined) snakeCaseData.address = data.address;
    if (data.mapEmbedUrl !== undefined) snakeCaseData.map_embed_url = data.mapEmbedUrl;
    if (data.customData !== undefined) snakeCaseData.custom_data = data.customData as Database['public']['Tables']['properties']['Update']['custom_data'];
    if (data.landingPage !== undefined) snakeCaseData.landing_page = data.landingPage as unknown as Database['public']['Tables']['properties']['Update']['landing_page'];

    const { data: result, error } = await supabase.from('properties').update(snakeCaseData).eq('id', id).select().single();

    if (error) {
        console.error('Error updating property in Supabase:', error);
        throw error;
    }

    return {
        id: result.id,
        title: result.title,
        slug: result.slug,
        description: result.description,
        price: result.price,
        status: result.status,
        coverImage: result.cover_image,
        images: result.images,
        address: result.address,
        mapEmbedUrl: result.map_embed_url,
        customData: result.custom_data as unknown as Record<string, string | number | boolean>,
        landingPage: result.landing_page as unknown as LandingPageConfig
    } as Property;
}

export async function deleteProperty(id: string) {
    const { error } = await supabase.from('properties').delete().eq('id', id);
    if (error) {
        console.error('Error deleting property from Supabase:', error);
        throw error;
    }
}

export async function getPropertyFields() {
    return propertyFieldsStore;
}

export async function createPropertyField(field: Omit<CustomField, "id">) {
    const newId = field.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const newField = { ...field, id: newId };
    propertyFieldsStore.push(newField);
    return newField;
}

export async function deleteLead(threadId: string) {
    const { error } = await supabase.from('leads').delete().eq('id', threadId);
    if (error) {
        console.error('Error deleting lead from Supabase:', error);
        throw error;
    }

    threadsStore.delete(threadId);
}

export function addMessage(msg: Omit<ChatMessage, 'id' | 'time'>) {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const fullMsg = { ...msg, id: Math.random().toString(36).substr(2, 9), time };
    
    messagesStore.push(fullMsg);

    // Update or create thread
    const thread = threadsStore.get(msg.threadId) || {
        id: msg.threadId,
        title: msg.agent !== "Lead" ? msg.agent : `Lead: ${msg.threadId.split('@')[0]}`,
        preview: msg.content,
        time,
        unread: msg.role === 'Client',
        phone: msg.threadId.split('@')[0],
        agentIds: [],
        status: 'novo',
        score: Math.floor(Math.random() * 50) // Mocking an AI score for now
    };

    // If we finally know the real name of the lead, update the title
    if (msg.role === 'Client' && msg.agent !== "Lead" && thread.title.startsWith("Lead: ")) {
        thread.title = msg.agent;
    }

    thread.preview = msg.content;
    thread.time = time;
    if (msg.role === 'Client') thread.unread = true;
    if (!thread.agentIds.includes(msg.agent) && !msg.isSystem && msg.role !== 'Client') {
        thread.agentIds.push(msg.agent);
    }

    threadsStore.set(msg.threadId, thread);
    return fullMsg;
}

export function markThreadRead(threadId: string) {
    const thread = threadsStore.get(threadId);
    if (thread) {
        thread.unread = false;
        threadsStore.set(threadId, thread);
    }
}
