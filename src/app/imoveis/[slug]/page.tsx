import { getProperties } from "@/lib/store";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import LeadForm from "./LeadForm";
import PropertyGalleryViewer from "@/components/PropertyGalleryViewer";

export default async function PropertyLandingPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = await params;
  const properties = await getProperties();
  const property = properties.find(p => p.slug === resolvedParams.slug);

  if (!property) {
    notFound();
  }

  const { landingPage } = property;
  const primaryColor = landingPage.primaryColor || '#DEC0A6'; // Default novian accent

  return (
    <div className="min-h-screen bg-[#0d1514] text-[#E5E7EB] font-sans selection:bg-opacity-30" style={{ '--color-primary': primaryColor } as React.CSSProperties}>
      
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-[#0d1514]/80 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link href="/">
            <Image src="/logo.png" alt="Novian" width={120} height={24} className="h-5 w-auto object-contain hover:opacity-80 transition-opacity" />
          </Link>
          <a href="#contato" className="text-sm font-semibold px-6 py-2.5 rounded-full transition-colors" style={{ backgroundColor: primaryColor, color: '#0d1514' }}>
            Falar com Especialista
          </a>
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
            <div className="inline-block px-4 py-1.5 rounded-full border border-white/20 backdrop-blur-sm text-xs font-semibold tracking-widest uppercase" style={{ color: primaryColor }}>
              Exclusividade Novian
            </div>
            
            <h1 className="text-5xl md:text-7xl font-light font-serif leading-tight">
              {landingPage.heroTitle}
            </h1>
            
            <p className="text-lg text-gray-400 leading-relaxed max-w-xl">
              {landingPage.heroSubtitle}
            </p>

            <div className="pt-4 flex flex-col sm:flex-row gap-4">
              <a href="#contato" className="inline-flex items-center justify-center px-8 py-4 rounded-full text-sm font-bold transition-transform hover:scale-105" style={{ backgroundColor: primaryColor, color: '#0d1514' }}>
                {landingPage.callToActionText}
              </a>
              {landingPage.showLeadMagnet && (
                <a href="#contato" className="inline-flex items-center justify-center px-8 py-4 rounded-full text-sm font-bold border border-white/20 backdrop-blur-sm hover:bg-white/5 transition-colors text-white">
                  {landingPage.leadMagnetTitle || "Baixar Apresentação"}
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Property Details Bar */}
      <section className="border-y border-white/5 bg-[#0d1514]/50 backdrop-blur-sm relative z-20 -mt-10 mx-6 rounded-2xl">
        <div className="max-w-7xl mx-auto px-8 py-6 flex flex-wrap items-center justify-between gap-8">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Valor do Imóvel</p>
            <p className="text-2xl font-light font-serif">R$ {property.price.toLocaleString('pt-BR')}</p>
          </div>
          <div className="w-px h-12 bg-white/10 hidden md:block"></div>
          {Object.entries(property.customData).slice(0,3).map(([key, value]) => (
            <div key={key}>
               <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{key === 'area' ? 'Área' : key === 'bedrooms' ? 'Quartos' : key === 'parking' ? 'Vagas' : key}</p>
               <p className="text-xl font-light">{value} {key === 'area' ? 'm²' : ''}</p>
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
              <div className="text-gray-400 leading-relaxed text-lg prose prose-invert prose-p:text-gray-400 prose-headings:font-serif prose-headings:font-light prose-a:text-[#DEC0A6] max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {property.description.replace(/\\n/g, '\n')}
                </ReactMarkdown>
              </div>
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
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-[500px] bg-current opacity-5 blur-[120px] rounded-full pointer-events-none" style={{ color: primaryColor }} />
        
        <div className="max-w-3xl mx-auto px-6 relative z-10">
          <div className="bg-[#151c1b] border border-white/10 rounded-3xl p-8 md:p-12 shadow-2xl">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-light font-serif mb-4">Fale com um Especialista</h2>
              <p className="text-gray-400">
                Preencha seus dados para receber um atendimento exclusivo e {landingPage.showLeadMagnet ? `baixar o material completo do imóvel.` : `agendar sua visita.`}
              </p>
            </div>

            <LeadForm 
              primaryColor={primaryColor} 
              showLeadMagnet={landingPage.showLeadMagnet} 
              callToActionText={landingPage.callToActionText} 
              propertyTitle={property.title}
            />
          </div>
        </div>
      </section>

    </div>
  );
}
