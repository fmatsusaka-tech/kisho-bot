import { writeFile } from "node:fs/promises";

const STATION = { name: "海老名", precNo: "46", blockNo: "0388" };
const START_DATE = "2020-01-01";

const plainText = (html) => html
  .replace(/<br\s*\/?>/gi, " ")
  .replace(/<[^>]*>/g, "")
  .replace(/&nbsp;/g, " ")
  .replace(/&minus;/g, "-")
  .trim();

const value = (cell) => {
  const text = plainText(cell).replace(/[\)\]\*＃]/g, "").trim();
  if (!text || text.includes("///") || text === "--") return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
};

export const parseDailyAmedasHtml = (html, year, month) => {
  const rows = [];
  for (const match of html.matchAll(/<tr class="mtx"[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...match[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) => cell[1]);
    if (cells.length < 7) continue;
    const dayMatch = plainText(cells[0]).match(/^\d+$/);
    if (!dayMatch) continue;
    rows.push({
      date: `${year}-${String(month).padStart(2, "0")}-${String(Number(dayMatch[0])).padStart(2, "0")}`,
      meanTemp: value(cells[4]),
      maxTemp: value(cells[5]),
      minTemp: value(cells[6]),
      rainfall: value(cells[1]),
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

export const fetchEbina = async (endDate = yesterdayInJapan()) => {
  const records = [];
  let cursor = new Date(`${START_DATE}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  while (cursor <= end) {
    const year = cursor.getUTCFullYear();
    const month = cursor.getUTCMonth() + 1;
    const url = `https://www.data.jma.go.jp/stats/etrn/view/daily_a1.php?prec_no=${STATION.precNo}&block_no=${STATION.blockNo}&year=${year}&month=${month}&day=&view=`;
    const response = await fetch(url, { headers: { "user-agent": "kisho-bot/1.0 (historical weather import)" } });
    if (!response.ok) throw new Error(`${year}-${month}: JMA HTTP ${response.status}`);
    records.push(...parseDailyAmedasHtml(await response.text(), year, month));
    cursor = new Date(Date.UTC(year, month, 1));
  }
  return records.filter((record) => record.date >= START_DATE && record.date <= endDate);
};

const csvCell = (item) => item === null ? "" : String(item);

if (process.argv[1]?.endsWith("fetch-ebina-jma.mjs")) {
  const outputPath = process.argv[2];
  if (!outputPath) throw new Error("出力先CSVパスを指定してください。");
  const records = await fetchEbina();
  const dates = new Set(records.map((record) => record.date));
  if (dates.size !== records.length) throw new Error("取得結果に日付の重複があります。");
  const csv = [
    "年月日,平均気温(℃),最高気温(℃),最低気温(℃),降水量(mm)",
    ...records.map((record) => [record.date.replaceAll("-", "/"), record.meanTemp, record.maxTemp, record.minTemp, record.rainfall].map(csvCell).join(",")),
  ].join("\n");
  await writeFile(outputPath, `${csv}\n`, "utf8");
  process.stdout.write(JSON.stringify({ station: STATION, startDate: START_DATE, endDate: records.at(-1)?.date, records: records.length, outputPath }));
}
