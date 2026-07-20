export interface InitAnalyticsConfig {
  siteId: string;
  environment?: string;
  release?: string;
  ga4?: {
    measurementId: string;
    debug?: boolean;
  };
  googleAds?: {
    conversionId: string;
  };
  sentry?: {
    dsn: string;
    tracesSampleRate?: number;
  };
  consent?: {
    policyHref?: string;
  };
}
