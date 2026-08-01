import type { WeatherRecord } from "./weather-data";

export type WeatherMetric = "all" | "rainfall" | "temperature" | "accumulated";
export type WeatherView = "30days" | "custom" | "year";
export type BaseTemperature = 3 | 5 | 8;

const shiftDateToYear = (date: string, targetYear: number) => {
  const [, month, day] = date.split("-").map(Number);
  const lastDay = new Date(Date.UTC(targetYear, month, 0)).getUTCDate();
  return `${targetYear}-${String(month).padStart(2, "0")}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
};

export const comparisonPeriod = (
  rows: readonly WeatherRecord[], startDate: string, endDate: string, targetStartYear: string,
): WeatherRecord[] => {
  if (!startDate || !endDate || startDate > endDate) return [];
  const sourceStartYear = Number(startDate.slice(0, 4));
  const targetYear = Number(targetStartYear);
  if (!Number.isInteger(sourceStartYear) || !Number.isInteger(targetYear)) return [];
  const offset = targetYear - sourceStartYear;
  const shiftedStart = shiftDateToYear(startDate, targetYear);
  const shiftedEnd = shiftDateToYear(endDate, Number(endDate.slice(0, 4)) + offset);
  return rows.filter((row) => row.date >= shiftedStart && row.date <= shiftedEnd);
};

export const filterWeatherPeriod = (
  rows: readonly WeatherRecord[],
  view: WeatherView,
  startDate: string,
  endDate: string,
): WeatherRecord[] => {
  if (!rows.length) return [];
  if (view === "30days") return rows.slice(-30);
  if (view === "year") {
    const year = rows.at(-1)?.date.slice(0, 4);
    return rows.filter((row) => row.date.startsWith(`${year}-`));
  }
  if (!startDate || !endDate || startDate > endDate) return [];
  return rows.filter((row) => row.date >= startDate && row.date <= endDate);
};

const present = (values: readonly (number | null)[]) =>
  values.filter((value): value is number => value !== null);

export const buildAccumulatedTemperatureSeries = (
  rows: readonly WeatherRecord[],
  baseTemperature: BaseTemperature = 5,
): number[] => {
  let accumulated = 0;
  return rows.map((row) => {
    if (row.meanTemp !== null) {
      accumulated += Math.max(row.meanTemp - baseTemperature, 0);
    }
    return accumulated;
  });
};

export const summarizeWeather = (
  rows: readonly WeatherRecord[],
  baseTemperature: BaseTemperature = 5,
) => {
  const rain = present(rows.map((row) => row.yuasaRain));
  const means = present(rows.map((row) => row.meanTemp));
  const highs = present(rows.map((row) => row.maxTemp));
  const lows = present(rows.map((row) => row.minTemp));
  const accumulated = buildAccumulatedTemperatureSeries(rows, baseTemperature);
  return {
    days: rows.length,
    rainTotal: rain.length ? rain.reduce((sum, value) => sum + value, 0) : null,
    rainDays: rain.filter((value) => value > 0).length,
    rainMaximum: rain.length ? Math.max(...rain) : null,
    meanTemperature: means.length
      ? means.reduce((sum, value) => sum + value, 0) / means.length
      : null,
    maximumTemperature: highs.length ? Math.max(...highs) : null,
    minimumTemperature: lows.length ? Math.min(...lows) : null,
    accumulatedTemperature: means.length ? accumulated.at(-1) ?? 0 : null,
    temperatureObservedDays: means.length,
    temperatureMissingDays: rows.length - means.length,
  };
};
