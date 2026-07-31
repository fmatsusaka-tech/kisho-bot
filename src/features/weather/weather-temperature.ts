import type { WeatherRecord } from "./weather-data";

export type TemperatureKind = "maximum" | "mean" | "minimum";

export const temperatureValue = (
  row: WeatherRecord,
  kind: TemperatureKind,
): number | null => {
  if (kind === "maximum") return row.maxTemp;
  if (kind === "minimum") return row.minTemp;
  return row.meanTemp;
};

export const temperatureLabel = (kind: TemperatureKind) => {
  if (kind === "maximum") return "最高気温";
  if (kind === "minimum") return "最低気温";
  return "平均気温";
};
