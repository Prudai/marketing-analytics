# @prudai/marketing-analytics

Shared analytics, consent (via [vanilla-cookieconsent v3](https://cookieconsent.orestbida.com)), and error-tracking (GlitchTip) for PrudAI marketing sites.

Consumed by `prudai-website`, `product-page-alex`, `product-page-vera`, `product-page-zia`, `legal-center`, and `trust-center`.

## Install

```sh
bun add github:Prudai/marketing-analytics#v0.2.0 @sentry/react @vercel/speed-insights
```

## Use

```tsx
// src/main.tsx
import { initAnalytics } from "@prudai/marketing-analytics";
import "vanilla-cookieconsent/dist/cookieconsent.css"; // required

initAnalytics({
  siteId: "product-page-alex",
  environment: import.meta.env.MODE,
  release: import.meta.env.VITE_GIT_SHA,
  ga4: { measurementId: import.meta.env.VITE_GA4_MEASUREMENT_ID },
  sentry: { dsn: import.meta.env.VITE_SENTRY_DSN },
  consent: { policyHref: "https://legal.prudai.com/privacy" },
});
```

Event helpers:

```ts
import { trackCta, trackOutboundClick } from "@prudai/marketing-analytics";

trackCta("Probeer Alex", "hero");
trackOutboundClick("https://app.prudai.com/signup", "hero-signup");
```

Vercel Speed Insights (optional):

```tsx
import { SpeedInsights } from "@prudai/marketing-analytics";

export function App() {
  return (
    <>
      {/* your app */}
      <SpeedInsights />
    </>
  );
}
```

## How consent works

- Google Consent Mode v2 is set to **all denied** before `gtag.js` loads.
- vanilla-cookieconsent shows an AVG-compliant banner (NL/EN, auto-detects).
- When the user accepts the "analytics" category, we call `gtag('consent', 'update', { analytics_storage: 'granted', ... })` and emit a `page_view` event so GA4 Realtime populates.
- Ad categories stay denied by default since we don't do ad tracking.

## Development

```sh
bun install
bun run typecheck
bun test
bun run build
```
