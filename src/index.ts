export { initAnalytics } from "./init";
export type { InitAnalyticsConfig } from "./config";

export {
  trackEvent,
  trackCta,
  trackOutboundClick,
  trackScrollDepth,
} from "./ga4/events";
export type { EventParams } from "./ga4/events";

export { SpeedInsights } from "./speed";
export { Sentry } from "./sentry/init";

export { CookieConsent } from "./consent/run";
