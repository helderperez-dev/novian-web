"use client";

import Script from "next/script";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";

const CALENDAR_SCRIPT_SRC =
  "https://calendar.google.com/calendar/scheduling-button-script.js";
const CALENDAR_STYLESHEET_HREF =
  "https://calendar.google.com/calendar/scheduling-button-script.css";
const CALENDAR_APPOINTMENT_URL =
  "https://calendar.google.com/calendar/appointments/schedules/AcZssZ3CjSrCD7akvPtfW7JfbU5ptYfZZwrg7_cLmyqI-hTiaXNRgMvIS1b2rZG7oyha3GEoMSCLe3zx?gv=true";

declare global {
  interface Window {
    calendar?: {
      schedulingButton?: {
        load: (options: {
          url: string;
          color: string;
          label: string;
          target: HTMLElement;
        }) => void;
      };
    };
  }
}

type GoogleCalendarButtonProps = {
  children: ReactNode;
  className: string;
};

export default function GoogleCalendarButton({
  children,
  className,
}: GoogleCalendarButtonProps) {
  const targetRef = useRef<HTMLSpanElement>(null);
  const generatedButtonRef = useRef<HTMLButtonElement | null>(null);
  const initializedRef = useRef(false);
  const [isScriptReady, setIsScriptReady] = useState(false);

  useEffect(() => {
    if (document.querySelector('link[data-google-calendar-scheduling="true"]')) {
      return;
    }

    const stylesheet = document.createElement("link");
    stylesheet.rel = "stylesheet";
    stylesheet.href = CALENDAR_STYLESHEET_HREF;
    stylesheet.dataset.googleCalendarScheduling = "true";
    document.head.appendChild(stylesheet);
  }, []);

  const initializeSchedulingButton = useCallback(() => {
    if (initializedRef.current) {
      return;
    }

    const target = targetRef.current;
    const loadSchedulingButton = window.calendar?.schedulingButton?.load;

    if (!target || !loadSchedulingButton) {
      return;
    }

    loadSchedulingButton({
      url: CALENDAR_APPOINTMENT_URL,
      color: "#039BE5",
      label: "Agendar um compromisso",
      target,
    });

    const generatedButton = target.nextElementSibling;

    if (generatedButton instanceof HTMLButtonElement) {
      generatedButton.hidden = true;
      generatedButton.tabIndex = -1;
      generatedButton.setAttribute("aria-hidden", "true");
      generatedButtonRef.current = generatedButton;
      initializedRef.current = true;
    }
  }, []);

  useEffect(() => {
    if (!isScriptReady) {
      return;
    }

    initializeSchedulingButton();
  }, [initializeSchedulingButton, isScriptReady]);

  const handleClick = () => {
    if (!initializedRef.current) {
      initializeSchedulingButton();
    }

    if (generatedButtonRef.current) {
      generatedButtonRef.current.click();
      return;
    }

    window.open(CALENDAR_APPOINTMENT_URL, "_blank", "noopener,noreferrer");
  };

  return (
    <>
      <Script
        id="google-calendar-scheduling-script"
        src={CALENDAR_SCRIPT_SRC}
        strategy="afterInteractive"
        onReady={() => {
          setIsScriptReady(true);
        }}
      />

      <button type="button" className={className} onClick={handleClick}>
        {children}
      </button>

      <span ref={targetRef} className="hidden" aria-hidden="true" />
    </>
  );
}
