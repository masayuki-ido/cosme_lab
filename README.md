# コスメ研究所

化粧水の全成分をメーカー公式の表示どおりに掲載し、「自分のNG成分が入っているか」を判定するサイト。

- 公開URL: https://masayuki-ido.github.io/cosme_lab/
- 掲載数: 化粧水78品・成分695語（`data/` が元データ）

## 作り

依存パッケージなし。`data/` のJSONを読んで `dist/` に静的HTMLを書き出すだけ。

```
data/products/<id>.json   商品1件（全成分・有効成分・価格・出典など。手で直す）
data/dictionary.json      成分の解説と配合目的（正規化した成分名がキー）
data/rakuten.json         楽天APIで取った画像・価格・アフィリエイトリンク（Actionsが毎日書き換える）
src/lib/                  正規化・NG判定・配合目的のアイコン・レイアウト
src/pages/                ページごとのHTML組み立て
src/assets/site.css       デザイン（legacy/index.html から移植）
src/assets/app.js         閲覧者ごとに変わるところ（NG設定・検索・比較）
scripts/build.mjs         ビルド
scripts/rakuten-sync.mjs  楽天APIから画像・価格・リンクを取得
scripts/serve.mjs         確認用のローカルサーバー
legacy/index.html         移行前の1ファイル版（デザインの原本）
```

生成されるURL:

| URL | 中身 |
|---|---|
| `/` | 化粧水一覧（検索・絞り込み） |
| `/ranking/` | 人気順ランキング |
| `/products/<id>/` | 商品ごとの全成分ページ |
| `/ingredients/` | 成分一覧（695種） |
| `/ingredients/<成分名>/` | 成分ごとの配合目的と、含む化粧水 |
| `/compare/`, `/mypage/` | 比較・条件設定（noindex、localStorageのみ） |
| `/about/` | 運営方針・広告表記 |
| `/sitemap.xml`, `/robots.txt` | - |

## 動かす

```sh
npm run build     # dist/ に書き出す
npm run dev       # ビルドして http://localhost:4321/cosme_lab/ で確認
```

## 楽天の画像・価格・アフィリエイトリンク

画像はダウンロードせず、楽天の画像URLをそのまま表示して楽天の商品ページへリンクする（規約順守）。

```sh
export RAKUTEN_APP_ID=...        # https://webservice.rakuten.co.jp/ のアプリID
export RAKUTEN_AFFILIATE_ID=...  # https://affiliate.rakuten.co.jp/ のアフィリエイトID

npm run rakuten:match   # 商品名＋容量で検索し、確度が高いものだけ itemCode を data/products/<id>.json に保存
npm run rakuten:update  # itemCode のある商品の価格・画像・リンクを取り直して data/rakuten.json に保存
```

`match` で確度が足りなかったものは `data/rakuten-candidates.json` に候補が残るので、
正しい `itemCode` を選んで商品JSONの `rakutenItemCode` に手で入れる。

GitHub Actions `楽天の画像・価格を更新` が毎日6時(JST)に `update` を実行し、
差分があればコミットしてサイトを公開し直す。

### リポジトリに入れる値

Settings → Secrets and variables → Actions

| 種類 | 名前 | 用途 |
|---|---|---|
| Secret | `RAKUTEN_APP_ID` | 楽天APIの呼び出し（必須） |
| Secret | `RAKUTEN_AFFILIATE_ID` | アフィリエイトリンクの発行 |
| Secret | `AMAZON_TAG` | Amazonアソシエイト承認後 |
| Secret | `YAHOO_VC_SID` / `YAHOO_VC_PID` | バリューコマース利用時 |
| Variable | `SITE_ORIGIN` / `SITE_BASE` | 独自ドメインに移すとき（例 `https://example.com` と `/`） |

## 決めごと

- 全成分は推測で埋めない。メーカー公式か大手通販の表示どおりに転記し、出典と確認日を商品ページに出す。
- 成分の解説は一般的な配合目的だけを書き、効果効能を断定しない（薬機法）。
- 医薬部外品の有効成分は「医薬部外品の有効成分として〜を防ぐ目的で配合される」の形にする。
- 購入リンクの近くに「PR」表記と、紹介料が入ることの説明を出す（ステマ規制対応）。

## これから

- Amazonアソシエイト承認後に商品情報API(PA-API)を追加し、規定の文言も入れる
- 口コミ機能（Supabaseなど）
- 乳液・美容液への拡大
