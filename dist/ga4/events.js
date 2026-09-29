import { consentedTargets } from "./init";
/**
 * Stuurt een event alleen naar de tags waarvoor de bezoeker toestemming gaf:
 * GA4 bij analytics, Google Ads bij marketing. Zonder toestemming gebeurt er
 * niets. Een meegegeven `send_to` gaat alleen door als die naar een
 * toegestane tag wijst. Beheert dit pakket de tag niet (geen `initAnalytics`
 * met een tag-id), dan gaat het event ongewijzigd naar een `window.gtag` die
 * iemand anders zette, zoals vóór v0.4.0.
 */
function push(name, params) {
    if (typeof window === "undefined" || !window.gtag)
        return;
    const targets = consentedTargets();
    if (targets === null) {
        window.gtag("event", name, params);
        return;
    }
    if (targets.length === 0)
        return;
    const explicit = params.send_to;
    if (typeof explicit === "string") {
        const id = explicit.split("/")[0];
        if (!targets.includes(id))
            return;
        window.gtag("event", name, params);
        return;
    }
    window.gtag("event", name, { ...params, send_to: targets });
}
export function trackEvent(name, params = {}) {
    push(name, params);
}
export function trackCta(label, location) {
    push("cta_click", { label, location });
}
export function trackOutboundClick(href, label) {
    push("outbound_click", { href, label });
}
export function trackScrollDepth(depth) {
    push("scroll_depth", { depth });
}
//# sourceMappingURL=events.js.map