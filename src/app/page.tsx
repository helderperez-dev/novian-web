import { getProperties } from "@/lib/store";
import {
  formatPropertyOfferLabel,
  getPropertyOfferSummary,
} from "@/lib/property-utils";
import { connection } from "next/server";
import Link from "next/link";
import Image from "next/image";
import HeroParallaxBackground from "./HeroParallaxBackground";
import GoogleCalendarButton from "./GoogleCalendarButton";
import LandingHeader from "./LandingHeader";
import TestimonialsCarousel from "./TestimonialsCarousel";
import {
  ArrowRight,
  Bath,
  BedDouble,
  Building2,
  CalendarDays,
  CarFront,
  Compass,
  Heart,
  MapPin,
  MessageCircle,
  Phone,
  Ruler,
  Search,
  ShieldCheck,
  Star,
  UserRound,
} from "lucide-react";
import PropertyListingTracker from "./PropertyListingTracker";

const whatsappHref =
  "https://wa.me/5511965489677?text=Ol%C3%A1%2C%20quero%20conhecer%20os%20im%C3%B3veis%20da%20Novian.";

const trustPillars = [
  { 
    icon: UserRound,
    title: "Atendimento personalizado",
  },
  {
    icon: Compass,
    title: "Imóveis selecionados com inteligência",
  },
  {
    icon: ShieldCheck,
    title: "Transparência e segurança em cada etapa",
  },
];

const signatureNumbers = [
  { value: "+5 anos", label: "de experiência" },
  { value: "+140", label: "imóveis vendidos" },
  { value: "+420", label: "clientes atendidos" },
  { value: "Referência", label: "em Jundiaí e região" },
];

const navLinks = [
  { href: "#collection", label: "Imóveis" },
  { href: "#experience", label: "Quem somos" },
  { href: "#experience", label: "Soluções" },
  { href: whatsappHref, label: "Contato" },
];

const footerNavigation = [
  { href: "#collection", label: "Imóveis selecionados" },
  { href: "#experience", label: "Experiência Novian" },
  { href: whatsappHref, label: "Fale conosco" },
  { href: "/politica-de-privacidade", label: "Política de Privacidade" },
  { href: "/termos-de-uso", label: "Termos de Uso" },
  { href: "/login", label: "Área interna" },
];

const footerSolutions = [
  "Compra guiada",
  "Venda estratégica",
  "Locação com suporte",
  "Avaliação de imóveis",
];

type SocialPlatform = "instagram" | "facebook" | "tiktok" | "linkedin" | "x";

const socialLinks: { label: string; href: string; platform: SocialPlatform }[] = [
  { label: "Instagram", href: "#", platform: "instagram" },
  { label: "Facebook", href: "#", platform: "facebook" },
  { label: "TikTok", href: "#", platform: "tiktok" },
  { label: "LinkedIn", href: "#", platform: "linkedin" },
  { label: "X", href: "#", platform: "x" },
];

function SocialIcon({ platform }: { platform: SocialPlatform }) {
  if (platform === "instagram") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-[18px] w-[18px]">
        <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
        <circle cx="12" cy="12" r="4.2" />
        <circle cx="17.3" cy="6.7" r="1" fill="currentColor" stroke="none" />
      </svg>
    );
  }

  if (platform === "tiktok") {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-[18px] w-[18px]">
        <path d="M14.6 3c.28 2.28 1.56 4.06 3.96 4.57v2.62a7.2 7.2 0 0 1-3.75-1.23v5.44c0 3.4-2.17 5.82-5.83 5.82-3.2 0-5.58-2.3-5.58-5.36 0-3.5 2.72-5.53 5.95-5.53.35 0 .7.03 1.03.1v2.7a3.8 3.8 0 0 0-.97-.13c-1.76 0-3.03 1.08-3.03 2.73 0 1.53 1.16 2.65 2.67 2.65 1.91 0 2.96-1.2 2.96-3.63V3h2.6Z" />
      </svg>
    );
  }

  if (platform === "facebook") {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-[18px] w-[18px]">
        <path d="M13.33 21v-7.86H16l.4-3.08h-3.07V8.09c0-.89.25-1.49 1.52-1.49h1.63V3.84c-.28-.04-1.24-.12-2.36-.12-2.33 0-3.93 1.42-3.93 4.03v2.31H7.54v3.08h2.65V21h3.14Z" />
      </svg>
    );
  }

  if (platform === "linkedin") {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-[18px] w-[18px]">
        <path d="M6.86 8.36a1.68 1.68 0 1 1 0-3.36 1.68 1.68 0 0 1 0 3.36ZM5.4 9.8h2.93V19H5.4V9.8Zm4.76 0h2.8v1.26H13c.39-.74 1.36-1.52 2.8-1.52 3 0 3.56 1.98 3.56 4.56V19h-2.93v-4.38c0-1.05-.02-2.39-1.46-2.39-1.46 0-1.68 1.14-1.68 2.31V19h-2.93V9.8Z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-[18px] w-[18px]">
      <path d="M18.901 2.25H21l-6.873 7.855L22.207 21.75H15.88l-4.953-6.474-5.665 6.474H3.16l7.349-8.399L2.75 2.25h6.488l4.477 5.908L18.901 2.25Zm-1.109 17.608h1.163L8.606 4.039H7.357l10.435 15.819Z" />
    </svg>
  );
}

