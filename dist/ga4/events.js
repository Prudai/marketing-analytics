function push(name, params) {
    if (typeof window === "undefined" || !window.gtag)
        return;
    window.gtag("event", name, params);
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