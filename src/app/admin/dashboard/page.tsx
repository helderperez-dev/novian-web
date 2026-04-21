"use client";

import { useEffect, useState } from "react";
import { Funnel as RechartsFunnel, FunnelChart, Tooltip, Cell, LabelList, ResponsiveContainer } from "recharts";
import Link from "next/link";
import Image from "next/image";

type DashboardBreakdownItem = { label: string; count: number; color?: string | null };
type DashboardRecentCaptacaoItem = { id: string; title: string; status: string; source: string; createdAt: string; image: string };
type DashboardRecentPropertyItem = { id: string; title: string; status: string; price: number; address: string; image: string };
type DashboardRecentClientProcessItem = { id: string; title: string; status: string; updated_at: string };
type DashboardPayload = {
  overview: {
    crmLeads: number;
    crmFunnels: number;
    captacaoLeads: number;
    captacaoFunnels: number;
    totalProperties: number;
    activeProperties: number;
    internalUsers: number;
    clients: number;
    clientProcesses: number;
    clientDocuments: number;
    totalMessages: number;
  };
  crmStatusBreakdown: DashboardBreakdownItem[];
  captacaoStatusBreakdown: DashboardBreakdownItem[];
  propertyStatusBreakdown: DashboardBreakdownItem[];
  clientProcessBreakdown: DashboardBreakdownItem[];
  recentCaptacao: DashboardRecentCaptacaoItem[];
  recentProperties: DashboardRecentPropertyItem[];
  recentClientProcesses: DashboardRecentClientProcessItem[];
};

const getDashboardLabel = (label: string) => {
  const normalized = label.trim().toLowerCase();
  if (normalized === "active") return "Ativo";
  if (normalized === "inactive") return "Inativo";
  if (normalized === "sold") return "Vendido";
  if (normalized === "unassigned") return "Sem etapa";
  if (normalized === "pending") return "Pendente";
  return label;
};

const getStageTheme = (color?: string | null) => {
  const normalized = String(color || "").toLowerCase();

  if (normalized.includes("purple")) {
    return {
      border: "rgba(168, 85, 247, 0.28)",
      background: "rgba(168, 85, 247, 0.12)",
      accent: "#c084fc",
      badgeBackground: "rgba(168, 85, 247, 0.18)",
      badgeBorder: "rgba(168, 85, 247, 0.32)",
      text: "#e9d5ff",
    };
  }

  if (normalized.includes("yellow")) {
    return {
      border: "rgba(234, 179, 8, 0.28)",
      background: "rgba(234, 179, 8, 0.12)",
      accent: "#facc15",
      badgeBackground: "rgba(234, 179, 8, 0.18)",
      badgeBorder: "rgba(234, 179, 8, 0.32)",
      text: "#fef08a",
    };
  }

  if (normalized.includes("orange")) {
    return {
      border: "rgba(249, 115, 22, 0.28)",
      background: "rgba(249, 115, 22, 0.12)",
      accent: "#fb923c",
      badgeBackground: "rgba(249, 115, 22, 0.18)",
      badgeBorder: "rgba(249, 115, 22, 0.32)",
      text: "#fdba74",
    };
  }

  if (normalized.includes("green")) {
    return {
      border: "rgba(34, 197, 94, 0.28)",
      background: "rgba(34, 197, 94, 0.12)",
      accent: "#4ade80",
      badgeBackground: "rgba(34, 197, 94, 0.18)",
      badgeBorder: "rgba(34, 197, 94, 0.32)",
      text: "#bbf7d0",
    };
  }

  if (normalized.includes("red")) {
    return {
      border: "rgba(239, 68, 68, 0.28)",
      background: "rgba(239, 68, 68, 0.12)",
      accent: "#f87171",
      badgeBackground: "rgba(239, 68, 68, 0.18)",
      badgeBorder: "rgba(239, 68, 68, 0.32)",
      text: "#fecaca",
    };
  }

  return {
    border: "rgba(59, 130, 246, 0.28)",
    background: "rgba(59, 130, 246, 0.12)",
    accent: "#60a5fa",
    badgeBackground: "rgba(59, 130, 246, 0.18)",
    badgeBorder: "rgba(59, 130, 246, 0.32)",
    text: "#bfdbfe",
  };
};

function StatCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-3xl border border-novian-muted/40 bg-novian-surface/45 p-6">
      <div className="text-sm font-medium text-novian-text/55">{label}</div>
      <div className="mt-3 flex items-baseline gap-2">
        <div className="text-3xl font-bold text-novian-text">{value}</div>
        {hint && <div className="text-xs font-medium text-novian-text/45">{hint}</div>}
      </div>
    </div>
  );
}

function RecentListCard({
  title,
  subtitle,
  items,
  emptyMessage,
}: {
  title: string;
  subtitle: string;
  items: { id: string; title: string; meta: string; trailing?: string; image?: string; href?: string }[];
  emptyMessage: string;
}) {
  return (
    <div className="rounded-3xl border border-novian-muted/40 bg-novian-surface/45 p-6">
      <div className="mb-1 text-lg font-semibold text-novian-text">{title}</div>
      <div className="truncate whitespace-nowrap text-sm text-novian-text/55">{subtitle}</div>

      <div className="mt-6 space-y-4">
        {items.length > 0 ? (
          items.map((item) => {
            const content = (
              <div className="flex items-center justify-between gap-4 w-full">
                <div className="flex items-center min-w-0 gap-4 flex-1">
                  {item.image && (
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-novian-surface/80 shadow-md">
                      <Image 
                        src={item.image} 
                        alt={item.title} 
                        fill 
                        sizes="48px"
                        className="object-cover"
                      />
                    </div>
                  )}
                  {!item.image && (
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-dashed border-white/10 bg-white/5 text-xs text-novian-text/30">
                      Sem foto
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-novian-text group-hover:text-novian-accent transition-colors">{item.title}</div>
                    <div className="mt-1 truncate text-xs text-novian-text/55">{item.meta}</div>
                  </div>
                </div>
                {item.trailing && (
                  <div className="shrink-0 text-sm font-medium text-novian-text">{item.trailing}</div>
                )}
              </div>
            );

            if (item.href) {
              return (
                <Link key={item.id} href={item.href} className="group block rounded-2xl p-2 -mx-2 hover:bg-white/5 transition-colors">
                  {content}
                </Link>
              );
            }

            return (
              <div key={item.id} className="group block rounded-2xl p-2 -mx-2">
                {content}
              </div>
            );
          })
        ) : (
          <div className="rounded-2xl border border-dashed border-novian-muted/40 bg-novian-primary/40 px-4 py-5 text-sm text-novian-text/45">
            {emptyMessage}
          </div>
        )}
      </div>
    </div>
  );
}

function BreakdownCard({
  title,
  subtitle,
  items,
  emptyMessage,
}: {
  title: string;
  subtitle: string;
  items: DashboardBreakdownItem[];
  emptyMessage: string;
}) {
  const maxCount = Math.max(...items.map((i) => i.count), 1);

  return (
    <div className="rounded-3xl border border-novian-muted/40 bg-novian-surface/45 p-6">
      <div className="mb-1 text-lg font-semibold text-novian-text">{title}</div>
      <div className="truncate whitespace-nowrap text-sm text-novian-text/55">{subtitle}</div>

      <div className="mt-6 space-y-4">
        {items.length > 0 ? (
          items.map((item) => (
            <div key={item.label}>
              <div className="mb-2 flex items-center justify-between gap-4 text-sm">
                <span className="text-novian-text/75">{getDashboardLabel(item.label)}</span>
                <span className="font-semibold text-novian-text">{item.count}</span>
              </div>
              <div className="h-2 rounded-full bg-novian-primary/80">
                <div
                  className="h-2 rounded-full bg-novian-accent"
                  style={{ width: `${(item.count / maxCount) * 100}%` }}
                />
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-novian-muted/40 bg-novian-primary/40 px-4 py-5 text-sm text-novian-text/45">
            {emptyMessage}
          </div>
        )}
      </div>
    </div>
  );
}

const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: { payload: { label: string; count: number; accent: string } }[] }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="rounded-xl border border-white/10 bg-[#061110]/95 px-4 py-3 shadow-2xl backdrop-blur-md">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-novian-text/45">{data.label}</p>
        <p className="mt-1 text-2xl font-bold" style={{ color: data.accent }}>
          {data.count}
        </p>
      </div>
    );
  }
  return null;
};

