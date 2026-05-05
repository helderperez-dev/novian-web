import { supabase } from "./supabase";
import { Database } from "./database.types";
import { normalizeAssetUrl, normalizeAssetUrls } from "./assets";
import { ensurePropertyReferenceCode } from "./property-reference";
import { PROPERTY_SYSTEM_FIELD_KEYS, synchronizePropertyStructuredData } from "./property-attributes";

type PropertyRow = Database["public"]["Tables"]["properties"]["Row"];
type PropertyOfferRow = Database["public"]["Tables"]["property_offers"]["Row"];

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
    description?: string;
    iconName?: string;
    type: 'text' | 'number' | 'dropdown' | 'date' | 'boolean' | 'multiselect';
    options?: string[]; // For dropdowns and multiselects
    required: boolean;
    dbId?: string;
    unit?: string;
    sortOrder?: number;
    showOnPropertyCard?: boolean;
    showOnPropertyPage?: boolean;
    showOnPropertyFilters?: boolean;
    targetEntity?: string;
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
    leadId?: string;
    agentId?: string;
    title: string;
    preview: string;
    time: string;
    unread: boolean;
    phone: string;
    agentIds: string[];
    status?: string; // e.g., 'novo', 'qualificacao', 'atendimento', 'proposta', 'fechado'
    score?: number;
    funnelId?: string;
    customData?: Record<string, unknown>;
}

