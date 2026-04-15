// src/consent/storage.ts
var STORAGE_KEY = "prudai-consent-v1";
function readConsent() {
  if (typeof window === "undefined")
    return "unknown";
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === "granted" || raw === "denied")
      return raw;
  } catch {}
  return "unknown";
}
function writeConsent(state) {
  if (typeof window === "undefined")
    return;
  try {
    window.localStorage.setItem(STORAGE_KEY, state);
  } catch {}
}
var CONSENT_EVENT = "prudai-consent-change";
function emitConsentChange(state) {
  if (typeof window === "undefined")
    return;
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: state }));
}

// src/ga4/events.ts
function push(name, params) {
  if (typeof window === "undefined" || !window.gtag)
    return;
  window.gtag("event", name, params);
}
function trackEvent(name, params = {}) {
  push(name, params);
}
function trackCta(label, location) {
  push("cta_click", { label, location });
}
function trackOutboundClick(href, label) {
  push("outbound_click", { href, label });
}
function trackScrollDepth(depth) {
  push("scroll_depth", { depth });
}
function trackConsentChoice(choice) {
  push("consent_choice", { choice });
}

// src/ga4/init.ts
var loaded = false;
function ensureDataLayer() {
  window.dataLayer = window.dataLayer ?? [];
  if (!window.gtag) {
    window.gtag = function gtag(...args) {
      window.dataLayer.push(args);
    };
  }
}
function applyConsentMode(state) {
  if (!window.gtag)
    return;
  const analytics = state === "granted" ? "granted" : "denied";
  window.gtag("consent", "update", {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: analytics
  });
}
function initGa4({ measurementId, debug }) {
  if (typeof window === "undefined" || !measurementId || loaded)
    return;
  loaded = true;
  ensureDataLayer();
  window.gtag("consent", "default", {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: "denied",
    functionality_storage: "granted",
    security_storage: "granted",
    wait_for_update: 500
  });
  window.gtag("js", new Date);
  window.gtag("config", measurementId, {
    anonymize_ip: true,
    debug_mode: debug === true ? true : undefined
  });
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  document.head.appendChild(script);
  applyConsentMode(readConsent());
  window.addEventListener(CONSENT_EVENT, (event) => {
    const detail = event.detail;
    applyConsentMode(detail);
  });
}

// src/sentry/init.ts
import * as Sentry from "@sentry/react";
var initialized = false;
function initSentry({
  dsn,
  environment,
  release,
  tracesSampleRate = 0
}) {
  if (!dsn || initialized)
    return;
  initialized = true;
  Sentry.init({
    dsn,
    environment,
    release,
    sendDefaultPii: false,
    tracesSampleRate,
    integrations: tracesSampleRate > 0 ? [Sentry.browserTracingIntegration()] : []
  });
}

// src/init.ts
function initAnalytics(config) {
  if (typeof window === "undefined")
    return;
  if (config.sentry?.dsn) {
    initSentry({
      dsn: config.sentry.dsn,
      environment: config.environment,
      release: config.release,
      tracesSampleRate: config.sentry.tracesSampleRate
    });
  }
  if (config.ga4?.measurementId) {
    initGa4({
      measurementId: config.ga4.measurementId,
      debug: config.ga4.debug
    });
  }
  window.addEventListener(CONSENT_EVENT, (event) => {
    const detail = event.detail;
    if (detail === "granted" || detail === "denied") {
      trackConsentChoice(detail);
    }
  });
}
// src/consent/i18n.ts
var strings = {
  nl: {
    title: "Cookies op deze site",
    body: "We gebruiken analytische cookies om te begrijpen hoe bezoekers onze site gebruiken, zodat we die kunnen verbeteren. Essentiële functies werken zonder cookies.",
    accept: "Accepteren",
    reject: "Weigeren",
    policyLinkLabel: "Privacybeleid"
  },
  en: {
    title: "Cookies on this site",
    body: "We use analytics cookies to understand how visitors use our site so we can improve it. Essential functionality works without cookies.",
    accept: "Accept",
    reject: "Reject",
    policyLinkLabel: "Privacy policy"
  }
};
function getStrings(locale) {
  return strings[locale] ?? strings.en;
}

