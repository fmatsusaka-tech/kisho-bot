# 気象データBot（kisho-bot）

## 目的と利用者

和歌山県の気象庁アメダス観測値を、みかん栽培の判断に使いやすい形で確認するための独立Webアプリです。主な利用者は、まつさか農園の栽培・管理担当者です。

`teiki-chosa-output`とは別システムです。このリポジトリからOutput側のコードやSpreadsheetを変更しません。

## 主要機能

- 期間を「直近30日」「指定期間」「今年」から選択
- 湯浅の降水量、川辺の最高・平均・最低気温を表示
- 基準温度3℃・5℃・8℃（初期値5℃）から有効積算温度を計算
- 降水量・気温・積算温度の個別表示と、一枚の複合グラフ表示
- 「今年」と「指定期間」では、同じ月日範囲の過去2年までを色分け比較
- グラフを0.5倍まで縮小・最大5倍まで拡大し、横移動中も縦軸を固定
- 通常画面と別画面の両方で、横移動中の縦目盛りを固定
- 観測データを表で表示し、欠測値は「—」で表示
- 元データと気象庁の出典を表示

## データ

- 川辺：日平均・最高・最低気温、日降水量
- 湯浅：日降水量。存在しない湯浅の気温は補完しない
- 表示元：[Google Spreadsheet「和歌山気象データ」](https://docs.google.com/spreadsheets/d/1o1sgFxmD0UGYHfpIVUZxRaE0NC1yKUFy7qXbZiOyWnA/edit)
- 整備対象：2015年1月1日以降

画面はSpreadsheetの公開CSVをブラウザから読み取ります。現在のリポジトリには、気象庁からデータを取得してSpreadsheetへ保存するバッチ、毎朝6時頃の自動実行、直近3日の再取得処理は実装されていません。これらは要求仕様として残っていますが、現時点で自動更新を保証できません。

## 現在の完成状況

- 公開画面、期間切替、各指標の集計・グラフ・表、年比較、ズーム：実装・公開済み
- CSVの読込・基本検査、集計ロジック：単体テストあり
- 気象庁からの取得、Spreadsheetへの書込み、定時更新：未実装
- 認証：なし。公開CSVと公開Webページを利用

公開URL：<https://fmatsusaka-tech.github.io/kisho-bot/>

## 起動・検証

Node.js 22を使用します。

```text
npm ci
npm run dev
```

ローカルURLは通常 `http://localhost:3000` です。変更後は次をすべて実行します。

```text
npm run typecheck
npm run lint
npm test
npm run build
```

## 公開

`main`へのpushを契機に、GitHub Actionsが検証と静的ビルドを行い、GitHub Pagesへ公開します。開発は作業ブランチとPRを使い、`main`へ直接コミットしません。詳しい運用は [OPERATIONS.md](./OPERATIONS.md) を参照してください。

システム構成は [SYSTEM_MAP.md](./SYSTEM_MAP.md)、維持すべき動作は [GUARANTEES.md](./GUARANTEES.md) に記録しています。
