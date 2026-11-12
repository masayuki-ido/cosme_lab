import { SITE, esc, yen, page, pageHeader, url, abs, crumbs, fullName, ICONS } from "../lib/site.mjs";
import { CAT_ORDER, ICON_WARN, catVars, metaOf } from "../lib/cat.mjs";
import { norm } from "../lib/norm.mjs";
import { catCounts, cautionCount, cautionGroups, perMl } from "../lib/data.mjs";
import { breakdown, cmpBtn, fullIngList, ingHref, kindTag, productCard, thumb } from "../lib/components.mjs";
import { buyLinksHtml, productImage } from "../lib/rakuten.mjs";

export function productPage(p, ctx) {
  const { rakuten, catOf, slugOf, dict, products } = ctx;
  const rk = rakuten[p.id];
  const has = p.ingredients.length > 0;
  const cg = cautionGroups(p);
  const counts = catCounts(p, catOf);
  const price = (rk && rk.price) || p.price;
  const img = productImage(p, rk, 600);

  const bc = crumbs([["ホーム", ""], [p.brand, null], [`${p.name}の全成分`, null]]);

  // 同じブランドの他の商品／同じ有効成分の商品
  const sameBrand = products.filter(x => x.id !== p.id && x.brand === p.brand).slice(0, 4);
  const actives = p.activeIngredients.map(norm);
  const sameActive = actives.length
    ? products.filter(x => x.id !== p.id && x.activeIngredients.map(norm).some(n => actives.includes(n))).slice(0, 4)
    : [];

  const activeBlock = p.activeIngredients.length ? `<div class="field"><span class="meta" style="font-size:12px">有効成分${p.kind === "医薬部外品" ? "（医薬部外品）" : ""}</span>
    <div class="row">${p.activeIngredients.map(n => { const k = catOf(n) || "肌荒れ防止";
      return `<a class="tag cat" style="min-height:32px;${catVars(k)}" href="${ingHref(slugOf, n)}">${metaOf(k)[1]}${esc(n)}</a>`; }).join("")}</div></div>` : "";

  const body = `${bc.html}
<section class="hero">
  ${thumb(p, rk, { big: true, link: false })}
  <div class="herobody">
    <div class="row">${kindTag(p)}<span class="meta">${esc(p.brand)}${p.maker && p.maker !== p.brand ? "（" + esc(p.maker) + "）" : ""}</span></div>
    <h1 class="title">${esc(p.name)}</h1>
    <div class="between"><span>${yen(price)} <span class="meta">／ ${esc(p.size || "")}${perMl({ ...p, price }) ? `（1mLあたり約${perMl({ ...p, price })}円）` : ""}</span></span>${cmpBtn(p)}</div>
    ${rk && rk.price ? `<p class="meta" style="margin:0;font-size:11px">価格は楽天市場（${esc(rk.shopName || "出店ショップ")}）の${esc((rk.fetchedAt || "").slice(0, 10))}時点の表示です。</p>` : ""}
  </div>
</section>
${img ? `<p class="imgcredit">画像：楽天市場</p>` : ""}

${has ? `<section class="verdict neutral" id="verdict" data-caution="${esc(cg.map(g => g.key).join(" "))}">
  <b class="vh">${cg.length ? ICON_WARN + "注意成分が入っています" : "注意成分は入っていません"}</b>
  <p>${cg.length ? "この化粧水に含まれる注意成分：" + esc(cg.map(g => g.label).join("、")) + "。マイページでNG成分を設定すると、あなたの条件で判定します。"
    : "エタノール・香料・パラベン・フェノキシエタノール・合成着色料・鉱物油・シリコーン・PGは、全成分に見当たりません。"}</p></section>`
  : `<section class="card"><b>全成分を確認中です</b><p class="meta" style="margin:4px 0 0">${esc(p.note || "公式の全成分表示を確認でき次第、掲載します。")}</p></section>`}

<section class="card col" style="gap:10px">
  <div class="row"><h2>購入する</h2><span class="pr">PR</span></div>
  <div class="buylinks">${buyLinksHtml(p, rk)}</div>
  <p class="meta" style="margin:0;font-size:11px;line-height:1.6">リンク先で購入されると、運営者に紹介料が入ることがあります。価格・在庫はリンク先でご確認ください。</p>
</section>

${p.claims.length ? `<section class="card col" style="gap:8px"><h2>メーカーが紹介している特徴</h2>
  <div class="row">${p.claims.map(x => `<span class="tag">${esc(x)}</span>`).join("")}</div>
  <p class="meta" style="margin:0;font-size:11px">メーカーの商品ページに書かれている説明をそのまま引用しています。</p></section>` : ""}

${has ? `<section class="card col" style="gap:10px">
  <div class="between"><h2>成分の内訳</h2><span class="meta">全${p.ingredients.length}成分</span></div>
  ${activeBlock}
  ${breakdown(p, catOf)}
  <div class="grid2">
    <div class="stat"><b>${p.ingredients.length}</b><span>成分数</span></div>
    <div class="stat"><b>${counts["保湿"] || 0}</b><span>保湿目的の成分</span></div>
    <div class="stat"><b>${cautionCount(p)}</b><span>注意成分</span></div>
    <div class="stat"><b>${CAT_ORDER.filter(k => counts[k]).length}</b><span>肌へのはたらきの種類</span></div>
  </div>
</section>

<section class="card col" style="gap:12px">
  <h2>${p.activeIngredients.length ? "その他の成分" : "全成分"}（${p.ingredients.length}）</h2>
  ${fullIngList(p, { catOf, slugOf, dict })}
  <p class="meta" style="margin:0;font-size:12px">表示順はパッケージの記載順（おおむね配合量の多い順、1%以下は順不同）です。成分名を押すと、その成分の配合目的と、含む化粧水を見られます。</p>
</section>` : ""}

${sameActive.length ? `<section class="col" style="gap:12px"><h2>同じ有効成分の化粧水</h2>
  <div class="plist">${sameActive.map(x => productCard(x, rakuten[x.id], catOf)).join("")}</div></section>` : ""}
${sameBrand.length ? `<section class="col" style="gap:12px"><h2>${esc(p.brand)}の他の化粧水</h2>
  <div class="plist">${sameBrand.map(x => productCard(x, rakuten[x.id], catOf)).join("")}</div></section>` : ""}

<p class="note">出典：${p.sourceUrl ? `<a href="${esc(p.sourceUrl)}" target="_blank" rel="noopener nofollow">メーカー等の商品ページ ${ICONS.ext}</a>` : "確認中"}　確認日：${esc(p.checkedAt || "")}${p.note ? `<br>${esc(p.note)}` : ""}
<br>全成分はメーカー公式などの表示を転記したものです。成分の解説は一般的な配合目的の説明で、この商品の効果・効能を示すものではありません。</p>`;

  // SEO
  const cautionTxt = cg.length ? `注意成分は${cg.map(g => g.label).join("・")}。` : "エタノール・香料・パラベンなどの注意成分は入っていません。";
  const activeTxt = p.activeIngredients.length ? `有効成分は${p.activeIngredients.join("・")}。` : "";
  const nm = fullName(p);
  const spec = [p.kind, p.size].filter(Boolean).join("・");
  const desc = has
    ? `${nm}（${spec}）の全成分${p.ingredients.length}種を表示順に掲載。${activeTxt}${cautionTxt}配合目的ごとの内訳も確認できます。`
    : `${nm}（${spec}）の情報。全成分は確認中です。`;

  const ldProduct = {
    "@context": "https://schema.org", "@type": "Product",
    name: fullName(p),
    brand: { "@type": "Brand", name: p.brand },
    ...(p.maker ? { manufacturer: { "@type": "Organization", name: p.maker } } : {}),
    ...(img ? { image: [img.src] } : {}),
    description: desc,
    url: abs(`products/${p.id}/`),
    ...(p.size ? { size: p.size } : {}),
    ...(has ? { additionalProperty: [{ "@type": "PropertyValue", name: "全成分", value: p.ingredients.join("、") }] } : {}),
    ...(rk && rk.price && rk.affiliateUrl ? {
      offers: { "@type": "Offer", price: rk.price, priceCurrency: "JPY", url: rk.affiliateUrl, availability: "https://schema.org/InStock", seller: { "@type": "Organization", name: "楽天市場" } }
    } : {})
  };

  return page({
    head: {
      title: `${fullName(p)}の全成分｜${p.kind}${p.size ? "・" + p.size : ""} - ${SITE.name}`,
      desc, path: `products/${p.id}/`, ogType: "article", ogImage: img ? img.src : null
    },
    header: pageHeader("商品詳細"), body, tab: "search",
    jsonLd: [ldProduct, bc.ld]
  });
}