// src/consent/useConsent.ts
import { useEffect, useState } from "react";
function useConsent() {
  const [state, setState] = useState(() => readConsent());
  useEffect(() => {
    const onChange = (event) => {
      const detail = event.detail;
      if (detail)
        setState(detail);
    };
    window.addEventListener(CONSENT_EVENT, onChange);
    return () => window.removeEventListener(CONSENT_EVENT, onChange);
  }, []);
  const accept = () => {
    writeConsent("granted");
    emitConsentChange("granted");
  };
  const reject = () => {
    writeConsent("denied");
    emitConsentChange("denied");
  };
  return { state, accept, reject };
}

// src/consent/CookieBanner.tsx
import { jsxDEV, Fragment } from "react/jsx-dev-runtime";
var baseStyle = {
  position: "fixed",
  left: 16,
  right: 16,
  bottom: 16,
  maxWidth: 520,
  margin: "0 auto",
  padding: "16px 20px",
  background: "#ffffff",
  color: "#111827",
  borderRadius: 12,
  boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
  fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  fontSize: 14,
  lineHeight: 1.5,
  zIndex: 2147483000
};
var titleStyle = { margin: "0 0 6px", fontSize: 15, fontWeight: 600 };
var bodyStyle = { margin: "0 0 12px" };
var actionsStyle = { display: "flex", gap: 8, justifyContent: "flex-end" };
var buttonBase = {
  border: "1px solid transparent",
  borderRadius: 8,
  padding: "8px 14px",
  fontSize: 14,
  cursor: "pointer"
};
var rejectStyle = {
  ...buttonBase,
  background: "#ffffff",
  color: "#111827",
  borderColor: "#d1d5db"
};
var acceptStyle = {
  ...buttonBase,
  background: "#111827",
  color: "#ffffff"
};
var linkStyle = { color: "#2563eb", textDecoration: "underline" };
function CookieBanner({
  locale = "nl",
  policyHref,
  className,
  style
}) {
  const { state, accept, reject } = useConsent();
  if (state !== "unknown")
    return null;
  const t = getStrings(locale);
  return /* @__PURE__ */ jsxDEV("div", {
    role: "dialog",
    "aria-live": "polite",
    "aria-label": t.title,
    "data-prudai-consent": "banner",
    className,
    style: { ...baseStyle, ...style },
    children: [
      /* @__PURE__ */ jsxDEV("p", {
        style: titleStyle,
        children: t.title
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV("p", {
        style: bodyStyle,
        children: [
          t.body,
          policyHref ? /* @__PURE__ */ jsxDEV(Fragment, {
            children: [
              " ",
              /* @__PURE__ */ jsxDEV("a", {
                href: policyHref,
                style: linkStyle,
                target: "_blank",
                rel: "noreferrer",
                children: t.policyLinkLabel
              }, undefined, false, undefined, this),
              "."
            ]
          }, undefined, true, undefined, this) : null
        ]
      }, undefined, true, undefined, this),
      /* @__PURE__ */ jsxDEV("div", {
        style: actionsStyle,
        children: [
          /* @__PURE__ */ jsxDEV("button", {
            type: "button",
            onClick: reject,
            style: rejectStyle,
            "data-prudai-consent": "reject",
            children: t.reject
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV("button", {
            type: "button",
            onClick: accept,
            style: acceptStyle,
            "data-prudai-consent": "accept",
            children: t.accept
          }, undefined, false, undefined, this)
        ]
      }, undefined, true, undefined, this)
    ]
  }, undefined, true, undefined, this);
}
// src/speed/index.ts
import { SpeedInsights } from "@vercel/speed-insights/react";
export {
  useConsent,
  trackScrollDepth,
  trackOutboundClick,
  trackEvent,
  trackCta,
  trackConsentChoice,
  initAnalytics,
  SpeedInsights,
  Sentry,
  CookieBanner
};
