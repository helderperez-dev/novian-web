"use client";

import { useState } from "react";
import { ArrowRight, MapPin, Search } from "lucide-react";
import PopupSelect from "@/components/PopupSelect";

type PropertySearchFiltersProps = {
  locationDefaultValue: string;
  propertyTypeValue: string;
  priceRangeValue: string;
  featureValue: string;
  propertyTypeOptions: string[];
  featureOptions: string[];
};

const priceOptions = [
  { value: "", label: "Todas as faixas" },
  { value: "under_500k", label: "Até R$ 500 mil" },
  { value: "500k_1m", label: "R$ 500 mil a R$ 1 mi" },
  { value: "1m_2m", label: "R$ 1 mi a R$ 2 mi" },
  { value: "over_2m", label: "Acima de R$ 2 mi" },
];

function normalizeFilterLabel(value: string) {
  const trimmed = value.trim();

  if (trimmed === "Tipo de Imovel") return "Tipo de Imóvel";
  if (trimmed === "Casa em condominio") return "Casa em condomínio";
  if (trimmed === "Espaco gourmet" || trimmed === "Espaço gourmet") return "Espaço Gourmet";
  if (trimmed === "Salao de festas" || trimmed === "Salão de festas") return "Salão de Festas";
  if (trimmed === "Suite") return "Suíte";
  if (trimmed === "Imoveis") return "Imóveis";

  return trimmed;
}

const fieldShellClass =
  "rounded-[18px] border border-white/20 bg-white/90 px-4 py-3.5 shadow-lg backdrop-blur-md";
const selectButtonClass =
  "!h-auto !rounded-none !border-0 !bg-transparent !px-0 !py-0 !text-[15px] !text-[#4f5a55] hover:!border-transparent";
const landingMenuClassName =
  "max-h-72 overflow-y-auto [scrollbar-width:thin] [scrollbar-color:rgba(95,120,80,0.5)_transparent] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#5F7850]/45 hover:[&::-webkit-scrollbar-thumb]:bg-[#5F7850]/60";

export default function PropertySearchFilters({
  locationDefaultValue,
  propertyTypeValue,
  priceRangeValue,
  featureValue,
  propertyTypeOptions,
  featureOptions,
}: PropertySearchFiltersProps) {
  const [propertyType, setPropertyType] = useState(propertyTypeValue);
  const [priceRange, setPriceRange] = useState(priceRangeValue);
  const [feature, setFeature] = useState(featureValue);

  return (
    <form method="get" className="grid w-full gap-3 xl:grid-cols-[minmax(250px,1.2fr)_minmax(170px,0.9fr)_minmax(170px,0.9fr)_minmax(190px,1fr)_minmax(190px,0.95fr)]">
      <label className={fieldShellClass}>
        <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.22em] text-[#1F2B2A]">
          Localização
        </span>
        <span className="flex items-center justify-between gap-4">
          <input
            name="location"
            type="text"
            placeholder="Bairro, cidade ou região"
            defaultValue={locationDefaultValue}
            className="w-full bg-transparent text-[15px] text-[#1F2B2A] outline-none placeholder:text-[#64706b]"
          />
          <MapPin size={18} className="shrink-0 text-[#1F2B2A]" />
        </span>
      </label>

      <div className={fieldShellClass}>
        <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.22em] text-[#1F2B2A]">
          Tipo de imóvel
        </span>
        <PopupSelect
          name="propertyType"
          value={propertyType}
          onChange={setPropertyType}
          options={[
            { value: "", label: "Todos os tipos" },
            ...propertyTypeOptions.map((option) => ({ value: option, label: normalizeFilterLabel(option) })),
          ]}
          placeholder="Selecione o tipo"
          buttonClassName={selectButtonClass}
          menuClassName={landingMenuClassName}
          portal
          portalMinWidth={240}
          portalMaxWidth={280}
        />
      </div>

      <div className={fieldShellClass}>
        <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.22em] text-[#1F2B2A]">
          Faixa de preço
        </span>
        <PopupSelect
          name="priceRange"
          value={priceRange}
          onChange={setPriceRange}
          options={priceOptions}
          placeholder="Selecione a faixa"
          buttonClassName={selectButtonClass}
          menuClassName={landingMenuClassName}
          portal
          portalMinWidth={240}
          portalMaxWidth={280}
        />
      </div>

      <div className={fieldShellClass}>
        <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.22em] text-[#1F2B2A]">
          Características
        </span>
        <PopupSelect
          name="amenity"
          value={feature}
          onChange={setFeature}
          options={[
            { value: "", label: "Todas as características" },
            ...featureOptions.map((option) => ({ value: option, label: normalizeFilterLabel(option) })),
          ]}
          placeholder="Selecione uma característica"
          buttonClassName={selectButtonClass}
          menuClassName={landingMenuClassName}
          portal
          portalMinWidth={240}
          portalMaxWidth={280}
        />
      </div>

      <button
        type="submit"
        className="inline-flex min-h-[70px] items-center justify-center gap-3 rounded-[18px] bg-[#5E7F49] px-5 py-4 text-base font-semibold text-white shadow-lg shadow-green-900/30 transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#4F6F3D]"
      >
        <Search size={18} />
        Buscar imóveis
        <ArrowRight size={16} />
      </button>
    </form>
  );
}
