import { rainfallValue, type RainfallStation, type WeatherRecord } from "@/features/weather/weather-data";
import { buildAccumulatedTemperatureSeries, type BaseTemperature } from "@/features/weather/weather-period";
import ChartViewport from "./chart-viewport";

export type AllGraphItem = "maximum" | "mean" | "minimum" | "rainfall" | "accumulated";

export const ALL_GRAPH_OPTIONS: { value: AllGraphItem; label: string }[] = [
  { value: "maximum", label: "最高気温" }, { value: "mean", label: "平均気温" },
  { value: "minimum", label: "最低気温" }, { value: "rainfall", label: "降水量" },
  { value: "accumulated", label: "積算温度" },
];

const COLORS: Record<AllGraphItem, readonly [string, string, string]> = {
  maximum: ["#dc2626", "#fb7185", "#991b1b"], mean: ["#f97316", "#facc15", "#a16207"],
  minimum: ["#7c3aed", "#c084fc", "#4c1d95"], rainfall: ["#2563eb", "#06b6d4", "#1e3a8a"],
  accumulated: ["#16a34a", "#84cc16", "#065f46"],
};

const valuesFor = (rows: WeatherRecord[], item: AllGraphItem, base: BaseTemperature, rainfallStation: RainfallStation) => {
  if (item === "accumulated") return buildAccumulatedTemperatureSeries(rows, base);
  if (item === "rainfall") return rows.map((row) => rainfallValue(row, rainfallStation));
  if (item === "maximum") return rows.map((row) => row.maxTemp);
  if (item === "minimum") return rows.map((row) => row.minTemp);
  return rows.map((row) => row.meanTemp);
};

const scaleRange = (values: (number | null)[], zeroBased: boolean) => {
  const valid = values.filter((value): value is number => value !== null);
  if (!valid.length) return { min: 0, max: 1, span: 1 };
  const min = zeroBased ? 0 : Math.floor(Math.min(...valid) - 1);
  const max = Math.ceil(Math.max(...valid) + 1);
  return { min, max, span: Math.max(max - min, 1) };
};

