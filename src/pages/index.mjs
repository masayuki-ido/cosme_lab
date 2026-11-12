import { SITE, esc, page, searchHeader, url, abs, fullName } from "../lib/site.mjs";
import { condBanner, productCard } from "../lib/components.mjs";

export function indexPage(ctx) {
  const { products, rakuten, catOf, ingCount } = ctx;
  const chips = [["all", "すべて"], ["ok", "NG成分なし"], ["cos", "化粧品"], ["quasi", "医薬部外品"]]
    .map(([k, l]) => `<button type="button" class="chip" data-filter="${k}" aria-pressed="${k === "all"}">${l}</button>`).join("");

  const body = `${condBanner()}
<h1 class="title" style="font-size:18px">化粧水の全成分から、自分に合うものをさがす</h1>
<p class="meta" style="margin:0">${products.length}品の化粧水の全成分を、メーカー公式などの表示どおりに掲載しています。エタノール・香料・パラベンなど、避けたい成分を設定すると、入っているかどうかを一覧で判定します。</p>
<div class="chips">${chips}</div>
<div class="meta" id="listcount">化粧水 ${products.length}件</div>
<div class="plist" id="plist">${products.map(p => productCard(p, rakuten[p.id], catOf)).join("")}</div>
<div class="card empty" id="listempty" hidden>条件に合う化粧水はありません</div>
<section class="card col" style="gap:8px">
  <h2>成分から調べる</h2>
  <p class="meta" style="margin:0">掲載中の成分は${ingCount}種。成分ごとに配合目的と、その成分が入っている化粧水を見られます。</p>
  <a class="pillbtn" href="${url("ingredients/")}">成分一覧を見る</a>
</section>
<p class="note">価格は確認日時点の参考価格です。全成分はメーカー公式などの表示を転記しています。購入前に商品パッケージの表示もご確認ください。</p>`;

  const ld = [
    { "@context": "https://schema.org", "@type": "WebSite", name: SITE.name, url: abs(""), description: SITE.desc,
      potentialAction: { "@type": "SearchAction", target: { "@type": "EntryPoint", urlTemplate: abs("") + "?q={search_term_string}" }, "query-input": "required name=search_term_string" } },
    { "@context": "https://schema.org", "@type": "ItemList", name: "掲載中の化粧水",
      numberOfItems: products.length,
      itemListElement: products.slice(0, 30).map((p, i) => ({ "@type": "ListItem", position: i + 1, url: abs(`products/${p.id}/`), name: fullName(p) })) }
  ];
  return page({
    head: { title: `${SITE.name}｜化粧水の全成分とNG成分チェック`, desc: SITE.desc + `現在${products.length}品・${ingCount}成分を掲載。`, path: "" },
    header: searchHeader(""), body, tab: "search", jsonLd: ld
  });
}
