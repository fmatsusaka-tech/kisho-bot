# 気象データBot（kisho-bot）

## 目的と利用者

気象庁アメダスの日別データを、まつさか農園の栽培判断に使いやすい形で確認する独立Webアプリです。`teiki-chosa-output`とは別システムであり、同リポジトリや同Spreadsheetを変更しません。

## 主要機能

- 上部ダッシュボードに最新観測日、表示バージョン、湯浅の直近30日間の降水量を表示
- 期間を「直近30日」「指定期間」「今年」から選択
- 降水量、最高・平均・最低気温、基準3/5/8℃の有効積算温度を表示。単独の積算温度は指定期間または今年で集計
- 「全部」で降水量・3種類の気温・積算温度を1グラフに表示
- 今年と指定期間は、同じ月日範囲を過去2年まで比較。指定期間は今年を参照せず、過去年の12月31日まで表示可能
- 2020年以降は年ボタン、2019年以前はプルダウンから比較年を選択
- 降水量地点を湯浅・川辺・海老名から選択
- 気温地点を川辺・海老名から選択（湯浅アメダスは気温観測なし）
- 0.5〜5倍ズーム、横スクロール、固定縦目盛り、別画面表示
- 欠測値を0に変換せず「—」で表示

将来、気象庁ではなくSwitchBotセンサーを使う地点として「旧吉備（屋内）」「旧吉備（屋外）」を追加予定です。現時点では画面にもデータにも追加していません。

## データと完成状況

- 現在の表示バージョン：`2.01`
- 保存先：[Google Spreadsheet「和歌山気象データ」](https://docs.google.com/spreadsheets/d/1o1sgFxmD0UGYHfpIVUZxRaE0NC1yKUFy7qXbZiOyWnA/edit)
- 川辺：平均・最高・最低気温、降水量（1999/03/04以降）
- 湯浅：降水量のみ（1976/01/01以降）
- 海老名：降水量（1976/01/01以降）、平均・最高・最低気温（1978/01/17以降）
- Web画面、期間切替、全指標、年比較、地点切替：実装済み
- 川辺・湯浅・海老名の毎朝更新：Google Apps Scriptで稼働中

全地点の過去取得は `scripts/fetch-jma-history.mjs` で再現できます。日次更新と分割バックフィルは `apps-script/Code.js` でGit管理し、Apps Scriptプロジェクト「気象データ読み込み」へ反映します。

## 起動・検証

Node.js 22を使用します。

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

## 公開

作業ブランチのPRを`main`へマージするとGitHub Actionsが検証・ビルドし、GitHub Pagesへ公開します。

公開URL：<https://fmatsusaka-tech.github.io/kisho-bot/>

運用詳細は [OPERATIONS.md](./OPERATIONS.md)、構成は [SYSTEM_MAP.md](./SYSTEM_MAP.md)、維持条件は [GUARANTEES.md](./GUARANTEES.md) を参照してください。
