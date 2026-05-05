"use client";

import { useState } from "react";
import { usePostHog } from "posthog-js/react";
import { getBrowserContextProps, getPropertyAnalyticsProps } from "@/lib/posthog";
import { trackLeadConversion } from "@/lib/marketing-tracking";

function formatPhoneNumber(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);

  if (digits.length <= 2) {
    return digits.length ? `(${digits}` : "";
  }

  if (digits.length <= 6) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  }

  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }

  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

interface LeadFormProps {
  primaryColor: string;
  showLeadMagnet?: boolean;
  leadMagnetTitle?: string;
  callToActionText: string;
  propertyId: string;
  propertySlug: string;
  propertyTitle: string;
  propertyPrice: number;
  propertyAddress: string;
}

export default function LeadForm({
  primaryColor,
  showLeadMagnet,
  leadMagnetTitle,
  callToActionText,
  propertyId,
  propertySlug,
  propertyTitle,
  propertyPrice,
  propertyAddress,
}: LeadFormProps) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [hasTrackedStart, setHasTrackedStart] = useState(false);
  const posthog = usePostHog();

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const propertyEventProps = getPropertyAnalyticsProps({
      id: propertyId,
      slug: propertySlug,
      title: propertyTitle,
      price: propertyPrice,
      address: propertyAddress,
      showLeadMagnet,
    });

    const sharedEventProps = {
      ...propertyEventProps,
      call_to_action_text: callToActionText,
      lead_magnet_title: leadMagnetTitle || null,
      form_name: "property_lead_form",
      ...getBrowserContextProps(),
    };

    try {
      posthog?.capture("external_property_contact_requested", {
        ...sharedEventProps,
        contact_channel: "lead_form",
        submitted_email: formData.email,
        submitted_phone: formData.phone,
      });

      const res = await fetch("/api/people", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: formData.name,
          primaryPhone: formData.phone,
          email: formData.email,
          roles: ["lead"],
          origin: "Landing Page Imovel",
          createLead: true,
          metadata: {
            email: formData.email,
            source: "Landing Page Imóvel",
            property: propertyTitle,
            propertyId,
            propertySlug,
            propertyPrice,
            propertyAddress,
            leadMagnetTitle: leadMagnetTitle || null,
            showLeadMagnet: Boolean(showLeadMagnet),
            analytics: {
              posthogDistinctId: posthog?.get_distinct_id() || null,
              eventName: "external_property_contact_requested",
              capturedAt: new Date().toISOString(),
              ...getBrowserContextProps(),
            },
          },
        }),
      });

      if (!res.ok) {
        throw new Error("Erro ao enviar dados. Tente novamente.");
      }

      posthog?.identify(formData.email || formData.phone, {
        email: formData.email,
        name: formData.name,
        phone: formData.phone,
        last_property_id: propertyId,
        last_property_slug: propertySlug,
        last_property_title: propertyTitle,
      });

      trackLeadConversion({
        formName: "property_lead_form",
        propertyId,
        propertySlug,
        propertyTitle,
        propertyPrice,
        propertyOfferType: propertyEventProps.property_primary_offer_type,
        leadMagnetTitle: leadMagnetTitle || null,
        leadMagnetEnabled: Boolean(showLeadMagnet),
        callToActionText: callToActionText || null,
        currentUrl: typeof sharedEventProps.current_url === "string" ? sharedEventProps.current_url : null,
        pathname: typeof sharedEventProps.pathname === "string" ? sharedEventProps.pathname : null,
        referrer: typeof sharedEventProps.referrer === "string" ? sharedEventProps.referrer : null,
        utmSource: typeof sharedEventProps.utm_source === "string" ? sharedEventProps.utm_source : null,
        utmMedium: typeof sharedEventProps.utm_medium === "string" ? sharedEventProps.utm_medium : null,
        utmCampaign: typeof sharedEventProps.utm_campaign === "string" ? sharedEventProps.utm_campaign : null,
        utmTerm: typeof sharedEventProps.utm_term === "string" ? sharedEventProps.utm_term : null,
        utmContent: typeof sharedEventProps.utm_content === "string" ? sharedEventProps.utm_content : null,
      });

      setSuccess(true);
      posthog?.capture("external_property_lead_created", {
        ...sharedEventProps,
        contact_channel: "lead_form",
      });
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Ocorreu um erro inesperado.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFieldFocus = () => {
    if (hasTrackedStart) {
      return;
    }

    setHasTrackedStart(true);
    posthog?.capture("external_property_lead_form_started", {
      ...getPropertyAnalyticsProps({
        id: propertyId,
        slug: propertySlug,
        title: propertyTitle,
        price: propertyPrice,
        address: propertyAddress,
        showLeadMagnet,
      }),
      call_to_action_text: callToActionText,
      lead_magnet_title: leadMagnetTitle || null,
      form_name: "property_lead_form",
      ...getBrowserContextProps(),
    });
  };

  if (success) {
    return (
      <div className="text-center space-y-4 py-8">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border-2" style={{ borderColor: primaryColor, color: primaryColor }}>
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-2xl font-serif">Obrigado pelo interesse!</h3>
        <p className="text-[#66706b]">
          {showLeadMagnet ? "Seu material foi liberado e" : "Um especialista"} entrará em contato em breve.
        </p>
      </div>
    );
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium text-[#6a726d]">Nome Completo</label>
          <input 
            type="text" 
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            onFocus={handleFieldFocus}
            className="w-full rounded-xl border border-[#ddd3c7] bg-white/88 px-4 py-3 text-[#1f2421] outline-none transition-colors placeholder:text-[#8f948f] focus:border-current" 
            style={{ borderColor: formData.name ? primaryColor : undefined, outlineColor: primaryColor }} 
            placeholder="Seu nome" 
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-[#6a726d]">Telefone / WhatsApp</label>
          <input 
            type="tel" 
            required
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: formatPhoneNumber(e.target.value) })}
            onFocus={handleFieldFocus}
            className="w-full rounded-xl border border-[#ddd3c7] bg-white/88 px-4 py-3 text-[#1f2421] outline-none transition-colors placeholder:text-[#8f948f] focus:border-current" 
            style={{ borderColor: formData.phone ? primaryColor : undefined, outlineColor: primaryColor }} 
            inputMode="numeric"
            maxLength={15}
            placeholder="(00) 00000-0000" 
          />
        </div>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-[#6a726d]">E-mail</label>
        <input 
          type="email" 
          required
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          onFocus={handleFieldFocus}
          className="w-full rounded-xl border border-[#ddd3c7] bg-white/88 px-4 py-3 text-[#1f2421] outline-none transition-colors placeholder:text-[#8f948f] focus:border-current" 
          style={{ borderColor: formData.email ? primaryColor : undefined, outlineColor: primaryColor }} 
          placeholder="seu@email.com" 
        />
      </div>
      <button 
        type="submit" 
        disabled={loading}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-4 text-lg font-bold shadow-lg transition-transform hover:scale-[1.02] disabled:opacity-70 disabled:hover:scale-100" 
        style={{ backgroundColor: primaryColor, color: '#0d1514' }}
      >
        {loading ? (
          <span className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : (
          callToActionText
        )}
      </button>
      <p className="mt-4 text-center text-xs text-[#8a8f8b]">
        Seus dados estão seguros. Ao enviar, você concorda com nossos Termos de Privacidade.
      </p>
    </form>
  );
}