const novianReasons = [
  {
    icon: UserRound,
    title: "Atendimento humano",
    description:
      "Acolhimento e escuta ativa para entender o que realmente faz sentido para você.",
  },
  {
    icon: Compass,
    title: "Seleção inteligente",
    description:
      "Imóveis criteriosamente avaliados para apresentar apenas o que tem valor real.",
  },
  {
    icon: ShieldCheck,
    title: "Transparência total",
    description:
      "Processos claros, documentação segura e comunicação constante em cada etapa.",
  },
  {
    icon: Building2,
    title: "Soluções completas",
    description:
      "Da compra à locação, assessoria completa para uma jornada tranquila.",
  },
];

const testimonials = [
  {
    quote:
      "A Novian tornou todo o processo leve e seguro. Fomos muito bem atendidos do início ao fim.",
    name: "Juliana M.",
    role: "Compradora",
    avatar: "/juliana.png",
  },
  {
    quote:
      "Profissionais incríveis. Encontraram o imóvel ideal para nossa família com muito cuidado e atenção.",
    name: "Ricardo e Fernanda",
    role: "Clientes",
    avatar: "/ricardo-fernanda.png",
  },
  {
    quote:
      "Transparência e agilidade que fazem toda a diferença. Recomendo de olhos fechados.",
    name: "Carlos T.",
    role: "Investidor",
    avatar: "/carlos.png",
  },
  {
    quote:
      "Atendimento impecável. Desde o primeiro contato sentimos muita segurança no processo. Tudo foi muito transparente e sem pressão.",
    name: "Marina D.",
    role: "Compradora",
    avatar: "/marina.png",
  },
  {
    quote:
      "O que mais me chamou atenção foi a curadoria. Não perdi tempo com opções ruins, só me mostraram imóveis que realmente faziam sentido.",
    name: "Eduardo R.",
    role: "Investidor",
    avatar: "/eduardo.png",
  },
  {
    quote:
      "Processo rápido, organizado e com muito cuidado nos detalhes. A equipe realmente se preocupa em entender o que você precisa.",
    name: "Patrícia L.",
    role: "Cliente",
    avatar: "/patricia.png",
  },
];

