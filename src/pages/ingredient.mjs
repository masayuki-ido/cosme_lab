import { SITE, esc, page, pageHeader, url, abs, crumbs } from "../lib/site.mjs";
import { ICON_WARN, catVars, ci } from "../lib/cat.mjs";
import { NG_GROUPS } from "../lib/ng.mjs";
import { productCard, ingHref } from "../lib/components.mjs";

// 成分一覧（索引）
export function ingredientIndexPage(ctx) {
  const { index, catOf, products } = ctx;
  const list = [...index.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "ja"));
  const body = `${crumbs([["ホーム", ""], ["成分一覧", null]]).html}
<h1 class="title" style="font-size:18px">化粧水の成分一覧（${list.length}種）</h1>
<p class="meta" style="margin:0">掲載中の化粧水${products.length}品に入っている成分を、配合商品数の多い順に並べました。成分名を押すと、一般的な配合目的と、その成分を含む化粧水が見られます。</p>
<label class="searchbox">${""}<input id="q" type="search" aria-label="成分を検索" placeholder="セラミド、グリセリン、トラネキサム酸…" autocomplete="off"></label>
<div class="meta" id="listcount">成分 ${list.length}種</div>
<section class="card"><ul class="inglist" id="inglist">${list.map(e => {
  const cg = NG_GROUPS.filter(g => g.re.test(e.name)).map(g => g.key).join(" ");
  const cat = catOf(e.name);
  return `<li data-name="${esc(e.name)}"><a class="ingbtn" data-cg="${esc(cg)}" href="${url(`ingredients/${encodeURIComponent(e.slug)}/`)}">
    ${ci(cat || "その他", "sm")}<span class="nm"><span class="nmrow">${esc(e.name)}</span>${cat ? `<span class="ds"><b class="catlbl" style="${catVars(cat)}">${esc(cat)}</b>${e.desc ? esc(e.desc) : ""}</span>` : ""}</span>
    <span class="meta" style="font-size:12px;flex:none">${e.count}商品</span></a></li>`;
}).join("")}</ul></section>
<p class="note">成分の解説は一般的な配合目的をまとめたもので、効果・効能を保証するものではありません。</p>`;
  const bc = crumbs([["ホーム", ""], ["成分一覧", null]]);
  return page({
    head: { title: `化粧水の成分一覧${list.length}種｜配合目的から調べる - ${SITE.name}`,
      desc: `化粧水に入っている成分${list.length}種を、配合商品数の多い順に一覧化。保湿・美白・肌荒れ防止など一般的な配合目的と、その成分を含む化粧水を確認できます。`, path: "ingredients/" },
    header: pageHeader("成分一覧"), body, tab: "ingredients", jsonLd: [bc.ld]
  });
}

// 成分1件のページ
export function ingredientPage(e, ctx) {
  const { products, rakuten, catOf, dict } = ctx;
  const d = dict[e.name] || {};
  const cat = catOf(e.name);
  const groups = NG_GROUPS.filter(g => g.re.test(e.name));
  const inP = e.products.map(id => products.find(p => p.id === id)).filter(Boolean);
  const asActive = e.active.map(id => products.find(p => p.id === id)).filter(Boolean);
  const bc = crumbs([["ホーム", ""], ["成分一覧", "ingredients/"], [e.name, null]]);

  const body = `${bc.html}
<section class="card col" style="gap:8px">
  <div class="row" style="gap:12px;flex-wrap:nowrap">${ci(cat || "その他", "lg")}<h1 class="title" style="min-width:0;overflow-wrap:anywhere">${esc(e.name)}</h1></div>
  <div class="row">${cat ? `<span class="tag cat" style="${catVars(cat)}">${esc(cat)}</span>` : ""}
    ${groups.map(g => `<span class="tag ng">${ICON_WARN}${esc(g.label)}に該当</span>`).join("")}
    <span class="tag">配合 ${e.count}商品</span>${asActive.length ? `<span class="tag">有効成分として ${asActive.length}商品</span>` : ""}</div>
  <p style="margin:0">${d.desc ? esc(d.desc) : '<span class="meta">この成分の解説は準備中です。</span>'}</p>
  ${groups.length ? `<p class="meta" style="margin:0;font-size:13px">「${esc(groups.map(g => g.label).join("・"))}」は、肌に合わないと感じる人が避けることのある成分です。マイページでNG成分に設定すると、含む商品に印が付きます。</p>` : ""}
</section>
${asActive.length ? `<section class="col" style="gap:12px"><h2>${esc(e.name)}を有効成分として配合（${asActive.length}）</h2>
  <div class="plist">${asActive.map(p => productCard(p, rakuten[p.id], catOf)).join("")}</div></section>` : ""}
<section class="col" style="gap:12px"><h2>${esc(e.name)}を含む化粧水（${inP.length}）</h2>
  <div class="plist">${inP.map(p => productCard(p, rakuten[p.id], catOf)).join("")}</div></section>
<p class="note">成分の解説は一般的な配合目的をまとめたもので、効果・効能を保証するものではありません。医薬部外品の有効成分についての記述は、承認された目的を示すもので、効果を保証するものではありません。</p>`;

  const desc = `${e.name}は${cat ? `化粧水で主に${cat}の目的で配合される成分です。` : "化粧水に配合される成分です。"}${d.desc ? d.desc : ""}掲載中の化粧水${e.count}品に入っています。`;
  const ld = { "@context": "https://schema.org", "@type": "DefinedTerm", name: e.name,
    description: d.desc || desc, url: abs(`ingredients/${encodeURIComponent(e.slug)}/`),
    inDefinedTermSet: { "@type": "DefinedTermSet", name: `${SITE.name} 化粧品成分辞典`, url: abs("ingredients/") } };
  return page({
    head: { title: `${e.name}とは｜配合目的と配合されている化粧水${e.count}品 - ${SITE.name}`, desc: desc.slice(0, 160), path: `ingredients/${encodeURIComponent(e.slug)}/` },
    header: pageHeader("成分詳細", "ingredients/"), body, tab: "ingredients", jsonLd: [ld, bc.ld]
  });
}
