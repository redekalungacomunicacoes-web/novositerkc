import { useEffect } from "react";
import { getSiteSettings } from "@/lib/siteSettings";

const SCRIPT_ID = "rkc-ga-script";

function isMeasurementId(value?: string | null) {
  if (!value) return false;
  return /^G-[A-Z0-9]{6,}$/i.test(value.trim());
}

function upsertGaScript(measurementId: string) {
  const src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;

  let external = document.getElementById(`${SCRIPT_ID}-external`) as HTMLScriptElement | null;
  if (!external) {
    external = document.createElement("script");
    external.id = `${SCRIPT_ID}-external`;
    external.async = true;
    document.head.appendChild(external);
  }
  external.src = src;

  let inline = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
  if (!inline) {
    inline = document.createElement("script");
    inline.id = SCRIPT_ID;
    document.head.appendChild(inline);
  }

  inline.innerHTML = `
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', '${measurementId}');
  `;
}

export function GoogleAnalytics() {
  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const settings = await getSiteSettings();
        if (!active) return;

        if (!settings.google_analytics_enabled) return;
        const measurementId = settings.google_analytics_measurement_id?.trim();
        if (!isMeasurementId(measurementId)) return;

        upsertGaScript(measurementId);
      } catch {
        // noop
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  return null;
}
