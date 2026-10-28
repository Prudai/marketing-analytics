# @prudai/marketing-analytics

Shared analytics, consent (via [vanilla-cookieconsent v3](https://cookieconsent.orestbida.com)), and error-tracking (GlitchTip) for Prudai marketing sites.

Consumed by `prudai-website`, `product-page-alex` (leo.prudai.com), `product-page-vera`, `product-page-zia`, `product-page-irma`, `product-page-bever`, `product-page-ordo`, `legal-center`, `trust-center`, `docs` (Astro, docs.prudai.com) and `research-site`. Each pins a git tag, so a new version reaches a site only when that site bumps its pin.

## Install

```sh
bun add github:Prudai/marketing-analytics#v0.4.8 @sentry/react @vercel/speed-insights
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
  googleAds: { conversionId: "AW-XXXXXXXXXXX" }, // optional: Google Ads conversion tag
  sentry: { dsn: import.meta.env.VITE_SENTRY_DSN },
  consent: { policyHref: "https://legal.prudai.com/privacy" },
});
```

**Own domain outside prudai.com (v0.4.5):** pass `consent: { policyHref, bereik: "site" }`. The banner then says
"Je keuze geldt voor deze website" / "Your choice applies to this website" instead of claiming the shared
.prudai.com choice (which does not reach another domain; the cookie follows the host there anyway). The
default (`bereik` omitted or `"prudai"`) is byte-for-byte the v0.4.4 text, so prudai.com sites need no change.
First user: ai-geletterdheid-training.nl.

**Sentry/GlitchTip loads lazily (v0.4.7).** `initAnalytics` no longer imports `@sentry/react`
statically. It loads it with a dynamic `import()` (its own chunk in the site's bundle) 1 s after the
`load` event, on an idle moment (`requestIdleCallback`, at most 3 s; `setTimeout` where that does not
exist). Before, Sentry (~40 KB gz) sat in the same critical chunk as the cookie banner, and on mobile the
banner text (`#cm__desc`) is the LCP element. Measured on product-page-zia (local build, Lighthouse
mobile, median of 5, 27-10-2026): critical JS 141 → 103 KB gz, FCP 1.70 → 1.42 s, LCP 3.08 → 2.86 s,
score 93 → 95. The 1 s wait matters: loading the chunk right at `load` still started it before the
banner had faded in, and Lighthouse then counted it into the LCP (3.24 s, worse than before).

What this means for a site:

- No code change needed for v0.4.7, and `initAnalytics(config)` is unchanged. **From v0.4.8 a site that scrubs
  events with `Sentry.addEventProcessor` must also set `sentry.noodroute: false`** (see below).
- Uncaught errors and unhandled rejections from before Sentry starts are buffered (at most 10) and
  reported right after `Sentry.init`, marked unhandled. Explicit `Sentry.captureException` calls in that
  window are lost, **unlike in v0.4.6 and earlier**, where they worked right after `initAnalytics()`.
- **v0.4.8, safety nets for the lazy start.** (1) `initAnalytics` schedules Sentry first, before the
  herkomst and GA4/consent code, so a failure there no longer skips it. (2) When the visitor leaves
  before Sentry has started (`pagehide`, or the tab becomes hidden), the buffered errors are sent as
  minimal events (`src/sentry/beacon.ts`) with a `fetch` (`keepalive`, `credentials: "omit"`). There is no
  `navigator.sendBeacon` fallback: it cannot omit credentials and would send the `.prudai.com` cookies
  (`cc_cookie`, `_ga*`) to the GlitchTip subdomain. An event has the error name (cut at 100), the message
  (cut at 500), the URL **without query and hash** (cut at 500), environment and release (cut at 100), the
  error's own time, the user agent and the tag `via: noodroute`. No stack, no breadcrumbs, no session, so
  these events group apart from SDK events (the code adds about 1.2 kB gz to the critical chunk). They are not re-reported when the page comes back from the bfcache. (3) A failed
  chunk `import()` (offline, ad blocker, stale hash after a redeploy) is retried once after 2 s. Every
  engine remembers a failed import for the same URL (measured 28-10-2026: Chromium 145/147, Firefox 142
  and WebKit 26.4: a plain second `import()` makes no request), so the retry asks for the same chunk with
  an extra `?r=<time>`, taken from the error message (own origin only). Chromium and Firefox name the URL
  in that message, **Safari does not, so Safari has no retry** and goes straight to the emergency route.
  If the retry fails too, or `Sentry.init` itself throws, the buffered errors go out as in (2) and
  monitoring stays off for that page view.
- **The emergency route bypasses event processors.** They live in the SDK, which is not there yet, so
  what a processor would normally scrub goes out as it is: the error message (500 characters), the error
  name, and for a non-Error rejection the JSON of the reason. The URL has no query or hash and there is
  no stack. A site that scrubs events with `Sentry.addEventProcessor` (van-uren-naar-product:
  `schoonBreadcrumbs`) must set `sentry: { dsn, noodroute: false }` when it moves to v0.4.8. Then nothing
  is ever sent without the SDK (pagehide, hidden tab, failed chunk, failed init) and the buffered errors
  stay for the SDK to report, exactly as in v0.4.7; only a chunk that never loads loses them.
- What the lazy start still costs in error monitoring (measured with a real `@sentry/react` in Chromium,
  27-10-2026): the buffer of 10 drops further errors silently (v0.4.6 reported all of them); errors
  reported after the lazy start carry the time they were reported (about 1 s after the real error) and
  mechanism `onerror`/`onunhandledrejection` instead of `instrument/setTimeout`; a session starts late, so
  very short visits do not count as a session; and a chunk that keeps failing means no monitoring for that
  page view beyond the buffered errors.
- The `Sentry` export stays. A site that imports it (van-uren-naar-product calls
  `Sentry.addEventProcessor` right after `initAnalytics`) keeps the parts it uses in its main chunk; the
  client and integrations still move to the lazy chunk (test build: entry 27 KB gz instead of 16 KB gz
  without the export). Event processors added through it before the lazy start sit on the isolation
  scope, which `Sentry.init` keeps, so they also apply to the buffered errors that the SDK reports
  (not to errors sent by the emergency route, see above).
- With `tracesSampleRate > 0` tracing now starts after the lazy init: fetch/XHR child spans and
  `sentry-trace` headers from the first seconds are missing and the pageload idle span ends early. No
  site sets it today.
- A test (`tests/sentry-lazy.test.ts`) fails as soon as `src/init.ts` reaches `@sentry/*` through a
  static import again, and as soon as `lazy.ts` imports anything but `./beacon` statically.

Event helpers:

```ts
import { trackCta, trackOutboundClick } from "@prudai/marketing-analytics";

trackCta("Probeer LEO", "hero");
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

**Sample rate (v0.4.6, decision Beau 19-10-2026: no paid plan).** `SpeedInsights` measures 20% of
page views by default (`SPEED_INSIGHTS_SAMPLE_RATE = 0.2`). The free Speed Insights tier is
10,000 events per rolling 30 days, **shared by the whole Vercel team**; a team that crosses it is
paused for at least 14 days, and stays paused while the last 30 days are above 5,000 (Vercel docs,
"Limits and Pricing for Speed Insights", read 20-10-2026). In October 2026 the pause hit 4 days
after collection had resumed, so all sites lost their data (including geo for the daily report) for weeks.

How 0.2 was derived (20-10-2026):

- Demand: `/_vercel/speed-insights/vitals` beacons in the log drain (`visits`, bots and non-200
  included), 16-09..19-10: at most 13,371 per rolling 30 days, of which 13,288 from prudai-website
  and product-page-leo and 83 from all other sites together.
- Events per beacon: Vercel `*_count` metrics (`vercel metrics vercel.speed_insights.<m>_count`,
  team total; per project the attribution is unreliable) divided by beacons for the unpaused
  full days 05..07-10: 1.73 / 2.15 / 2.32, pooled 2.04.
- Budget: 8,000 events (the free 10,000 minus a 20% margin), counting the other sites at 1.0
  until they move to v0.4.6: (13,288 × 0.2 + 83) × 2.04 ≈ 5,600 (56%); at 2.32 per beacon ≈ 6,400.
  That leaves room for ~25% traffic growth. 0.25 would be ≈ 7,900 at 2.32: no margin left.

A site can override it (`<SpeedInsights sampleRate={0.5} />`); `0` renders nothing (the Vercel
package treats a falsy rate as "measure everything"). The rate is shared because the quota is:
raising it on one site eats into all the others. Re-check when traffic grows: beacons per 30 days
× 2.04 × rate must stay under 8,000 (check the worst day ratio too).

Cookie preferences link (since v0.4.1). Withdrawing consent must be as easy as giving it
(GDPR art. 7(3)), so a site puts a "Cookievoorkeuren" / "Cookie preferences" link in its
footer that reopens the preferences window. prudai-website, product-page-alex (leo),
product-page-vera, product-page-zia, legal-center and trust-center have one (v0.4.4 rollout,
29-09-2026). product-page-irma, -bever and -ordo (served on prudai.com/<product>, measuring in
the prudai.com stream) and docs.prudai.com (public pages only, never the SSO-gated ones) get the
banner, v0.4.4 and the link in the 08-10-2026 rollout (card f926a352; live once those PRs are
merged). maia and research-site run no banner (no GA4 id configured); give them the link, and
at least v0.4.4, as soon as they get one.

```tsx
import { openCookieVoorkeuren } from "@prudai/marketing-analytics";

<button type="button" onClick={() => openCookieVoorkeuren()}>
  {t("footer.cookiePreferences")}
</button>
```

It returns `false` (and does nothing) when the banner is not running on the page: outside
the browser, without GA4/Ads ids in `initAnalytics`, or for a crawler user agent (the library
then has no window; from v0.4.2 every later call returns `false` too). Use this
function rather than the attribute `data-cc="show-preferencesModal"`: vanilla-cookieconsent
binds that attribute once, during `run()`, to the elements that exist at that moment, so a
React footer that renders later or remounts on a route change never gets it.

## How consent works (Consent Mode v2 basic, since v0.4.0)

- **Nothing Google loads before consent.** No `gtag.js`, no `dataLayer`, no `window.gtag`,
  so no cookieless pings either. `initAnalytics` only remembers the tag ids.
- vanilla-cookieconsent shows an AVG-compliant banner (NL/EN, auto-detects).
- **Withdrawal clears the cookies on the parent domain too (v0.4.3).** gtag writes `_ga*` and
  `_gcl_*` on the registrable domain (`.prudai.com`), also when the visitor is on a subdomain such
  as leo.prudai.com. Without an explicit `domain` the library only erased on `location.hostname`,
  so on subdomains the cookies survived a withdrawal (measured in production 29-09-2026). The
  service cookie lists now carry the host plus every parent domain. A `*.vercel.app` preview does
  not show this problem (gtag sets the cookies on the host there), so verify it on a real subdomain.
  It is not retroactive: leftovers from a withdrawal before v0.4.3 are only cleared the next
  time that visitor changes the choice.
- **Withdrawing marketing also clears the ad click from localStorage (v0.4.4).** Google Ads keeps
  the click in `_gcl_ls` (localStorage) next to the `_gcl_aw` cookie; the banner only clears
  cookies. On a site with an Ads tag, every `applyConsent` without marketing consent removes the
  `_gcl*` localStorage keys. A site without an Ads tag (/vera, /zia on the prudai.com origin)
  leaves them alone, so it cannot wipe the click of a visitor who consented on prudai.com.
- **One consent for all Prudai websites (v0.4.4, decision Beau 29-09-2026).** On prudai.com and
  every `*.prudai.com` host the choice lives in one `cc_cookie` on `.prudai.com` (`GEDEELD_DOMEIN`):
  accepting or withdrawing on one site applies on all of them, and the banner text says so. That
  only holds when **every** site with a banner runs v0.4.4 or later: a site on an older version
  writes its own cookie or another revision. Roll consumers out together.
  Before, each host wrote its own cookie, but the apex cookie (`Domain=prudai.com`) was visible on
  the subdomains and won there, so a withdrawal on leo.prudai.com did not survive a reload
  (measured in production 29-09-2026). Consequences:
  - every site shows the same categories, Marketing included even without an Ads tag, because a
    site without the category would drop it from the shared choice when saving; whether an Ads
    tag loads is still decided by `googleAds`;
  - `revision` is `CONSENT_REVISIE` (3) everywhere: the scope grew from "this site" to "all Prudai
    websites", so everyone is asked once more;
  - a subdomain erases its old own `cc_cookie` (host-only / `Domain=<host>`) before the banner
    starts, otherwise the library could read the stale one first;
  - hosts outside prudai.com (`*.vercel.app` previews, localhost) keep the library default (host).
- On consent (the first click, or on every page load for a returning visitor with stored
  consent) the tag starts: `consent default` all denied, immediately followed by
  `consent update` with the visitor's choice, then `config` and the `gtag.js` script.
  GA4's `config` sends the `page_view` of the page the consent lands on; later SPA route
  changes are measured by GA4's history-change page views.
- The "analytics" category configures GA4. The "Marketing" category (on every site since v0.4.4)
  configures the Google Ads tag, but only on a site with `googleAds` configured, and grants
  `ad_storage`/`ad_user_data`/`ad_personalization`. Change `CONSENT_REVISIE` whenever a
  category or the scope changes, so returning visitors are asked again once.
- `trackEvent` and the other helpers send only to the tags the visitor consented to
  (`send_to`); without consent they do nothing, and nothing is queued for later. So
  `ads_conversion_*` reaches Google Ads only with marketing consent.
- Withdrawing consent sends `consent update` denied and sets `ga-disable-<id>` for the
  withdrawn tag. For GA4 that is Google's documented opt-out, so the automatic page views
  of later route changes stop too; for Google Ads the flag is not documented and the
  `send_to` gating plus the denied ad signals do the work. Measured 29-09-2026: route
  changes, scrolling and reloads after withdrawal send 0 requests to Google. One exception:
  events recorded before the withdrawal that gtag has not sent yet (GA4 batches them for a
  few seconds) still go out once, a few seconds after the withdrawal, with the consent state
  they were recorded under (`gcs=G111`). gtag has no public way to drop that queue, and the
  processing before the withdrawal stays lawful (GDPR art. 7(3)). The script itself stays on
  the page until the next load.
- Consent after navigating inside the SPA: the gclid/utm of the landing URL are no longer
  in the address bar when the tag starts. The package remembers them from page load and
  puts them back into GA4's first `page_view` (`page_location`), so GA4 still counts the
  visit as ad/campaign traffic. Google Ads' conversion linker reads the real address bar
  only, so in that flow no `_gcl_aw` cookie is written and a later conversion is not tied
  to the ad click. **This is a change from v0.3.2**, where gtag.js already ran on the
  landing page and wrote `_gcl_aw` once consent came (measured 29-09-2026). Accepting on
  the landing page itself still writes it. Our own attribution (`leesHerkomst()`, see
  below, stored with every form) is unaffected.
- Why basic and not advanced: in advanced mode the tag sent cookieless pings before any
  click. Most of those came from Microsoft 365 link scanners opening the links in our
  mails (29-09-2026: 775 of 1,283 GA4 sessions in 28 days, all "Unassigned"). The
  modelling advanced mode exists for needs a volume we do not reach.

## Breaking in v0.4.0 (consumer tests)

`trackEvent`/`trackCta`/`trackOutboundClick`/`trackScrollDepth` now check consent. When
`initAnalytics` configured a GA4 or Ads id, an event without consent is dropped, and with
consent it gets a `send_to` with the consented ids. A test that only sets `window.gtag`
(without `initAnalytics`) still sees the old behaviour: the event passes through unchanged.
A test that calls `initAnalytics` with ids and then expects events on `window.gtag` needs to
mock the package instead.

## Development

```sh
bun install
bun run typecheck
bun test
bun run build
```

## Herkomst van een bezoek (v0.3.2)

`initAnalytics` legt bij de eerste pagina in een tab vast waar het bezoek vandaan kwam
(landingspagina, verwijzer, `utm_*`, `gclid`) in `sessionStorage` onder `prudai_herkomst`;
geen cookie, geen derde partij, onafhankelijk van de cookiebanner. Een formulier stuurt
`leesHerkomst()` mee (eerste aanraking + de pagina van het formulier), de edge-functie
`submit-contact-form` bewaart het in `contact_logs.herkomst` en zet een leesbare regel
"Herkomst" in de notificatiemail en de CRM-notitie. Een nieuwe `gclid`/`utm_*` in dezelfde
tab overschrijft de oude herkomst.
