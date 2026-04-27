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

  return (
    <div className="min-h-screen bg-[#0d1514] text-[#E5E7EB] font-sans selection:bg-opacity-30" style={{ '--color-primary': primaryColor } as React.CSSProperties}>
      
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-[#0d1514]/80 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
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
      <section className="relative min-h-[90vh] flex items-center pt-20">
        {/* Background Image with Overlay */}
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-r from-[#0d1514] via-[#0d1514]/80 to-transparent z-10" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0d1514] via-transparent to-transparent z-10" />
          <img 
            src={property.coverImage || "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&q=80&w=1920"} 
            alt={property.title}
            className="w-full h-full object-cover"
          />
        </div>

        <div className="relative z-20 max-w-7xl mx-auto px-6 w-full">
          <div className="max-w-2xl space-y-8">
            {property.isExclusiveNovian ? (
              <div className="inline-block px-4 py-1.5 rounded-full border border-white/20 backdrop-blur-sm text-xs font-semibold tracking-widest uppercase" style={{ color: primaryColor }}>
                Exclusividade Novian
              </div>
            ) : null}
            
            <h1 className="text-5xl md:text-7xl font-light font-serif leading-tight">
              {landingPage.heroTitle}
            </h1>
            
            <p className="text-lg text-gray-400 leading-relaxed max-w-xl">
              {landingPage.heroSubtitle}
            </p>

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
      </section>

      {/* Property Details Bar */}
      <section className="border-y border-white/5 bg-[#0d1514]/50 backdrop-blur-sm relative z-20 -mt-10 mx-6 rounded-2xl">
        <div className="max-w-7xl mx-auto px-8 py-6 flex flex-wrap items-center justify-between gap-8">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Oferta Principal</p>
            <p className="text-2xl font-light font-serif">{formatPropertyOfferLabel(primaryOffer)}</p>
            {saleOffer && rentOffer ? (
              <p className="mt-2 text-xs uppercase tracking-[0.18em] text-gray-500">Venda e locação disponíveis</p>
            ) : null}
          </div>
          <div className="w-px h-12 bg-white/10 hidden md:block"></div>
          {[saleOffer, rentOffer].filter(Boolean).map((offer) => (
            <div key={offer!.offerType}>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{offer!.offerType === "rent" ? "Locação" : "Venda"}</p>
              <p className="text-xl font-light">{formatPropertyOfferLabel(offer!)}</p>
            </div>
          ))}
          {visiblePageFields.slice(0, 3).map(({ field, value }) => (
            <div key={field.id}>
               <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{field.name}</p>
               <p className="text-xl font-light">{formatPropertyFieldValue(value!, field)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Description Section */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
          <div className="space-y-12">
            <div className="space-y-6">
              <h2 className="text-3xl font-light font-serif">Sobre o Imóvel</h2>
              {hasRichDescription ? (
                <div
                  className="text-gray-400 leading-relaxed text-lg prose prose-invert prose-p:text-gray-400 prose-headings:font-serif prose-headings:font-light prose-a:text-[#DEC0A6] max-w-none"
                  dangerouslySetInnerHTML={{ __html: property.description }}
                />
              ) : (
                <div className="text-gray-400 leading-relaxed text-lg prose prose-invert prose-p:text-gray-400 prose-headings:font-serif prose-headings:font-light prose-a:text-[#DEC0A6] max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {property.description.replace(/\\n/g, '\n')}
                  </ReactMarkdown>
                </div>
              )}
            </div>
            
            {property.address && (
              <div className="space-y-4">
                <h3 className="text-xl font-light font-serif text-white">Localização</h3>
                <p className="text-gray-400 flex items-start gap-2">
                  <svg className="w-5 h-5 text-current mt-0.5 flex-shrink-0" style={{ color: primaryColor }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>{property.address}</span>
                </p>
              </div>
            )}

            {visiblePageFields.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-xl font-light font-serif text-white">Características</h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {visiblePageFields.map(({ field, value }) => (
                    <div key={field.id} className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-gray-500">{field.name}</p>
                      <p className="mt-2 text-lg font-light text-white">{formatPropertyFieldValue(value!, field)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {property.broker ? (
              <div className="space-y-4">
                <h3 className="text-xl font-light font-serif text-white">Seu Corretor</h3>
                <div className="flex items-center gap-4 rounded-3xl border border-white/10 bg-white/5 px-5 py-5">
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
                    <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Atendimento especializado</p>
                    <p className="mt-1 text-xl font-light text-white">{property.broker.fullName}</p>
                    <p className="mt-2 text-sm text-gray-400">
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
              <div className="rounded-2xl border border-white/10 overflow-hidden bg-white/5 h-64 relative">
                <iframe 
                  src={property.mapEmbedUrl} 
                  width="100%" 
                  height="100%" 
                  style={{ border: 0, filter: 'invert(90%) hue-rotate(180deg) grayscale(20%)' }} 
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
      <section id="contato" className="py-24 border-t border-white/5 relative overflow-hidden">
        <div className="max-w-3xl mx-auto px-6 relative z-10">
          <div className="relative overflow-hidden rounded-[28px] border border-white/12 bg-gradient-to-b from-[#182120] to-[#121918] p-8 md:p-12">
            <div
              className="pointer-events-none absolute inset-0 rounded-[28px] opacity-80"
              style={{
                background:
                  "linear-gradient(145deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.015) 35%, rgba(0,0,0,0) 100%)",
              }}
            />
            <div className="text-center mb-10">
              <h2 className="text-3xl font-light font-serif mb-4">Fale com um Especialista</h2>
              <p className="text-gray-400">
                Preencha seus dados para receber um atendimento exclusivo e {landingPage.showLeadMagnet ? `baixar o material completo do imóvel.` : `agendar sua visita.`}
              </p>
              {property.broker ? (
                <div className="mx-auto mt-7 grid max-w-xl grid-cols-[auto_1fr] items-center gap-4 rounded-2xl border border-white/12 bg-[#111816]/85 px-4 py-3 text-left">
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
                    <p className="text-[11px] uppercase tracking-[0.18em] text-gray-500">Corretor responsável</p>
                    <p className="mt-1 truncate text-[18px] font-medium leading-tight text-white">{property.broker.fullName}</p>
                    <p className="mt-1 text-sm text-gray-400">
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
