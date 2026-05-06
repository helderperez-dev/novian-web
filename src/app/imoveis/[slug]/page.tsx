import { getPropertyFields } from "@/lib/store";
import { getActivePropertyBySlug } from "@/lib/properties";
import { formatPropertyFieldValue, formatPropertyOfferLabel, getPropertyOfferSummary, getVisiblePropertyFieldEntries, normalizePropertyDisplayText } from "@/lib/property-utils";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import LandingHeader from "@/app/LandingHeader";
import LeadForm from "./LeadForm";
import PropertyEngagementTracker from "./PropertyEngagementTracker";
import PropertyGalleryViewer from "@/components/PropertyGalleryViewer";
import { getPropertyFieldIcon } from "@/lib/property-field-icons";
import GoogleCalendarButton from "@/app/GoogleCalendarButton";
import TestimonialsCarousel from "@/app/TestimonialsCarousel";
import { ArrowRight, CalendarDays, Heart, MapPin, MessageCircle, Phone } from "lucide-react";

const RICH_TEXT_HTML_PATTERN = /<\/?[a-z][\s\S]*>/i;
const whatsappHref =
  "https://wa.me/5511965489677?text=Ol%C3%A1%2C%20quero%20conhecer%20os%20im%C3%B3veis%20da%20Novian.";
const navLinks = [
  { href: "/#collection", label: "Imóveis" },
  { href: "/#experience", label: "Quem somos" },
  { href: "/#experience", label: "Soluções" },
  { href: whatsappHref, label: "Contato" },
];
const footerNavigation = [
  { href: "/#collection", label: "Imóveis selecionados" },
  { href: "/#experience", label: "Experiência Novian" },
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

type SocialPlatform = "instagram" | "facebook";

const socialLinks: { label: string; href: string; platform: SocialPlatform }[] = [
  {
    label: "Instagram",
    href: "https://www.instagram.com/barbara_camargocorretora/",
    platform: "instagram",
  },
  {
    label: "Facebook",
    href: "https://www.facebook.com/profile.php?id=100085177520030",
    platform: "facebook",
  },
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

  if (platform === "facebook") {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-[18px] w-[18px]">
        <path d="M13.33 21v-7.86H16l.4-3.08h-3.07V8.09c0-.89.25-1.49 1.52-1.49h1.63V3.84c-.28-.04-1.24-.12-2.36-.12-2.33 0-3.93 1.42-3.93 4.03v2.31H7.54v3.08h2.65V21h3.14Z" />
      </svg>
    );
  }
}
const SUMMARY_FIELD_PRIORITY = ["property_type", "area", "bedrooms", "bathrooms", "parking"];

