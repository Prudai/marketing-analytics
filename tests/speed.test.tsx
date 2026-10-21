import { describe, expect, mock, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

// Vercels component zet zijn <script> pas in een effect neer; vervang hem door een element
// dat de props laat zien die de wrapper doorgeeft.
mock.module("@vercel/speed-insights/react", () => ({
  SpeedInsights: (props: { sampleRate?: number; route?: string }) => (
    <i data-sample-rate={props.sampleRate} data-route={props.route} />
  ),
}));

const { SpeedInsights, SPEED_INSIGHTS_SAMPLE_RATE } = await import("../src");

describe("SpeedInsights", () => {
  test("geeft standaard de gedeelde sampleRate 0,2 door", () => {
    expect(SPEED_INSIGHTS_SAMPLE_RATE).toBe(0.2);
    expect(renderToStaticMarkup(<SpeedInsights />)).toBe('<i data-sample-rate="0.2"></i>');
  });

  test("een site kan de sampleRate overschrijven; overige props gaan mee", () => {
    expect(renderToStaticMarkup(<SpeedInsights sampleRate={0.5} route="/x" />)).toBe(
      '<i data-sample-rate="0.5" data-route="/x"></i>'
    );
  });

  test("boven 1 wordt 1", () => {
    expect(renderToStaticMarkup(<SpeedInsights sampleRate={3} />)).toBe('<i data-sample-rate="1"></i>');
  });

  test("0, negatief of NaN meet niets in plaats van alles", () => {
    for (const rate of [0, -0.5, Number.NaN]) {
      expect(renderToStaticMarkup(<SpeedInsights sampleRate={rate} />)).toBe("");
    }
  });
});
