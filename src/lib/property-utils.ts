import type { CustomField, Property, PropertyCustomDataValue, PropertyOffer, PropertyOfferType } from "@/lib/store";

const PROPERTY_DISPLAY_TEXT_MAP: Record<string, string> = {
  "Tipo de Imovel": "Tipo de Imóvel",
  Numero: "Número",
  Area: "Área",
  Pais: "País",
  Nao: "Não",
  "Casa em condominio": "Casa em condomínio",
  "Condominio": "Condomínio",
  "Espaco gourmet": "Espaço Gourmet",
  "Espaço gourmet": "Espaço Gourmet",
  "Salao de festas": "Salão de Festas",
  "Salão de festas": "Salão de Festas",
  Suite: "Suíte",
};

export function normalizePropertyDisplayText(text: string) {
  const trimmed = text.trim();

  if (!trimmed) {
    return trimmed;
  }

  return PROPERTY_DISPLAY_TEXT_MAP[trimmed] ?? trimmed;
}

export function getPrimaryPropertyOffer(property: Pick<Property, "offers" | "price">, preferredType?: PropertyOfferType) {
  const offers = Array.isArray(property.offers) ? property.offers : [];

  if (preferredType) {
    const preferredPrimary = offers.find((offer) => offer.offerType === preferredType && offer.isPrimary);
    if (preferredPrimary) {
      return preferredPrimary;
    }

    const preferredOffer = offers.find((offer) => offer.offerType === preferredType);
    if (preferredOffer) {
      return preferredOffer;
    }

    if (preferredType === "sale" && offers.length === 0 && Number.isFinite(property.price) && property.price > 0) {
      return {
        offerType: "sale",
        price: property.price,
        isPrimary: true,
      } satisfies PropertyOffer;
    }

    return null;
  }

  const primaryOffer = offers.find((offer) => offer.isPrimary);
  if (primaryOffer) {
    return primaryOffer;
  }

  if (offers.length > 0) {
    return offers[0];
  }

  if (Number.isFinite(property.price) && property.price > 0) {
    return {
      offerType: "sale",
      price: property.price,
      isPrimary: true,
    } satisfies PropertyOffer;
  }

  return null;
}

export function getPropertyOfferPrice(property: Pick<Property, "offers" | "price">, preferredType?: PropertyOfferType) {
  return getPrimaryPropertyOffer(property, preferredType)?.price ?? property.price ?? 0;
}

export function formatPropertyOfferLabel(offer: PropertyOffer | null | undefined) {
  if (!offer) {
    return "Sob consulta";
  }

  const formattedPrice = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number.isFinite(offer.price) ? offer.price : 0);

  return offer.offerType === "rent" ? `${formattedPrice}/mes` : formattedPrice;
}

export function getPropertyOfferSummary(property: Pick<Property, "offers" | "price">) {
  const saleOffer = getPrimaryPropertyOffer(property, "sale");
  const rentOffer = getPrimaryPropertyOffer(property, "rent");
  return {
    saleOffer,
    rentOffer,
    primaryOffer: getPrimaryPropertyOffer(property),
  };
}

function isEmptyPropertyValue(value: PropertyCustomDataValue | undefined) {
  if (value === undefined || value === null) {
    return true;
  }

  if (typeof value === "string") {
    return value.trim().length === 0;
  }

  return false;
}

export function formatPropertyFieldValue(value: PropertyCustomDataValue, field?: Pick<CustomField, "type" | "unit">) {
  if (typeof value === "boolean") {
    return value ? "Sim" : "Não";
  }

  if (typeof value === "number") {
    if (field?.type === "number" && field.unit) {
      if (field.unit.trim().toUpperCase() === "R$") {
        const formattedNumber = new Intl.NumberFormat("pt-BR").format(value);
        return `R$ ${formattedNumber}`;
      }
      return `${value} ${field.unit}`;
    }

    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizePropertyDisplayText(item)).join(", ");
  }

  if (field?.type === "number" && field?.unit) {
    if (field.unit.trim().toUpperCase() === "R$") {
      return normalizePropertyDisplayText(`R$ ${value}`);
    }
    return normalizePropertyDisplayText(`${value} ${field.unit}`);
  }

  return normalizePropertyDisplayText(value);
}

export function getVisiblePropertyFieldEntries(
  property: Pick<Property, "customData">,
  fields: CustomField[],
  visibility: "card" | "page",
  limit?: number,
) {
  const filtered = fields
    .filter((field) => visibility === "card" ? field.showOnPropertyCard : field.showOnPropertyPage)
    .map((field) => ({
      field,
      value: property.customData?.[field.id],
    }))
    .filter((entry) => !isEmptyPropertyValue(entry.value));

  return typeof limit === "number" ? filtered.slice(0, limit) : filtered;
}
