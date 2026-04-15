import * as Sentry from "@sentry/react";

export interface SentryInitOptions {
  dsn: string;
  environment?: string;
  release?: string;
  tracesSampleRate?: number;
}

let initialized = false;

export function initSentry({
  dsn,
  environment,
  release,
  tracesSampleRate = 0,
}: SentryInitOptions): void {
  if (!dsn || initialized) return;
  initialized = true;

  Sentry.init({
    dsn,
    environment,
    release,
    sendDefaultPii: false,
    tracesSampleRate,
    integrations: tracesSampleRate > 0 ? [Sentry.browserTracingIntegration()] : [],
  });
}

export { Sentry };