function FunnelBreakdownCard({
  title,
  subtitle,
  items,
  emptyMessage,
}: {
  title: string;
  subtitle: string;
  items: DashboardBreakdownItem[];
  emptyMessage: string;
}) {
  const stageItems = items.map((item, index) => {
    const theme = getStageTheme(item.color);

    return {
      id: `${item.label}-${index}`,
      label: getDashboardLabel(item.label),
      count: item.count,
      accent: theme.accent,
      text: theme.text,
      border: theme.border,
      background: theme.background,
      badgeBackground: theme.badgeBackground,
      badgeBorder: theme.badgeBorder,
      // A standard funnel chart tapers down. Let's make `value` just taper down linearly.
      // Taper down to 40% width so text can fit inside
      shapeValue: 100 - index * (60 / Math.max(items.length, 1)),
    };
  });

  const renderCustomLabel = (props: { x?: number | string, y?: number | string, width?: number | string, height?: number | string, index?: number }) => {
    const x = Number(props.x || 0);
    const y = Number(props.y || 0);
    const width = Number(props.width || 0);
    const height = Number(props.height || 0);
    const index = props.index || 0;
    const item = stageItems[index];
    
    if (!item) return null;
    
    return (
      <g>
        <text
          x={x + width / 2}
          y={y + height / 2 - 8}
          fill="#ffffff"
          textAnchor="middle"
          dominantBaseline="middle"
          style={{ fontSize: "20px", fontWeight: 700 }}
        >
          {item.count}
        </text>
        <text
          x={x + width / 2}
          y={y + height / 2 + 14}
          fill="rgba(255,255,255,0.8)"
          textAnchor="middle"
          dominantBaseline="middle"
          style={{ fontSize: "13px", fontWeight: 500 }}
        >
          {item.label}
        </text>
      </g>
    );
  };

  return (
    <div className="rounded-3xl border border-novian-muted/40 bg-novian-surface/45 p-6">
      <div className="mb-1 text-lg font-semibold text-novian-text">{title}</div>
      <div className="truncate whitespace-nowrap text-sm text-novian-text/55">{subtitle}</div>

      <div className="mt-8 h-[360px] w-full">
        {items.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <FunnelChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.05)" }} />
              <RechartsFunnel
                dataKey="shapeValue"
                data={stageItems}
                isAnimationActive={false}
                lastShapeType="rectangle"
              >
                <LabelList
                  position="inside"
                  content={renderCustomLabel}
                />
                {stageItems.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.accent} fillOpacity={0.8} stroke={entry.border} />
                ))}
              </RechartsFunnel>
            </FunnelChart>
          </ResponsiveContainer>
        ) : (
          <div className="rounded-2xl border border-dashed border-novian-muted/40 bg-novian-primary/40 px-4 py-5 text-sm text-novian-text/45">
            {emptyMessage}
          </div>
        )}
      </div>
    </div>
  );
}

