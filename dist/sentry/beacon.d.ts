import type { VroegeFout } from "./init";
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
export declare const BEACON_VERSIE = "0.4.8";
export declare const MAX_WAARDE = 500;
export declare const MAX_URL = 500;
/** Foutnaam, omgeving en release: kort, anders groeit een envelope boven de keepalive-grens. */
export declare const MAX_KORT = 100;
export interface BeaconOpties {
    dsn: string;
    environment?: string;
    release?: string;
}
/** `https://<sleutel>@host[/prefix]/<projectnummer>` naar het envelope-eindpunt; `undefined` bij een onbruikbare DSN. */
export declare function envelopeEindpunt(dsn: string): string | undefined;
/** Alleen herkomst en pad: query en hash kunnen bestandsnamen, tokens of andere gegevens bevatten. */
export declare function schoneUrl(href: string): string | undefined;
/** Eén envelope (header, itemkop, event; elk op een eigen regel) voor één gebufferde fout. */
export declare function bouwEnvelope(opties: BeaconOpties, f: VroegeFout, nu?: number): string;
/**
 * Stuurt elke fout als eigen envelope. `text/plain` houdt het een CORS-"simple request" (geen
 * preflight, nodig bij het sluiten van de pagina). Geeft het aantal verstuurde fouten terug en
 * gooit nooit: een noodroute mag de pagina niet storen.
 */
export declare function stuurFoutenMetBeacon(opties: BeaconOpties, fouten: readonly VroegeFout[]): number;
//# sourceMappingURL=beacon.d.ts.map