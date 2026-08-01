export const WEATHER_SPREADSHEET_ID = "1o1sgFxmD0UGYHfpIVUZxRaE0NC1yKUFy7qXbZiOyWnA";
export const WEATHER_SPREADSHEET_URL = `https://docs.google.com/spreadsheets/d/${WEATHER_SPREADSHEET_ID}/edit`;
export const WEATHER_CSV_URL = `https://docs.google.com/spreadsheets/d/${WEATHER_SPREADSHEET_ID}/export?format=csv&gid=186487642`;

export type WeatherRecord = {
  date: string;
  yuasaRain: number | null;
  meanTemp: number | null;
  maxTemp: number | null;
  minTemp: number | null;
  meanTemp15: number | null;
  meanTemp30: number | null;
  yuasaRain15: number | null;
  yuasaRain30: number | null;
  kawabeRain: number | null;
};

export type RainfallStation = "yuasa" | "kawabe";

export const rainfallValue = (row: WeatherRecord, station: RainfallStation) =>
  station === "yuasa" ? row.yuasaRain : row.kawabeRain;

const required = ["年月日", "降水量（湯浅）", "平均気温（川辺）", "最高気温（川辺）", "最低気温（川辺）", "15日平均気温（川辺）", "30日平均気温（川辺）", "15日積算降水量（湯浅）", "30日積算降水量（湯浅）", "降水量（川辺・比較用）"];

const csvRows = (text: string) => {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i], next = text[i + 1];
    if (c === '"' && quoted && next === '"') { cell += '"'; i += 1; }
    else if (c === '"') quoted = !quoted;
    else if (c === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && next === "\n") i += 1;
      row.push(cell); if (row.some(Boolean)) rows.push(row); row = []; cell = "";
    } else cell += c;
  }
  row.push(cell); if (row.some(Boolean)) rows.push(row);
  return rows;
};

const numeric = (value: string | undefined) => {
  if (!value?.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const parseWeatherCsv = (text: string): WeatherRecord[] => {
  const rows = csvRows(text.replace(/^\uFEFF/, ""));
  if (!rows.length) throw new Error("気象データが空です。");
  const indexes = required.map((header) => rows[0].indexOf(header));
  if (indexes.some((index) => index < 0)) throw new Error("必要な列が不足しています。");
  return rows.slice(1).flatMap((row): WeatherRecord[] => {
    const match = row[indexes[0]]?.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
    if (!match) return [];
    const get = (position: number) => numeric(row[indexes[position]]);
    return [{
      date: `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`,
      yuasaRain: get(1), meanTemp: get(2), maxTemp: get(3), minTemp: get(4),
      meanTemp15: get(5), meanTemp30: get(6), yuasaRain15: get(7),
      yuasaRain30: get(8), kawabeRain: get(9),
    }];
  }).sort((a, b) => a.date.localeCompare(b.date));
};

export const validateWeather = (rows: readonly WeatherRecord[]) => {
  const issues: string[] = [], dates = new Set<string>();
  for (const row of rows) {
    if (dates.has(row.date)) issues.push(`${row.date}: 重複`);
    dates.add(row.date);
    if (row.minTemp !== null && row.maxTemp !== null && row.minTemp > row.maxTemp) issues.push(`${row.date}: 気温逆転`);
    if (row.yuasaRain !== null && row.yuasaRain < 0) issues.push(`${row.date}: 負の降水量`);
  }
  return issues;
};