export interface AgentConfig {
    id: string;
    name: string;
    role: string;
    systemPrompt: string;
    modules?: string[];
    knowledgeBase?: string;
    whatsappDisplayName?: string;
    whatsappPhone?: string;
    whatsappProfilePictureUrl?: string;
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

export type PropertyCustomDataValue = string | number | boolean | string[];
export type PropertyOfferType = "sale" | "rent";

export interface PropertyOffer {
    id?: string;
    offerType: PropertyOfferType;
    price: number;
    ownerPrice?: number | null;
    commissionRate?: number | null;
    isPrimary?: boolean;
}

export interface BrokerSummary {
    id: string;
    fullName: string;
    email: string;
    avatarUrl: string | null;
    creci: string | null;
}

export interface Property {
    id: string;
    title: string;
    slug: string;
    description: string;
    price: number;
    status: 'active' | 'inactive' | 'sold';
    isExclusiveNovian?: boolean;
    coverImage: string;
    images: string[];
    address: string;
    propertyType?: string | null;
    street?: string | null;
    streetNumber?: string | null;
    complement?: string | null;
    neighborhood?: string | null;
    city?: string | null;
    state?: string | null;
    postalCode?: string | null;
    country?: string | null;
    amenities?: string[];
    mapEmbedUrl?: string;
    customData: Record<string, PropertyCustomDataValue>;
    landingPage: LandingPageConfig;
    offers?: PropertyOffer[];
    brokerUserId?: string | null;
    broker?: BrokerSummary | null;
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
        isExclusiveNovian: true,
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
        isExclusiveNovian: false,
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
        isExclusiveNovian: true,
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
        isExclusiveNovian: false,
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
        isExclusiveNovian: true,
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
        isExclusiveNovian: true,
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
        isExclusiveNovian: false,
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
        isExclusiveNovian: false,
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
        isExclusiveNovian: false,
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
        isExclusiveNovian: false,
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
    { id: "property_type", name: "Tipo de Imóvel", description: "Tipo principal do imóvel usado em filtros, cards e na landing page.", iconName: "building-2", type: "dropdown", options: ["Apartamento", "Casa", "Cobertura", "Casa em condomínio", "Terreno", "Comercial", "Studio", "Loft"], required: true, sortOrder: 5, showOnPropertyCard: false, showOnPropertyPage: true, showOnPropertyFilters: true, targetEntity: "properties" },
    { id: "area", name: "Área", description: "Área principal usada para destaque e comparação entre imóveis.", iconName: "ruler", type: "number", required: true, unit: "m²", sortOrder: 10, showOnPropertyCard: true, showOnPropertyPage: true, targetEntity: "properties" },
    { id: "street", name: "Rua", description: "Nome da rua do imóvel.", iconName: "map", type: "text", required: false, sortOrder: 12, showOnPropertyCard: false, showOnPropertyPage: true, showOnPropertyFilters: false, targetEntity: "properties" },
    { id: "street_number", name: "Número", description: "Número do endereço.", iconName: "hash", type: "text", required: false, sortOrder: 14, showOnPropertyCard: false, showOnPropertyPage: true, showOnPropertyFilters: false, targetEntity: "properties" },
    { id: "complement", name: "Complemento", description: "Complemento opcional do endereço.", iconName: "door-open", type: "text", required: false, sortOrder: 16, showOnPropertyCard: false, showOnPropertyPage: true, showOnPropertyFilters: false, targetEntity: "properties" },
    { id: "neighborhood", name: "Bairro", description: "Bairro utilizado em filtros e localização.", iconName: "map-pinned", type: "text", required: false, sortOrder: 18, showOnPropertyCard: false, showOnPropertyPage: true, showOnPropertyFilters: true, targetEntity: "properties" },
    { id: "city", name: "Cidade", description: "Cidade padronizada para filtros e buscas.", iconName: "map-pin", type: "dropdown", required: true, sortOrder: 19, showOnPropertyCard: false, showOnPropertyPage: true, showOnPropertyFilters: true, targetEntity: "properties" },
    { id: "bedrooms", name: "Quartos", description: "Quantidade de quartos do imóvel.", iconName: "bed-double", type: "number", required: true, sortOrder: 20, showOnPropertyCard: true, showOnPropertyPage: true, targetEntity: "properties" },
    { id: "bathrooms", name: "Banheiros", description: "Quantidade total de banheiros do imóvel.", iconName: "building-2", type: "number", required: false, sortOrder: 25, showOnPropertyCard: true, showOnPropertyPage: true, showOnPropertyFilters: true, targetEntity: "properties" },
    { id: "state", name: "Estado", description: "Estado padronizado para filtros e buscas.", iconName: "landmark", type: "dropdown", required: false, sortOrder: 21, showOnPropertyCard: false, showOnPropertyPage: true, showOnPropertyFilters: true, targetEntity: "properties" },
    { id: "postal_code", name: "CEP", description: "CEP do imóvel.", iconName: "mail", type: "text", required: false, sortOrder: 22, showOnPropertyCard: false, showOnPropertyPage: true, showOnPropertyFilters: false, targetEntity: "properties" },
    { id: "country", name: "País", description: "País do imóvel.", iconName: "flag", type: "dropdown", required: false, sortOrder: 23, showOnPropertyCard: false, showOnPropertyPage: true, showOnPropertyFilters: false, targetEntity: "properties" },
    { id: "parking", name: "Vagas", description: "Quantidade de vagas de garagem disponíveis.", iconName: "car-front", type: "number", required: true, sortOrder: 30, showOnPropertyCard: true, showOnPropertyPage: true, targetEntity: "properties" },
    { id: "condominium_fee", name: "Condomínio", description: "Valor mensal do condomínio.", iconName: "building-2", type: "number", required: false, unit: "R$", sortOrder: 31, showOnPropertyCard: false, showOnPropertyPage: true, showOnPropertyFilters: true, targetEntity: "properties" },
    { id: "iptu", name: "IPTU", description: "Valor do IPTU.", iconName: "building-2", type: "number", required: false, unit: "R$", sortOrder: 32, showOnPropertyCard: false, showOnPropertyPage: true, showOnPropertyFilters: true, targetEntity: "properties" },
    { id: "transaction_type", name: "Transação", description: "Define se o imóvel está disponível para venda, locação ou ambos.", iconName: "building-2", type: "dropdown", options: ["Venda", "Locação", "Venda e locação"], required: false, sortOrder: 33, showOnPropertyCard: false, showOnPropertyPage: true, showOnPropertyFilters: true, targetEntity: "properties" },
    { id: "property_purpose", name: "Finalidade", description: "Finalidade principal do imóvel.", iconName: "building-2", type: "dropdown", options: ["Residencial", "Comercial", "Industrial", "Rural", "Temporada"], required: false, sortOrder: 34, showOnPropertyCard: false, showOnPropertyPage: true, showOnPropertyFilters: true, targetEntity: "properties" },
    { id: "lavabos", name: "Lavabos", description: "Quantidade de lavabos do imóvel.", iconName: "building-2", type: "number", required: false, sortOrder: 35, showOnPropertyCard: false, showOnPropertyPage: true, showOnPropertyFilters: false, targetEntity: "properties" },
    { id: "built_area", name: "Área construída", description: "Área construída em metros quadrados.", iconName: "ruler", type: "number", required: false, unit: "m²", sortOrder: 36, showOnPropertyCard: false, showOnPropertyPage: true, showOnPropertyFilters: true, targetEntity: "properties" },
    { id: "private_area", name: "Área privativa", description: "Área privativa em metros quadrados.", iconName: "ruler", type: "number", required: false, unit: "m²", sortOrder: 37, showOnPropertyCard: false, showOnPropertyPage: true, showOnPropertyFilters: true, targetEntity: "properties" },
    { id: "total_area", name: "Área total", description: "Área total do imóvel em metros quadrados.", iconName: "ruler", type: "number", required: false, unit: "m²", sortOrder: 38, showOnPropertyCard: false, showOnPropertyPage: true, showOnPropertyFilters: true, targetEntity: "properties" },
    { id: "property_age", name: "Idade do imóvel", description: "Idade aproximada do imóvel em anos.", iconName: "building-2", type: "number", required: false, unit: "anos", sortOrder: 39, showOnPropertyCard: false, showOnPropertyPage: true, showOnPropertyFilters: true, targetEntity: "properties" },
    { id: "amenities", name: "Características", description: "Características e diferenciais selecionáveis do imóvel.", iconName: "sliders-horizontal", type: "multiselect", options: ["Piscina", "Academia", "Espaço Gourmet", "Churrasqueira", "Playground", "Salão de Festas", "Portaria 24h", "Pet Place", "Varanda", "Suíte"], required: false, sortOrder: 40, showOnPropertyCard: false, showOnPropertyPage: true, showOnPropertyFilters: true, targetEntity: "properties" },
    { id: "accepts_exchange", name: "Aceita permuta", description: "Indica se o proprietário aceita permuta.", iconName: "building-2", type: "boolean", required: false, sortOrder: 41, showOnPropertyCard: false, showOnPropertyPage: true, showOnPropertyFilters: true, targetEntity: "properties" },
    { id: "accepts_financing", name: "Aceita financiamento", description: "Indica se o imóvel aceita financiamento.", iconName: "building-2", type: "boolean", required: false, sortOrder: 42, showOnPropertyCard: false, showOnPropertyPage: true, showOnPropertyFilters: true, targetEntity: "properties" },
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

function slugifyFieldKey(value: string) {
    return value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "") || "campo_personalizado";
}

function getFallbackPropertyOffers(row: Record<string, unknown>) {
    const price = Number(row.price || 0);
    if (!Number.isFinite(price) || price <= 0) {
        return [];
    }

    const customData = (row.custom_data as Record<string, unknown> | null) || {};
    const ownerPrice = typeof customData.owner_price === "number" ? customData.owner_price : null;
    const commissionRate = typeof customData.commission_rate === "number" ? customData.commission_rate : null;

    return [
        {
            offerType: "sale" as const,
            price,
            ownerPrice,
            commissionRate,
            isPrimary: true,
        },
    ];
}

function mapPropertyOffers(row: Record<string, unknown>): PropertyOffer[] {
    const rawOffers = row.property_offers;
    if (!Array.isArray(rawOffers) || rawOffers.length === 0) {
        return getFallbackPropertyOffers(row);
    }

    const offers: PropertyOffer[] = [];
    for (const offer of rawOffers) {
        if (!offer || typeof offer !== "object") {
            continue;
        }

        const raw = offer as Record<string, unknown>;
        const price = Number(raw.price || 0);
        if (!Number.isFinite(price)) {
            continue;
        }

        offers.push({
            id: typeof raw.id === "string" ? raw.id : undefined,
            offerType: raw.offer_type === "rent" ? "rent" : "sale",
            price,
            ownerPrice: typeof raw.owner_price === "number" ? raw.owner_price : null,
            commissionRate: typeof raw.commission_rate === "number" ? raw.commission_rate : null,
            isPrimary: Boolean(raw.is_primary),
        });
    }

    return offers;
}

function mapPropertyFieldRow(row: Record<string, unknown>): CustomField {
    const fieldKey = typeof row.field_key === "string" && row.field_key ? row.field_key : String(row.id);
    const targetEntity = typeof row.target_entity === "string" ? row.target_entity : "properties";
    const rawName = String(row.name || "");
    const rawDescription = typeof row.description === "string" && row.description ? row.description : undefined;
    const rawOptions = Array.isArray(row.options) ? row.options.map((option) => String(option)) : undefined;
    const rawIconName = typeof row.icon_name === "string" && row.icon_name ? row.icon_name : undefined;

    const normalizeName = (name: string) => {
        if (targetEntity !== "properties") return name;
        if (fieldKey === "property_type" && name === "Tipo de Imovel") return "Tipo de Imóvel";
        if (fieldKey === "street_number" && name === "Numero") return "Número";
        if (fieldKey === "country" && name === "Pais") return "País";
        if (fieldKey === "condominium_fee" && name === "Condominio") return "Condomínio";
        if (fieldKey === "transaction_type" && name === "Transacao") return "Transação";
        if (fieldKey === "property_age" && name === "Idade do imovel") return "Idade do imóvel";
        if (fieldKey === "amenities" && (name === "Amenidades" || name === "Características do imóvel")) return "Características";
        return name;
    };

    const normalizeDescription = (description?: string) => {
        if (targetEntity !== "properties" || !description) return description;
        if (fieldKey === "street_number" && description === "Numero do endereco.") return "Número do endereço.";
        if (fieldKey === "country" && description === "Pais do imovel.") return "País do imóvel.";
        if (fieldKey === "condominium_fee" && description === "Valor mensal do condominio.") return "Valor mensal do condomínio.";
        if (fieldKey === "property_type" && description === "Tipo principal do imovel usado em filtros, cards e na landing page.") return "Tipo principal do imóvel usado em filtros, cards e na landing page.";
        if (fieldKey === "transaction_type" && description === "Define se o imovel esta disponivel para venda, locacao ou ambos.") return "Define se o imóvel está disponível para venda, locação ou ambos.";
        if (fieldKey === "property_age" && description === "Idade aproximada do imovel em anos.") return "Idade aproximada do imóvel em anos.";
        if (fieldKey === "amenities" && description === "Amenidades selecionáveis para enriquecer a ficha do imóvel.") return "Características e diferenciais selecionáveis do imóvel.";
        return description;
    };

    const normalizeOptions = (options?: string[]) => {
        if (targetEntity !== "properties" || !options) return options;
        if (fieldKey === "property_type") {
            return options.map((option) => (option === "Casa em condominio" ? "Casa em condomínio" : option));
        }
        if (fieldKey === "transaction_type") {
            return options.map((option) => (option === "Locacao" ? "Locação" : option));
        }
        if (fieldKey === "amenities") {
            return options.map((option) => {
                if (option === "Espaco gourmet" || option === "Espaço gourmet") return "Espaço Gourmet";
                if (option === "Salao de festas" || option === "Salão de festas") return "Salão de Festas";
                if (option === "Suite") return "Suíte";
                if (option === "Pet place") return "Pet Place";
                return option;
            });
        }
        return options;
    };

    return {
        id: fieldKey,
        dbId: typeof row.id === "string" ? row.id : undefined,
        name: normalizeName(rawName),
        description: normalizeDescription(rawDescription),
        iconName: targetEntity === "properties" && fieldKey === "amenities" && rawIconName === "sparkles" ? "sliders-horizontal" : rawIconName,
        type: (row.type as CustomField["type"]) || "text",
        options: normalizeOptions(rawOptions),
        required: Boolean(row.required),
        unit: typeof row.unit === "string" && row.unit ? row.unit : undefined,
        sortOrder: typeof row.sort_order === "number" ? row.sort_order : 0,
        showOnPropertyCard: Boolean(row.show_on_property_card),
        showOnPropertyPage: Boolean(row.show_on_property_page),
        showOnPropertyFilters: Boolean(row.show_on_property_filters),
        targetEntity,
    };
}

async function loadPropertyRowsWithOffers(rows: PropertyRow[]) {
    if (rows.length === 0) {
        return [] as Array<PropertyRow & { property_offers: PropertyOfferRow[] }>;
    }

    const propertyIds = rows.map((row) => row.id);
    const { data: offerRows, error: offersError } = await supabase
        .from("property_offers")
        .select("*")
        .in("property_id", propertyIds);

    if (offersError) {
        if (isMissingPropertyOffersTableError(offersError)) {
            return rows.map((row) => ({ ...row, property_offers: [] }));
        }
        console.error("Error fetching property offers from Supabase:", offersError);
        return rows.map((row) => ({ ...row, property_offers: [] }));
    }

    const offersByPropertyId = new Map<string, PropertyOfferRow[]>();
    for (const offer of offerRows || []) {
        const propertyOffers = offersByPropertyId.get(offer.property_id) || [];
        propertyOffers.push(offer);
        offersByPropertyId.set(offer.property_id, propertyOffers);
    }

    return rows.map((row) => ({
        ...row,
        property_offers: offersByPropertyId.get(row.id) || [],
    }));
}

function isMissingSortOrderColumnError(error: unknown) {
    return Boolean(
        error &&
        typeof error === "object" &&
        "code" in error &&
        (error as { code?: string }).code === "42703",
    );
}

function isMissingPropertyOffersTableError(error: unknown) {
    const message =
        error && typeof error === "object" && "message" in error && typeof error.message === "string"
            ? error.message
            : "";

    return Boolean(
        error &&
        typeof error === "object" &&
        "code" in error &&
        (error as { code?: string }).code === "PGRST205" &&
        message.includes("property_offers"),
    );
}

export async function getProperties() {
    const { data, error } = await supabase
        .from('properties')
        .select('*')
        .order('updated_at', { ascending: false });
    if (error) {
        console.error('Error fetching properties from Supabase:', error);
        // Fallback to local store if Supabase fails (e.g., during migration or network issue)
        return Array.from(propertiesStore.values());
    }

    const rowsWithOffers = await loadPropertyRowsWithOffers((data || []) as PropertyRow[]);
    
    // Convert snake_case to camelCase while keeping a primary offer price fallback.
    return rowsWithOffers.map((row: Record<string, unknown>) => {
        const offers = mapPropertyOffers(row);
        const primaryOffer = offers.find((offer) => offer.isPrimary) || offers[0];
        const referenceAwareCustomData = ensurePropertyReferenceCode(
            (row.custom_data as unknown as Record<string, PropertyCustomDataValue>) || {},
            {
                id: String(row.id),
                slug: typeof row.slug === "string" ? row.slug : null,
                title: typeof row.title === "string" ? row.title : null,
            },
        );
        const structured = synchronizePropertyStructuredData({
            propertyType: typeof row.property_type === "string" ? row.property_type : null,
            street: typeof row.street === "string" ? row.street : null,
            streetNumber: typeof row.street_number === "string" ? row.street_number : null,
            complement: typeof row.complement === "string" ? row.complement : null,
            neighborhood: typeof row.neighborhood === "string" ? row.neighborhood : null,
            city: typeof row.city === "string" ? row.city : null,
            state: typeof row.state === "string" ? row.state : null,
            postalCode: typeof row.postal_code === "string" ? row.postal_code : null,
            country: typeof row.country === "string" ? row.country : null,
            amenities: Array.isArray(row.amenities) ? row.amenities : [],
            address: typeof row.address === "string" ? row.address : "",
            customData: referenceAwareCustomData,
        });

        return {
            id: row.id,
            title: row.title,
            slug: row.slug,
            description: row.description,
            price: primaryOffer?.price ?? Number(row.price || 0),
            status: row.status,
            isExclusiveNovian: Boolean(row.is_exclusive_novian),
            coverImage: normalizeAssetUrl(row.cover_image),
            images: normalizeAssetUrls(row.images),
            address: structured.address,
            propertyType: structured.propertyType,
            street: structured.street,
            streetNumber: structured.streetNumber,
            complement: structured.complement,
            neighborhood: structured.neighborhood,
            city: structured.city,
            state: structured.state,
            postalCode: structured.postalCode,
            country: structured.country,
            amenities: structured.amenities,
            mapEmbedUrl: row.map_embed_url,
            customData: structured.customData as Record<string, PropertyCustomDataValue>,
            landingPage: (row.landing_page as unknown as LandingPageConfig) || {},
            offers,
            brokerUserId: typeof row.broker_user_id === "string" ? row.broker_user_id : null,
            broker: null,
        };
    }) as Property[];
}

export async function createProperty(data: Omit<Property, "id">) {
    const structured = synchronizePropertyStructuredData({
        propertyType: data.propertyType,
        street: data.street,
        streetNumber: data.streetNumber,
        complement: data.complement,
        neighborhood: data.neighborhood,
        city: data.city,
        state: data.state,
        postalCode: data.postalCode,
        country: data.country,
        amenities: data.amenities,
        address: data.address,
        customData: data.customData,
    });
    const snakeCaseData: Database['public']['Tables']['properties']['Insert'] = {
        title: data.title,
        slug: data.slug,
        description: data.description,
        price: data.price,
        status: data.status,
        is_exclusive_novian: Boolean(data.isExclusiveNovian),
        cover_image: data.coverImage,
        images: data.images,
        address: structured.address,
        property_type: structured.propertyType,
        street: structured.street,
        street_number: structured.streetNumber,
        complement: structured.complement,
        neighborhood: structured.neighborhood,
        city: structured.city,
        state: structured.state,
        postal_code: structured.postalCode,
        country: structured.country,
        amenities: structured.amenities,
        map_embed_url: data.mapEmbedUrl,
        custom_data: structured.customData as Database['public']['Tables']['properties']['Insert']['custom_data'],
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
        address: structured.address,
        propertyType: structured.propertyType,
        street: structured.street,
        streetNumber: structured.streetNumber,
        complement: structured.complement,
        neighborhood: structured.neighborhood,
        city: structured.city,
        state: structured.state,
        postalCode: structured.postalCode,
        country: structured.country,
        amenities: structured.amenities,
        customData: ensurePropertyReferenceCode(structured.customData as Record<string, PropertyCustomDataValue>, {
            id: result.id,
            slug: data.slug,
            title: data.title,
        }),
        offers: data.offers,
    } as Property;
}

export async function updateProperty(id: string, data: Partial<Property>) {
    const snakeCaseData: Database['public']['Tables']['properties']['Update'] = {};
    const structured = synchronizePropertyStructuredData({
        propertyType: data.propertyType,
        street: data.street,
        streetNumber: data.streetNumber,
        complement: data.complement,
        neighborhood: data.neighborhood,
        city: data.city,
        state: data.state,
        postalCode: data.postalCode,
        country: data.country,
        amenities: data.amenities,
        address: data.address,
        customData: data.customData,
    });
    if (data.title !== undefined) snakeCaseData.title = data.title;
    if (data.slug !== undefined) snakeCaseData.slug = data.slug;
    if (data.description !== undefined) snakeCaseData.description = data.description;
    if (data.price !== undefined) snakeCaseData.price = data.price;
    if (data.status !== undefined) snakeCaseData.status = data.status;
    if (data.isExclusiveNovian !== undefined) snakeCaseData.is_exclusive_novian = data.isExclusiveNovian;
    if (data.coverImage !== undefined) snakeCaseData.cover_image = data.coverImage;
    if (data.images !== undefined) snakeCaseData.images = data.images;
    if (data.address !== undefined || data.street !== undefined || data.city !== undefined || data.neighborhood !== undefined || data.state !== undefined || data.country !== undefined) snakeCaseData.address = structured.address;
    if (data.propertyType !== undefined || data.customData?.[PROPERTY_SYSTEM_FIELD_KEYS.propertyType] !== undefined) snakeCaseData.property_type = structured.propertyType;
    if (data.street !== undefined || data.customData?.[PROPERTY_SYSTEM_FIELD_KEYS.street] !== undefined) snakeCaseData.street = structured.street;
    if (data.streetNumber !== undefined || data.customData?.[PROPERTY_SYSTEM_FIELD_KEYS.streetNumber] !== undefined) snakeCaseData.street_number = structured.streetNumber;
    if (data.complement !== undefined || data.customData?.[PROPERTY_SYSTEM_FIELD_KEYS.complement] !== undefined) snakeCaseData.complement = structured.complement;
    if (data.neighborhood !== undefined || data.customData?.[PROPERTY_SYSTEM_FIELD_KEYS.neighborhood] !== undefined) snakeCaseData.neighborhood = structured.neighborhood;
    if (data.city !== undefined || data.customData?.[PROPERTY_SYSTEM_FIELD_KEYS.city] !== undefined) snakeCaseData.city = structured.city;
    if (data.state !== undefined || data.customData?.[PROPERTY_SYSTEM_FIELD_KEYS.state] !== undefined) snakeCaseData.state = structured.state;
    if (data.postalCode !== undefined || data.customData?.[PROPERTY_SYSTEM_FIELD_KEYS.postalCode] !== undefined) snakeCaseData.postal_code = structured.postalCode;
    if (data.country !== undefined || data.customData?.[PROPERTY_SYSTEM_FIELD_KEYS.country] !== undefined) snakeCaseData.country = structured.country;
    if (data.amenities !== undefined || data.customData?.[PROPERTY_SYSTEM_FIELD_KEYS.amenities] !== undefined) snakeCaseData.amenities = structured.amenities;
    if (data.mapEmbedUrl !== undefined) snakeCaseData.map_embed_url = data.mapEmbedUrl;
    if (data.customData !== undefined) snakeCaseData.custom_data = structured.customData as Database['public']['Tables']['properties']['Update']['custom_data'];
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
        isExclusiveNovian: Boolean(result.is_exclusive_novian),
        coverImage: normalizeAssetUrl(result.cover_image),
        images: normalizeAssetUrls(result.images),
        address: structured.address || result.address,
        propertyType: structured.propertyType,
        street: structured.street,
        streetNumber: structured.streetNumber,
        complement: structured.complement,
        neighborhood: structured.neighborhood,
        city: structured.city,
        state: structured.state,
        postalCode: structured.postalCode,
        country: structured.country,
        amenities: structured.amenities,
        mapEmbedUrl: result.map_embed_url,
        customData: ensurePropertyReferenceCode(
            structured.customData as Record<string, PropertyCustomDataValue>,
            {
                id: result.id,
                slug: result.slug,
                title: result.title,
            },
        ),
        landingPage: result.landing_page as unknown as LandingPageConfig,
        offers: data.offers,
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
    const query = supabase
        .from("custom_fields")
        .select("*")
        .eq("target_entity", "properties")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });

    let { data, error } = await query;

    if (isMissingSortOrderColumnError(error)) {
        const fallback = await supabase
            .from("custom_fields")
            .select("*")
            .eq("target_entity", "properties")
            .order("created_at", { ascending: true });
        data = fallback.data;
        error = fallback.error;
    }

    if (error) {
        console.error("Error fetching property fields from Supabase:", error);
        return propertyFieldsStore;
    }

    return (data || []).map(mapPropertyFieldRow);
}

