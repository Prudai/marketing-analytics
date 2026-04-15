declare global {
    interface Window {
        dataLayer?: unknown[];
        gtag?: (...args: unknown[]) => void;
    }
}
export interface Ga4InitOptions {
    measurementId: string;
    debug?: boolean;
}
export declare function initGa4({ measurementId, debug }: Ga4InitOptions): void;
export declare function applyAnalyticsConsent(granted: boolean): void;
//# sourceMappingURL=init.d.ts.map