export type EventParams = Record<string, string | number | boolean | undefined>;

function push(name: string, params: EventParams): void {
  if (typeof window === "undefined" || !window.gtag) return;
  window.gtag("event", name, params);
}

export function trackEvent(name: string, params: EventParams = {}): void {
  push(name, params);
}

export function trackCta(label: string, location?: string): void {
  push("cta_click", { label, location });
}

export function trackOutboundClick(href: string, label?: string): void {
  push("outbound_click", { href, label });
}

export function trackScrollDepth(depth: 25 | 50 | 75 | 90 | 100): void {
  push("scroll_depth", { depth });
}
