import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

export const HISTORICAL_START_YEAR = 1976;

export const STATIONS = Object.freeze({
  kawabe: Object.freeze({ name: "川辺", precNo: "65", blockNo: "1485", hasTemperature: true }),
  yuasa: Object.freeze({ name: "湯浅", precNo: "65", blockNo: "0978", hasTemperature: false }),
  ebina: Object.freeze({ name: "海老名", precNo: "46", blockNo: "0388", hasTemperature: true }),
});

const plainText = (html) => html
  .replace(/<br\s*\/?>/gi, " ")
  .replace(/<[^>]*>/g, "")
  .replace(/&nbsp;/gi, " ")
  .replace(/&minus;|&#8722;/gi, "-")
  .trim();

const numericValue = (cell) => {
  const text = plainText(cell).replace(/[\)\]\*#]/g, "").trim();
  if (!text || text.includes("///") || text.includes("×") || text === "--") return null;
  const match = text.replaceAll(",", "").match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const number = Number(match[0]);
  return Number.isFinite(number) ? number : null;
};

export const parseDetailedDailyAmedasHtml = (html, year, month, station) => {
  const table = html.match(/<table[^>]*id=["']tablefix1["'][^>]*>([\s\S]*?)<\/table>/i)?.[1];
  if (!table) return [];

  const rows = [];
  for (const match of table.matchAll(/<tr[^>]*class=["'][^"']*mtx[^"']*["'][^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...match[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) => cell[1]);
    const dayText = cells[0] ? plainText(cells[0]) : "";
    if (!/^\d+$/.test(dayText)) continue;
    const day = Number(dayText);
    const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    rows.push({
      date,
      meanTemp: station.hasTemperature && cells.length > 6 ? numericValue(cells[6]) : null,
      maxTemp: station.hasTemperature && cells.length > 7 ? numericValue(cells[7]) : null,
      minTemp: station.hasTemperature && cells.length > 9 ? numericValue(cells[9]) : null,
      rainfall: cells.length > 1 ? numericValue(cells[1]) : null,
    });
  }
  return rows;
};

const yesterdayInJapan = () => {
  const now = new Date();
  const japan = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
  japan.setDate(japan.getDate() - 1);
  return `${japan.getFullYear()}-${String(japan.getMonth() + 1).padStart(2, "0")}-${String(japan.getDate()).padStart(2, "0")}`;
};

const monthSequence = (startYear, endDate) => {
  const end = new Date(`${endDate}T00:00:00Z`);
  const months = [];
  for (let year = startYear; year <= end.getUTCFullYear(); year += 1) {
    const lastMonth = year === end.getUTCFullYear() ? end.getUTCMonth() + 1 : 12;
    for (let month = 1; month <= lastMonth; month += 1) months.push({ year, month });
  }
  return months;
};

export const fetchStationHistory = async (stationKey, options = {}) => {
  const station = STATIONS[stationKey];
  if (!station) throw new Error(`未知の地点です: ${stationKey}`);
  const endDate = options.endDate ?? yesterdayInJapan();
  const startYear = options.startYear ?? HISTORICAL_START_YEAR;
  const records = [];

  for (const { year, month } of monthSequence(startYear, endDate)) {
    const url = `https://www.data.jma.go.jp/stats/etrn/view/daily_a1.php?prec_no=${station.precNo}&block_no=${station.blockNo}&year=${year}&month=${month}&day=&view=a1`;
    const response = await fetch(url, { headers: { "user-agent": "kisho-bot/1.0 (historical weather import)" } });
    if (!response.ok) throw new Error(`${station.name} ${year}-${month}: JMA HTTP ${response.status}`);
    records.push(...parseDetailedDailyAmedasHtml(await response.text(), year, month, station));
    if (options.requestIntervalMs) await new Promise((resolveDelay) => setTimeout(resolveDelay, options.requestIntervalMs));
  }

  const filtered = records.filter((record) => record.date <= endDate);
  const dates = new Set(filtered.map((record) => record.date));
  if (dates.size !== filtered.length) throw new Error(`${station.name}の取得結果に日付の重複があります。`);
  return filtered;
};

export const writeStationCsv = async (stationKey, records, outputDirectory) => {
  await mkdir(outputDirectory, { recursive: true });
  const outputPath = resolve(outputDirectory, `${stationKey}.csv`);
  const csv = [
    "年月日,平均気温(℃),最高気温(℃),最低気温(℃),降水量(mm)",
    ...records.map((record) => [record.date.replaceAll("-", "/"), record.meanTemp, record.maxTemp, record.minTemp, record.rainfall]
      .map((value) => value === null ? "" : String(value)).join(",")),
  ].join("\n");
  await writeFile(outputPath, `${csv}\n`, "utf8");
  return outputPath;
};

if (process.argv[1]?.endsWith("fetch-jma-history.mjs")) {
  const stationKeys = process.argv[2] === "all" ? Object.keys(STATIONS) : [process.argv[2]];
  const outputDirectory = process.argv[3];
  if (!stationKeys[0] || !outputDirectory) throw new Error("地点（kawabe / yuasa / ebina / all）と出力先を指定してください。");
  const summaries = [];
  for (const stationKey of stationKeys) {
    const records = await fetchStationHistory(stationKey, { requestIntervalMs: 100 });
    const outputPath = await writeStationCsv(stationKey, records, outputDirectory);
    summaries.push({ station: STATIONS[stationKey].name, firstDate: records[0]?.date, lastDate: records.at(-1)?.date, records: records.length, outputPath });
  }
  process.stdout.write(`${JSON.stringify(summaries)}\n`);
}
