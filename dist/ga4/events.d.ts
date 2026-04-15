export type EventParams = Record<string, string | number | boolean | undefined>;
export declare function trackEvent(name: string, params?: EventParams): void;
export declare function trackCta(label: string, location?: string): void;
export declare function trackOutboundClick(href: string, label?: string): void;
export declare function trackScrollDepth(depth: 25 | 50 | 75 | 90 | 100): void;
//# sourceMappingURL=events.d.ts.map