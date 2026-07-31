import type { WeatherRecord } from "@/features/weather/weather-data";
import ChartViewport from "./chart-viewport";
import {
  temperatureLabel,
  temperatureValue,
  type TemperatureKind,
} from "@/features/weather/weather-temperature";

type Series = {
  year: string;
  rows: WeatherRecord[];
  stroke: string;
  dash?: string;
};

const calendarDay = (date: string) => {
  const [, month, day] = date.split("-").map(Number);
  const start = Date.UTC(2001, 0, 1);
  return (Date.UTC(2001, month - 1, day) - start) / 86_400_000;
};

export default function TemperatureComparisonChart({
  allRows,
  currentRows,
  currentYear,
  comparisonYears,
  kind,
}: {
  allRows: WeatherRecord[];
  currentRows: WeatherRecord[];
  currentYear: string;
  comparisonYears: string[];
  kind: TemperatureKind;
}) {
  const series: Series[] = [
    { year: currentYear, rows: currentRows, stroke: "var(--navy)" },
    ...comparisonYears.map((year, index) => ({
      year,
      rows: allRows.filter((row) => row.date.startsWith(`${year}-`)),
      stroke: index === 0 ? "var(--aqua)" : "var(--navy)",
      dash: index === 0 ? "10 6" : "3 6",
    })),
  ];
  const valid = series.flatMap((item) =>
    item.rows.map((row) => temperatureValue(row, kind))
      .filter((value): value is number => value !== null),
  );
  if (valid.length < 2) return <p className="empty">表示できるデータがありません。</p>;

  const width = 720, height = 290, left = 64, right = 18, top = 24, bottom = 48;
  const plotWidth = width - left - right, plotHeight = height - top - bottom;
  const min = Math.floor(Math.min(...valid) - 1);
  const max = Math.ceil(Math.max(...valid) + 1);
  const span = Math.max(max - min, 1);
  const x = (day: number) => left + day / 364 * plotWidth;
  const y = (value: number) => top + (max - value) / span * plotHeight;
  const yTicks = Array.from({ length: 5 }, (_, index) => max - span * index / 4);
  const xTicks = [
    ["1/1", 0], ["4/1", 90], ["7/1", 181], ["10/1", 273], ["12/31", 364],
  ] as const;

  const legend = <div className="chart-legend" aria-label="比較年の凡例">
      {series.map((item) => <span key={item.year}><i style={{ borderColor: item.stroke, borderStyle: item.dash ? "dashed" : "solid" }} />{item.year}年</span>)}
    </div>;
  return <ChartViewport legend={legend}>
    <svg className="axis-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`今年と比較年の${temperatureLabel(kind)}`}>
      <text x={left} y="13" className="axis-unit">℃</text>
      {yTicks.map((tick) => <g key={tick}>
        <line x1={left} y1={y(tick)} x2={width - right} y2={y(tick)} className="grid-line" />
        <text x={left - 9} y={y(tick) + 4} textAnchor="end" className="tick-label">{tick.toFixed(1)}</text>
      </g>)}
      {xTicks.map(([label, day]) => <g key={label}>
        <line x1={x(day)} y1={top} x2={x(day)} y2={height - bottom} className="grid-line vertical" />
        <text x={x(day)} y={height - 17} textAnchor="middle" className="tick-label">{label}</text>
      </g>)}
      <line x1={left} y1={height - bottom} x2={width - right} y2={height - bottom} className="axis-line" />
      <line x1={left} y1={top} x2={left} y2={height - bottom} className="axis-line" />
      {series.map((item) => {
        const points = item.rows.flatMap((row) => {
          const value = temperatureValue(row, kind);
          return value === null ? [] : [`${x(calendarDay(row.date))},${y(value)}`];
        }).join(" ");
        return <polyline key={item.year} points={points} fill="none" stroke={item.stroke} strokeWidth="3" strokeDasharray={item.dash} vectorEffect="non-scaling-stroke" />;
      })}
    </svg>
  </ChartViewport>;
}
