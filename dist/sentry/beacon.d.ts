import type { VroegeFout } from "./init";
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
export declare const BEACON_VERSIE = "0.4.8";
export interface BeaconOpties {
    dsn: string;
    environment?: string;
    release?: string;
}
/** `https://<sleutel>@host[/prefix]/<projectnummer>` naar het envelope-eindpunt; `undefined` bij een onbruikbare DSN. */
export declare function envelopeEindpunt(dsn: string): string | undefined;
/** Eén envelope (header, itemkop, event; elk op een eigen regel) voor één gebufferde fout. */
export declare function bouwEnvelope(opties: BeaconOpties, f: VroegeFout, nu?: number): string;
/**
 * Stuurt elke fout als eigen envelope. `text/plain` houdt het een CORS-"simple request" (geen
 * preflight, nodig bij het sluiten van de pagina). Geeft het aantal verstuurde fouten terug en
 * gooit nooit: een noodroute mag de pagina niet storen.
 */
export declare function stuurFoutenMetBeacon(opties: BeaconOpties, fouten: readonly VroegeFout[]): number;
//# sourceMappingURL=beacon.d.ts.map