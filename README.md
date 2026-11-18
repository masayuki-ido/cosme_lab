# コスメ研究所

化粧水の全成分をメーカー公式の表示どおりに掲載し、「自分のNG成分が入っているか」を判定するサイト。

- 公開URL: https://masayuki-ido.github.io/cosme_lab/
- 掲載数: 化粧水78品・成分695語（`data/` が元データ）

## 作り

依存パッケージなし。`data/` のJSONを読んで `dist/` に静的HTMLを書き出すだけ。

```
data/products/<id>.json   商品1件（全成分・有効成分・価格・出典など。手で直す）
data/dictionary.json      成分の解説と配合目的（正規化した成分名がキー）
data/rakuten.json         楽天APIで取った画像・価格・リンク（Actionsが毎日書き換える）
data/yahoo.json           Yahoo!ショッピングAPIで取った同上
src/lib/                  正規化・NG判定・配合目的のアイコン・レイアウト
src/pages/                ページごとのHTML組み立て
src/assets/site.css       デザイン（legacy/index.html から移植）
src/assets/app.js         閲覧者ごとに変わるところ（NG設定・検索・比較）
scripts/build.mjs         ビルド
src/lib/match.mjs         商品データと通販サイトの検索結果の突き合わせ（採点はここだけ）
src/lib/shops.mjs         画像・価格・購入リンクの組み立て（楽天／Yahoo!共通）
scripts/rakuten-sync.mjs  楽天APIから取得
scripts/yahoo-sync.mjs    Yahoo!ショッピングAPIから取得
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

## 商品画像・価格・購入リンク

楽天市場とYahoo!ショッピングの商品検索APIから取る。画像はダウンロードせず、
各サイトの画像URLをそのまま表示して、そのサイトの商品ページへリンクする。
両方で商品が確定している場合は楽天を優先する。

```sh
# 楽天（アプリIDは https://webservice.rakuten.co.jp/ ／ アフィリエイトIDは楽天アフィリエイト）
export RAKUTEN_APP_ID=... RAKUTEN_AFFILIATE_ID=...
npm run rakuten:match    # 商品名＋容量で検索し、確度が高いものだけ rakutenItemCode を商品JSONに保存
npm run rakuten:update   # 価格・画像・リンクを取り直して data/rakuten.json に保存

# Yahoo!ショッピング（Client IDは https://e.developer.yahoo.co.jp/register ／ アフィリエイトはバリューコマース）
export YAHOO_APP_ID=... VALUECOMMERCE_SID=... VALUECOMMERCE_PID=...
npm run yahoo:match      # 確度が高いものだけ yahooItemCode / yahooSellerId を商品JSONに保存
npm run yahoo:update     # 価格・画像・リンクを取り直して data/yahoo.json に保存
```

照合の規則は `src/lib/match.mjs` に1つだけ置いて、両サイトで共通にしている。
商品名の語が8割そろわないと自動確定しないので、Ⅰ/Ⅱ/Ⅲ や詰め替え・セット品には当たらない。
確度が足りなかったものは `data/<サイト>-candidates.json` に候補が残るので、
正しいコードを選んで商品JSONに手で入れる。

GitHub Actions `通販サイトの画像・価格を更新` が毎日6時(JST)に `update` を実行し、
差分があればコミットしてサイトを公開し直す。アプリIDが未設定のサイトはスキップされる。

### 守ること

- Yahoo!のAPIを使っている間は、全ページのフッターに
  「Webサービス by Yahoo! JAPAN」のクレジット表示を出す（規約で必須、`src/lib/shops.mjs`）。
  HTMLは指定されたものをそのまま使い、色やサイズを変えない。
- Yahoo!デベロッパーネットワークは原則として非商用利用。アフィリエイト（バリューコマース経由）
  によるマネタイズはショッピングAPIで公式に提供されているので、Yahoo!を使うなら
  バリューコマース経由のアフィリエイトとセットで使う。
- 画像は自分のサーバーに保存せず、必ず取得元の画像URLをそのまま表示する。

### リポジトリに入れる値

Settings → Secrets and variables → Actions

| 種類 | 名前 | 用途 |
|---|---|---|
| Secret | `RAKUTEN_APP_ID` | 楽天APIの呼び出し |
| Secret | `RAKUTEN_AFFILIATE_ID` | 楽天のアフィリエイトリンク |
| Secret | `YAHOO_APP_ID` | Yahoo!ショッピングAPIの呼び出し |
| Secret | `VALUECOMMERCE_SID` / `VALUECOMMERCE_PID` | Yahoo!のアフィリエイトリンク（両方必要） |
| Secret | `AMAZON_TAG` | Amazonアソシエイト承認後 |
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
