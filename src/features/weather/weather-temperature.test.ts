import { describe, expect, it } from "vitest";
import type { WeatherRecord } from "./weather-data";
import { temperatureLabel, temperatureValue } from "./weather-temperature";

const row: WeatherRecord = {
  date: "2026-07-31",
  yuasaRain: 0,
  meanTemp: 27.2,
  maxTemp: 33.1,
  minTemp: 22.4,
  meanTemp15: null,
  meanTemp30: null,
  yuasaRain15: null,
  yuasaRain30: null,
  kawabeRain: 0,
  ebinaRain: 4,
  ebinaMeanTemp: 30.2,
  ebinaMaxTemp: 35.1,
  ebinaMinTemp: 25.4,
};

describe("temperature kind", () => {
  it.each([
    ["maximum", 33.1, "最高気温"],
    ["mean", 27.2, "平均気温"],
    ["minimum", 22.4, "最低気温"],
  ] as const)("%sを選択する", (kind, expectedValue, expectedLabel) => {
    expect(temperatureValue(row, kind)).toBe(expectedValue);
    expect(temperatureLabel(kind)).toBe(expectedLabel);
  });

  it("海老名の気温を選択する", () => {
    expect(temperatureValue(row, "maximum", "ebina")).toBe(35.1);
    expect(temperatureValue(row, "mean", "ebina")).toBe(30.2);
    expect(temperatureValue(row, "minimum", "ebina")).toBe(25.4);
  });
});
