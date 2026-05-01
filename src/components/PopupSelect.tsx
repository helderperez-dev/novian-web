"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import Image from "next/image";

export type PopupSelectOption = {
  value: string;
  label: string;
  description?: string;
  avatarUrl?: string;
};

type PopupSelectProps = {
  name?: string;
  value: string;
  onChange: (value: string) => void;
  options: PopupSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyMessage?: string;
  maxVisibleOptions?: number;
  buttonClassName?: string;
  menuClassName?: string;
};

export default function PopupSelect({
  name,
  value,
  onChange,
  options,
  placeholder = "Selecionar",
  disabled = false,
  required = false,
  searchable = false,
  searchPlaceholder = "Buscar...",
  emptyMessage = "Nenhuma opcao encontrada.",
  maxVisibleOptions = 120,
  buttonClassName = "",
  menuClassName = "",
}: PopupSelectProps) {
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

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value),
    [options, value],
  );
  const visibleOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = normalizedQuery
      ? options.filter((option) => {
          const haystack = `${option.label} ${option.description || ""} ${option.value}`.toLowerCase();
          return haystack.includes(normalizedQuery);
        })
      : options;

    return filtered.slice(0, maxVisibleOptions);
  }, [maxVisibleOptions, options, query]);

  const applyValue = (nextValue: string) => {
    onChange(nextValue);
    setQuery("");
    setIsOpen(false);
  };

  return (
    <div ref={rootRef} className="relative overflow-visible">
      {name ? <input type="hidden" name={name} value={value} required={required} /> : null}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((current) => !current)}
        className={`flex h-11 w-full items-center justify-between gap-3 rounded-xl border border-novian-muted/40 bg-novian-primary px-3 py-2.5 text-left text-sm text-novian-text outline-none transition hover:border-novian-accent/35 disabled:cursor-not-allowed disabled:opacity-60 ${buttonClassName}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className={`flex min-w-0 items-center ${selectedOption?.avatarUrl ? "gap-3" : ""}`}>
          {selectedOption?.avatarUrl ? (
            <Image
              src={selectedOption.avatarUrl}
              alt={selectedOption.label}
              width={24}
              height={24}
              className="h-6 w-6 shrink-0 rounded-full object-cover"
            />
          ) : null}
          <span className={`truncate ${selectedOption ? "text-novian-text" : "text-novian-text/45"}`}>
            {selectedOption?.label || placeholder}
          </span>
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
          {searchable ? (
            <div className="px-1.5 pb-1.5">
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={searchPlaceholder}
                className="h-10 w-full rounded-xl border border-novian-muted/35 bg-novian-primary px-3 text-sm text-novian-text outline-none transition focus:border-novian-accent/35"
              />
            </div>
          ) : null}
          {visibleOptions.length === 0 ? (
            <div className="px-3 py-3 text-sm text-novian-text/45">
              {emptyMessage}
            </div>
          ) : null}
          {visibleOptions.map((option) => {
            const isSelected = option.value === value;

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => applyValue(option.value)}
                className={`flex w-full items-start justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                  isSelected
                    ? "bg-novian-primary/70 text-novian-text"
                    : "text-novian-text/75 hover:bg-novian-primary/45 hover:text-novian-text"
                }`}
                role="option"
                aria-selected={isSelected}
              >
                <span className={`flex min-w-0 items-start ${option.avatarUrl ? "gap-3" : ""}`}>
                  {option.avatarUrl ? (
                    <Image
                      src={option.avatarUrl}
                      alt={option.label}
                      width={34}
                      height={34}
                      className="mt-0.5 h-8 w-8 shrink-0 rounded-full object-cover"
                    />
                  ) : null}
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{option.label}</span>
                    {option.description ? (
                      <span className="mt-0.5 block text-xs leading-relaxed text-novian-text/45">
                        {option.description}
                      </span>
                    ) : null}
                  </span>
                </span>
                {isSelected ? <Check size={15} className="mt-0.5 shrink-0 text-novian-accent" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
