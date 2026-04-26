"use client";

import { useState } from "react";
import { usePostHog } from "posthog-js/react";
import { getBrowserContextProps, getPropertyAnalyticsProps } from "@/lib/posthog";

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
        <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center border-2" style={{ borderColor: primaryColor, color: primaryColor }}>
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-2xl font-serif">Obrigado pelo interesse!</h3>
        <p className="text-gray-400">
          {showLeadMagnet ? "Seu material foi liberado e" : "Um especialista"} entrará em contato em breve.
        </p>
      </div>
    );
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      {error && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-xl text-sm">
          {error}
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-300">Nome Completo</label>
          <input 
            type="text" 
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            onFocus={handleFieldFocus}
            className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-current transition-colors" 
            style={{ borderColor: formData.name ? primaryColor : undefined, outlineColor: primaryColor }} 
            placeholder="Seu nome" 
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-300">Telefone / WhatsApp</label>
          <input 
            type="tel" 
            required
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            onFocus={handleFieldFocus}
            className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-current transition-colors" 
            style={{ borderColor: formData.phone ? primaryColor : undefined, outlineColor: primaryColor }} 
            placeholder="(00) 00000-0000" 
          />
        </div>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-300">E-mail</label>
        <input 
          type="email" 
          required
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          onFocus={handleFieldFocus}
          className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-current transition-colors" 
          style={{ borderColor: formData.email ? primaryColor : undefined, outlineColor: primaryColor }} 
          placeholder="seu@email.com" 
        />
      </div>
      <button 
        type="submit" 
        disabled={loading}
        className="w-full py-4 rounded-xl font-bold text-lg transition-transform hover:scale-[1.02] shadow-lg mt-4 disabled:opacity-70 disabled:hover:scale-100 flex items-center justify-center gap-2" 
        style={{ backgroundColor: primaryColor, color: '#0d1514' }}
      >
        {loading ? (
          <span className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : (
          callToActionText
        )}
      </button>
      <p className="text-xs text-center text-gray-500 mt-4">
        Seus dados estão seguros. Ao enviar, você concorda com nossos Termos de Privacidade.
      </p>
    </form>
  );
}
