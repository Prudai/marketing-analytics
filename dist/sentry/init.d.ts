import * as Sentry from "@sentry/react";
export interface SentryInitOptions {
    dsn: string;
    environment?: string;
    release?: string;
    tracesSampleRate?: number;
}
export declare function initSentry({ dsn, environment, release, tracesSampleRate, }: SentryInitOptions): void;
export { Sentry };
//# sourceMappingURL=init.d.ts.map