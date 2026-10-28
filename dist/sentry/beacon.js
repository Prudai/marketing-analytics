/**
 * Noodroute (v0.4.8) voor fouten die Sentry nooit meer haalt: de bezoeker verlaat de pagina
 * voordat de luie chunk (zie ./lazy) gestart is, of de chunk laadt niet. Zonder dit gingen de
 * gebufferde fouten verloren. Een Sentry-SDK is er niet nodig: een envelope is een paar regels
 * JSON, en `navigator.sendBeacon` overleeft het sluiten van de pagina.
 *
 * Bewust minder rijk dan een echt Sentry-event: geen geparste stacktrace (de ruwe stack staat
 * in `extra`), geen breadcrumbs, geen sessie. Elk event krijgt de tag `via: pagehide-beacon`
 * zodat het in GlitchTip te herkennen is. Verder gelijk aan wat de SDK zonder `sendDefaultPii`
 * stuurt: type, bericht, URL, omgeving en release; geen cookies, geen gebruiker.
 */
export const BEACON_VERSIE = "0.4.8";
const MAX_WAARDE = 1000;
const MAX_STACK = 4000;
const MAX_URL = 1000;
/** `https://<sleutel>@host[/prefix]/<projectnummer>` naar het envelope-eindpunt; `undefined` bij een onbruikbare DSN. */
export function envelopeEindpunt(dsn) {
    try {
        const u = new URL(dsn);
        if (!/^https?:$/.test(u.protocol) || !u.username)
            return undefined;
        const delen = u.pathname.split("/").filter(Boolean);
        const project = delen.pop();
        if (!project || !/^\d+$/.test(project))
            return undefined;
        const voorvoegsel = delen.length ? `/${delen.join("/")}` : "";
        return (`${u.protocol}//${u.host}${voorvoegsel}/api/${project}/envelope/` +
            `?sentry_key=${encodeURIComponent(u.username)}&sentry_version=7` +
            `&sentry_client=${encodeURIComponent(`prudai.marketing-analytics.beacon/${BEACON_VERSIE}`)}`);
    }
    catch {
        return undefined;
    }
}
function nieuwId() {
    const c = globalThis.crypto;
    if (c && typeof c.randomUUID === "function")
        return c.randomUUID().replace(/-/g, "");
    let id = "";
    for (let i = 0; i < 32; i++)
        id += Math.floor(Math.random() * 16).toString(16);
    return id;
}
const knip = (s, max) => (s.length > max ? s.slice(0, max) : s);
function alsTekst(waarde) {
    try {
        return typeof waarde === "string" ? waarde : JSON.stringify(waarde) ?? String(waarde);
    }
    catch {
        return String(waarde);
    }
}
/** Eén envelope (header, itemkop, event; elk op een eigen regel) voor één gebufferde fout. */
export function bouwEnvelope(opties, f, nu = Date.now()) {
    const e = f.fout;
    const isFout = typeof e === "object" && e !== null && typeof e.message === "string";
    const type = isFout ? (typeof e.name === "string" && e.name ? e.name : "Error") : "UnhandledRejection";
    const waarde = isFout
        ? e.message
        : `Non-Error ${f.soort === "onerror" ? "exception" : "promise rejection"} captured with value: ${alsTekst(f.fout)}`;
    const stack = isFout && typeof e.stack === "string" ? knip(e.stack, MAX_STACK) : undefined;
    const eventId = nieuwId();
    const tijd = typeof f.tijd === "number" ? f.tijd : nu;
    const event = {
        event_id: eventId,
        timestamp: tijd / 1000,
        platform: "javascript",
        level: "error",
        environment: opties.environment,
        release: opties.release,
        sdk: { name: "prudai.marketing-analytics.beacon", version: BEACON_VERSIE },
        tags: { via: "pagehide-beacon" },
        request: typeof location !== "undefined" && location.href ? { url: knip(location.href, MAX_URL) } : undefined,
        exception: {
            values: [{ type, value: knip(waarde, MAX_WAARDE), mechanism: { type: f.soort, handled: false } }],
        },
        extra: stack ? { raw_stack: stack } : undefined,
    };
    return [
        JSON.stringify({ event_id: eventId, sent_at: new Date(nu).toISOString(), sdk: event.sdk }),
        JSON.stringify({ type: "event" }),
        JSON.stringify(event),
    ].join("\n");
}
/**
 * Stuurt elke fout als eigen envelope. `text/plain` houdt het een CORS-"simple request" (geen
 * preflight, nodig bij het sluiten van de pagina). Geeft het aantal verstuurde fouten terug en
 * gooit nooit: een noodroute mag de pagina niet storen.
 */
export function stuurFoutenMetBeacon(opties, fouten) {
    const eindpunt = envelopeEindpunt(opties.dsn);
    if (!eindpunt || fouten.length === 0)
        return 0;
    let verstuurd = 0;
    for (const f of fouten) {
        try {
            const body = bouwEnvelope(opties, f);
            if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
                if (navigator.sendBeacon(eindpunt, new Blob([body], { type: "text/plain;charset=UTF-8" })))
                    verstuurd++;
            }
            else if (typeof fetch === "function") {
                void fetch(eindpunt, {
                    method: "POST",
                    body,
                    keepalive: true,
                    credentials: "omit",
                    headers: { "content-type": "text/plain;charset=UTF-8" },
                }).catch(() => { });
                verstuurd++;
            }
        }
        catch {
            // Geen beacon mogelijk: de fout valt weg, zoals vóór v0.4.8.
        }
    }
    return verstuurd;
}
//# sourceMappingURL=beacon.js.map