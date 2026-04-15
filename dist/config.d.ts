export interface InitAnalyticsConfig {
    siteId: string;
    environment?: string;
    release?: string;
    ga4?: {
        measurementId: string;
        debug?: boolean;
    };
    sentry?: {
        dsn: string;
        tracesSampleRate?: number;
    };
    consent?: {
        policyHref?: string;
    };
}
//# sourceMappingURL=config.d.ts.map