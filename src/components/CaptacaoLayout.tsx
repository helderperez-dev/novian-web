import React, { useCallback, useEffect, useRef, useState } from "react";
import { Bot, Loader2, Sparkles, MessageSquare, SlidersHorizontal, X, Trash2, MoreHorizontal, ChevronLeft, ChevronRight } from "lucide-react";
import { useSearchParams } from "next/navigation";
import type { Funnel, Thread, FunnelColumn } from "@/lib/store";

interface ExtendedFunnel extends Funnel {
  columns: FunnelColumn[];
}

interface ApifySearchConfig {
  areaMin: number;
  bathroomsMin: number;
  bedroomsMin: number;
  city: string;
  includeDescription: boolean;
  maxListings: number;
  priceMax: number;
  priceMin: number;
  propertyType: string;
  region: string;
  sources: string;
  state: string;
  transactionType: string;
}

const sanitizeMediaUrl = (value: unknown) =>
  String(value ?? "")
    .replace(/[`"]/g, "")
    .trim();

const getLeadImages = (lead: Thread) => {
  const rawImages = lead.customData?.images;
  if (Array.isArray(rawImages)) {
    return rawImages.map(sanitizeMediaUrl).filter(Boolean);
  }
  const cover = sanitizeMediaUrl(lead.customData?.image);
  return cover ? [cover] : [];
};

const formatCurrency = (value: unknown) => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return "Nao informado";
  return `R$ ${amount.toLocaleString("pt-BR")}`;
};

const formatNumberLabel = (value: unknown, suffix = "") => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return "Nao informado";
  return `${amount.toLocaleString("pt-BR")}${suffix}`;
};

const formatDateLabel = (value: unknown) => {
  const text = String(value ?? "").trim();
  if (!text) return "Nao informado";
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text;
  return date.toLocaleString("pt-BR");
};

const getPricePerSqmLabel = (lead: Thread) => {
  const explicitValue = Number(lead.customData?.pricePerSqm);
  if (Number.isFinite(explicitValue) && explicitValue > 0) {
    return `R$ ${explicitValue.toLocaleString("pt-BR", {
      minimumFractionDigits: explicitValue % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    })}`;
  }

  const price = Number(lead.customData?.price);
  const area = Number(lead.customData?.area);
  if (Number.isFinite(price) && price > 0 && Number.isFinite(area) && area > 0) {
    const calculated = price / area;
    return `R$ ${calculated.toLocaleString("pt-BR", {
      minimumFractionDigits: calculated % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    })}`;
  }

  return "Nao informado";
};

const getCaptacaoBadgeLabel = (lead: Thread) => {
  const status = String(lead.status ?? "").trim();
  if (!status) return "Em captacao";
  return status;
};

const getLeadDescription = (lead: Thread) => {
  const description = String(lead.customData?.description ?? "").trim();
  return description;
};

const splitTags = (value: unknown) =>
  String(value ?? "")
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);

export function CaptacaoLayout() {
  const searchParams = useSearchParams();
  const deepLinkLeadId = searchParams.get("lead");
  const didAutoOpenLeadFromQueryRef = useRef(false);
  const checkedDeepLinkLeadIdRef = useRef<string | null>(null);
  const [funnelsList, setFunnelsList] = useState<ExtendedFunnel[]>([]);
  const [activeFunnelId, setActiveFunnelId] = useState<string>("");
  const [leads, setLeads] = useState<Thread[]>([]);
  const [selectedLead, setSelectedLead] = useState<Thread | null>(null);
  const [selectedGalleryIndex, setSelectedGalleryIndex] = useState<number | null>(null);
  const [leadToDelete, setLeadToDelete] = useState<Thread | null>(null);
  const [openMenuLeadId, setOpenMenuLeadId] = useState<string | null>(null);
  const [isDrawerMenuOpen, setIsDrawerMenuOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isApifyModalOpen, setIsApifyModalOpen] = useState(false);
  const [isScraping, setIsScraping] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null);
  const [dragOverColumnId, setDragOverColumnId] = useState<string | null>(null);
  const [apifyConfig, setApifyConfig] = useState<ApifySearchConfig>({
    areaMin: 1,
    bathroomsMin: 1,
    bedroomsMin: 1,
    city: "jundiai",
    includeDescription: true,
    maxListings: 50,
    priceMax: 0,
    priceMin: 0,
    propertyType: "all",
    region: "sao-paulo-e-regiao",
    sources: "olx",
    state: "sp",
    transactionType: "sale",
  });

  // Drag-to-scroll refs
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isDraggingScroll = useRef(false);
  const startX = useRef(0);
  const scrollLeftPos = useRef(0);

  const activeFunnel = funnelsList.find((item) => item.id === activeFunnelId) || funnelsList[0] || null;

  const fetchFunnels = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/funnels?type=captacao', { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to load funnels');

      const data = await res.json();
      const nextFunnels = Array.isArray(data.funnels) ? data.funnels as ExtendedFunnel[] : [];
      setFunnelsList(nextFunnels);
      setActiveFunnelId((prev) => {
        if (prev && nextFunnels.some((funnel) => funnel.id === prev)) {
          return prev;
        }
        return nextFunnels[0]?.id || "";
      });
      if (nextFunnels.length === 0) {
        setLeads([]);
      }
    } catch (err) {
      console.error("Error fetching captacao funnels:", err);
      setFunnelsList([]);
      setLeads([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchLeads = useCallback(async (funnelId: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/captacao/items?funnelId=${encodeURIComponent(funnelId)}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load captacao items");
      const data = await res.json();
      setLeads(Array.isArray(data.items) ? data.items : []);
    } catch (err) {
      console.error("Error fetching captacao leads:", err);
      setLeads([]);
    } finally {
      setIsLoading(false);
    }
  }, [funnelsList]);

  useEffect(() => {
    fetchFunnels();
  }, []);

  useEffect(() => {
    if (!activeFunnelId) {
      setSelectedLead(null);
      setSelectedGalleryIndex(null);
      setOpenMenuLeadId(null);
      return;
    }

    setSelectedLead(null);
    setSelectedGalleryIndex(null);
    setOpenMenuLeadId(null);
    fetchLeads(activeFunnelId);
  }, [activeFunnelId, fetchLeads]);

  useEffect(() => {
    if (!deepLinkLeadId || funnelsList.length === 0 || checkedDeepLinkLeadIdRef.current === deepLinkLeadId) {
      return;
    }

    checkedDeepLinkLeadIdRef.current = deepLinkLeadId;
    const syncFunnelFromLead = async () => {
      const res = await fetch(`/api/captacao/items/${encodeURIComponent(deepLinkLeadId)}`, { cache: "no-store" });
      if (!res.ok) return;
      const payload = await res.json();
      const funnelId = payload.item?.funnel_id;
      if (!funnelId) return;
      if (funnelId !== activeFunnelId) {
        setActiveFunnelId(String(funnelId));
      }
    };

    syncFunnelFromLead();
  }, [deepLinkLeadId, funnelsList, activeFunnelId]);

  useEffect(() => {
    didAutoOpenLeadFromQueryRef.current = false;
  }, [deepLinkLeadId]);

  useEffect(() => {
    if (!deepLinkLeadId || didAutoOpenLeadFromQueryRef.current || leads.length === 0) {
      return;
    }

    const matchedLead = leads.find((lead) => lead.id === deepLinkLeadId);
    if (matchedLead) {
      setSelectedLead(matchedLead);
      didAutoOpenLeadFromQueryRef.current = true;
    }
  }, [deepLinkLeadId, leads]);

  const handleScrape = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeFunnelId) return;
    
    setIsScraping(true);
    try {
      const res = await fetch('/api/captacao/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...apifyConfig,
          funnelId: activeFunnelId,
        })
      });
      
      if (!res.ok) throw new Error("Failed to scrape");
      
      await fetchLeads(activeFunnelId);
      setIsApifyModalOpen(false);
    } catch (error) {
      console.error("Scraping error:", error);
      alert("Erro ao buscar dados. Verifique o limite de memória ou tente novamente.");
    } finally {
      setIsScraping(false);
    }
  };

  const handleGenerateProposal = async (lead: Thread) => {
    try {
      const res = await fetch('/api/captacao/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: lead.id })
      });
      
      if (!res.ok) throw new Error("Failed to generate proposal");
      
      if (activeFunnelId) {
        await fetchLeads(activeFunnelId);
      }
      alert("Proposta gerada com sucesso! (Verifique o preview do lead)");
    } catch (err) {
      console.error(err);
      alert("Erro ao gerar proposta.");
    }
  };

  const handleDeleteLead = async () => {
    if (!leadToDelete) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/captacao/items/${encodeURIComponent(leadToDelete.id)}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete lead");

      setLeads(prev => prev.filter(lead => lead.id !== leadToDelete.id));
      if (selectedLead?.id === leadToDelete.id) {
        setSelectedLead(null);
        setSelectedGalleryIndex(null);
      }
      setIsDrawerMenuOpen(false);
      setLeadToDelete(null);
    } catch (error) {
      console.error("Delete error:", error);
      alert("Erro ao excluir item de captação.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDragStart = (e: React.DragEvent, leadId: string) => {
    if (isScrolling || isDraggingScroll.current) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData("leadId", leadId);
    e.dataTransfer.effectAllowed = "move";
    setTimeout(() => {
      setDraggedLeadId(leadId);
    }, 0);
  };

  const [isScrolling, setIsScrolling] = useState(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('[draggable="true"]')) return;

    if (!scrollContainerRef.current) return;
    isDraggingScroll.current = true;
    startX.current = e.pageX - scrollContainerRef.current.offsetLeft;
    scrollLeftPos.current = scrollContainerRef.current.scrollLeft;
    
    scrollContainerRef.current.style.cursor = 'grabbing';
    scrollContainerRef.current.style.userSelect = 'none';
  };

  const handleMouseLeave = () => {
    isDraggingScroll.current = false;
    setIsScrolling(false);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.style.cursor = 'grab';
      scrollContainerRef.current.style.userSelect = 'auto';
    }
  };

  const handleMouseUp = () => {
    isDraggingScroll.current = false;
    setIsScrolling(false);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.style.cursor = 'grab';
      scrollContainerRef.current.style.userSelect = 'auto';
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingScroll.current || !scrollContainerRef.current) return;
    e.preventDefault();
    if (!isScrolling) setIsScrolling(true);
    const x = e.pageX - scrollContainerRef.current.offsetLeft;
    const walk = (x - startX.current) * 1.5;
    scrollContainerRef.current.scrollLeft = scrollLeftPos.current - walk;
  };

  const handleDragOver = (e: React.DragEvent, columnTitle: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverColumnId !== columnTitle) {
      setDragOverColumnId(columnTitle);
    }
  };

  const handleDragEnd = () => {
    setDraggedLeadId(null);
    setDragOverColumnId(null);
  };

  const handleDrop = async (e: React.DragEvent, columnTitle: string) => {
    e.preventDefault();
    setDraggedLeadId(null);
    setDragOverColumnId(null);

    const leadId = e.dataTransfer.getData("leadId");
    if (!leadId) return;

    // Optimistic Update
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: columnTitle } : l));

    try {
      await fetch(`/api/captacao/items/${encodeURIComponent(leadId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: columnTitle })
      });
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  };

  if (isLoading) {
    return <div className="flex-1 flex items-center justify-center"><Loader2 className="animate-spin text-novian-accent" /></div>;
  }

  return (
    <div className="flex flex-1 h-full min-w-0 w-full flex-col bg-novian-primary/20 p-6">
      <div className="mb-6 flex w-full min-w-0 items-center justify-between gap-4">
        <div>
          <h2 className="shrink-0 text-xl font-light text-novian-text">Funis de Captação</h2>
          <p className="mt-1 text-sm text-novian-text/55">
            {activeFunnel ? `Gerenciando o funil ${activeFunnel.name}.` : "Crie um funil do tipo captação em Configurações para começar."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {funnelsList.length > 0 && (
            <select
              value={activeFunnelId}
              onChange={(e) => setActiveFunnelId(e.target.value)}
              className="rounded-xl border border-novian-muted/40 bg-[#071615] px-4 py-2 text-sm text-novian-text outline-none transition-colors focus:border-blue-500/50"
            >
              {funnelsList.map((funnel) => (
                <option key={funnel.id} value={funnel.id}>
                  {funnel.name}
                </option>
              ))}
            </select>
          )}
          <button 
            onClick={() => setIsApifyModalOpen(true)}
            disabled={!activeFunnel}
            className="shrink-0 rounded-full border border-blue-500/30 bg-blue-600/20 px-4 py-2 text-sm font-semibold text-blue-400 transition-colors hover:bg-blue-600/30 cursor-pointer flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <SlidersHorizontal size={16} /> Configurar Busca
          </button>
        </div>
      </div>

      {!activeFunnel ? (
        <div className="flex flex-1 items-center justify-center rounded-3xl border border-dashed border-novian-muted/40 bg-[#071615]/40 p-10 text-center">
          <div className="max-w-md">
            <p className="text-lg font-medium text-novian-text">Nenhum funil de captação disponível.</p>
            <p className="mt-2 text-sm leading-6 text-novian-text/60">
              Vá em Configurações, crie um funil novo e selecione o tipo &quot;Captação&quot; para usar esta tela.
            </p>
          </div>
        </div>
      ) : (

      <div 
        className="flex-1 min-w-0 w-full overflow-x-auto cursor-grab active:cursor-grabbing [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
        ref={scrollContainerRef}
        onMouseDown={handleMouseDown}
        onMouseLeave={handleMouseLeave}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
      >
        <div className={`flex gap-6 h-full min-w-max pb-4 ${isScrolling ? 'pointer-events-none' : ''}`}>
          {activeFunnel.columns.map((stage: FunnelColumn) => {
            const stageLeads = leads.filter(l => l.status === stage.title);
            
            return (
              <div 
                key={stage.id} 
                className={`w-80 flex flex-col h-full bg-novian-surface/50 rounded-2xl border transition-colors ${
                  dragOverColumnId === stage.title 
                    ? "border-novian-accent/50 bg-novian-surface" 
                    : "border-novian-muted/30"
                }`}
                onDragOver={(e) => handleDragOver(e, stage.title)}
                onDrop={(e) => handleDrop(e, stage.title)}
              >
                <div className="p-4 border-b border-novian-muted/30 flex items-center justify-between">
                  <h3 className="font-semibold text-novian-text text-sm">{stage.title}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${stage.color}`}>
                    {stageLeads.length}
                  </span>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {stageLeads.map(lead => {
                    const leadImages = getLeadImages(lead);
                    const coverImage = leadImages[0];
                    return (
                    <div 
                      key={lead.id} 
                      draggable
                      onDragStart={(e) => handleDragStart(e, lead.id)}
                      onDragEnd={handleDragEnd}
                      onClick={() => setSelectedLead(lead)}
                      className={`bg-novian-surface p-4 rounded-xl border transition-colors group cursor-grab active:cursor-grabbing shadow-sm ${
                        draggedLeadId === lead.id 
                          ? "opacity-50 border-novian-accent" 
                          : "border-novian-muted/50 hover:border-novian-accent/50"
                      }`}
                    >
                      <div className="mb-3 overflow-hidden rounded-xl border border-white/5 bg-white/5">
                        {coverImage ? (
                          <img
                            src={coverImage}
                            alt={lead.title}
                            className="h-36 w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                          />
                        ) : (
                          <div className="flex h-36 w-full items-center justify-center bg-[radial-gradient(circle_at_top,#12312d,transparent_60%)] text-xs uppercase tracking-[0.22em] text-novian-text/35">
                            Sem Foto
                          </div>
                        )}
                      </div>
                      <div className="flex justify-between items-start mb-2 relative">
                        <h4 className="font-medium text-sm text-novian-text">{lead.title}</h4>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuLeadId(prev => prev === lead.id ? null : lead.id);
                          }}
                          className="ml-3 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-novian-text/65 transition-colors hover:bg-white/10 hover:text-novian-text"
                          title="Mais ações"
                        >
                          <MoreHorizontal size={14} />
                        </button>
                        {openMenuLeadId === lead.id && (
                          <div className="absolute right-0 top-10 z-20 min-w-[150px] overflow-hidden rounded-xl border border-white/10 bg-[#0d1d1b] shadow-2xl shadow-black/30">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenMenuLeadId(null);
                                setLeadToDelete(lead);
                              }}
                              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-red-300 transition-colors hover:bg-red-500/10"
                            >
                              <Trash2 size={14} />
                              Excluir item
                            </button>
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-novian-text/60 mb-3 line-clamp-2">{lead.preview}</p>
                      
                      {lead.customData?.price !== undefined && lead.customData?.price !== null && (
                        <div className="text-xs font-semibold text-novian-accent mb-3">
                          R$ {Number(lead.customData.price).toLocaleString('pt-BR')}
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2 mb-3">
                        {lead.customData?.area !== undefined && lead.customData?.area !== null && (
                          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-novian-text/70">
                            {String(lead.customData.area)} m²
                          </span>
                        )}
                        {lead.customData?.bedrooms !== undefined && lead.customData?.bedrooms !== null && (
                          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-novian-text/70">
                            {String(lead.customData.bedrooms)} dorm.
                          </span>
                        )}
                        {typeof lead.customData?.source === "string" && (
                          <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-1 text-[10px] text-blue-300">
                            {String(lead.customData.source).toUpperCase()}
                          </span>
                        )}
                        {lead.customData?.imageCount !== undefined &&
                          lead.customData?.imageCount !== null &&
                          Number(lead.customData.imageCount) > 0 && (
                          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-novian-text/70">
                            {String(lead.customData.imageCount)} fotos
                          </span>
                        )}
                      </div>

                      {typeof lead.customData?.drafted_proposal === "string" && (
                        <div className="bg-novian-primary/30 p-2 rounded border border-novian-muted/30 mb-3 max-h-24 overflow-y-auto">
                          <p className="text-[10px] text-novian-text/80 whitespace-pre-wrap font-mono leading-relaxed">
                            {lead.customData.drafted_proposal as string}
                          </p>
                        </div>
                      )}

                      <div className="flex items-center gap-2 mt-2 pt-3 border-t border-novian-muted/30">
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleGenerateProposal(lead); }}
                          className="flex-1 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 text-xs py-1.5 rounded-lg flex items-center justify-center gap-1 transition-colors"
                          title="IA: Elaborar Proposta"
                        >
                          <Sparkles size={12} /> Gerar Proposta
                        </button>
                        <button 
                          onClick={(e) => e.stopPropagation()}
                          className="w-8 h-8 flex items-center justify-center rounded-lg bg-novian-muted/30 hover:bg-novian-muted text-novian-text/70 hover:text-novian-text transition-colors"
                        >
                          <MessageSquare size={14} />
                        </button>
                      </div>
                    </div>
                  )})}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      )}

      {isApifyModalOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/35 backdrop-blur-sm">
          <div
            className="absolute inset-0"
            onClick={() => setIsApifyModalOpen(false)}
          />
          <aside className="relative z-10 flex h-full w-full max-w-xl flex-col border-l border-novian-muted/40 bg-[#071615] shadow-2xl shadow-black/40">
            <div className="flex items-start justify-between border-b border-novian-muted/30 px-6 py-5">
              <div>
                <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-300">
                  <Bot size={12} />
                  Apify Config
                </div>
                <h3 className="text-2xl font-semibold text-novian-text">Parâmetros da Captação</h3>
                <p className="mt-2 max-w-md text-sm leading-relaxed text-novian-text/65">
                  Configure a busca do scraper para captar exatamente os imóveis que fazem sentido para a sua operação.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsApifyModalOpen(false)}
                className="rounded-full border border-white/10 p-2 text-novian-text/70 transition-colors hover:bg-white/5 hover:text-novian-text"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleScrape} className="flex min-h-0 flex-1 flex-col">
              <div className="grid min-h-0 flex-1 grid-cols-2 gap-4 overflow-y-auto px-6 py-6">
                <div className="col-span-2">
                  <label className="mb-1 block text-xs font-medium text-novian-text/70">Cidade</label>
                  <input
                    value={apifyConfig.city}
                    onChange={(e) => setApifyConfig(prev => ({ ...prev, city: e.target.value }))}
                    className="w-full rounded-xl border border-novian-muted/40 bg-novian-primary px-4 py-3 text-sm outline-none transition-colors focus:border-blue-500/50"
                    placeholder="jundiai"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-novian-text/70">Estado</label>
                  <input
                    value={apifyConfig.state}
                    onChange={(e) => setApifyConfig(prev => ({ ...prev, state: e.target.value }))}
                    className="w-full rounded-xl border border-novian-muted/40 bg-novian-primary px-4 py-3 text-sm outline-none transition-colors focus:border-blue-500/50"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-novian-text/70">Região</label>
                  <input
                    value={apifyConfig.region}
                    onChange={(e) => setApifyConfig(prev => ({ ...prev, region: e.target.value }))}
                    className="w-full rounded-xl border border-novian-muted/40 bg-novian-primary px-4 py-3 text-sm outline-none transition-colors focus:border-blue-500/50"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-novian-text/70">Fonte</label>
                  <select
                    value={apifyConfig.sources}
                    onChange={(e) => setApifyConfig(prev => ({ ...prev, sources: e.target.value }))}
                    className="w-full rounded-xl border border-novian-muted/40 bg-novian-primary px-4 py-3 text-sm outline-none transition-colors focus:border-blue-500/50"
                  >
                    <option value="olx">OLX</option>
                    <option value="zap">ZAP</option>
                    <option value="vivareal">VivaReal</option>
                    <option value="all">Todas</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-novian-text/70">Transação</label>
                  <select
                    value={apifyConfig.transactionType}
                    onChange={(e) => setApifyConfig(prev => ({ ...prev, transactionType: e.target.value }))}
                    className="w-full rounded-xl border border-novian-muted/40 bg-novian-primary px-4 py-3 text-sm outline-none transition-colors focus:border-blue-500/50"
                  >
                    <option value="sale">Venda</option>
                    <option value="rent">Locação</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-novian-text/70">Tipo de Imóvel</label>
                  <select
                    value={apifyConfig.propertyType}
                    onChange={(e) => setApifyConfig(prev => ({ ...prev, propertyType: e.target.value }))}
                    className="w-full rounded-xl border border-novian-muted/40 bg-novian-primary px-4 py-3 text-sm outline-none transition-colors focus:border-blue-500/50"
                  >
                    <option value="all">Todos</option>
                    <option value="apartment">Apartamento</option>
                    <option value="house">Casa</option>
                    <option value="condo">Condomínio</option>
                    <option value="land">Terreno</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-novian-text/70">Máximo de anúncios</label>
                  <input
                    type="number"
                    min={1}
                    value={apifyConfig.maxListings}
                    onChange={(e) => setApifyConfig(prev => ({ ...prev, maxListings: Number(e.target.value) || 1 }))}
                    className="w-full rounded-xl border border-novian-muted/40 bg-novian-primary px-4 py-3 text-sm outline-none transition-colors focus:border-blue-500/50"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-novian-text/70">Área mínima</label>
                  <input
                    type="number"
                    min={0}
                    value={apifyConfig.areaMin}
                    onChange={(e) => setApifyConfig(prev => ({ ...prev, areaMin: Number(e.target.value) || 0 }))}
                    className="w-full rounded-xl border border-novian-muted/40 bg-novian-primary px-4 py-3 text-sm outline-none transition-colors focus:border-blue-500/50"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-novian-text/70">Dormitórios mín.</label>
                  <input
                    type="number"
                    min={0}
                    value={apifyConfig.bedroomsMin}
                    onChange={(e) => setApifyConfig(prev => ({ ...prev, bedroomsMin: Number(e.target.value) || 0 }))}
                    className="w-full rounded-xl border border-novian-muted/40 bg-novian-primary px-4 py-3 text-sm outline-none transition-colors focus:border-blue-500/50"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-novian-text/70">Banheiros mín.</label>
                  <input
                    type="number"
                    min={0}
                    value={apifyConfig.bathroomsMin}
                    onChange={(e) => setApifyConfig(prev => ({ ...prev, bathroomsMin: Number(e.target.value) || 0 }))}
                    className="w-full rounded-xl border border-novian-muted/40 bg-novian-primary px-4 py-3 text-sm outline-none transition-colors focus:border-blue-500/50"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-novian-text/70">Preço mínimo</label>
                  <input
                    type="number"
                    min={0}
                    value={apifyConfig.priceMin}
                    onChange={(e) => setApifyConfig(prev => ({ ...prev, priceMin: Number(e.target.value) || 0 }))}
                    className="w-full rounded-xl border border-novian-muted/40 bg-novian-primary px-4 py-3 text-sm outline-none transition-colors focus:border-blue-500/50"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-novian-text/70">Preço máximo</label>
                  <input
                    type="number"
                    min={0}
                    value={apifyConfig.priceMax}
                    onChange={(e) => setApifyConfig(prev => ({ ...prev, priceMax: Number(e.target.value) || 0 }))}
                    className="w-full rounded-xl border border-novian-muted/40 bg-novian-primary px-4 py-3 text-sm outline-none transition-colors focus:border-blue-500/50"
                  />
                </div>

                <label className="col-span-2 flex items-center justify-between rounded-2xl border border-novian-muted/30 bg-white/2 px-4 py-4">
                  <div>
                    <div className="text-sm font-medium text-novian-text">Incluir descrição</div>
                    <div className="text-xs text-novian-text/60">Melhora a qualidade do draft da IA.</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={apifyConfig.includeDescription}
                    onChange={(e) => setApifyConfig(prev => ({ ...prev, includeDescription: e.target.checked }))}
                    className="h-4 w-4 accent-blue-500"
                  />
                </label>
              </div>

              <div className="border-t border-novian-muted/30 px-6 py-5">
                <div className="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsApifyModalOpen(false)}
                    className="rounded-xl px-4 py-2 text-sm font-semibold text-novian-text transition-colors hover:bg-novian-muted"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isScraping}
                    className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isScraping ? <><Loader2 size={16} className="animate-spin" /> Buscando...</> : <>Executar Busca</>}
                  </button>
                </div>
              </div>
            </form>
          </aside>
        </div>
      )}

      {selectedLead && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/35 backdrop-blur-sm">
          <div className="absolute inset-0" onClick={() => {
            setSelectedLead(null);
            setIsDrawerMenuOpen(false);
            setSelectedGalleryIndex(null);
          }} />
          {(() => {
            const galleryImages = getLeadImages(selectedLead);
            const mainImage = galleryImages[0];
                  const badgeLabel = getCaptacaoBadgeLabel(selectedLead);
                  const fullDescription = getLeadDescription(selectedLead);
            return (
          <aside
            className="relative z-10 flex h-full w-full max-w-2xl flex-col border-l border-novian-muted/40 bg-[#071615] shadow-2xl shadow-black/40"
            onClick={() => setIsDrawerMenuOpen(false)}
          >
            <div className="flex items-start justify-between border-b border-novian-muted/30 px-6 py-5">
              <div>
                <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-novian-text/70">
                  {badgeLabel}
                </div>
                <h3 className="max-w-xl text-2xl font-semibold text-novian-text">{selectedLead.title}</h3>
                <p className="mt-2 text-sm text-novian-text/60">{String(selectedLead.customData?.location || "Origem web")}</p>
              </div>
              <div className="relative flex items-center gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsDrawerMenuOpen(prev => !prev);
                  }}
                  className="rounded-full border border-white/10 p-2 text-novian-text/70 transition-colors hover:bg-white/5 hover:text-novian-text"
                >
                  <MoreHorizontal size={18} />
                </button>
                {isDrawerMenuOpen && (
                  <div
                    className="absolute right-12 top-0 z-20 min-w-[220px] overflow-hidden rounded-xl border border-white/10 bg-[#0d1d1b] shadow-2xl shadow-black/30"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setIsDrawerMenuOpen(false);
                        handleGenerateProposal(selectedLead);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-purple-300 transition-colors hover:bg-purple-500/10"
                    >
                      <Sparkles size={14} />
                      Gerar proposta
                    </button>
                    {typeof selectedLead.customData?.url === "string" && (
                      <a
                        href={String(selectedLead.customData.url)}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => setIsDrawerMenuOpen(false)}
                        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-novian-text transition-colors hover:bg-white/5"
                      >
                        <MessageSquare size={14} />
                        Ver anúncio original
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setIsDrawerMenuOpen(false);
                        setLeadToDelete(selectedLead);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-red-300 transition-colors hover:bg-red-500/10"
                    >
                      <Trash2 size={14} />
                      Excluir item
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedLead(null);
                    setIsDrawerMenuOpen(false);
                    setSelectedGalleryIndex(null);
                  }}
                  className="rounded-full border border-white/10 p-2 text-novian-text/70 transition-colors hover:bg-white/5 hover:text-novian-text"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="border-b border-novian-muted/20 bg-black/10 p-6">
                {mainImage ? (
                  <img
                    src={mainImage}
                    alt={selectedLead.title}
                    onClick={() => setSelectedGalleryIndex(0)}
                    className="h-[320px] w-full cursor-zoom-in rounded-2xl border border-white/5 object-cover"
                  />
                ) : (
                  <div className="flex h-[320px] w-full items-center justify-center rounded-2xl border border-white/5 bg-[radial-gradient(circle_at_top,#12312d,transparent_60%)] text-sm uppercase tracking-[0.3em] text-novian-text/35">
                    Sem Imagem Principal
                  </div>
                )}
              </div>

              <div className="space-y-6 p-6">
                {galleryImages.length > 1 && (
                  <div>
                    <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-novian-text/45">Galeria</div>
                    <div className="grid grid-cols-4 gap-3">
                      {galleryImages.slice(0, 8).map((image, index) => (
                        <img
                          key={`${image}-${index}`}
                          src={image}
                          alt={`${selectedLead.title} ${index + 1}`}
                          onClick={() => setSelectedGalleryIndex(index)}
                          className="h-20 w-full cursor-zoom-in rounded-xl border border-white/5 object-cover transition-transform hover:scale-[1.02]"
                        />
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <div className="rounded-2xl border border-white/5 bg-white/3 p-4">
                    <div className="mb-1 text-[10px] uppercase tracking-[0.2em] text-novian-text/45">Preço</div>
                    <div className="text-sm font-semibold text-novian-accent">
                      {formatCurrency(selectedLead.customData?.price)}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/5 bg-white/3 p-4">
                    <div className="mb-1 text-[10px] uppercase tracking-[0.2em] text-novian-text/45">Área</div>
                    <div className="text-sm font-semibold text-novian-text">{formatNumberLabel(selectedLead.customData?.area, " m²")}</div>
                  </div>
                  <div className="rounded-2xl border border-white/5 bg-white/3 p-4">
                    <div className="mb-1 text-[10px] uppercase tracking-[0.2em] text-novian-text/45">Dormitórios</div>
                    <div className="text-sm font-semibold text-novian-text">{formatNumberLabel(selectedLead.customData?.bedrooms)}</div>
                  </div>
                  <div className="rounded-2xl border border-white/5 bg-white/3 p-4">
                    <div className="mb-1 text-[10px] uppercase tracking-[0.2em] text-novian-text/45">Fonte</div>
                    <div className="text-sm font-semibold text-blue-300">{selectedLead.customData?.source ? String(selectedLead.customData.source).toUpperCase() : "APIFY"}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <div className="rounded-2xl border border-white/5 bg-white/3 p-4">
                    <div className="mb-1 text-[10px] uppercase tracking-[0.2em] text-novian-text/45">Preço / m²</div>
                    <div className="text-sm font-semibold text-novian-text">{getPricePerSqmLabel(selectedLead)}</div>
                  </div>
                  <div className="rounded-2xl border border-white/5 bg-white/3 p-4">
                    <div className="mb-1 text-[10px] uppercase tracking-[0.2em] text-novian-text/45">Banheiros</div>
                    <div className="text-sm font-semibold text-novian-text">{formatNumberLabel(selectedLead.customData?.bathrooms)}</div>
                  </div>
                  <div className="rounded-2xl border border-white/5 bg-white/3 p-4">
                    <div className="mb-1 text-[10px] uppercase tracking-[0.2em] text-novian-text/45">Vagas</div>
                    <div className="text-sm font-semibold text-novian-text">{formatNumberLabel(selectedLead.customData?.parkingSpaces)}</div>
                  </div>
                  <div className="rounded-2xl border border-white/5 bg-white/3 p-4">
                    <div className="mb-1 text-[10px] uppercase tracking-[0.2em] text-novian-text/45">Fotos</div>
                    <div className="text-sm font-semibold text-novian-text">{formatNumberLabel(selectedLead.customData?.imageCount)}</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-white/5 bg-white/3 p-5">
                    <div className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-novian-text/45">Classificação</div>
                    <div className="space-y-3 text-sm">
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-novian-text/55">Transação</span>
                        <span className="font-medium text-novian-text">{selectedLead.customData?.transactionType ? String(selectedLead.customData.transactionType) : "Nao informado"}</span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-novian-text/55">Tipo</span>
                        <span className="font-medium text-novian-text">{selectedLead.customData?.propertyType ? String(selectedLead.customData.propertyType) : "Nao informado"}</span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-novian-text/55">Subtipo</span>
                        <span className="font-medium text-novian-text">{selectedLead.customData?.propertySubType ? String(selectedLead.customData.propertySubType) : "Nao informado"}</span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-novian-text/55">ID Externo</span>
                        <span className="font-medium text-novian-text">{selectedLead.customData?.externalId ? String(selectedLead.customData.externalId) : "Nao informado"}</span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/5 bg-white/3 p-5">
                    <div className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-novian-text/45">Custos</div>
                    <div className="space-y-3 text-sm">
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-novian-text/55">Preço anunciado</span>
                        <span className="font-medium text-novian-text">{selectedLead.customData?.priceFormatted ? String(selectedLead.customData.priceFormatted) : formatCurrency(selectedLead.customData?.price)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-novian-text/55">Condomínio</span>
                        <span className="font-medium text-novian-text">{formatCurrency(selectedLead.customData?.condominiumFee)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-novian-text/55">IPTU</span>
                        <span className="font-medium text-novian-text">{formatCurrency(selectedLead.customData?.iptu)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/5 bg-white/3 p-5">
                  <div className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-novian-text/45">Localização</div>
                  <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-novian-text/55">Bairro</span>
                      <span className="font-medium text-novian-text">{selectedLead.customData?.neighborhood ? String(selectedLead.customData.neighborhood) : "Nao informado"}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-novian-text/55">Cidade</span>
                      <span className="font-medium text-novian-text">{selectedLead.customData?.city ? String(selectedLead.customData.city) : "Nao informado"}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-novian-text/55">Estado</span>
                      <span className="font-medium text-novian-text">{selectedLead.customData?.state ? String(selectedLead.customData.state) : "Nao informado"}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-novian-text/55">Região</span>
                      <span className="font-medium text-novian-text">{selectedLead.customData?.region ? String(selectedLead.customData.region) : "Nao informado"}</span>
                    </div>
                  </div>
                </div>

                {fullDescription && (
                  <div>
                    <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-novian-text/45">Descrição do anúncio</div>
                    <p className="max-w-3xl whitespace-pre-wrap text-sm leading-7 text-novian-text/70">{fullDescription}</p>
                  </div>
                )}

                <div>
                  <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-novian-text/45">
                    {fullDescription ? "Resumo curto" : "Resumo"}
                  </div>
                  <p className="max-w-3xl whitespace-pre-wrap text-sm leading-7 text-novian-text/70">{selectedLead.preview}</p>
                </div>

                {splitTags(selectedLead.customData?.amenities).length > 0 && (
                  <div>
                    <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-novian-text/45">Comodidades do imóvel</div>
                    <div className="flex flex-wrap gap-2">
                      {splitTags(selectedLead.customData?.amenities).map((item) => (
                        <span key={item} className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-novian-text/75">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {splitTags(selectedLead.customData?.complexAmenities).length > 0 && (
                  <div>
                    <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-novian-text/45">Comodidades do condomínio</div>
                    <div className="flex flex-wrap gap-2">
                      {splitTags(selectedLead.customData?.complexAmenities).map((item) => (
                        <span key={item} className="rounded-full border border-blue-500/15 bg-blue-500/8 px-3 py-1.5 text-xs text-blue-200">
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {typeof selectedLead.customData?.drafted_proposal === "string" && (
                  <div>
                    <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-novian-text/45">Proposta sugerida pela IA</div>
                    <div className="rounded-2xl border border-purple-500/20 bg-purple-500/5 p-4">
                      <p className="whitespace-pre-wrap text-sm leading-7 text-novian-text/80">
                        {String(selectedLead.customData.drafted_proposal)}
                      </p>
                    </div>
                  </div>
                )}

                <div className="rounded-2xl border border-white/5 bg-white/3 p-5">
                  <div className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-novian-text/45">Rastreamento</div>
                  <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-novian-text/55">Publicado em</span>
                      <span className="font-medium text-novian-text">{formatDateLabel(selectedLead.customData?.publishedAt)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-novian-text/55">Captado em</span>
                      <span className="font-medium text-novian-text">{formatDateLabel(selectedLead.customData?.scrapedAt)}</span>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </aside>
            );
          })()}
        </div>
      )}

      {selectedLead && selectedGalleryIndex !== null && (() => {
        const galleryImages = getLeadImages(selectedLead);
        const activeImage = galleryImages[selectedGalleryIndex];
        if (!activeImage) return null;

        const goPrev = () => setSelectedGalleryIndex((prev) => {
          if (prev === null) return prev;
          return prev === 0 ? galleryImages.length - 1 : prev - 1;
        });

        const goNext = () => setSelectedGalleryIndex((prev) => {
          if (prev === null) return prev;
          return prev === galleryImages.length - 1 ? 0 : prev + 1;
        });

        return (
          <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/80 p-6 backdrop-blur-md">
            <div
              className="absolute inset-0"
              onClick={() => setSelectedGalleryIndex(null)}
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedGalleryIndex(null);
              }}
              className="absolute right-6 top-6 z-10 rounded-full border border-white/10 bg-black/30 p-3 text-white/80 transition-colors hover:bg-black/50 hover:text-white"
            >
              <X size={20} />
            </button>
            {galleryImages.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    goPrev();
                  }}
                  className="absolute left-6 top-1/2 z-10 -translate-y-1/2 rounded-full border border-white/10 bg-black/30 p-3 text-white/80 transition-colors hover:bg-black/50 hover:text-white"
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    goNext();
                  }}
                  className="absolute right-6 top-1/2 z-10 -translate-y-1/2 rounded-full border border-white/10 bg-black/30 p-3 text-white/80 transition-colors hover:bg-black/50 hover:text-white"
                >
                  <ChevronRight size={20} />
                </button>
              </>
            )}
            <div className="relative z-10 flex w-full max-w-6xl flex-col gap-4">
              <img
                src={activeImage}
                alt={`${selectedLead.title} ${selectedGalleryIndex + 1}`}
                className="max-h-[78vh] w-full rounded-2xl object-contain"
              />
              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white/80">
                <span>{selectedLead.title}</span>
                <span>{selectedGalleryIndex + 1} / {galleryImages.length}</span>
              </div>
            </div>
          </div>
        );
      })()}

      {leadToDelete && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/45 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0a1918] p-6 shadow-2xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-red-300">
              <Trash2 size={12} />
              Excluir Item
            </div>
            <h3 className="text-xl font-semibold text-novian-text">Excluir item de captação?</h3>
            <p className="mt-3 text-sm leading-6 text-novian-text/65">
              Isso remove <span className="font-semibold text-novian-text">{leadToDelete.title}</span> do funil de captação permanentemente.
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setLeadToDelete(null)}
                className="rounded-xl px-4 py-2 text-sm font-semibold text-novian-text transition-colors hover:bg-white/5"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteLead}
                disabled={isDeleting}
                className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {isDeleting ? <><Loader2 size={14} className="animate-spin" /> Excluindo...</> : <><Trash2 size={14} /> Excluir</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
