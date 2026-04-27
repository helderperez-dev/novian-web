import { getProperties, getPropertyFields } from "@/lib/store";
import { formatPropertyFieldValue, formatPropertyOfferLabel, getPropertyOfferSummary, getVisiblePropertyFieldEntries } from "@/lib/property-utils";
import { connection } from "next/server";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, MapPin } from "lucide-react";
import PropertyListingTracker from "./PropertyListingTracker";

export default async function PropertiesListingPage() {
  await connection();
  const [properties, propertyFields] = await Promise.all([
    getProperties(),
    getPropertyFields(),
  ]);
  const activeProperties = properties.filter((property) => property.status === "active");

  return (
    <div className="min-h-screen bg-[#0d1514] text-white font-sans selection:bg-[#DEC0A6]/30">
      {/* Navigation */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-[#0d1514]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-24 flex items-center justify-between">
          <Link href="/" className="flex items-center">
            <Image 
              src="/logo.png" 
              alt="Novian Logo" 
              width={120} 
              height={24} 
              className="h-6 w-auto object-contain hover:opacity-80 transition-opacity"
              priority
            />
          </Link>
          <div className="flex items-center gap-8">
            <a href="#portfolio" className="text-sm font-medium text-white/70 hover:text-white transition-colors tracking-wide">PORTFÓLIO</a>
            <Link 
              href="/admin" 
              className="bg-[#DEC0A6] text-[#0d1514] px-6 py-2.5 rounded-full text-sm font-bold tracking-wide hover:bg-white transition-colors"
            >
              Área do Corretor
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-[85vh] flex items-center pt-24 overflow-hidden">
        {/* Background Texture/Gradient */}
        <div className="absolute inset-0 bg-[#0d1514] z-0" />
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-[#DEC0A6] opacity-[0.03] blur-[120px] rounded-full translate-x-1/3 -translate-y-1/4 pointer-events-none z-0" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-[#DEC0A6] opacity-[0.02] blur-[100px] rounded-full -translate-x-1/3 translate-y-1/3 pointer-events-none z-0" />
        
        <div className="max-w-7xl mx-auto px-6 w-full relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
          <div className="lg:col-span-7 space-y-8">
            <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full border border-white/10 bg-white/5 backdrop-blur-sm">
              <span className="w-2 h-2 rounded-full bg-[#DEC0A6] animate-pulse" />
              <span className="text-xs font-semibold tracking-widest text-white/80 uppercase">Curadoria Exclusiva Novian</span>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-light font-serif leading-[1.1] tracking-tight">
              Encontre o seu <br/>
              <span className="text-[#DEC0A6] italic">próximo nível</span> de viver.
            </h1>
            
            <p className="text-xl text-white/60 leading-relaxed max-w-xl font-light">
              Uma seleção rigorosa de imóveis extraordinários. Design, localização e sofisticação em cada metro quadrado.
            </p>
            
            <div className="pt-4">
              <a 
                href="#portfolio" 
                className="inline-flex items-center gap-3 bg-white/10 hover:bg-white/20 border border-white/10 text-white px-8 py-4 rounded-full font-medium tracking-wide transition-all group"
              >
                Explorar Portfólio
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </a>
            </div>
          </div>
          
          <div className="lg:col-span-5 relative hidden lg:block">
            {activeProperties[0] && (
              <div className="relative aspect-[4/5] rounded-3xl overflow-hidden shadow-2xl">
                <img 
                  src={activeProperties[0].coverImage} 
                  alt="Destaque" 
                  className="w-full h-full object-cover opacity-80"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0d1514] via-transparent to-transparent" />
                <div className="absolute bottom-8 left-8 right-8">
                  <p className="text-xs text-[#DEC0A6] font-bold tracking-widest uppercase mb-2">Imóvel Destaque</p>
                  <h3 className="text-2xl font-serif text-white">{activeProperties[0].title}</h3>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Portfolio Grid */}
      <section id="portfolio" className="py-32 relative z-10 border-t border-white/5 bg-[#0a1110]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="mb-20 flex flex-col md:flex-row md:items-end justify-between gap-8">
            <div>
              <h2 className="text-4xl font-light font-serif mb-4">Nosso Portfólio</h2>
              <p className="text-white/50 text-lg max-w-md">Descubra propriedades únicas, pensadas para quem não abre mão do melhor.</p>
            </div>
            <div className="text-white/40 text-sm font-medium tracking-widest uppercase">
              {activeProperties.length} {activeProperties.length === 1 ? 'Imóvel Encontrado' : 'Imóveis Encontrados'}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-16">
            {activeProperties.map((property) => {
              const { primaryOffer, saleOffer, rentOffer } = getPropertyOfferSummary(property);
              const cardFields = getVisiblePropertyFieldEntries(property, propertyFields, "card", 3);

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
                <div className="aspect-[4/3] rounded-2xl overflow-hidden bg-white/5 mb-6 relative">
                  <img 
                    src={property.coverImage} 
                    alt={property.title} 
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors duration-500" />
                  
                  {/* Status Badge */}
                  <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-semibold tracking-wider text-white border border-white/10">
                    Disponível
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <h3 className="text-xl font-serif text-white group-hover:text-[#DEC0A6] transition-colors line-clamp-1">
                      {property.title}
                    </h3>
                    <p className="text-sm text-white/50 mt-2 flex items-center gap-1.5 line-clamp-1">
                      <MapPin size={14} className="text-[#DEC0A6]" />
                      {property.address?.split('-')[0] || property.address || "Localização sob consulta"}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 py-4 border-y border-white/5 text-white/70">
                    {cardFields.map(({ field, value }) => (
                      <div key={field.id} className="rounded-full border border-white/10 px-3 py-1.5 text-sm font-medium">
                        {field.name}: {formatPropertyFieldValue(value!, field)}
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div>
                      <p className="text-xl font-light">{formatPropertyOfferLabel(primaryOffer)}</p>
                      {saleOffer && rentOffer ? (
                        <p className="mt-1 text-xs uppercase tracking-[0.2em] text-white/40">Venda e locação</p>
                      ) : rentOffer ? (
                        <p className="mt-1 text-xs uppercase tracking-[0.2em] text-white/40">Locação</p>
                      ) : (
                        <p className="mt-1 text-xs uppercase tracking-[0.2em] text-white/40">Venda</p>
                      )}
                    </div>
                    <span className="text-xs font-bold tracking-widest text-[#DEC0A6] uppercase group-hover:underline underline-offset-4">
                      Ver Detalhes
                    </span>
                  </div>
                </div>
                </PropertyListingTracker>
              );
            })}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-white/10 bg-[#0d1514] text-center">
        <Image 
          src="/logo.png" 
          alt="Novian Logo" 
          width={100} 
          height={20} 
          className="h-5 w-auto object-contain opacity-50 hover:opacity-80 transition-opacity mx-auto mb-6"
        />
        <p className="text-white/40 text-sm">
          &copy; {new Date().getFullYear()} Novian Real Estate. Todos os direitos reservados.
        </p>
      </footer>
    </div>
  );
}
