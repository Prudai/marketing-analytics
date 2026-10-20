import type { ComponentProps } from "react";
import { SpeedInsights as VercelSpeedInsights } from "@vercel/speed-insights/react";

/**
 * Standaard-sampleRate voor álle Prudai-sites (v0.4.6). Het gratis Speed Insights-tegoed is
 * 10.000 events per glijdende 30 dagen, gedeeld door het hele Vercel-team; wie erover gaat
 * wordt minstens 14 dagen gepauzeerd (oktober 2026: 4 dagen na het hervatten). Gemeten
 * 16-09..19-10-2026: ~13.400 beacons per 30 dagen × ~2,04 events per beacon ≈ 27.300 events.
 * Met 0,25 is dat ≈ 6.800 (68% van het tegoed); ook bij de hoogste gemeten 2,32 events per
 * beacon blijft het onder 8.000, dus ≥20% marge. Berekening: README, "Sample rate".
 */
export const SPEED_INSIGHTS_SAMPLE_RATE = 0.25;

export type SpeedInsightsProps = ComponentProps<typeof VercelSpeedInsights>;

/** Vercel Speed Insights met de gedeelde sampleRate; een site kan hem per prop overschrijven. */
export function SpeedInsights({ sampleRate = SPEED_INSIGHTS_SAMPLE_RATE, ...props }: SpeedInsightsProps) {
  // @vercel/speed-insights negeert een falsy sampleRate en meet dan élke paginaweergave:
  // 0 (of NaN) zou het tegoed dus juist leegtrekken. Niets meten = niets renderen.
  if (!(sampleRate > 0)) return null;
  return <VercelSpeedInsights {...props} sampleRate={Math.min(sampleRate, 1)} />;
}
