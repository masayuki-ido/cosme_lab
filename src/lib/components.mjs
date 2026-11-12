import { esc, yen, url, ICONS } from "./site.mjs";
import { CAT_META, CAT_ORDER, FUNC_ORDER, ICON_OK, ICON_WARN, catVars, ci, metaOf } from "./cat.mjs";
import { norm } from "./norm.mjs";
import { NG_GROUPS } from "./ng.mjs";
import { catCounts, cautionCount, cautionGroups, perMl } from "./data.mjs";
import { productImage } from "./rakuten.mjs";

const TINTS = [["#E6F4F1","#7FB8AF"],["#EAF0F9","#8DA9D0"],["#FBEFF3","#D79AB4"],["#F1ECFA","#A796D3"],["#FBF4E6","#D3B675"],["#EDF5E9","#9CC08C"]];
export function tintOf(p) { let h = 0; for (const ch of p.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return TINTS[h % TINTS.length]; }

export const ingHref = (slugOf, name) => url(`ingredients/${encodeURIComponent(slugOf(norm(name)))}/`);
export const productHref = id => url(`products/${id}/`);

// 商品のサムネイル。楽天の画像があればそれを出し、無ければ legacy と同じ色面のプレースホルダ。
export function thumb(p, rk, { big = false, link = true } = {}) {
  const img = productImage(p, rk, big ? 600 : 300);
  const [bg, fg] = tintOf(p);
  const inner = img
    ? `<img src="${esc(img.src)}" alt="${esc(img.alt)}" width="${big ? 600 : 300}" height="${big ? 600 : 300}" loading="${big ? "eager" : "lazy"}" decoding="async" referrerpolicy="no-referrer-when-downgrade">`
    : `<i></i><em style="background:${fg}"></em>`;
  const style = img ? "background:#fff" : `background:linear-gradient(160deg,${bg} 0%,var(--surface) 100%)`;
  if (!link) return `<span class="thumb" style="${style}">${inner}</span>`;
  return `<a class="thumb" style="${style}" href="${productHref(p.id)}"${img ? "" : ` aria-label="${esc(p.name)}の詳細"`}${big ? ' tabindex="-1"' : ""}>${inner}</a>`;
}

export const kindTag = p => `<span class="kind${p.kind === "医薬部外品" ? " q" : ""}">${esc(p.kind)}</span>`;

// 注意成分タグ。サーバー側では「設定にかかわらず入っている注意成分」を出し、
// 閲覧者のNG設定に合わせた表示は app.js が data-* から作り直す。
export function cautionTag(p) {
  if (!p.ingredients.length) return `<span class="tag">全成分 確認中</span>`;
  const gs = cautionGroups(p);
  return gs.length
    ? `<span class="tag ng">${ICON_WARN}注意成分：${esc(gs.map(g => g.label).join("・"))}</span>`
    : `<span class="tag ok">${ICON_OK}注意成分なし</span>`;
}

export function featureTag(p, catOf) {
  const c = catCounts(p, catOf);
  if (p.kind === "医薬部外品" && p.activeIngredients.length) {
    const k = catOf(p.activeIngredients[0]) || "肌荒れ防止";
    return `<span class="tag cat" style="${catVars(k)}">${metaOf(k)[1]}${esc(p.activeIngredients[0])}</span>`;
  }
  if (c["保湿"]) return `<span class="tag cat" style="${catVars("保湿")}">${CAT_META["保湿"][1]}保湿成分 ${c["保湿"]}種</span>`;
  return "";
}

export const cmpBtn = p => `<button type="button" class="pillbtn" data-cmp="${esc(p.id)}" aria-pressed="false">＋ 比較</button>`;

// 商品カード。data-* は app.js がNG判定と検索に使う。
export function productCard(p, rk, catOf) {
  const cg = cautionGroups(p).map(g => g.key).join(" ");
  const hay = [p.brand, p.maker, p.name, ...p.ingredients, ...p.activeIngredients].join(" ").toLowerCase();
  return `<article class="card pcard" data-pid="${esc(p.id)}" data-caution="${esc(cg)}" data-kind="${esc(p.kind)}" data-has="${p.ingredients.length ? 1 : 0}" data-hay="${esc(hay)}">
  ${thumb(p, rk)}
  <div class="pbody">
    <div class="row">${kindTag(p)}<span class="meta" style="font-size:12px">${esc(p.brand)}</span></div>
    <a class="pname" href="${productHref(p.id)}">${esc(p.name)}</a>
    <div class="row" data-ngslot>${cautionTag(p)}${featureTag(p, catOf)}</div>
    <div class="between"><span class="meta">${rk && rk.price ? yen(rk.price) : yen(p.price)}／${esc(p.size || "")}</span>${cmpBtn(p)}</div>
  </div></article>`;
}

export function condBanner() {
  // 中身は app.js が localStorage の設定から書き換える
  return `<section class="cond"><div><b>あなたの条件で判定中</b><span id="condtext">肌質とNG成分を設定すると、ここで判定します</span></div>
    <a class="pillbtn" href="${url("mypage/")}">条件を変更</a></section>`;
}

// 成分1行
export function ingRow(name, no, { catOf, slugOf, dict, hideCat = false }) {
  const n = norm(name);
  const d = dict[n] || {};
  const cat = catOf(n);
  const cg = NG_GROUPS.filter(g => g.re.test(n)).map(g => g.key).join(" ");
  const lbl = !hideCat && cat ? `<b class="catlbl" style="${catVars(cat)}">${esc(cat)}</b>` : "";
  const desc = (lbl || d.desc) ? `<span class="ds">${lbl}${d.desc ? esc(d.desc) : ""}</span>` : "";
  return `<li><a class="ingbtn wd" data-cg="${esc(cg)}" href="${ingHref(slugOf, n)}">
    <span class="no">${no ?? "◆"}</span>${ci(cat || "その他")}
    <span class="nm"><span class="nmrow">${esc(n)}</span>${desc}</span></a></li>`;
}

// 成分の内訳：配合目的ごとの本数を色付きバーと凡例で見せる（legacy の compBreakdown）
export function breakdown(p, catOf) {
  const c = {};
  for (const n of p.ingredients) { const k = catOf(n) || "その他"; c[k] = (c[k] || 0) + 1; }
  const order = [...CAT_ORDER, ...FUNC_ORDER];
  const keys = order.filter(k => c[k]).concat(Object.keys(c).filter(k => !order.includes(k)));
  const main = keys.filter(k => CAT_ORDER.includes(k) || k === "香料");
  const func = keys.filter(k => !main.includes(k));
  const funcN = func.reduce((a, k) => a + c[k], 0);
  const segs = main.map(k => [k, c[k]]).concat(funcN ? [["基剤・品質保持", funcN]] : []);
  const legi = (k, n) => `<span class="legi" style="${catVars(k)}">${ci(k, "sm")}${esc(k)} <b>${n}</b></span>`;
  const caut = cautionCount(p);
  return `<div class="compbar" role="img" aria-label="${esc(segs.map(s => s[0] + s[1] + "種").join("、"))}">${
    segs.map(([k, n]) => `<span style="flex:${n};${catVars(k === "基剤・品質保持" ? "ベース" : k)}"></span>`).join("")}</div>
  <div class="leg">${main.map(k => legi(k, c[k])).join("")}${caut ? `<span class="legi warn"><span class="ci sm">${ICON_WARN}</span>注意成分 <b>${caut}</b></span>` : ""}</div>
  ${func.length ? `<div class="leg">${func.map(k => legi(k, c[k])).join("")}</div>` : ""}`;
}

// 全成分リスト（表示順／目的別の切り替えは app.js）
export function fullIngList(p, ctx) {
  const seg = `<div class="seg" role="group" aria-label="並べ方"><button type="button" data-ingmode="order" aria-pressed="true">表示順</button><button type="button" data-ingmode="cat" aria-pressed="false">目的別</button></div>`;
  const order = `<ol class="inglist" data-inglist="order">${p.ingredients.map((n, i) => ingRow(n, i + 1, ctx)).join("")}</ol>`;
  const groups = {};
  p.ingredients.forEach((n, i) => { const k = ctx.catOf(n) || "その他"; (groups[k] = groups[k] || []).push([n, i + 1]); });
  const ord = [...CAT_ORDER, ...FUNC_ORDER];
  const keys = ord.filter(k => groups[k]).concat(Object.keys(groups).filter(k => !ord.includes(k)));
  const byCat = `<div data-inglist="cat" hidden>${keys.map(k =>
    `<div class="ggrp"><div class="between"><h3 class="row" style="gap:8px;${catVars(k)};color:var(--cc)">${ci(k, "sm")}${esc(k)}</h3><span class="meta" style="font-size:12px">${groups[k].length}成分</span></div>
     <ol class="inglist">${groups[k].map(([n, i]) => ingRow(n, i, { ...ctx, hideCat: true })).join("")}</ol></div>`).join("")}</div>`;
  return seg + order + byCat;
}

export { perMl, ICONS };
