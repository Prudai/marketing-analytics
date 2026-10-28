/**
 * Noodroute (v0.4.8) voor fouten die Sentry nooit meer haalt: de bezoeker verlaat de pagina
 * voordat de luie chunk (zie ./lazy) gestart is, of de chunk laadt niet. Zonder dit gingen de
 * gebufferde fouten verloren. Een Sentry-SDK is er niet nodig: een envelope is een paar regels
 * JSON, en een `fetch` met `keepalive` overleeft het sluiten van de pagina.
 *
 * Bewust minder dan een echt Sentry-event, en bewust voorzichtiger:
 * - `fetch` met `credentials: "omit"`. `navigator.sendBeacon` kan dat niet instellen en stuurt de
 *   cookies van `.prudai.com` (`cc_cookie`, `_ga*`) mee naar het GlitchTip-subdomein. Daarom is er
 *   geen terugval op sendBeacon: elke engine die modulescripts draait kent `fetch`.
 * - Geen event processors: die leven in de SDK en draaien hier niet. Een site die ze nodig heeft om
 *   events te schonen zet `sentry.noodroute` op `false`. Daarom gaat er ook niets mee dat een
 *   processor normaal zou schonen: de URL zonder query en hash, geen ruwe stack, bericht afgekapt.
 * - Wat een processor normaal zou schonen gaat dus wel mee: bericht (op 500 tekens), foutnaam en, bij een
 *   niet-Error-afwijzing, de JSON van de reden. Een site waar dat niet mag zet `noodroute` op `false`.
 * - Geen geparste stacktrace, geen breadcrumbs, geen sessie. Elk event krijgt de tag
 *   `via: noodroute` zodat het in GlitchTip te herkennen is, en groepeert apart van SDK-events.
 */
export const BEACON_VERSIE = "0.4.8";
// Eén envelope per fout en `keepalive` laat samen maximaal 64 KB in vlucht toe: 10 x ~3 KB past ruim.
export const MAX_WAARDE = 500;
export const MAX_URL = 500;
/** Foutnaam, omgeving en release: kort, anders groeit een envelope boven de keepalive-grens. */
export const MAX_KORT = 100;
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
/** Alleen herkomst en pad: query en hash kunnen bestandsnamen, tokens of andere gegevens bevatten. */
export function schoneUrl(href) {
    try {
        const u = new URL(href);
        return knip(`${u.origin}${u.pathname}`, MAX_URL);
    }
    catch {
        return undefined;
    }
}
/** Eén envelope (header, itemkop, event; elk op een eigen regel) voor één gebufferde fout. */
export function bouwEnvelope(opties, f, nu = Date.now()) {
    const e = f.fout;
    const isFout = typeof e === "object" && e !== null && typeof e.message === "string";
    const type = isFout ? knip(typeof e.name === "string" && e.name ? e.name : "Error", MAX_KORT) : "UnhandledRejection";
    const waarde = isFout
        ? e.message
        : `Non-Error ${f.soort === "onerror" ? "exception" : "promise rejection"} captured with value: ${alsTekst(f.fout)}`;
    const eventId = nieuwId();
    const tijd = typeof f.tijd === "number" ? f.tijd : nu;
    const url = typeof location !== "undefined" && location.href ? schoneUrl(location.href) : undefined;
    const ua = typeof navigator !== "undefined" && typeof navigator.userAgent === "string" ? navigator.userAgent : undefined;
    const event = {
        event_id: eventId,
        timestamp: tijd / 1000,
        platform: "javascript",
        level: "error",
        environment: opties.environment === undefined ? undefined : knip(opties.environment, MAX_KORT),
        release: opties.release === undefined ? undefined : knip(opties.release, MAX_KORT),
        sdk: { name: "prudai.marketing-analytics.beacon", version: BEACON_VERSIE },
        tags: { via: "noodroute" },
        request: url || ua ? { url, headers: ua ? { "User-Agent": ua } : undefined } : undefined,
        exception: {
            values: [{ type, value: knip(waarde, MAX_WAARDE), mechanism: { type: f.soort, handled: false } }],
        },
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
            if (typeof fetch === "function") {
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
            // Geen verzending mogelijk: de fout valt weg, zoals vóór v0.4.8.
        }
    }
    return verstuurd;
}
//# sourceMappingURL=beacon.js.map