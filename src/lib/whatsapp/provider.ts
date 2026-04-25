export type WhatsAppProvider = "worker" | "evolution";

export function getWhatsAppProvider(): WhatsAppProvider {
  const explicit = (process.env.WHATSAPP_PROVIDER || "").trim().toLowerCase();
  if (explicit === "worker" || explicit === "evolution") {
    return explicit;
  }

  const hasEvolutionConfig = Boolean(process.env.EVOLUTION_API_URL && process.env.EVOLUTION_API_KEY);
  if (hasEvolutionConfig) {
    return "evolution";
  }

  return "worker";
}

export function isEvolutionProvider() {
  return getWhatsAppProvider() === "evolution";
}