function DashboardLoader() {
  return (
    <div className="flex flex-col gap-8 w-full max-w-[1400px]">
      <div className="flex min-h-[180px] w-full flex-col items-center justify-center rounded-3xl border border-novian-muted/40 bg-novian-surface/35">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-novian-muted/35 border-t-novian-accent" />
        <p className="mt-4 text-sm font-medium text-novian-text/75">Carregando dashboard...</p>
        <p className="mt-1 text-xs text-novian-text/45">Buscando os dados mais recentes do sistema.</p>
      </div>

      <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-[120px] w-full animate-pulse rounded-3xl border border-novian-muted/20 bg-novian-surface/20" />
        ))}
      </div>

      <div className="grid w-full grid-cols-1 gap-6 xl:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-[480px] w-full animate-pulse rounded-3xl border border-novian-muted/20 bg-novian-surface/20" />
        ))}
      </div>
      
      <div className="grid w-full grid-cols-1 gap-6 lg:grid-cols-2">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="h-[300px] w-full animate-pulse rounded-3xl border border-novian-muted/20 bg-novian-surface/20" />
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/admin/dashboard");
        if (res.ok) {
          setDashboard(await res.json());
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="h-full overflow-y-auto p-8 w-full">
        <div className="mx-auto w-full max-w-[1400px]">
          <div className="mb-8">
            <h1 className="text-3xl font-medium tracking-tight text-novian-text">Dashboard</h1>
            <p className="mt-2 text-sm text-novian-text/60">Visão geral do sistema e acompanhamento de métricas.</p>
          </div>
          <DashboardLoader />
        </div>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="text-novian-text/45">Não foi possível carregar os dados do dashboard.</div>
      </div>
    );
  }

  const cards = [
    { label: "Total de Oportunidades", value: dashboard.overview.captacaoLeads, hint: "Em captação" },
    { label: "Leads em Atendimento", value: dashboard.overview.crmLeads, hint: "No CRM" },
    { label: "Imóveis Ativos", value: dashboard.overview.activeProperties, hint: `de ${dashboard.overview.totalProperties} totais` },
    { label: "Processos Abertos", value: dashboard.overview.clientProcesses, hint: "Portal do Cliente" },
  ];

  return (
    <div className="h-full overflow-y-auto p-8 w-full">
      <div className="mx-auto w-full max-w-[1400px]">
        <div className="mb-8">
          <h1 className="text-3xl font-medium tracking-tight text-novian-text">Dashboard</h1>
          <p className="mt-2 text-sm text-novian-text/60">Visão geral do sistema e acompanhamento de métricas.</p>
        </div>

        <div className="flex flex-col gap-8">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {cards.map((card) => (
              <StatCard key={card.label} label={card.label} value={card.value} hint={card.hint} />
            ))}
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <FunnelBreakdownCard
              title="Pipeline do CRM"
              subtitle="Leads em andamento no CRM."
              items={dashboard.crmStatusBreakdown}
              emptyMessage="Ainda não existem leads no CRM."
            />
            <FunnelBreakdownCard
              title="Pipeline de Captação"
              subtitle="Oportunidades no funil de captação."
              items={dashboard.captacaoStatusBreakdown}
              emptyMessage="Ainda não existem oportunidades captadas."
            />
            <BreakdownCard
              title="Status dos Imóveis"
              subtitle="Estoque por status."
              items={dashboard.propertyStatusBreakdown}
              emptyMessage="Ainda não existem imóveis."
            />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <RecentListCard
              title="Captações Recentes"
              subtitle="Novas oportunidades."
              items={dashboard.recentCaptacao.map((item) => ({
                id: item.id,
                title: item.title,
                meta: `${getDashboardLabel(item.status)} · Origem: ${item.source}`,
                trailing: new Date(item.createdAt).toLocaleDateString("pt-BR"),
                image: item.image,
                href: `/admin/captacao?lead=${item.id}`,
              }))}
              emptyMessage="Ainda não existem captações."
            />
            <RecentListCard
              title="Imóveis Recentes"
              subtitle="Imóveis disponíveis."
              items={dashboard.recentProperties.map((item) => ({
                id: item.id,
                title: item.title,
                meta: `${getDashboardLabel(item.status)} · ${item.address}`,
                trailing: new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(item.price),
                image: item.image,
                href: `/admin/properties?id=${item.id}`,
              }))}
              emptyMessage="Ainda não existem imóveis."
            />
          </div>
        </div>
      </div>
    </div>
  );
}
