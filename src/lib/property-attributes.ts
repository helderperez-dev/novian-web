export const PROPERTY_SYSTEM_FIELD_KEYS = {
  propertyType: "property_type",
  street: "street",
  streetNumber: "street_number",
  complement: "complement",
  neighborhood: "neighborhood",
  city: "city",
  state: "state",
  postalCode: "postal_code",
  country: "country",
  amenities: "amenities",
} as const;

export type PropertyStructuredAttributes = {
  propertyType?: string | null;
  street?: string | null;
  streetNumber?: string | null;
  complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
  amenities?: string[] | null;
};

type StructuredPropertyInput = PropertyStructuredAttributes & {
  address?: string | null;
  customData?: Record<string, unknown> | null;
};

function normalizeStringValue(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function normalizeMultiValueList(value: unknown) {
  if (Array.isArray(value)) {
    return Array.from(
      new Set(
        value
          .map((item) => normalizeStringValue(item))
          .filter((item): item is string => Boolean(item)),
      ),
    );
  }

  if (typeof value === "string") {
    return Array.from(
      new Set(
        value
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      ),
    );
  }

  return [] as string[];
}

export function formatMultiValueList(value: unknown) {
  return normalizeMultiValueList(value).join(", ");
}

export function buildStructuredAddressLabel(input: PropertyStructuredAttributes) {
  const streetLine = [normalizeStringValue(input.street), normalizeStringValue(input.streetNumber)]
    .filter(Boolean)
    .join(", ");
  const localityLine = [
    normalizeStringValue(input.neighborhood),
    normalizeStringValue(input.city),
    normalizeStringValue(input.state),
  ]
    .filter(Boolean)
    .join(", ");
  const country = normalizeStringValue(input.country);
  const shouldShowCountry = Boolean(country && ((streetLine || localityLine) || country !== "Brasil"));

  return [streetLine, localityLine, shouldShowCountry ? country : null].filter(Boolean).join(" - ");
}

export function synchronizePropertyStructuredData(input: StructuredPropertyInput) {
  const nextCustomData = { ...(input.customData || {}) };

  const propertyType =
    normalizeStringValue(input.propertyType) ||
    normalizeStringValue(nextCustomData[PROPERTY_SYSTEM_FIELD_KEYS.propertyType]);
  const street =
    normalizeStringValue(input.street) ||
    normalizeStringValue(nextCustomData[PROPERTY_SYSTEM_FIELD_KEYS.street]);
  const streetNumber =
    normalizeStringValue(input.streetNumber) ||
    normalizeStringValue(nextCustomData[PROPERTY_SYSTEM_FIELD_KEYS.streetNumber]);
  const complement =
    normalizeStringValue(input.complement) ||
    normalizeStringValue(nextCustomData[PROPERTY_SYSTEM_FIELD_KEYS.complement]);
  const neighborhood =
    normalizeStringValue(input.neighborhood) ||
    normalizeStringValue(nextCustomData[PROPERTY_SYSTEM_FIELD_KEYS.neighborhood]);
  const city =
    normalizeStringValue(input.city) ||
    normalizeStringValue(nextCustomData[PROPERTY_SYSTEM_FIELD_KEYS.city]);
  const state =
    normalizeStringValue(input.state) ||
    normalizeStringValue(nextCustomData[PROPERTY_SYSTEM_FIELD_KEYS.state]);
  const postalCode =
    normalizeStringValue(input.postalCode) ||
    normalizeStringValue(nextCustomData[PROPERTY_SYSTEM_FIELD_KEYS.postalCode]);
  const country =
    normalizeStringValue(input.country) ||
    normalizeStringValue(nextCustomData[PROPERTY_SYSTEM_FIELD_KEYS.country]) ||
    "Brasil";
  const amenities = normalizeMultiValueList(
    input.amenities ?? nextCustomData[PROPERTY_SYSTEM_FIELD_KEYS.amenities],
  );

  if (propertyType) nextCustomData[PROPERTY_SYSTEM_FIELD_KEYS.propertyType] = propertyType;
  else delete nextCustomData[PROPERTY_SYSTEM_FIELD_KEYS.propertyType];
  if (street) nextCustomData[PROPERTY_SYSTEM_FIELD_KEYS.street] = street;
  else delete nextCustomData[PROPERTY_SYSTEM_FIELD_KEYS.street];
  if (streetNumber) nextCustomData[PROPERTY_SYSTEM_FIELD_KEYS.streetNumber] = streetNumber;
  else delete nextCustomData[PROPERTY_SYSTEM_FIELD_KEYS.streetNumber];
  if (complement) nextCustomData[PROPERTY_SYSTEM_FIELD_KEYS.complement] = complement;
  else delete nextCustomData[PROPERTY_SYSTEM_FIELD_KEYS.complement];
  if (neighborhood) nextCustomData[PROPERTY_SYSTEM_FIELD_KEYS.neighborhood] = neighborhood;
  else delete nextCustomData[PROPERTY_SYSTEM_FIELD_KEYS.neighborhood];
  if (city) nextCustomData[PROPERTY_SYSTEM_FIELD_KEYS.city] = city;
  else delete nextCustomData[PROPERTY_SYSTEM_FIELD_KEYS.city];
  if (state) nextCustomData[PROPERTY_SYSTEM_FIELD_KEYS.state] = state;
  else delete nextCustomData[PROPERTY_SYSTEM_FIELD_KEYS.state];
  if (postalCode) nextCustomData[PROPERTY_SYSTEM_FIELD_KEYS.postalCode] = postalCode;
  else delete nextCustomData[PROPERTY_SYSTEM_FIELD_KEYS.postalCode];
  if (country) nextCustomData[PROPERTY_SYSTEM_FIELD_KEYS.country] = country;
  else delete nextCustomData[PROPERTY_SYSTEM_FIELD_KEYS.country];
  if (amenities.length > 0) nextCustomData[PROPERTY_SYSTEM_FIELD_KEYS.amenities] = amenities;
  else delete nextCustomData[PROPERTY_SYSTEM_FIELD_KEYS.amenities];

  const fallbackAddress = normalizeStringValue(input.address) || "";
  const structuredAddress = buildStructuredAddressLabel({
    street,
    streetNumber,
    neighborhood,
    city,
    state,
    country,
  });

  return {
    propertyType,
    street,
    streetNumber,
    complement,
    neighborhood,
    city,
    state,
    postalCode,
    country,
    amenities,
    address: fallbackAddress || structuredAddress,
    customData: nextCustomData,
  };
}