function splitTitleIntoTwoLines(title: string) {
  const words = title.trim().split(/\s+/).filter(Boolean);

  if (words.length <= 2) {
    return [title];
  }

  const midpoint = Math.ceil(words.length / 2);
  return [words.slice(0, midpoint).join(" "), words.slice(midpoint).join(" ")];
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const resolvedParams = await params;
  const [property, propertyFields] = await Promise.all([
    getActivePropertyBySlug(resolvedParams.slug),
    getPropertyFields(),
  ]);

  if (!property) {
    return {
      title: "Imóvel não encontrado | Novian",
    };
  }

  const { primaryOffer } = getPropertyOfferSummary(property);
  const visiblePageFields = getVisiblePropertyFieldEntries(property, propertyFields, "page");
  
  const getFieldValue = (id: string) => {
    const entry = visiblePageFields.find(({ field }) => field.id === id);
    return entry ? formatPropertyFieldValue(entry.value!, entry.field) : null;
  };

  const propertyType = getFieldValue("property_type") || "Imóvel";
  const bedrooms = getFieldValue("bedrooms");
  const area = getFieldValue("area");
  
  const detailsParts = [];
  if (bedrooms) detailsParts.push(`${bedrooms} Quartos`);
  if (area) detailsParts.push(area);
  const detailsText = detailsParts.length > 0 ? ` • ${detailsParts.join(" • ")}` : "";
  
  const priceText = primaryOffer ? ` por ${formatPropertyOfferLabel(primaryOffer)}` : "";
  
  const neighborhood = getFieldValue("neighborhood");
  const city = getFieldValue("city");
  const locationParts = [];
  if (neighborhood) locationParts.push(neighborhood);
  if (city) locationParts.push(city);
  const locationText = locationParts.length > 0 ? ` em ${locationParts.join(", ")}` : "";

  const title = `${propertyType}${detailsText}${locationText}${priceText}`;
  
  const rawDescription = property.landingPage?.heroSubtitle || property.description || "";
  const cleanDescription = rawDescription.replace(/<\/?[^>]+(>|$)/g, "").substring(0, 160);
  const description = cleanDescription.length === 160 ? `${cleanDescription}...` : cleanDescription;
  
  const ogImage = property.coverImage || "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&q=80&w=1200";

  return {
    title: `${title} | Novian`,
    description,
    openGraph: {
      title: `${title} | Novian`,
      description,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | Novian`,
      description,
      images: [ogImage],
    },
  };
}

export default async function PropertyLandingPage({ params }: { params: Promise<{ slug: string }> }) {
  await connection();
  const resolvedParams = await params;
  const [property, propertyFields] = await Promise.all([
    getActivePropertyBySlug(resolvedParams.slug),
    getPropertyFields(),
  ]);

  if (!property) {
    notFound();
  }

  const { landingPage } = property;
  const primaryColor = landingPage.primaryColor || '#DEC0A6'; // Default novian accent
  const hasRichDescription = RICH_TEXT_HTML_PATTERN.test(property.description);
  const { primaryOffer, saleOffer, rentOffer } = getPropertyOfferSummary(property);
  const secondaryOffers = [saleOffer, rentOffer].filter(
    (offer): offer is NonNullable<typeof saleOffer> => {
      if (!offer) {
        return false;
      }

      if (!primaryOffer) {
        return true;
      }

      return offer.offerType !== primaryOffer.offerType || offer.price !== primaryOffer.price;
    },
  );
  const HIDDEN_PAGE_FIELD_KEYS = new Set([
    "street",
    "street_number",
    "complement",
    "postal_code",
    "country",
    "accepts_exchange",
  ]);

  const visiblePageFields = getVisiblePropertyFieldEntries(property, propertyFields, "page")
    .filter(({ field }) => !HIDDEN_PAGE_FIELD_KEYS.has(field.id));
  const prioritizedHighlights = SUMMARY_FIELD_PRIORITY.map((fieldId) =>
    visiblePageFields.find(({ field }) => field.id === fieldId),
  ).filter((entry): entry is NonNullable<(typeof visiblePageFields)[number]> => Boolean(entry));
  const fallbackHighlights = visiblePageFields.filter(
    ({ field }) => !SUMMARY_FIELD_PRIORITY.includes(field.id),
  );
  const topHighlights = [...prioritizedHighlights, ...fallbackHighlights].slice(0, 5);
  const topHighlightIds = new Set(topHighlights.map(({ field }) => field.id));
  const remainingPageFields = visiblePageFields.filter(({ field }) => !topHighlightIds.has(field.id));
  const heroTitleLines = splitTitleIntoTwoLines(landingPage.heroTitle);
  const summaryGridClass = secondaryOffers.length > 0 ? "xl:grid-cols-8" : "xl:grid-cols-7";
  const contactCard = (
    <div
      id="contato"
      className="relative overflow-hidden rounded-[32px] border border-[#d8ccbe] bg-[linear-gradient(180deg,#fffaf4,#f3ece3)] p-6 shadow-[0_26px_60px_rgba(47,74,58,0.08)] md:p-7"
    >
      <div
        className="pointer-events-none absolute inset-0 rounded-[32px] opacity-80"
        style={{
          background:
            "linear-gradient(145deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.18) 35%, rgba(255,255,255,0) 100%)",
        }}
      />
      <div className="relative z-10 space-y-6">
        <div className="space-y-2">
          <h3 className="font-serif text-[2rem] font-light leading-tight text-[#1f2421]">Fale com um especialista</h3>
          <p className="max-w-136 text-sm leading-7 text-[#66706b]">
            Preencha seus dados para receber um atendimento exclusivo e {landingPage.showLeadMagnet ? "baixar o material completo do imóvel." : "agendar sua visita."}
          </p>
        </div>

        {property.broker ? (
          <div className="rounded-[24px] border border-[#ddd3c7] bg-white/75 px-4 py-4">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/10 text-lg font-medium text-white">
                {property.broker.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={property.broker.avatarUrl}
                    alt={property.broker.fullName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  property.broker.fullName
                    .split(" ")
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((part) => part[0]?.toUpperCase() || "")
                    .join("")
                    .slice(0, 2)
                )}
              </div>
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[#7c847f]">Corretor responsável</p>
                <p className="mt-1 text-xl font-medium text-[#1f2421]">{property.broker.fullName}</p>
                <p className="mt-2 text-sm text-[#66706b]">
                  {property.broker.creci ? `CRECI ${property.broker.creci}` : "Equipe Novian"}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <LeadForm
          propertyId={property.id}
          propertySlug={property.slug}
          primaryColor={primaryColor}
          showLeadMagnet={landingPage.showLeadMagnet}
          leadMagnetTitle={landingPage.leadMagnetTitle}
          callToActionText={landingPage.callToActionText}
          propertyTitle={property.title}
          propertyPrice={primaryOffer?.price ?? property.price}
          propertyAddress={property.address}
        />
      </div>
    </div>
  );

  return (
    <div
      className="min-h-screen bg-[#f6f1ea] font-sans text-[#1f2421] selection:bg-(--color-primary)/20"
      style={{ "--color-primary": primaryColor } as React.CSSProperties}
    >
      <LandingHeader navLinks={navLinks} whatsappHref={whatsappHref} />

      {/* Hero Section */}
      <section className="pb-8 pt-20 lg:pt-[82px]">
        <div className="relative overflow-hidden border-y border-black/6 bg-[#10201b] shadow-[0_32px_90px_rgba(16,32,27,0.18)]">
            <div className="absolute inset-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={property.coverImage || "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&q=80&w=1920"}
                alt={property.title}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(8,18,16,0.92)_0%,rgba(8,18,16,0.82)_34%,rgba(8,18,16,0.42)_64%,rgba(8,18,16,0.2)_100%)]" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(222,192,166,0.18),transparent_24rem)]" />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,18,16,0.08)_0%,rgba(8,18,16,0.12)_30%,rgba(8,18,16,0.75)_100%)]" />
            </div>

            <div className="relative z-10 mx-auto flex min-h-[720px] w-full max-w-[1440px] flex-col justify-between px-6 py-8 sm:px-8 sm:py-10 lg:px-12 lg:py-12">
              <div className="max-w-[620px] pt-12 sm:pt-16 lg:pt-20">
                <div className="flex flex-wrap items-center gap-3">
                  {property.isExclusiveNovian ? (
                    <div
                      className="inline-flex rounded-full border border-white/14 bg-white/6 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#e8d6c2] backdrop-blur-md"
                    >
                      Exclusividade Novian
                    </div>
                  ) : null}
                </div>

                <h1 className="mt-8 max-w-[10ch] font-serif text-[3.35rem] font-light leading-[0.96] tracking-[-0.05em] text-white sm:max-w-[11ch] sm:text-[4.4rem] lg:max-w-[11.5ch] lg:text-[5.15rem]">
                  {heroTitleLines.map((line, index) => (
                    <span key={`${line}-${index}`} className="block">
                      {line}
                    </span>
                  ))}
                </h1>

                <p className="mt-6 max-w-[560px] text-[16px] leading-8 text-white/72 sm:text-[17px]">
                  {landingPage.heroSubtitle}
                </p>

                <div className="mt-6 flex flex-wrap gap-2">
                  <span className="inline-flex rounded-full border border-white/12 bg-white/7 px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-white/70">
                    {saleOffer && rentOffer ? "Venda e locação" : rentOffer ? "Locação" : "Venda"}
                  </span>
                  {topHighlights.slice(0, 2).map(({ field, value }) => (
                    <span
                      key={field.id}
                      className="inline-flex rounded-full border border-white/12 bg-white/7 px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-white/70"
                    >
                      {field.name}: {formatPropertyFieldValue(value!, field)}
                    </span>
                  ))}
                </div>

                <div className="mt-8">
                  <PropertyEngagementTracker
                    property={{
                      id: property.id,
                      slug: property.slug,
                      title: property.title,
                      price: primaryOffer?.price ?? property.price,
                      address: property.address,
                    }}
                    primaryColor={primaryColor}
                    callToActionText={landingPage.callToActionText}
                    showLeadMagnet={landingPage.showLeadMagnet}
                    leadMagnetTitle={landingPage.leadMagnetTitle}
                    variant="hero"
                    trackPageView
                  />
                </div>
              </div>
            </div>
        </div>
      </section>


      <section className="px-6 pb-8 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className={`grid gap-3 md:grid-cols-2 ${summaryGridClass}`}>
            <div className="rounded-[24px] border border-[#ddd3c7] bg-white/82 px-5 py-5 shadow-[0_14px_32px_rgba(47,74,58,0.05)] xl:col-span-2">
              <p className="text-[11px] uppercase tracking-[0.18em] text-[#7c847f]">Valor do imóvel</p>
              <p className="mt-2 font-serif text-[32px] font-light leading-none text-[#1f2421]">{formatPropertyOfferLabel(primaryOffer)}</p>
              {saleOffer && rentOffer ? (
                <p className="mt-3 text-[11px] uppercase tracking-[0.18em] text-[#7c847f]">Venda e locação disponíveis</p>
              ) : null}
            </div>

            {secondaryOffers.map((offer) => (
              <div key={offer.offerType} className="rounded-[24px] border border-[#ddd3c7] bg-white/82 px-5 py-5 shadow-[0_14px_32px_rgba(47,74,58,0.05)]">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[#7c847f]">
                  {offer.offerType === "rent" ? "Locação" : "Venda"}
                </p>
                <p className="mt-2 text-lg font-medium text-[#1f2421]">{formatPropertyOfferLabel(offer)}</p>
              </div>
            ))}

            {topHighlights.map(({ field, value }) => (
              <div key={field.id} className="rounded-[24px] border border-[#ddd3c7] bg-white/82 px-5 py-5 shadow-[0_14px_32px_rgba(47,74,58,0.05)]">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-[#7c847f]">{normalizePropertyDisplayText(field.name)}</p>
                  {field.iconName ? (
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[#e4d8cc] bg-[#f7f1ea] text-[#7c847f]">
                      {(() => {
                        const Icon = getPropertyFieldIcon(field.iconName);
                        return <Icon size={16} strokeWidth={1.7} />;
                      })()}
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-lg font-medium text-[#1f2421]">{formatPropertyFieldValue(value!, field)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Description Section */}
      <section className="px-6 py-20 lg:px-8 lg:py-24">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)] lg:items-start lg:gap-14">
          <div className="space-y-12">
            <div className="space-y-6">
              <div className="inline-flex rounded-full border border-[#d8ccbe] bg-white/75 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#6f7d68]">
                Sobre o imóvel
              </div>
              {hasRichDescription ? (
                <div
                  className="prose max-w-none text-[17px] leading-8 text-[#525b56] prose-p:text-[#525b56] prose-headings:font-serif prose-headings:font-light prose-a:text-(--color-primary)"
                  dangerouslySetInnerHTML={{ __html: property.description }}
                />
              ) : (
                <div className="prose max-w-none text-[17px] leading-8 text-[#525b56] prose-p:text-[#525b56] prose-headings:font-serif prose-headings:font-light prose-a:text-(--color-primary)">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {property.description.replace(/\\n/g, '\n')}
                  </ReactMarkdown>
                </div>
              )}
            </div>
            
            {remainingPageFields.length > 0 && (
              <div className="space-y-4">
                <h3 className="font-serif text-[1.85rem] font-light text-[#1f2421]">Características</h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {remainingPageFields.map(({ field, value }) => (
                    <div
                      key={field.id}
                      className={`rounded-[24px] border border-[#ddd3c7] bg-white/75 px-5 py-4 shadow-[0_14px_32px_rgba(47,74,58,0.05)] ${
                        field.type === "multiselect" ? "sm:col-span-2 xl:col-span-3" : ""
                      }`}
                    >
                      <p className="text-[11px] uppercase tracking-[0.18em] text-[#7c847f]">{normalizePropertyDisplayText(field.name)}</p>
                      <p className={`mt-2 font-medium text-[#1f2421] ${field.type === "multiselect" ? "text-[1.05rem] leading-8" : "text-lg"}`}>
                        {formatPropertyFieldValue(value!, field)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>

          <div className="space-y-8">
            <PropertyGalleryViewer coverImage={property.coverImage} images={property.images || []} />

            {contactCard}
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
