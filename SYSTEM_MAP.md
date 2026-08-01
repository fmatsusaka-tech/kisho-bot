# SYSTEM_MAP

## システム境界

```text
気象庁データ
    │  現在、このリポジトリには取得・保存処理なし
    ▼
Google Spreadsheet「和歌山気象データ」
    │  公開CSV（読取り専用で利用）
    ▼
気象データBot（Next.js静的Webアプリ）
    ├─ 期間選択・集計
    ├─ グラフ・年比較・表
    └─ ブラウザ画面へ出力
```

GitHub Actionsはソースから静的ファイルを生成し、GitHub Pagesへ配置します。Webアプリ自身にサーバーAPIやデータベースはありません。

## 画面

| 画面・部品 | 役割 |
|---|---|
| `src/app/page.tsx` | ダッシュボードを表示する入口 |
| `src/app/kisho-dashboard.tsx` | CSV取得、期間・指標選択、集計値、表、エラー表示を統括 |
| `src/app/weather-year-comparison-chart.tsx` | 今年と最大2つの比較年を表示 |
| `src/app/all-weather-chart.tsx` | 気温・降水量・積算温度を一枚に重ねて表示 |
| `src/app/chart-viewport.tsx` | 最大5倍ズーム、横スクロール、縦軸固定、別画面表示 |

## ロジックとデータ

| ファイル | 入力 | 出力・更新対象 |
|---|---|---|
| `src/features/weather/weather-data.ts` | Spreadsheetの公開CSV | ブラウザメモリ上の観測レコード。外部データは更新しない |
| `src/features/weather/weather-period.ts` | 観測レコード、期間、基準温度 | 期間抽出、集計値、積算温度系列 |
| `src/features/weather/weather-temperature.ts` | 観測レコード、気温種別 | 最高・平均・最低気温の選択値 |

公開CSVで必須の列名は `weather-data.ts` の `required` 配列が契約です。日付は `YYYY/M/D` 形式を読み、内部では `YYYY-MM-DD` に正規化します。CSVの行は日付順に並べ替えます。

## 外部サービス

| サービス | 用途 | このシステムが更新するもの |
|---|---|---|
| Google Spreadsheet「和歌山気象データ」 | 公開画面のデータ元 | なし（現在は読取りのみ） |
| GitHub | ソース、PR、CI、公開workflow | ソースとActions実行履歴 |
| GitHub Pages | 静的Webアプリの公開 | Actionsが `out/` をデプロイ |
| 気象庁 | データの原典と出典 | なし |
| `teiki-chosa-output` | 別アプリ | 一切更新しない |

## 入力から表示まで

1. 利用者がGitHub Pagesの公開画面を開く。
2. ブラウザがSpreadsheetの公開CSVを `cache: no-store` で取得する。
3. 必須列と日付を読み取り、数値でない値や空欄を欠測（`null`）として保持する。
4. 最新日を基準に、初期状態として直近30日を選ぶ。
5. 選択期間と表示指標に応じてブラウザ内で集計する。
6. カード、グラフ、観測表へ出力する。外部データへの書込みは行わない。

## 未実装のデータ更新経路

要求仕様には「2015年以降の整備」「毎朝6時頃に前日までの直近3日を再取得」「日付キーでSpreadsheetを更新」があります。しかし、気象庁取得・Google認証・Spreadsheet Writer・定時workflowは現行コードにありません。実装する場合は、公開画面とは別の書込み経路として設計し、秘密情報をブラウザへ含めないでください。
