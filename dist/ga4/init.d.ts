declare global {
    interface Window {
        dataLayer?: unknown[];
        gtag?: (...args: unknown[]) => void;
    }
}
export interface GtagInitOptions {
    measurementId?: string;
    adsConversionId?: string;
    debug?: boolean;
}
export interface ConsentState {
    analytics: boolean;
    marketing: boolean;
}
export declare function initGtag({ measurementId, adsConversionId, debug }: GtagInitOptions): void;
export declare function applyConsent({ analytics, marketing }: ConsentState): void;
//# sourceMappingURL=init.d.ts.map