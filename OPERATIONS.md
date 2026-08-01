# OPERATIONS

## 前提と環境変数

- Node.js 22
- npm
- GitHubリポジトリ `fmatsusaka-tech/kisho-bot`
- GitHub Pagesの公開元はGitHub Actions

現行アプリに必須の環境変数やSecretsはありません。Spreadsheet IDと公開CSVのgidは `src/features/weather/weather-data.ts` に公開設定として定義されています。秘密情報ではありませんが、変更時は別Spreadsheetへの誤接続がないか確認してください。

`next.config.ts` はGitHub Actions上で `GITHUB_ACTIONS=true` のときだけ `/kisho-bot` のbase pathを付けます。この変数はGitHub Actionsが提供するもので、通常は手動設定しません。

## ローカル起動

```text
npm ci
npm run dev
```

通常は `http://localhost:3000` を開きます。静的成果物の確認は `npm run build` 後の `out/` を対象にします。

## デプロイ方法

1. 作業ブランチで変更し、必須検証を通す。
2. PRを作成し、CI workflow `CI / verify` の成功を確認する。
3. PRをmainへマージする。
4. `Deploy Next.js site to Pages` のbuildとdeploy成功を確認する。
5. <https://fmatsusaka-tech.github.io/kisho-bot/> を開き、HTTP応答と主要画面を確認する。

workflowは `.github/workflows/ci.yml` と `.github/workflows/nextjs.yml` です。Pagesは `out/` を公開します。

## 障害時の確認場所

| 症状 | 最初に確認する場所 |
|---|---|
| 公開ページが開かない | GitHub ActionsのPages workflow、Repository SettingsのPages、直近deploy |
| CSSやJSが404 | `next.config.ts` のbasePath/assetPrefix、リポジトリ名、Pages URL |
| 「気象データを取得できませんでした」 | ブラウザ開発者ツールのNetwork、公開CSV URL、Spreadsheetの共有・公開設定、必須列名 |
| データが古い | 元Spreadsheetの最終日。現行repoに自動取得処理はないため、上流の更新担当・仕組みを確認 |
| 数値がおかしい | 元CSV、欠測欄、列名、DATA HEALTH、該当期間と基準温度 |
| 「全部」の雨量が想定地点と違う | 「降水量の地点」の湯浅・川辺選択と、凡例・観測表の地点名を確認 |
| 年比較できない | CSVに対象年の行があるか、今年以外の選択が2年以内か |
| 別画面が開かない | ブラウザのポップアップ許可 |
| 別画面で目盛りが動く | ポップアップを再読込し、横スクロール時に左端の縦目盛りが固定されるか確認 |

## 復旧・切り戻し

推奨は、問題を起こしたSquashコミットをGitHub上でRevertするPRを作り、検証後にmainへマージする方法です。履歴を書き換えるforce pushや、ローカルでの `git reset --hard` は使いません。

1. 最後に正常だった公開コミットと、不具合を導入したコミットを特定する。
2. 不具合コミットをrevertする作業ブランチとPRを作る。
3. typecheck、lint、test、buildを実行する。
4. マージ後にPages deployと公開URLを確認する。

データ異常の場合、アプリの切り戻しではSpreadsheetの内容は戻りません。まず元Spreadsheetを別途保全し、更新元と修正範囲を確認してください。Output側のSpreadsheetは操作しません。

## 外部サービスの設定箇所

- Spreadsheet URL/ID/gid：`src/features/weather/weather-data.ts`
- GitHub Actions：`.github/workflows/`
- GitHub Pages：GitHub repository Settings → Pages、およびEnvironment `github-pages`
- 公開パス：`next.config.ts`
- npm依存関係とコマンド：`package.json`, `package-lock.json`

## 現在できない運用

気象庁データの自動取得、Google Spreadsheetへの書込み、毎朝6時頃の定時実行、直近3日の再取得は未実装です。そのため、その処理に必要なGoogle認証情報、Secrets名、復旧手順、実行ログの場所もまだ存在しません。実装時にこの文書へ追記するまで、運用可能とは判断しないでください。
