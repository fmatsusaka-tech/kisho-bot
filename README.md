# kisho-bot

和歌山県の気象庁アメダス観測値を取得・集計し、みかん栽培向けに表示する独立アプリです。

## 対象

- 川辺：日平均・最高・最低気温、日降水量
- 湯浅：日降水量（気温は存在しないため補完しない）
- 15日・30日の平均気温と積算降水量
- 保存先：[和歌山気象データ](https://docs.google.com/spreadsheets/d/1o1sgFxmD0UGYHfpIVUZxRaE0NC1yKUFy7qXbZiOyWnA/edit)

データ取得は毎日6時頃に行い、直近3日を再取得して気象庁による訂正を反映します。欠測値を0へ変換しません。過去データは2015年1月1日以降を整備対象とします。

## 開発

```text
npm install
npm run dev
```

検証は`npm run typecheck`、`npm run lint`、`npm test`、`npm run build`を実行します。