export async function createPropertyField(field: Omit<CustomField, "id">) {
    const fieldKey = slugifyFieldKey(field.name);
    const payload: Database["public"]["Tables"]["custom_fields"]["Insert"] = {
        name: field.name,
        target_entity: "properties",
        type: field.type,
        required: field.required,
        options: field.options && field.options.length > 0 ? field.options : null,
        field_key: fieldKey,
        description: field.description ?? null,
        icon_name: field.iconName ?? null,
        unit: field.unit ?? null,
        sort_order: field.sortOrder ?? propertyFieldsStore.length * 10,
        show_on_property_card: Boolean(field.showOnPropertyCard),
        show_on_property_filters: Boolean(field.showOnPropertyFilters),
        show_on_property_page: field.showOnPropertyPage ?? true,
    };

    let { data, error } = await supabase
        .from("custom_fields")
        .insert(payload)
        .select("*")
        .single();

    if (isMissingSortOrderColumnError(error)) {
        const fallbackPayload = { ...payload };
        delete fallbackPayload.sort_order;
        const fallback = await supabase
            .from("custom_fields")
            .insert(fallbackPayload)
            .select("*")
            .single();
        data = fallback.data;
        error = fallback.error;
    }

    if (error) {
        console.error("Error creating property field in Supabase:", error);
        const newField = { ...field, id: fieldKey, targetEntity: "properties" };
        propertyFieldsStore.push(newField);
        return newField;
    }

    if (!data) {
        const newField = { ...field, id: fieldKey, targetEntity: "properties" };
        propertyFieldsStore.push(newField);
        return newField;
    }

    return mapPropertyFieldRow(data);
}

export async function deleteLead(threadId: string) {
    const { error } = await supabase.from('people').delete().eq('id', threadId);
    if (error) {
        console.error('Error deleting lead person from Supabase:', error);
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
