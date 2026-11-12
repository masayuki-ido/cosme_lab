import { SITE, esc, page, pageHeader, url, crumbs } from "../lib/site.mjs";
import { NG_GROUPS, SKIN_TYPES } from "../lib/ng.mjs";

export function comparePage() {
  const body = `<h1 class="title" style="font-size:18px">化粧水を比べる</h1>
<p class="meta" style="margin:0">商品ページの「＋ 比較」で選んだ化粧水を、最大3つまで並べて比べられます。価格・1mLあたりの価格・成分数・注意成分・共通する成分と、片方だけに入っている成分がわかります。</p>
<div id="cmparea" class="col" style="gap:12px"><div class="card empty">読み込み中…</div></div>
<p class="note">比較リストはこのブラウザにだけ保存されます。</p>`;
  return page({
    head: { title: `化粧水を比較する - ${SITE.name}`, desc: "選んだ化粧水を最大3つまで並べて、価格・成分数・注意成分・共通する成分を比べられます。", path: "compare/", robots: "noindex,follow" },
    header: pageHeader("比較"), body, tab: "compare"
  });
}

export function myPage(ctx) {
  const body = `<h1 class="title" style="font-size:18px">判定の条件</h1>
<section class="card col" style="gap:10px"><h2>肌質</h2>
  <p class="meta" style="margin:0;font-size:13px">複数選べます。これから口コミ機能を足すときに、同じ肌質の人の評価を出すのに使います。</p>
  <div class="chips" id="skinchips" style="flex-wrap:wrap">${SKIN_TYPES.map(s => `<button type="button" class="chip">${esc(s)}</button>`).join("")}</div></section>
<section class="card col" style="gap:10px"><h2>NG成分</h2>
  <p class="meta" style="margin:0;font-size:13px">選んだ成分が入っている商品に、一覧と商品ページで印をつけます。</p>
  <div class="chips" id="ngchips" style="flex-wrap:wrap">${NG_GROUPS.map(g => `<button type="button" class="chip">${esc(g.label)}</button>`).join("")}</div></section>
<section class="card col" style="gap:6px"><h2>掲載状況</h2>
  <div class="grid2"><div class="stat"><b>${ctx.products.length}</b><span>掲載中の化粧水</span></div><div class="stat"><b>${ctx.ingCount}</b><span>解説のある成分</span></div></div>
  <p class="meta" style="margin:0;font-size:13px">人気の商品から順に追加しています。</p></section>
<p class="note">肌質とNG成分の設定は、このブラウザにだけ保存されます。サーバーには送られません。</p>
<div style="height:72px" aria-hidden="true"></div>
<div class="actionbar"><div><button type="button" class="pillbtn" data-prefs="reset">元に戻す</button><button type="button" class="pillbtn solid" data-prefs="apply">この条件で判定する</button></div></div>`;
  return page({
    head: { title: `判定の条件（肌質・NG成分）- ${SITE.name}`, desc: "肌質と避けたい成分（NG成分）を設定すると、化粧水の一覧と商品ページがあなたの条件で判定されます。", path: "mypage/", robots: "noindex,follow" },
    header: pageHeader("マイページ"), body, tab: "mypage"
  });
}

export function aboutPage(ctx) {
  const bc = crumbs([["ホーム", ""], ["このサイトについて", null]]);
  const body = `${bc.html}
<h1 class="title">このサイトについて</h1>
<div class="card prose">
<h2>何をするサイトか</h2>
<p>${SITE.name}は、化粧水の<strong>全成分</strong>をメーカー公式サイトなどの表示どおりに掲載し、「自分が避けたい成分が入っているか」を確かめられるサイトです。現在、化粧水${ctx.products.length}品・成分${ctx.ingCount}種を掲載しています。</p>

<h2>成分の情報について</h2>
<ul>
<li>全成分は、メーカー公式サイトまたは大手通販サイトの表示をそのまま転記しています。推測で補うことはしません。商品ページの下部に出典と確認日を載せています。</li>
<li>成分の解説は、化粧品に配合されるときの<strong>一般的な配合目的</strong>の説明です。特定の商品の効果・効能を示すものではありません。</li>
<li>医薬部外品の有効成分については、承認された配合目的を記載しています。効果を保証するものではありません。</li>
<li>成分の表示順は商品パッケージの記載順（おおむね配合量の多い順。配合量1%以下の成分は順不同）です。</li>
<li>肌に合うかどうかは人によって異なります。特定の成分が「悪い」という意味ではありません。心配なときは医師や薬剤師にご相談ください。</li>
</ul>

<h2>NG成分の判定について</h2>
<p>マイページで選んだ成分グループが全成分に含まれるかを、成分名のパターンで判定しています。判定に使えるグループは次の${NG_GROUPS.length}種類です。</p>
<p>${NG_GROUPS.map(g => `<span class="tag">${esc(g.label)}</span>`).join(" ")}</p>
<p>肌質とNG成分の設定は、お使いのブラウザのlocalStorageにのみ保存されます。サーバーには送信していません。</p>

<h2>広告・アフィリエイトについて</h2>
<p>当サイトは、楽天アフィリエイトなどのアフィリエイトプログラムに参加しています。商品ページの「購入する」にあるリンクから商品が購入された場合、運営者に<strong>紹介料が支払われることがあります</strong>。該当するリンクの近くには「PR」と表示しています。</p>
<p>紹介料の有無によって、掲載する商品や成分の説明を変えることはしません。掲載順はメーカーや販売店からの依頼ではなく、通販サイトの人気順を参考にしています。</p>
<p>商品画像および商品価格は、楽天ウェブサービス（楽天商品検索API）から取得して表示しています。価格・在庫は取得時点のもので、最新の情報はリンク先でご確認ください。</p>
<p class="meta">Supported by <a href="https://webservice.rakuten.co.jp/" target="_blank" rel="noopener nofollow">Rakuten Developers</a></p>

<h2>価格について</h2>
<p>価格は確認日または楽天市場からの取得時点の参考価格です。実際の販売価格は販売店によって異なります。購入前にリンク先の表示をご確認ください。</p>

<h2>これから足すもの</h2>
<ul>
<li>化粧水の掲載数を増やし、乳液・美容液などにも広げる</li>
<li>使った人の口コミ（同じ肌質の人の評価が見られるように）</li>
</ul>

<h2>お問い合わせ・掲載内容の修正依頼</h2>
<p>掲載内容の誤りに気づかれた場合や、メーカー・権利者の方からの削除・修正のご依頼は、GitHubのIssueからご連絡ください。<br>
<a href="https://github.com/masayuki-ido/cosme_lab/issues" target="_blank" rel="noopener">github.com/masayuki-ido/cosme_lab/issues</a></p>
</div>`;
  return page({
    head: { title: `このサイトについて・広告表記 - ${SITE.name}`, desc: `${SITE.name}の情報の集め方、成分解説の方針、アフィリエイト（広告）についての表記をまとめています。`, path: "about/" },
    header: pageHeader("このサイトについて"), body, tab: "search", jsonLd: [bc.ld]
  });
}

export function notFoundPage() {
  const body = `<div class="card empty"><p>お探しのページは見つかりませんでした。</p><a class="pillbtn solid" href="${url()}">化粧水をさがす</a></div>`;
  return page({
    head: { title: `ページが見つかりません - ${SITE.name}`, desc: "お探しのページは見つかりませんでした。", path: "404.html", robots: "noindex" },
    header: pageHeader("404"), body, tab: "search"
  });
}
