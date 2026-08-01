import type { WeatherRecord } from "@/features/weather/weather-data";
import {
  buildAccumulatedTemperatureSeries,
  type BaseTemperature,
} from "@/features/weather/weather-period";
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

export default function WeatherYearComparisonChart({
  currentRows,
  currentYear,
  comparisonSeries,
  metric,
  kind,
  baseTemperature,
  colors = ["var(--chart-red)", "var(--chart-blue)", "var(--chart-green)"],
}: {
  currentRows: WeatherRecord[];
  currentYear: string;
  comparisonSeries: { year: string; rows: WeatherRecord[] }[];
  metric: "accumulated" | "rainfall" | "temperature";
  kind: TemperatureKind;
  baseTemperature: BaseTemperature;
  colors?: readonly [string, string, string];
}) {
  const series: Series[] = [
    { year: currentYear, rows: currentRows, stroke: colors[0] },
    ...comparisonSeries.map(({ year, rows }, index) => ({
      year, rows,
      stroke: colors[index + 1],
    })),
  ];
  const valueSeries = series.map((item) => ({
    ...item,
    values: metric === "accumulated"
      ? buildAccumulatedTemperatureSeries(item.rows, baseTemperature)
      : item.rows.map((row) => metric === "rainfall" ? row.yuasaRain : temperatureValue(row, kind)),
  }));
  const valid = valueSeries.flatMap((item) =>
    item.values
      .filter((value): value is number => value !== null),
  );
  if (valid.length < 2) return <p className="empty">表示できるデータがありません。</p>;

  const width = 720, height = 290, left = 52, right = 18, top = 24, bottom = 48;
  const plotWidth = width - left - right, plotHeight = height - top - bottom;
  const min = metric === "temperature" ? Math.floor(Math.min(...valid) - 1) : 0;
  const max = Math.ceil(Math.max(...valid) + 1);
  const span = Math.max(max - min, 1);
  const label = metric === "rainfall" ? "降水量" : metric === "accumulated" ? "積算温度" : temperatureLabel(kind);
  const unit = metric === "rainfall" ? "mm" : metric === "accumulated" ? "℃・日" : "℃";
  const x = (index: number, count: number) => left + index / Math.max(count - 1, 1) * plotWidth;
  const y = (value: number) => top + (max - value) / span * plotHeight;
  const yTicks = Array.from({ length: 5 }, (_, index) => max - span * index / 4);
  const xTicks = [...new Set(Array.from({ length: 5 }, (_, index) =>
    Math.round((currentRows.length - 1) * index / 4),
  ))];

  const legend = <div className="chart-legend" aria-label="比較年の凡例">
      {series.map((item) => <span key={item.year}><i style={{ borderColor: item.stroke, borderStyle: "solid" }} />{item.year}年</span>)}
    </div>;
  return <ChartViewport legend={legend}>
    <svg className="axis-chart" data-axis-width="58" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`選択期間と比較年の${label}`}>
      <text x={left} y="13" className="axis-unit">{unit}</text>
      {yTicks.map((tick) => <g key={tick}>
        <line x1={left} y1={y(tick)} x2={width - right} y2={y(tick)} className="grid-line" />
        <text x={left - 9} y={y(tick) + 4} textAnchor="end" className="tick-label">{tick.toFixed(metric === "rainfall" ? 0 : 1)}</text>
      </g>)}
      {xTicks.map((index) => <g key={index}>
        <line x1={x(index, currentRows.length)} y1={top} x2={x(index, currentRows.length)} y2={height - bottom} className="grid-line vertical" />
        <text x={x(index, currentRows.length)} y={height - 17} textAnchor="middle" className="tick-label">{currentRows[index]?.date.slice(5).replace("-", "/")}</text>
      </g>)}
      <line x1={left} y1={height - bottom} x2={width - right} y2={height - bottom} className="axis-line" />
      <line x1={left} y1={top} x2={left} y2={height - bottom} className="axis-line" />
      {valueSeries.map((item) => {
        const points = item.rows.flatMap((row, index) => {
          const value = item.values[index];
          return value === null ? [] : [`${x(index, item.rows.length)},${y(value)}`];
        }).join(" ");
        return <polyline key={item.year} points={points} fill="none" stroke={item.stroke} strokeWidth="2" vectorEffect="non-scaling-stroke" />;
      })}
    </svg>
  </ChartViewport>;
}
