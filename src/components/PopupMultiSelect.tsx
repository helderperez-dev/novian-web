"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import type { PopupSelectOption } from "@/components/PopupSelect";

type PopupMultiSelectProps = {
  name?: string;
  values: string[];
  onChange: (values: string[]) => void;
  options: PopupSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  searchPlaceholder?: string;
  emptyMessage?: string;
  buttonClassName?: string;
  menuClassName?: string;
};

export default function PopupMultiSelect({
  name,
  values,
  onChange,
  options,
  placeholder = "Selecionar opcoes",
  disabled = false,
  searchPlaceholder = "Buscar opcoes...",
  emptyMessage = "Nenhuma opcao encontrada.",
  buttonClassName = "",
  menuClassName = "",
}: PopupMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) {
        setIsOpen(false);
        return;
      }

      if (!rootRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const visibleOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return options;
    }

    return options.filter((option) => {
      const haystack = `${option.label} ${option.description || ""} ${option.value}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [options, query]);

  const selectedLabels = useMemo(
    () =>
      values
        .map((value) => options.find((option) => option.value === value)?.label || value)
        .filter(Boolean),
    [options, values],
  );

  const toggleValue = (nextValue: string) => {
    if (values.includes(nextValue)) {
      onChange(values.filter((value) => value !== nextValue));
      return;
    }

    onChange([...values, nextValue]);
  };

  const summary =
    selectedLabels.length === 0
      ? placeholder
      : selectedLabels.length <= 2
        ? selectedLabels.join(", ")
        : `${selectedLabels.slice(0, 2).join(", ")} +${selectedLabels.length - 2}`;

  return (
    <div ref={rootRef} className="relative overflow-visible">
      {name ? <input type="hidden" name={name} value={values.join(",")} /> : null}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((current) => !current)}
        className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-novian-muted/40 bg-novian-primary px-3 py-2.5 text-left text-sm text-novian-text outline-none transition hover:border-novian-accent/35 disabled:cursor-not-allowed disabled:opacity-60 ${buttonClassName}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className={`min-w-0 truncate ${selectedLabels.length === 0 ? "text-novian-text/45" : "text-novian-text"}`}>
          {summary}
        </span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-novian-text/55 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen ? (
        <div
          className={`absolute top-[calc(100%+8px)] z-80 w-full rounded-2xl border border-novian-muted/35 bg-novian-surface/95 p-1.5 shadow-[0_18px_40px_rgba(0,0,0,0.28)] backdrop-blur ${menuClassName}`}
          role="listbox"
        >
          <div className="px-1.5 pb-1.5">
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              className="h-10 w-full rounded-xl border border-novian-muted/35 bg-novian-primary px-3 text-sm text-novian-text outline-none transition focus:border-novian-accent/35"
            />
          </div>
          {selectedLabels.length > 0 ? (
            <div className="flex flex-wrap gap-2 px-1.5 pb-2">
              {selectedLabels.map((label) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1 rounded-full border border-novian-muted/30 bg-novian-primary px-2.5 py-1 text-xs text-novian-text/75"
                >
                  {label}
                </span>
              ))}
              <button
                type="button"
                onClick={() => onChange([])}
                className="inline-flex items-center gap-1 rounded-full border border-novian-muted/30 px-2.5 py-1 text-xs text-novian-text/55 transition hover:border-novian-accent/35 hover:text-novian-text"
              >
                <X size={12} />
                Limpar
              </button>
            </div>
          ) : null}
          <div className="max-h-72 overflow-y-auto">
            {visibleOptions.length === 0 ? (
              <div className="px-3 py-3 text-sm text-novian-text/45">{emptyMessage}</div>
            ) : (
              visibleOptions.map((option) => {
                const isSelected = values.includes(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => toggleValue(option.value)}
                    className={`flex w-full items-start justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                      isSelected
                        ? "bg-novian-primary/70 text-novian-text"
                        : "text-novian-text/75 hover:bg-novian-primary/45 hover:text-novian-text"
                    }`}
                    role="option"
                    aria-selected={isSelected}
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{option.label}</span>
                      {option.description ? (
                        <span className="mt-0.5 block text-xs leading-relaxed text-novian-text/45">
                          {option.description}
                        </span>
                      ) : null}
                    </span>
                    {isSelected ? <Check size={15} className="mt-0.5 shrink-0 text-novian-accent" /> : null}
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
