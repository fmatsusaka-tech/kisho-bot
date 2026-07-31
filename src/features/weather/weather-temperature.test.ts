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
});