export default async function PropertiesListingPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const resolvedSearchParams = searchParams ? await searchParams : {};

  const properties = await getProperties();

  const activeProperties = properties.filter((property) => property.status === "active");
  const readSearchParam = (key: string) => {
    const value = resolvedSearchParams[key];
    return Array.isArray(value) ? value[0] || "" : value || "";
  };
  const locationQuery = readSearchParam("location").trim().toLowerCase();
  const propertyTypeFilter = readSearchParam("propertyType").trim();
  const priceRangeFilter = readSearchParam("priceRange").trim();
  const amenityFilter = readSearchParam("amenity").trim();
  const hasActiveFilters = Boolean(locationQuery || propertyTypeFilter || priceRangeFilter || amenityFilter);

  const getNumericMeta = (value: unknown) => {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string") {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }

    return null;
  };

  const matchesPriceRange = (price: number) => {
    if (!priceRangeFilter) {
      return true;
    }

    if (priceRangeFilter === "under_500k") return price <= 500_000;
    if (priceRangeFilter === "500k_1m") return price >= 500_000 && price <= 1_000_000;
    if (priceRangeFilter === "1m_2m") return price >= 1_000_000 && price <= 2_000_000;
    if (priceRangeFilter === "over_2m") return price >= 2_000_000;
    return true;
  };

  const availablePropertyTypes = Array.from(
    new Set(
      activeProperties
        .map((property) =>
          property.propertyType ||
          (typeof property.customData?.property_type === "string" ? property.customData.property_type : ""),
        )
        .filter(Boolean),
    ),
  ).sort((left, right) => left.localeCompare(right, "pt-BR"));

  const availableAmenities = Array.from(
    new Set(
      activeProperties.flatMap((property) => {
        if (Array.isArray(property.amenities) && property.amenities.length > 0) {
          return property.amenities;
        }

        return Array.isArray(property.customData?.amenities) ? property.customData.amenities : [];
      }),
    ),
  ).sort((left, right) => left.localeCompare(right, "pt-BR"));

  const filteredProperties = activeProperties.filter((property) => {
    const { primaryOffer } = getPropertyOfferSummary(property);
    const comparablePrice = primaryOffer?.price ?? property.price;
    const propertyType =
      property.propertyType ||
      (typeof property.customData?.property_type === "string" ? property.customData.property_type : "");
    const amenities =
      Array.isArray(property.amenities) && property.amenities.length > 0
        ? property.amenities
        : Array.isArray(property.customData?.amenities)
          ? property.customData.amenities
          : [];
    const locationMatches = !locationQuery || [
      property.address,
      property.city,
      property.neighborhood,
      property.state,
      property.title,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(locationQuery));

    return (
      locationMatches &&
      (!propertyTypeFilter || propertyType === propertyTypeFilter) &&
      matchesPriceRange(comparablePrice) &&
      (!amenityFilter || amenities.includes(amenityFilter))
    );
  });

  return (
    <div className="min-h-screen bg-novian-primary text-novian-text">
      <LandingHeader navLinks={navLinks} whatsappHref={whatsappHref} />

      <main>
        <section className="relative flex min-h-svh flex-col overflow-hidden">
          <HeroParallaxBackground imageUrl="/background.png" className="bg-position-[70%_center] lg:bg-center" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(250,248,243,0.985)_0%,rgba(250,248,243,0.98)_38%,rgba(250,248,243,0.72)_58%,rgba(250,248,243,0.24)_78%,rgba(250,248,243,0.08)_100%)] lg:bg-[linear-gradient(90deg,rgba(250,248,243,0.985)_0%,rgba(250,248,243,0.97)_24%,rgba(250,248,243,0.8)_41%,rgba(250,248,243,0.34)_57%,rgba(250,248,243,0.08)_74%,rgba(250,248,243,0)_100%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_34%_30%,rgba(255,255,255,0.99)_0%,rgba(255,255,255,0.965)_16%,rgba(250,248,243,0.84)_34%,rgba(250,248,243,0.44)_50%,rgba(250,248,243,0.12)_64%,rgba(250,248,243,0)_76%)] lg:bg-[radial-gradient(circle_at_34%_49%,rgba(255,255,255,0.99)_0%,rgba(255,255,255,0.965)_15%,rgba(250,248,243,0.86)_28%,rgba(250,248,243,0.46)_42%,rgba(250,248,243,0.12)_55%,rgba(250,248,243,0)_68%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(232,214,194,0.34),transparent_24rem)]" />
          <div className="absolute inset-y-0 left-[27%] hidden w-80 bg-[radial-gradient(circle,rgba(255,255,255,0.74)_0%,rgba(255,255,255,0.34)_38%,rgba(255,255,255,0)_72%)] blur-2xl lg:block" />

          <div className="relative mx-auto grid w-full bottom-[-24px] max-w-[1440px] flex-1 grid-cols-1 px-5 pb-6 pt-[88px] lg:grid-cols-[49%_51%] lg:px-14">
            <section className="relative z-10 max-w-[640px] self-start pb-60 pt-5 sm:pb-72 md:pb-80 lg:self-center lg:pb-2 lg:pt-6">
              <div className="flex items-center gap-4 text-[12px] font-semibold uppercase tracking-[0.18em] text-novian-accent">
                <span className="block h-px w-10 bg-novian-accent" />
                Imóveis selecionados em Jundiaí
              </div>

              <h1 className="mt-7 max-w-68 font-sans text-[3rem] font-medium leading-[0.92] tracking-[-0.07em] text-[#1f1f1f] sm:max-w-84 sm:text-[3.6rem] lg:max-w-[560px] lg:text-[4.85rem]">
                O próximo
                <br />
                capítulo da sua
                <br />
                vida <span className="font-medium text-[#5F7850]">começa aqui.</span>
              </h1>

              <p className="mt-5 max-w-84 text-[15px] leading-[1.55] text-[#3f3f3f] sm:max-w-md lg:max-w-[510px] lg:text-[17px]">
                Mais que imóveis, entregamos experiências. Atendimento humano,
                tecnologia e uma seleção cuidadosa para você encontrar o lugar ideal.
              </p>

              <div className="mt-7 flex flex-col gap-4 sm:flex-row sm:flex-wrap">
                <a
                  href="#collection"
                  className="inline-flex h-14 w-full items-center justify-center gap-3 rounded-[10px] bg-[linear-gradient(135deg,#2F4A3A,#5F7850)] px-6 text-[15px] font-medium text-white shadow-[0_18px_34px_rgba(47,74,58,0.16)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_44px_rgba(47,74,58,0.2)] sm:w-auto"
                >
                  <Building2 size={17} />
                  Ver imóveis disponíveis
                  <ArrowRight size={16} />
                </a>

                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-14 w-full items-center justify-center gap-3 rounded-[10px] border border-[rgba(47,74,58,0.2)] bg-[linear-gradient(180deg,rgba(255,255,255,0.6),rgba(250,248,243,0.42))] px-6 text-[15px] font-medium text-novian-accent shadow-[0_16px_34px_rgba(47,74,58,0.08),inset_0_1px_0_rgba(255,255,255,0.72)] backdrop-blur-xl transition hover:border-[rgba(47,74,58,0.28)] hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.72),rgba(250,248,243,0.52))] sm:w-auto"
                >
                  <MessageCircle size={17} />
                  Falar no WhatsApp
                </a>
              </div>

              <div className="mt-9 flex max-w-88 flex-col gap-4 text-[#202020] sm:max-w-none md:flex-row md:gap-0">
                {trustPillars.map((item, index) => {
                  const Icon = item.icon;

                  return (
                    <div
                      key={item.title}
                      className={`flex min-w-[170px] items-start gap-2.5 md:px-5 ${index === 0 ? "md:pl-0" : ""} ${index < trustPillars.length - 1 ? "md:border-r md:border-black/12" : ""}`}
                    >
                      <Icon size={20} className="mt-0.5 shrink-0 text-novian-accent" />
                      <p className="text-[12px] leading-[1.35] text-[#202020]">{item.title}</p>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="pointer-events-none absolute inset-x-0 bottom-0 top-18 z-0 overflow-hidden lg:pointer-events-auto lg:relative lg:inset-auto lg:z-10 lg:min-h-[340px]">
              <div className="absolute inset-x-0 bottom-0 top-0 flex items-end justify-end">
                <div className="absolute bottom-0 right-[-14%] h-[47svh] w-[92vw] max-w-none sm:right-[-8%] sm:h-[54svh] sm:w-[76vw] md:right-[-2%] md:w-[62vw] lg:bottom-[-10px] lg:right-[3%] lg:h-[104%] lg:w-[900px] lg:max-w-[520px] xl:max-w-[640px]">
                  <Image
                    src="/barbara3.png"
                    alt="Consultora Novian"
                    fill
                    priority
                    className="object-contain object-bottom-right lg:object-cover"
                    sizes="(min-width: 1280px) 42vw, (min-width: 1024px) 44vw, (min-width: 640px) 72vw, 92vw"
                  />
                </div>
              </div>
            </section>
          </div>

          <div className="relative z-10 bg-[rgba(248,243,235,0.96)] px-5 py-4 lg:px-10">
            <div className="mx-auto grid max-w-[1440px] grid-cols-2 items-center gap-x-5 gap-y-4 md:grid-cols-2 lg:grid-cols-4 lg:gap-0 lg:px-10">
            {signatureNumbers.map((item) => (
                <div key={item.label} className="border-b border-black/10 pb-2 last:border-b-0 md:border-b md:last:border-b-0 lg:border-b-0 lg:border-r lg:pb-0 lg:pl-5 lg:last:border-r-0">
                  <p className="font-serif text-[27px] leading-none text-[#5F7850]">{item.value}</p>
                  <p className="mt-1 text-[12px] text-[#333]">{item.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-6 py-12 lg:px-8 lg:py-16">
          <div
            className="relative mx-auto max-w-7xl overflow-hidden rounded-[30px] bg-[#0c1815] shadow-[0_30px_80px_rgba(7,19,18,0.24)]"
            style={{ backgroundImage: "url('/search-bg.png')", backgroundPosition: "center", backgroundSize: "cover" }}
          >
            <div className="absolute -inset-px bg-[linear-gradient(90deg,rgba(7,19,18,0.85)_0%,rgba(7,19,18,0.7)_40%,rgba(7,19,18,0.4)_100%)] backdrop-blur-[6px]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(143,167,107,0.14),transparent_28rem)]" />

            <div className="relative z-10 px-6 py-8 sm:px-8 sm:py-10 lg:px-14 lg:py-14">
              <div className="mb-8 flex flex-col gap-8 lg:mb-10 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#A8BE8A] sm:text-xs">
                    Encontre o imóvel ideal
                  </p>
                  <h2 className="max-w-3xl text-[2rem] font-medium leading-[1.02] tracking-[-0.05em] text-white sm:text-[2.35rem] lg:text-[3.3rem]">
                    Busque imóveis selecionados
                    <br className="hidden sm:block" />
                    para o <span className="text-[#8FA76B]">seu momento.</span>
                  </h2>
                </div>

                <div className="hidden max-w-xs items-center gap-5 border-l border-white/20 pl-8 text-white/85 lg:flex">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#8FA76B]/16 text-[#A8BE8A]">
                    <Star size={18} />
                  </div>
                  <p className="text-base leading-relaxed">
                    Imóveis selecionados,
                    <br />
                    não listados em massa.
                  </p>
                </div>
              </div>

              <form method="get" className="grid gap-4 xl:grid-cols-[1.15fr_1fr_1fr_1fr_0.9fr]">
                <label className="rounded-[18px] border border-white/20 bg-white/90 px-5 py-4 shadow-lg backdrop-blur-md">
                  <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.22em] text-[#1F2B2A]">
                    Localização
                  </span>
                  <span className="flex items-center justify-between gap-4">
                    <input
                      name="location"
                      type="text"
                      placeholder="Bairro, cidade ou região"
                      defaultValue={readSearchParam("location")}
                      className="w-full bg-transparent text-[15px] text-[#1F2B2A] outline-none placeholder:text-[#64706b]"
                    />
                    <MapPin size={18} className="shrink-0 text-[#1F2B2A]" />
                  </span>
                </label>

                <label className="rounded-[18px] border border-white/20 bg-white/90 px-5 py-4 shadow-lg backdrop-blur-md">
                  <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.22em] text-[#1F2B2A]">
                    Tipo de imóvel
                  </span>
                  <select
                    name="propertyType"
                    defaultValue={propertyTypeFilter}
                    className="w-full appearance-none bg-transparent text-[15px] text-[#4f5a55] outline-none"
                  >
                    <option value="">Selecione o tipo</option>
                    {availablePropertyTypes.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="rounded-[18px] border border-white/20 bg-white/90 px-5 py-4 shadow-lg backdrop-blur-md">
                  <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.22em] text-[#1F2B2A]">
                    Faixa de preço
                  </span>
                  <select
                    name="priceRange"
                    defaultValue={priceRangeFilter}
                    className="w-full appearance-none bg-transparent text-[15px] text-[#4f5a55] outline-none"
                  >
                    <option value="">Selecione a faixa</option>
                    <option value="under_500k">Até R$ 500 mil</option>
                    <option value="500k_1m">R$ 500 mil a R$ 1 mi</option>
                    <option value="1m_2m">R$ 1 mi a R$ 2 mi</option>
                    <option value="over_2m">Acima de R$ 2 mi</option>
                  </select>
                </label>

                <label className="rounded-[18px] border border-white/20 bg-white/90 px-5 py-4 shadow-lg backdrop-blur-md">
                  <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.22em] text-[#1F2B2A]">
                    Amenidades
                  </span>
                  <select
                    name="amenity"
                    defaultValue={amenityFilter}
                    className="w-full appearance-none bg-transparent text-[15px] text-[#4f5a55] outline-none"
                  >
                    <option value="">Selecione uma amenidade</option>
                    {availableAmenities.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  type="submit"
                  className="inline-flex min-h-[76px] items-center justify-center gap-3 rounded-[18px] bg-[#5E7F49] px-6 py-5 text-base font-semibold text-white shadow-lg shadow-green-900/30 transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#4F6F3D]"
                >
                  <Search size={18} />
                  Buscar imóveis
                  <ArrowRight size={16} />
                </button>
              </form>

              <div className="mt-6 flex flex-col gap-3 text-sm leading-6 text-white/85 sm:flex-row sm:items-center sm:justify-between">
                <p className="flex items-start gap-2.5">
                  <ShieldCheck size={16} className="mt-1 shrink-0 text-[#A8BE8A]" />
                  {filteredProperties.length} {filteredProperties.length === 1 ? "imóvel encontrado" : "imóveis encontrados"} com os filtros atuais.
                </p>
                {hasActiveFilters ? (
                  <Link href="/" className="text-sm font-medium text-[#A8BE8A] transition hover:text-white">
                    Limpar filtros
                  </Link>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        <section id="collection" className="px-6 py-18 lg:px-8 lg:py-20">
          <div className="mx-auto max-w-7xl">
            <div className="mb-8 flex flex-col gap-5 md:mb-10 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-novian-accent/72 sm:text-xs">
                  <span className="h-px w-8 bg-novian-accent/46" />
                  Imóveis em destaque
                </p>
                <h2 className="mt-3 text-[2rem] font-medium leading-tight tracking-[-0.04em] text-novian-text sm:text-[2.45rem]">
                  {hasActiveFilters ? "Resultados da busca" : "Selecionados para você"}
                </h2>
              </div>
              <p className="text-sm text-novian-text/58">
                {filteredProperties.length} {filteredProperties.length === 1 ? "imóvel disponível" : "imóveis disponíveis"}.
              </p>
            </div>

            {filteredProperties.length === 0 ? (
              <div className="rounded-[28px] border border-novian-muted/55 bg-white px-8 py-12 text-center">
                <p className="text-lg font-medium text-novian-text">Nenhum imóvel encontrado</p>
                <p className="mt-2 text-sm text-novian-text/58">
                  Ajuste os filtros ou fale com a equipe Novian para uma seleção personalizada.
                </p>
              </div>
            ) : (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              {filteredProperties.map((property) => {
                const { primaryOffer, saleOffer, rentOffer } = getPropertyOfferSummary(property);
                const propertyTypeLabel =
                  property.propertyType ||
                  (typeof property.customData?.property_type === "string" ? property.customData.property_type : "Imóvel");
                const propertyRegion = property.city || property.neighborhood || property.address?.split("-")[0]?.trim() || "";
                const bedrooms = getNumericMeta(property.customData?.bedrooms);
                const bathrooms = getNumericMeta(property.customData?.bathrooms);
                const parking = getNumericMeta(property.customData?.parking);
                const area = getNumericMeta(property.customData?.area);
                const addressPreview = property.address?.split("-")[0]?.trim() || "Localização sob consulta";
                const offerLabel = saleOffer && rentOffer ? "Venda e locação" : rentOffer ? "Para locação" : "À venda";
                const metrics = [
                  bedrooms ? { icon: BedDouble, value: bedrooms } : null,
                  bathrooms ? { icon: Bath, value: bathrooms } : null,
                  parking ? { icon: CarFront, value: parking } : null,
                  area ? { icon: Ruler, value: `${area} m²` } : null,
                ].filter(Boolean) as Array<{ icon: typeof BedDouble; value: number | string }>;

                return (
                  <PropertyListingTracker
                    key={property.id}
                    property={{
                      id: property.id,
                      slug: property.slug,
                      title: property.title,
                      price: primaryOffer?.price ?? property.price,
                      address: property.address,
                    }}
                  >
                    <article className="h-full overflow-hidden rounded-[24px] border border-novian-muted/65 bg-white/86 shadow-[0_18px_42px_rgba(47,74,58,0.06)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_52px_rgba(47,74,58,0.1)]">
                      <div className="relative overflow-hidden rounded-t-[24px]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={property.coverImage}
                          alt={property.title}
                          className="aspect-[1.28/1] w-full object-cover transition duration-700 group-hover:scale-[1.04]"
                        />
                        <div className="absolute left-3 top-3 rounded-full border border-white/70 bg-white/94 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#425445] shadow-[0_8px_20px_rgba(15,23,20,0.08)]">
                          {offerLabel}
                        </div>
                      </div>

                      <div className="flex flex-col px-4 pb-4 pt-4">
                        <div>
                          <p className="text-[15px] font-medium leading-tight text-novian-text/74">
                            {propertyTypeLabel}
                          </p>
                          <p className="mt-1 text-[17px] font-medium leading-tight text-novian-text">
                            {propertyRegion || addressPreview}
                          </p>
                        </div>

                        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] text-novian-text/56">
                          {metrics.map((item, index) => {
                            const Icon = item.icon;

                            return (
                              <span key={`${property.id}-${index}`} className="inline-flex items-center gap-1.5">
                                <Icon size={14} className="text-novian-text/42" />
                                {item.value}
                              </span>
                            );
                          })}
                        </div>

                        <div className="mt-6 flex items-end justify-between gap-4 border-t border-novian-muted/55 pt-5">
                          <div>
                            <p className="text-[1.05rem] font-semibold text-novian-text sm:text-[1.15rem]">
                              {formatPropertyOfferLabel(primaryOffer)}
                            </p>
                          </div>
                          <span className="inline-flex items-center gap-2 text-sm font-semibold text-novian-accent">
                            Ver detalhes
                            <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
                          </span>
                        </div>
                      </div>
                    </article>
                  </PropertyListingTracker>
                );
              })}
            </div>
            )}
          </div>
        </section>

        <section id="experience" className="px-6 py-18 lg:px-8 lg:py-22">
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-novian-accent/68 sm:text-xs">
                Por que escolher a Novian
              </p>
              <h2 className="mt-4 text-[2rem] font-medium leading-tight tracking-[-0.05em] text-novian-text sm:text-[2.5rem]">
                Muito além de intermediar negócios
              </h2>
            </div>

            <div className="mt-12 grid gap-8 sm:grid-cols-2 xl:grid-cols-4 xl:gap-10">
              {novianReasons.map((reason) => {
                const Icon = reason.icon;

                return (
                  <article key={reason.title} className="max-w-sm">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full border border-novian-muted/70 bg-novian-surface-soft/72 text-novian-accent shadow-[0_10px_24px_rgba(47,74,58,0.05)]">
                      <Icon size={22} strokeWidth={1.9} />
                    </div>
                    <h3 className="mt-5 text-[1.25rem] font-semibold tracking-[-0.03em] text-novian-text">
                      {reason.title}
                    </h3>
                    <p className="mt-3 text-[15px] leading-8 text-novian-text/64">
                      {reason.description}
                    </p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="px-6 pb-8 lg:px-8 lg:pb-12">
          <div
            className="relative mx-auto max-w-7xl overflow-hidden rounded-[30px] bg-[#0b1412] shadow-[0_28px_70px_rgba(10,18,16,0.2)]"
            style={{ backgroundImage: "url('/cta-bg.png')", backgroundPosition: "center", backgroundSize: "cover" }}
          >
            <div className="absolute -inset-px bg-[linear-gradient(90deg,rgba(7,19,18,0.85)_0%,rgba(7,19,18,0.7)_40%,rgba(7,19,18,0.4)_100%)] backdrop-blur-[6px]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(95,120,80,0.14),transparent_24rem)]" />

            <div className="relative z-10 flex flex-col gap-8 px-6 py-8 sm:px-8 lg:flex-row lg:items-center lg:justify-between lg:px-12 lg:py-10">
              <div className="max-w-2xl">
                <h2 className="text-[2rem] font-medium leading-[1.02] tracking-[-0.05em] text-white sm:text-[2.5rem] lg:text-[3rem]">
                  Pronto para encontrar
                  <br />
                  seu próximo lar?
                </h2>
                <p className="mt-4 max-w-xl text-[15px] leading-7 text-white/85 lg:text-base">
                  Conte com a Novian para transformar planos em realidade. Fale com nossa equipe e descubra as melhores oportunidades.
                </p>
              </div>

              <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-[58px] items-center justify-center gap-3 rounded-[18px] bg-[#5E7F49] px-6 py-4 text-sm font-semibold text-white shadow-lg shadow-green-900/30 transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#4F6F3D] lg:min-w-[238px]"
                >
                  <MessageCircle size={18} />
                  Falar no WhatsApp
                  <ArrowRight size={16} />
                </a>

                <GoogleCalendarButton className="inline-flex min-h-[58px] items-center justify-center gap-3 rounded-[18px] border border-white/18 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(250,248,243,0.92))] px-6 py-4 text-sm font-semibold text-[#1f1f1f] shadow-[0_16px_34px_rgba(8,18,17,0.12)] transition hover:-translate-y-0.5 hover:bg-white lg:min-w-[250px]">
                  <CalendarDays size={18} />
                  Agendar uma conversa
                  <ArrowRight size={16} />
                </GoogleCalendarButton>
              </div>
            </div>
          </div>
        </section>

        <section className="px-6 py-16 lg:px-8 lg:py-20">
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-novian-accent/68 sm:text-xs">
                Quem confia, recomenda
              </p>
              <h2 className="mt-4 text-[2rem] font-medium leading-tight tracking-[-0.05em] text-novian-text sm:text-[2.5rem]">
                Histórias que nos inspiram
              </h2>
            </div>
            <TestimonialsCarousel testimonials={testimonials} />
          </div>
        </section>
      </main>

      <footer id="contact" className="pt-8">
        <div className="w-full overflow-hidden border-y border-novian-muted/60 bg-[linear-gradient(135deg,rgba(255,255,255,0.94),rgba(245,239,229,0.98))] shadow-[0_24px_80px_rgba(47,74,58,0.08)]">
          <div className="relative px-6 py-8 sm:px-8 lg:px-10 lg:py-10">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(95,120,80,0.08),transparent_30rem)]" />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.22),transparent_22%,rgba(243,237,227,0.42))]" />

            <div className="relative">
              <div className="grid gap-8 border-b border-novian-muted/55 pb-8 lg:grid-cols-[1.25fr_0.75fr_0.75fr_1.1fr] lg:gap-10">
                <div>
                  <Image
                    src="/logo.png"
                    alt="Novian"
                    width={168}
                    height={40}
                    className="h-8 w-auto object-contain"
                  />
                  <p className="mt-5 max-w-sm text-sm leading-7 text-novian-text/68">
                    Imóveis selecionados, atendimento próximo e inteligência aplicada para tornar cada decisão mais segura e elegante.
                  </p>

                  <div className="mt-6 flex flex-wrap gap-2">
                    <span className="rounded-full border border-novian-accent/15 bg-white/72 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-novian-accent/80">
                      Jundiaí e região
                    </span>
                    <span className="rounded-full border border-novian-accent/15 bg-white/72 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-novian-accent/80">
                      Atendimento consultivo
                    </span>
                  </div>

                  <div className="mt-6 flex items-center gap-2.5">
                    {socialLinks.map((item) => (
                      <a
                        key={item.label}
                        href={item.href}
                        aria-label={item.label}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-novian-accent/14 bg-white/78 text-novian-text/70 transition hover:border-novian-accent/24 hover:bg-white hover:text-novian-accent"
                      >
                        <SocialIcon platform={item.platform} />
                      </a>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-novian-text/45">
                    Navegação
                  </p>
                  <div className="mt-4 flex flex-col gap-3">
                    {footerNavigation.map((item) =>
                      item.href.startsWith("/") ? (
                        <Link
                          key={item.label}
                          href={item.href}
                          className="text-sm text-novian-text/68 transition hover:text-novian-accent"
                        >
                          {item.label}
                        </Link>
                      ) : (
                        <a
                          key={item.label}
                          href={item.href}
                          target={item.href.startsWith("http") ? "_blank" : undefined}
                          rel={item.href.startsWith("http") ? "noreferrer" : undefined}
                          className="text-sm text-novian-text/68 transition hover:text-novian-accent"
                        >
                          {item.label}
                        </a>
                      ),
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-novian-text/45">
                    Soluções
                  </p>
                  <div className="mt-4 flex flex-col gap-3">
                    {footerSolutions.map((item) => (
                      <p key={item} className="text-sm text-novian-text/68">
                        {item}
                      </p>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="rounded-[28px] border border-novian-accent/14 bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(249,246,240,0.84))] p-5">
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-novian-text/45">
                      Atendimento
                    </p>
                    <h3 className="mt-3 text-[1.65rem] font-medium leading-[1.05] tracking-[-0.04em] text-novian-text">
                      Fale com a Novian do jeito que for melhor para você.
                    </h3>

                    <div className="mt-5 space-y-3 text-sm text-novian-text/70">
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-[rgba(95,120,80,0.12)] text-novian-accent">
                          <Phone size={16} />
                        </span>
                        <div>
                          <p className="font-semibold text-novian-text">WhatsApp</p>
                          <p>(11) 96548-9677</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-[rgba(95,120,80,0.12)] text-novian-accent">
                          <MapPin size={16} />
                        </span>
                        <div>
                          <p className="font-semibold text-novian-text">Atuação</p>
                          <p>Jundiaí e região</p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 flex flex-col gap-3">
                      <a
                        href={whatsappHref}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex min-h-[54px] items-center justify-center gap-3 rounded-[10px] bg-[#5E7F49] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#4F6F3D]"
                      >
                        <MessageCircle size={17} />
                        Falar no WhatsApp
                        <ArrowRight size={16} />
                      </a>
                      <GoogleCalendarButton className="inline-flex min-h-[54px] items-center justify-center gap-3 rounded-[10px] border border-novian-accent/16 bg-white/86 px-5 py-3 text-sm font-semibold text-novian-text transition hover:bg-white">
                        <CalendarDays size={17} />
                        Agendar uma conversa
                        <ArrowRight size={16} />
                      </GoogleCalendarButton>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-4 text-sm text-novian-text/56 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-col gap-2">
                  <p>Corretora responsável: Bárbara Camargo - CRECI 301258-F.</p>
                  <p className="inline-flex items-center gap-2 text-novian-text/62">
                    Feito com
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[rgba(95,120,80,0.12)] text-novian-accent">
                      <Heart size={13} className="fill-current" />
                    </span>
                    em Jundiaí. Orgulhosamente uma empresa remote-first.
                  </p>
                </div>
                <div className="flex flex-col gap-2 lg:items-end">
                  <p>&copy; {new Date().getFullYear()} Novian Living. Todos os direitos reservados.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </footer>

      <a
        href={whatsappHref}
        target="_blank"
        rel="noreferrer"
        aria-label="Falar com a Novian no WhatsApp"
        className="group fixed bottom-4 right-4 z-70 flex items-center gap-2 rounded-full border border-[rgba(47,74,58,0.14)] bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(250,248,243,0.88))] px-2.5 py-2.5 shadow-[0_14px_34px_rgba(47,74,58,0.14)] backdrop-blur-xl transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(47,74,58,0.18)] sm:bottom-6 sm:right-6 sm:gap-3 sm:px-3"
      >
        <div className="relative shrink-0">
          <div className="relative h-11 w-11 overflow-hidden rounded-full border border-white/80 shadow-[0_8px_18px_rgba(47,74,58,0.14)] sm:h-12 sm:w-12">
            <Image
              src="/mariana-silva.png"
              alt="Atendimento Novian"
              fill
              className="object-cover transition duration-500 group-hover:scale-[1.04]"
              sizes="48px"
            />
          </div>
        </div>

        <div className="hidden min-w-0 sm:block">
          <p className="text-[13px] font-semibold leading-none text-novian-text">Fale com a Novian</p>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-novian-text/56">
            <span className="inline-flex items-center gap-1 rounded-full bg-[rgba(37,211,102,0.12)] px-1.5 py-0.5 font-semibold uppercase tracking-[0.14em] text-[#1f8f4d]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#25D366]" />
              Online
            </span>
            <span>WhatsApp</span>
          </div>
        </div>

        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#25D366,#1f8f4d)] text-white shadow-[0_8px_18px_rgba(37,211,102,0.22)] transition duration-300 group-hover:scale-[1.03]">
          <MessageCircle size={17} />
        </div>
      </a>
    </div>
  );
}
