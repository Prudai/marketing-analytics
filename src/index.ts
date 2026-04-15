export { initAnalytics } from "./init";
export type { InitAnalyticsConfig } from "./config";

export { CookieBanner } from "./consent/CookieBanner";
export type { CookieBannerProps } from "./consent/CookieBanner";
export { useConsent } from "./consent/useConsent";
export type { UseConsentResult } from "./consent/useConsent";
export type { ConsentState } from "./consent/storage";
export type { Locale } from "./consent/i18n";

export {
  trackEvent,
  trackCta,
  trackOutboundClick,
  trackScrollDepth,
  trackConsentChoice,
} from "./ga4/events";
export type { EventParams } from "./ga4/events";

export { SpeedInsights } from "./speed";

export { Sentry } from "./sentry/init";