export default function AllWeatherChart({
  currentRows, currentYear, comparisonSeries, items, baseTemperature, rainfallStation, comparePeriods,
}: {
  currentRows: WeatherRecord[];
  currentYear: string;
  comparisonSeries: { year: string; rows: WeatherRecord[] }[];
  items: AllGraphItem[];
  baseTemperature: BaseTemperature;
  rainfallStation: RainfallStation;
  comparePeriods: boolean;
}) {
  if (!items.length) return <p className="empty">表示するグラフ項目を選択してください。</p>;
  const rowsByYear = [
    { year: currentYear, yearIndex: 0, rows: currentRows },
    ...(comparePeriods ? comparisonSeries.map((item, index) => ({ ...item, yearIndex: index + 1 })) : []),
  ];
  const lines = items.flatMap((item) => rowsByYear.map((entry) => ({
    ...entry, item, values: valuesFor(entry.rows, item, baseTemperature, rainfallStation), color: COLORS[item][entry.yearIndex],
  })));
  const temperatureItems = new Set<AllGraphItem>(["maximum", "mean", "minimum"]);
  const temperatureScale = scaleRange(lines.filter((line) => temperatureItems.has(line.item)).flatMap((line) => line.values), false);
  const rainfallScale = scaleRange(lines.filter((line) => line.item === "rainfall").flatMap((line) => line.values), true);
  const accumulatedScale = scaleRange(lines.filter((line) => line.item === "accumulated").flatMap((line) => line.values), true);
  const hasTemperature = items.some((item) => temperatureItems.has(item));
  const activeScales = [hasTemperature, items.includes("rainfall"), items.includes("accumulated")].filter(Boolean).length;
  const width = 860, height = 330, left = 12 + activeScales * 52, right = 20, top = 28, bottom = 50;
  const plotWidth = width - left - right, plotHeight = height - top - bottom;
  const x = (index: number, count: number) => left + index / Math.max(count - 1, 1) * plotWidth;
  const yFor = (item: AllGraphItem, value: number) => {
    const scale = temperatureItems.has(item) ? temperatureScale : item === "rainfall" ? rainfallScale : accumulatedScale;
    return top + (scale.max - value) / scale.span * plotHeight;
  };
  const ticks = (scale: { max: number; span: number }) => Array.from({ length: 5 }, (_, index) => scale.max - scale.span * index / 4);
  const xTicks = Array.from({ length: 5 }, (_, index) => {
    const rowIndex = Math.round((currentRows.length - 1) * index / 4);
    const row = currentRows[rowIndex];
    return [row ? `${Number(row.date.slice(5, 7))}/${Number(row.date.slice(8, 10))}` : "", rowIndex] as const;
  });
  let axisIndex = 0;
  const nextAxisX = () => 48 + axisIndex++ * 52;
  const temperatureAxisX = hasTemperature ? nextAxisX() : 0;
  const rainfallAxisX = items.includes("rainfall") ? nextAxisX() : 0;
  const accumulatedAxisX = items.includes("accumulated") ? nextAxisX() : 0;
  const legend = <div className="chart-legend all-chart-legend" aria-label="グラフの凡例">
    {lines.map((line) => <span key={`${line.item}-${line.year}`}><i style={{ borderColor: line.color, borderStyle: "solid" }} />
      {line.item === "rainfall" ? `${rainfallStation === "yuasa" ? "湯浅" : "川辺"} 降水量` : ALL_GRAPH_OPTIONS.find((option) => option.value === line.item)?.label}{comparePeriods ? `・${line.year}年` : ""}</span>)}
  </div>;

  return <ChartViewport legend={legend}><svg className="axis-chart all-weather-axis" data-axis-width={left + 6} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="気温、降水量、積算温度の複合グラフ">
    {hasTemperature && <><text x={temperatureAxisX} y="14" textAnchor="end" className="axis-unit" fill="#7c3aed">気温 ℃</text>
      {ticks(temperatureScale).map((tick) => <g key={`temp-${tick}`}><line x1={left} y1={yFor("mean", tick)} x2={width - right} y2={yFor("mean", tick)} className="grid-line" />
        <text x={temperatureAxisX} y={yFor("mean", tick) + 4} textAnchor="end" className="tick-label">{tick.toFixed(1)}</text></g>)}</>}
    {items.includes("rainfall") && <><text x={rainfallAxisX} y="14" textAnchor="end" className="axis-unit" fill="#2563eb">降水量 mm</text>
      {ticks(rainfallScale).map((tick) => <text key={`rain-${tick}`} x={rainfallAxisX} y={yFor("rainfall", tick) + 4} textAnchor="end" className="tick-label">{tick.toFixed(0)}</text>)}</>}
    {items.includes("accumulated") && <><text x={accumulatedAxisX} y="14" textAnchor="end" className="axis-unit" fill="#16a34a">積算 ℃・日</text>
      {ticks(accumulatedScale).map((tick) => <text key={`acc-${tick}`} x={accumulatedAxisX} y={yFor("accumulated", tick) + 4} textAnchor="end" className="tick-label">{tick.toFixed(0)}</text>)}</>}
    {xTicks.map(([label, position]) => { const xPosition = x(position, currentRows.length); return <g key={`${label}-${position}`}>
      <line x1={xPosition} y1={top} x2={xPosition} y2={height - bottom} className="grid-line vertical" />
      <text x={xPosition} y={height - 17} textAnchor="middle" className="tick-label">{label}</text></g>; })}
    <line x1={left} y1={height - bottom} x2={width - right} y2={height - bottom} className="axis-line" />
    <line x1={left} y1={top} x2={left} y2={height - bottom} className="axis-line" />
    {lines.map((line) => <polyline key={`${line.item}-${line.year}`} points={line.rows.flatMap((_row, index) => {
      const value = line.values[index]; return value === null ? [] : [`${x(index, line.rows.length)},${yFor(line.item, value)}`];
    }).join(" ")} fill="none" stroke={line.color} strokeWidth="2" vectorEffect="non-scaling-stroke" />)}
  </svg></ChartViewport>;
}
