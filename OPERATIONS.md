# OPERATIONS

## 必要環境

- Node.js 22、npm
- GitHubリポジトリ `fmatsusaka-tech/kisho-bot`
- Google Spreadsheet「和歌山気象データ」への運用権限
- 日次更新を変更する場合は、同Spreadsheetに紐づくGoogle Apps Scriptの編集権限

現行の公開Webアプリに秘密の環境変数はありません。Spreadsheet IDと公開CSV gidは公開設定で、`src/features/weather/weather-data.ts`にあります。認証情報をソース、公開CSV、ログ、文書へ記載しないでください。

## ローカル起動と検証

```text
npm ci
npm run dev
```

```text
npm run typecheck
npm run lint
npm test
npm run build
```

## 過去データの再取得

3地点について、気象庁が公開する最古年から前日までの日別値を検証用CSVへ取得できます。

```text
node scripts/fetch-jma-history.mjs all .tmp-jma-history
```

CSV列は`年月日,平均気温,最高気温,最低気温,降水量`です。投入前に件数、先頭・末尾日、重複、欠測が空欄であることを確認してください。Apps Scriptでは地点別バックフィルを1回最大12年に分け、全地点完了後に`finalizeHistoricalBackfill`で分析・検査を再構築します。

- 湯浅：1976/01/01以降、降水量のみ
- 海老名：1976/01/01以降。気温は1978/01/17以降
- 川辺：1999/03/04以降

## 3地点の日次自動更新

Apps Scriptは川辺・湯浅・海老名を毎朝6時頃更新します。実装の正本は `apps-script/Code.js` です。変更時は必ずApps Scriptプロジェクトを`clasp clone`でバックアップしてから反映します。

- 地点：川辺（65/1485）、湯浅（65/0978）、海老名（46/0388）
- 保存先：`海老名`シート A:E
- 分析先：`データ分析` L:O
- 日付キーでupsertし、重複を作らない
- 前日までの直近3日を再取得
- `///`等は空欄。0へ変換しない
- `管理`に3地点の最新日・総件数、`取得ログ`に取得件数、`データチェック`に異常を記録
- 既存の川辺・湯浅の結果が同一であることを再実行前後で確認

Apps ScriptプロジェクトIDは運用URLから確認し、ローカル固有パスを含む`.clasp.json`はGit管理しません。編集後は`scheduledWeatherUpdate`を手動実行し、管理シートが成功、3地点の最新日が前日、確認事項0、トリガー1件であることを確認します。2026/08/14の手動実行は成功済みです。

## デプロイ

### 表示バージョンの更新

利用者向けバージョンは `src/app/app-version.ts` の `APP_VERSION` で管理します。現在は `2.01` です。次の公開更新は `2.02` のように公開単位で明示的に更新し、`package.json` と `package-lock.json` のバージョンも対応するセマンティックバージョンへ合わせます。

1. 作業ブランチで変更し、必須検証を通す。
2. PRを作成し、`CI / verify`成功を確認する。
3. `main`へマージする。
4. `Deploy Next.js site to Pages`のbuild/deploy成功を確認する。
5. <https://fmatsusaka-tech.github.io/kisho-bot/> を開き、海老名の降水量・気温・積算温度・年比較を確認する。

積算温度の公開確認では、30日画面から積算温度を選ぶと自動的に指定期間へ移り、期間入力が表示されることも確認します。

## 障害時の確認場所

| 症状 | 確認場所 |
|---|---|
| 公開ページが開かない | GitHub Actions Pages workflow、Repository Settings → Pages |
| データ取得エラー | 公開CSVの列名A:O、Spreadsheet共有設定、ブラウザNetwork |
| 過去年が表示されない | 生データ各シートの最古日、`データ分析`、2019年以前プルダウン |
| データが古い | `管理`、`取得ログ`、Apps Scriptの実行履歴とトリガー。3地点の最新日を比較 |
| 値が不自然 | 気象庁原典、`データチェック`、欠測記号、地点番号 |

## 復旧・切り戻し

コードは不具合を含むSquashコミットをRevertするPRで戻します。force pushや`git reset --hard`は使いません。Spreadsheetは変更前の版を版履歴から復元するか、投入前バックアップを使います。コードだけを戻してもSpreadsheet列は消さず、旧公開コードがA:Kを読み続けられることを確認します。

外部設定箇所は、Spreadsheet URL/ID/gid（`weather-data.ts`）、Apps Scriptエディタのトリガー、`.github/workflows/`、GitHub Pages Settingsです。`teiki-chosa-output`側は操作しません。
