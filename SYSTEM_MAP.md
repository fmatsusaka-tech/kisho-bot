# SYSTEM_MAP

## 全体構成

```text
気象庁 過去の気象データ検索
  ├─ 川辺（日平均・最高・最低気温、日降水量）
  ├─ 湯浅（日降水量）
  └─ 海老名（日平均・最高・最低気温、日降水量）
          ↓ 取得・日付キーで更新
Google Spreadsheet「和歌山気象データ」
  ├─ 川辺 / 湯浅 / 海老名：地点別の生データ
  ├─ データ分析：公開画面用の横持ちデータ
  ├─ 管理 / 取得ログ / データチェック：運用状態
  └─ 公開CSV（データ分析、gid=186487642）
          ↓ 読み取り専用
Next.js静的Webアプリ
  ├─ 期間・指標・地点・比較年を選択
  ├─ ブラウザ内で集計
  └─ グラフ・カード・観測表を表示
          ↓ mainマージ
GitHub Actions → GitHub Pages
```

## 画面とコード

| 場所 | 役割 |
|---|---|
| `src/app/kisho-dashboard.tsx` | CSV取得、全操作状態、カード・表・エラー表示 |
| `src/app/app-version.ts` | 上部ダッシュボードに表示する利用者向けバージョン |
| `src/app/all-weather-chart.tsx` | 全指標の複合グラフと年比較 |
| `src/app/weather-year-comparison-chart.tsx` | 単一指標の年比較 |
| `src/app/chart-viewport.tsx` | ズーム、横スクロール、固定縦目盛り、別画面 |
| `src/features/weather/weather-data.ts` | CSV解析、地点定義、降水量選択、基本検査 |
| `src/features/weather/weather-temperature.ts` | 川辺・海老名の気温選択 |
| `src/features/weather/weather-period.ts` | 期間抽出、今年を除外する期間移動、年比較、集計、積算温度 |
| `scripts/fetch-jma-history.mjs` | 3地点の公開最古年以降を検証・CSV生成 |
| `apps-script/Code.js` | 3地点の初回取得、12年単位の過去取得、毎朝更新、再取得、分析・管理・ログ・検査 |

## データ列

公開CSVでは従来のA:Kに加えて、L:Oを使用します。

| 列 | 内容 |
|---|---|
| L | 降水量（海老名） |
| M | 平均気温（海老名） |
| N | 最高気温（海老名） |
| O | 最低気温（海老名） |

湯浅に気温列は作りません。存在しない観測値を補完しないためです。

## 更新主体

| 対象 | 更新主体 | 現在の状態 |
|---|---|---|
| 川辺・湯浅・海老名の生データと分析列 | Spreadsheet付属Google Apps Script | 毎朝6時頃に直近3日を再取得 |
| 3地点の過去データ | Google Apps Scriptと気象庁日別表 | 湯浅・海老名は1976/01/01、川辺は1999/03/04以降を投入済み |
| 海老名の日次データ | Google Apps Script | 接続済み、手動実行成功、時間トリガー1件 |
| 画面表示 | ブラウザ | Spreadsheetの公開CSVを読み取り、外部へは書かない |
| Webアプリ | GitHub Actions | `main`からGitHub Pagesへ公開 |

`teiki-chosa-output`とそのSpreadsheetは、どの経路からも更新しません。
