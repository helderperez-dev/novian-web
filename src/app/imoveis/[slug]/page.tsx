import { getPropertyFields } from "@/lib/store";
import { getActivePropertyBySlug } from "@/lib/properties";
import { formatPropertyFieldValue, formatPropertyOfferLabel, getPropertyOfferSummary, getVisiblePropertyFieldEntries } from "@/lib/property-utils";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import Image from "next/image";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import LeadForm from "./LeadForm";
import PropertyEngagementTracker from "./PropertyEngagementTracker";
import PropertyGalleryViewer from "@/components/PropertyGalleryViewer";

const RICH_TEXT_HTML_PATTERN = /<\/?[a-z][\s\S]*>/i;

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
  const visiblePageFields = getVisiblePropertyFieldEntries(property, propertyFields, "page");
  const topHighlights = visiblePageFields.slice(0, 4);
  const remainingPageFields = visiblePageFields.slice(4);

  return (
    <div
      className="min-h-screen bg-[#f6f1ea] font-sans text-[#1f2421] selection:bg-(--color-primary)/20"
      style={{ "--color-primary": primaryColor } as React.CSSProperties}
    >
      
      {/* Navigation */}
      <nav className="fixed top-0 z-50 w-full border-b border-black/6 bg-[#f6f1ea]/82 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6">
          <Link href="/">
            <Image src="/logo.png" alt="Novian" width={120} height={24} className="h-5 w-auto object-contain hover:opacity-80 transition-opacity" />
          </Link>
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
            variant="nav"
          />
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pb-8 pt-20 lg:pt-24">
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
                  {property.address ? (
                    <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-white/10 bg-black/14 px-4 py-2 text-xs text-white/72 backdrop-blur-md">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: primaryColor }} />
                      <span className="truncate">{property.address}</span>
                    </div>
                  ) : null}
                </div>

                <h1 className="mt-8 max-w-[12ch] font-serif text-[3.35rem] font-light leading-[0.96] tracking-[-0.05em] text-white sm:text-[4.4rem] lg:text-[5.15rem]">
                  {landingPage.heroTitle}
                </h1>

                <p className="mt-6 max-w-[560px] text-[16px] leading-8 text-white/72 sm:text-[17px]">
                  {landingPage.heroSubtitle}
                </p>

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

              <div className="mt-12 rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,18,16,0.72),rgba(8,18,16,0.56))] p-4 backdrop-blur-xl sm:p-5 lg:p-6">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                  <div className="rounded-[22px] border border-white/8 bg-white/5 px-4 py-4 xl:col-span-2">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-white/42">Oferta principal</p>
                    <p className="mt-2 font-serif text-[30px] font-light leading-none text-white">{formatPropertyOfferLabel(primaryOffer)}</p>
                    {saleOffer && rentOffer ? (
                      <p className="mt-3 text-[11px] uppercase tracking-[0.18em] text-white/45">Venda e locação disponíveis</p>
                    ) : null}
                  </div>

                  {[saleOffer, rentOffer].filter(Boolean).map((offer) => (
                    <div key={offer!.offerType} className="rounded-[22px] border border-white/8 bg-white/5 px-4 py-4">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-white/42">
                        {offer!.offerType === "rent" ? "Locação" : "Venda"}
                      </p>
                      <p className="mt-2 text-lg font-medium text-white">{formatPropertyOfferLabel(offer!)}</p>
                    </div>
                  ))}

                  {topHighlights.map(({ field, value }) => (
                    <div key={field.id} className="rounded-[22px] border border-white/8 bg-white/5 px-4 py-4">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-white/42">{field.name}</p>
                      <p className="mt-2 text-lg font-medium text-white">{formatPropertyFieldValue(value!, field)}</p>
                    </div>
                  ))}
                </div>
              </div>
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
              <h2 className="text-[2.45rem] font-serif font-light leading-tight tracking-[-0.04em] text-[#1f2421]">
                Uma leitura clara de cada detalhe do imóvel.
              </h2>
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
            
            {property.address && (
              <div className="space-y-4">
                <h3 className="font-serif text-[1.85rem] font-light text-[#1f2421]">Localização</h3>
                <p className="flex items-start gap-2 text-[16px] leading-7 text-[#525b56]">
                  <svg className="mt-0.5 h-5 w-5 shrink-0 text-current" style={{ color: primaryColor }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>{property.address}</span>
                </p>
              </div>
            )}

            {remainingPageFields.length > 0 && (
              <div className="space-y-4">
                <h3 className="font-serif text-[1.85rem] font-light text-[#1f2421]">Características</h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {remainingPageFields.map(({ field, value }) => (
                    <div key={field.id} className="rounded-[24px] border border-[#ddd3c7] bg-white/75 px-5 py-4 shadow-[0_14px_32px_rgba(47,74,58,0.05)]">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-[#7c847f]">{field.name}</p>
                      <p className="mt-2 text-lg font-medium text-[#1f2421]">{formatPropertyFieldValue(value!, field)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {property.broker ? (
              <div className="space-y-4">
                <h3 className="font-serif text-[1.85rem] font-light text-[#1f2421]">Seu corretor</h3>
                <div className="flex items-center gap-4 rounded-[28px] border border-[#ddd3c7] bg-white/75 px-5 py-5 shadow-[0_14px_32px_rgba(47,74,58,0.05)]">
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
                    <p className="text-[11px] uppercase tracking-[0.18em] text-[#7c847f]">Atendimento especializado</p>
                    <p className="mt-1 text-xl font-medium text-[#1f2421]">{property.broker.fullName}</p>
                    <p className="mt-2 text-sm text-[#66706b]">
                      {property.broker.creci ? `CRECI ${property.broker.creci}` : "Corretor Novian"}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="space-y-8">
            <PropertyGalleryViewer coverImage={property.coverImage} images={property.images || []} />
            
            {property.mapEmbedUrl && (
              <div className="relative h-64 overflow-hidden rounded-[28px] border border-[#ddd3c7] bg-white/70 shadow-[0_14px_32px_rgba(47,74,58,0.05)]">
                <iframe 
                  src={property.mapEmbedUrl} 
                  width="100%" 
                  height="100%" 
                  style={{ border: 0, filter: 'grayscale(14%) contrast(1.02)' }} 
                  allowFullScreen={true} 
                  loading="lazy" 
                  referrerPolicy="no-referrer-when-downgrade"
                  className="absolute inset-0"
                />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Lead Generation Form Section */}
      <section id="contato" className="relative overflow-hidden border-t border-black/6 px-6 py-24 lg:px-8">
        <div className="relative z-10 mx-auto max-w-3xl">
          <div className="relative overflow-hidden rounded-[32px] border border-[#d8ccbe] bg-[linear-gradient(180deg,#fffaf4,#f3ece3)] p-8 shadow-[0_26px_60px_rgba(47,74,58,0.08)] md:p-12">
            <div
              className="pointer-events-none absolute inset-0 rounded-[32px] opacity-80"
              style={{
                background:
                  "linear-gradient(145deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.18) 35%, rgba(255,255,255,0) 100%)",
              }}
            />
            <div className="text-center mb-10">
              <h2 className="mb-4 font-serif text-3xl font-light text-[#1f2421]">Fale com um especialista</h2>
              <p className="text-[#66706b]">
                Preencha seus dados para receber um atendimento exclusivo e {landingPage.showLeadMagnet ? `baixar o material completo do imóvel.` : `agendar sua visita.`}
              </p>
              {property.broker ? (
                <div className="mx-auto mt-7 grid max-w-xl grid-cols-[auto_1fr] items-center gap-4 rounded-[24px] border border-[#ddd3c7] bg-white/75 px-4 py-3 text-left">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white/10 text-sm font-medium text-white">
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
                    <p className="mt-1 truncate text-[18px] font-medium leading-tight text-[#1f2421]">{property.broker.fullName}</p>
                    <p className="mt-1 text-sm text-[#66706b]">
                      {property.broker.creci ? `CRECI ${property.broker.creci}` : "Equipe Novian"}
                    </p>
                  </div>
                </div>
              ) : null}
            </div>

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
      </section>

    </div>
  );
}
