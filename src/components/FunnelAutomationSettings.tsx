"use client";

import { useEffect, useState } from "react";
import { Save, SlidersHorizontal } from "lucide-react";

type PersonRole = "lead" | "client" | "buyer" | "seller";

type FunnelColumn = {
  id: string;
  title: string;
  color: string;
};

type AutomationRule = {
  stageId: string;
  stageTitle: string;
  stageColor?: string | null;
  addRoles: PersonRole[];
  removeRoles: PersonRole[];
  addTags: string[];
  removeTags: string[];
  pointsDelta: number;
};

const ROLE_OPTIONS: Array<{ value: PersonRole; label: string }> = [
  { value: "lead", label: "Lead" },
  { value: "client", label: "Cliente" },
  { value: "buyer", label: "Comprador" },
  { value: "seller", label: "Vendedor" },
];

const parseTagInput = (value: string) =>
  Array.from(
    new Set(
      value
        .split(",")
        .map((item) =>
          item
            .trim()
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, ""),
        )
        .filter(Boolean),
    ),
  );

function RolePills({
  value,
  onChange,
}: {
  value: PersonRole[];
  onChange: (next: PersonRole[]) => void;
}) {
  const toggle = (role: PersonRole) => {
    if (value.includes(role)) {
      onChange(value.filter((item) => item !== role));
      return;
    }

    onChange([...value, role]);
  };

  return (
    <div className="flex flex-wrap gap-2">
      {ROLE_OPTIONS.map((role) => {
        const active = value.includes(role.value);
        return (
          <button
            key={role.value}
            type="button"
            onClick={() => toggle(role.value)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              active
                ? "border-novian-accent bg-novian-accent/15 text-novian-accent"
                : "border-novian-muted/40 bg-novian-primary/30 text-novian-text/60 hover:border-novian-accent/40 hover:text-novian-text"
            }`}
          >
            {role.label}
          </button>
        );
      })}
    </div>
  );
}

export default function FunnelAutomationSettings({
  funnelId,
  funnelName,
  funnelType,
  columns,
  disabled,
}: {
  funnelId: string;
  funnelName: string;
  funnelType: "lead" | "captacao";
  columns: FunnelColumn[];
  disabled?: boolean;
}) {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const buildResolvedRules = (sourceRules: AutomationRule[]) =>
    columns.map<AutomationRule>((column, index) => {
      const existing = sourceRules.find((rule) => rule.stageId === column.id || rule.stageTitle === column.title);
      return existing || {
        stageId: column.id,
        stageTitle: column.title,
        stageColor: column.color,
        addRoles: index === 0 ? (["lead"] as PersonRole[]) : [],
        removeRoles: [],
        addTags: [],
        removeTags: [],
        pointsDelta: 0,
      };
    });

  useEffect(() => {
    if (disabled || funnelType !== "lead" || !funnelId) {
      setRules([]);
      return;
    }

    let cancelled = false;
    const loadRules = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/people/automation?funnelId=${encodeURIComponent(funnelId)}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          throw new Error("Failed to load automation");
        }

        const data = await res.json();
        if (!cancelled) {
          setRules(Array.isArray(data.rules) ? data.rules : []);
        }
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setRules([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadRules();
    return () => {
      cancelled = true;
    };
  }, [disabled, funnelId, funnelType]);

  const normalizedRules = buildResolvedRules(rules);

  const saveRules = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/people/automation", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          funnelId,
          rules: normalizedRules.map((rule, index) => ({
            ...rule,
            stageId: columns[index]?.id || rule.stageId,
            stageTitle: columns[index]?.title || rule.stageTitle,
          })),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Nao foi possivel salvar as automacoes.");
      }
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "Nao foi possivel salvar as automacoes.");
    } finally {
      setSaving(false);
    }
  };

  if (funnelType !== "lead") {
    return (
      <div className="rounded-2xl border border-dashed border-novian-muted bg-novian-primary/40 px-5 py-5 text-sm text-novian-text/55">
        Automacoes de People ficam disponiveis apenas para funis do tipo Lead.
      </div>
    );
  }

  if (disabled || !funnelId || columns.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-novian-muted bg-novian-primary/40 px-5 py-5 text-sm text-novian-text/55">
        Salve o funil primeiro para configurar perfis, tags e pontos por etapa.
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-novian-muted bg-novian-primary/35 p-6">
      <div className="flex items-center justify-between gap-4 border-b border-novian-muted/40 pb-5">
        <div>
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-novian-text/45">
            <SlidersHorizontal size={14} />
            Automacoes do Funil
          </div>
          <div className="mt-2 text-lg font-semibold text-novian-text">{funnelName}</div>
          <div className="mt-1 text-sm text-novian-text/55">
            Defina quais perfis, tags e pontos a pessoa recebe quando entra em cada etapa.
          </div>
        </div>
        <button
          type="button"
          onClick={saveRules}
          disabled={saving || loading}
          className="inline-flex items-center gap-2 rounded-full border border-transparent bg-novian-accent px-4 py-2 text-sm font-semibold text-novian-primary transition-colors hover:bg-[#3b5c49] active:bg-[#284032] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-novian-accent/20 disabled:cursor-not-allowed disabled:bg-novian-accent/45 disabled:text-novian-primary/80"
        >
          <Save size={14} />
          {saving ? "Salvando..." : "Salvar"}
        </button>
      </div>

      <div className="mt-5 space-y-4">
        {loading ? (
          <div className="rounded-2xl border border-dashed border-novian-muted bg-novian-surface/20 px-5 py-8 text-sm text-novian-text/50">
            Carregando automacoes...
          </div>
        ) : (
          normalizedRules.map((rule, index) => (
            <div key={rule.stageId || `${rule.stageTitle}-${index}`} className="rounded-3xl border border-novian-muted/35 bg-novian-surface/20 p-4">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-novian-text">{columns[index]?.title || rule.stageTitle}</div>
                  <div className="mt-1 text-xs text-novian-text/45">Atualiza a pessoa quando esta etapa for atingida.</div>
                </div>
                <div className="rounded-full border border-novian-muted/35 bg-novian-surface/35 px-3 py-1 text-xs text-novian-text/55">
                  Etapa {index + 1}
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="mb-2 text-xs text-novian-text/55">Adicionar perfis</div>
                  <RolePills
                    value={rule.addRoles}
                    onChange={(next) =>
                      setRules(() => {
                        const nextRules = [...normalizedRules];
                        nextRules[index] = { ...nextRules[index], addRoles: next };
                        return nextRules;
                      })
                    }
                  />
                </div>

                <div>
                  <div className="mb-2 text-xs text-novian-text/55">Remover perfis</div>
                  <RolePills
                    value={rule.removeRoles}
                    onChange={(next) =>
                      setRules(() => {
                        const nextRules = [...normalizedRules];
                        nextRules[index] = { ...nextRules[index], removeRoles: next };
                        return nextRules;
                      })
                    }
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs text-novian-text/55">Tags para adicionar</label>
                  <input
                    value={rule.addTags.join(", ")}
                    onChange={(event) =>
                      setRules(() => {
                        const nextRules = [...normalizedRules];
                        nextRules[index] = { ...nextRules[index], addTags: parseTagInput(event.target.value) };
                        return nextRules;
                      })
                    }
                    className="w-full rounded-2xl border border-novian-muted/35 bg-novian-surface/30 px-4 py-3 text-sm outline-none transition focus:border-novian-accent/45"
                    placeholder="qualified, vip, pronto-para-proposta"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs text-novian-text/55">Tags para remover</label>
                  <input
                    value={rule.removeTags.join(", ")}
                    onChange={(event) =>
                      setRules(() => {
                        const nextRules = [...normalizedRules];
                        nextRules[index] = { ...nextRules[index], removeTags: parseTagInput(event.target.value) };
                        return nextRules;
                      })
                    }
                    className="w-full rounded-2xl border border-novian-muted/35 bg-novian-surface/30 px-4 py-3 text-sm outline-none transition focus:border-novian-accent/45"
                    placeholder="cold, aguardando-retorno"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs text-novian-text/55">Delta de pontos</label>
                  <input
                    type="number"
                    value={rule.pointsDelta}
                    onChange={(event) =>
                      setRules(() => {
                        const nextRules = [...normalizedRules];
                        nextRules[index] = { ...nextRules[index], pointsDelta: Number(event.target.value || 0) };
                        return nextRules;
                      })
                    }
                    className="w-full rounded-2xl border border-novian-muted/35 bg-novian-surface/30 px-4 py-3 text-sm outline-none transition focus:border-novian-accent/45"
                  />
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
