import { NextRequest, NextResponse } from "next/server";
import { City, Country, State } from "country-state-city";
import { requireInternalApiUser } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

type GeoOption = {
  value: string;
  label: string;
  code?: string;
};

const countryDisplayNames = new Intl.DisplayNames(["pt-BR"], { type: "region" });

function normalizeCountries(): GeoOption[] {
  return Country.getAllCountries()
    .map((country) => ({
      value: countryDisplayNames.of(country.isoCode) || country.name,
      label: countryDisplayNames.of(country.isoCode) || country.name,
      code: country.isoCode,
    }))
    .sort((left, right) => left.label.localeCompare(right.label, "pt-BR"));
}

function normalizeStates(countryCode: string): GeoOption[] {
  return State.getStatesOfCountry(countryCode)
    .map((state) => ({
      value: state.name,
      label: state.name,
      code: state.isoCode,
    }))
    .sort((left, right) => left.label.localeCompare(right.label, "pt-BR"));
}

function normalizeCities(countryCode: string, stateCode: string): GeoOption[] {
  if (!stateCode) {
    return [];
  }

  return City.getCitiesOfState(countryCode, stateCode)
    .map((city) => ({
      value: city.name,
      label: city.name,
    }))
    .sort((left, right) => left.label.localeCompare(right.label, "pt-BR"));
}

export async function GET(request: NextRequest) {
  const appUser = await requireInternalApiUser();
  if (!appUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const countryCode = searchParams.get("countryCode") || "BR";
  const stateCode = searchParams.get("stateCode") || "";

  try {
    return NextResponse.json({
      countries: normalizeCountries(),
      states: normalizeStates(countryCode),
      cities: normalizeCities(countryCode, stateCode),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to load geo options" }, { status: 500 });
  }
}
