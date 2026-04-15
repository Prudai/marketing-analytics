# @prudai/marketing-analytics

Shared analytics, consent, and error-tracking for PrudAI marketing sites.

Consumed by `prudai-website`, `product-page-alex`, `product-page-vera`, `product-page-zia`, `legal-center`, and `trust-center`.

## Install

```sh
bun add @prudai/marketing-analytics @sentry/react @vercel/speed-insights
```

Requires a `.npmrc` authenticating against GitHub Packages:

```
@prudai:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

## Use

```tsx
// src/main.tsx
import { initAnalytics } from "@prudai/marketing-analytics";

initAnalytics({
  siteId: "product-page-alex",
  environment: import.meta.env.MODE,
  release: import.meta.env.VITE_GIT_SHA,
  ga4: { measurementId: import.meta.env.VITE_GA4_MEASUREMENT_ID },
  sentry: { dsn: import.meta.env.VITE_SENTRY_DSN },
});
```

```tsx
// src/App.tsx
import { CookieBanner, SpeedInsights } from "@prudai/marketing-analytics";

export function App() {
  return (
    <>
      {/* your app */}
      <CookieBanner locale="nl" policyHref="https://legal.prudai.com/privacy" />
      <SpeedInsights />
    </>
  );
}
```

Track events from anywhere:

```ts
import { trackCta, trackOutboundClick } from "@prudai/marketing-analytics";

trackCta("Probeer Alex", "hero");
trackOutboundClick("https://app.prudai.com/signup", "hero-signup");
```

## Consent model

- Default state: `unknown` → banner shown.
- `granted` → GA4 Consent Mode v2 upgraded to `analytics_storage: granted`.
- `denied` → GA4 stays in consent-denied mode (modelling pings only, no cookies).

Sentry always initialises (JS errors are captured regardless of consent; `sendDefaultPii: false` by default).

## Development

```sh
bun install
bun run typecheck
bun test
bun run build
```
