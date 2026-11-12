#!/usr/bin/env node
// dist/ に静的サイトを書き出す。依存パッケージなし。`node scripts/build.mjs`
import { mkdirSync, writeFileSync, rmSync, readFileSync, cpSync } from "node:fs";
import { dirname, join } from "node:path";
import { SITE, abs } from "../src/lib/site.mjs";
import { NG_GROUPS, SKIN_TYPES } from "../src/lib/ng.mjs";
import { norm } from "../src/lib/norm.mjs";
import { ROOT, loadProducts, loadDictionary, loadRakuten, makeCatOf, buildIngredientIndex, catCounts, cautionCount, cautionGroups, perMl } from "../src/lib/data.mjs";
import { indexPage } from "../src/pages/index.mjs";
import { rankingPage } from "../src/pages/ranking.mjs";
import { productPage } from "../src/pages/product.mjs";
import { ingredientIndexPage, ingredientPage } from "../src/pages/ingredient.mjs";
import { comparePage, myPage, aboutPage, notFoundPage } from "../src/pages/static.mjs";

const DIST = join(ROOT, "dist");
let written = 0;
function out(path, content) {
  const f = join(DIST, path);
  mkdirSync(dirname(f), { recursive: true });
  writeFileSync(f, content);
  written++;
}

rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });

const products = loadProducts();
const { entries: dict, updatedAt: dictAt } = loadDictionary();
const { items: rakuten, updatedAt: rkAt } = loadRakuten();
const catOf = makeCatOf(dict);
const index = buildIngredientIndex(products, dict);
const slugOf = n => (index.get(norm(n)) || {}).slug || n;
const ctx = { products, dict, rakuten, catOf, slugOf, index, ingCount: index.size };

// ---- ページ ----
out("index.html", indexPage(ctx));
out("ranking/index.html", rankingPage(ctx));
out("ingredients/index.html", ingredientIndexPage(ctx));
out("compare/index.html", comparePage());
out("mypage/index.html", myPage(ctx));
out("about/index.html", aboutPage(ctx));
out("404.html", notFoundPage());
for (const p of products) out(`products/${p.id}/index.html`, productPage(p, ctx));
for (const e of index.values()) out(`ingredients/${e.slug}/index.html`, ingredientPage(e, ctx));

// ---- アセット ----
out("site.css", readFileSync(join(ROOT, "src/assets/site.css")));
// app.js には NG成分グループと肌質の一覧をビルド時に埋め込む（src/lib/ng.mjs が唯一の定義）
const app = readFileSync(join(ROOT, "src/assets/app.js"), "utf8")
  .replace("/*__NG_GROUPS__*/[]", JSON.stringify(NG_GROUPS.map(g => ({ key: g.key, label: g.label }))))
  .replace("/*__SKIN_TYPES__*/[]", JSON.stringify(SKIN_TYPES));
out("app.js", app);
out("favicon.svg", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#A35A8E"/><path d="M28 10h8v6h-8z" fill="#fff" opacity=".9"/><rect x="22" y="16" width="20" height="38" rx="7" fill="#fff"/><path d="M32 26c3.6 4.3 6 7.6 6 10.4a6 6 0 0 1-12 0c0-2.8 2.4-6.1 6-10.4z" fill="#A35A8E"/></svg>`);
out(".nojekyll", "");

// ---- 比較ページ用のデータ ----
const slugs = {};
for (const [name, e] of index) slugs[name] = e.slug;
out("products.json", JSON.stringify({
  updatedAt: new Date().toISOString(),
  slugs,
  products: products.map(p => {
    const rk = rakuten[p.id];
    const price = (rk && rk.price) || p.price || null;
    return {
      id: p.id, brand: p.brand, name: p.name, kind: p.kind, size: p.size || null, price,
      perMl: perMl({ ...p, price }),
      ing: [...new Set(p.ingredients.map(norm))],
      active: [...new Set(p.activeIngredients.map(norm))],
      caution: cautionGroups(p).map(g => g.key),
      cautionN: cautionCount(p),
      moist: catCounts(p, catOf)["保湿"] || 0
    };
  })
}));

// ---- sitemap / robots ----
const today = new Date().toISOString().slice(0, 10);
const urls = [
  { loc: abs(""), pri: "1.0", freq: "daily" },
  { loc: abs("ranking/"), pri: "0.8", freq: "daily" },
  { loc: abs("ingredients/"), pri: "0.8", freq: "weekly" },
  { loc: abs("about/"), pri: "0.3", freq: "monthly" },
  ...products.map(p => ({ loc: abs(`products/${p.id}/`), pri: "0.9", freq: "daily", lastmod: p.checkedAt || today })),
  ...[...index.values()].map(e => ({ loc: abs(`ingredients/${encodeURIComponent(e.slug)}/`), pri: "0.6", freq: "weekly", lastmod: dictAt || today }))
];
out("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `<url><loc>${u.loc}</loc><lastmod>${u.lastmod || today}</lastmod><changefreq>${u.freq}</changefreq><priority>${u.pri}</priority></url>`).join("\n")}
</urlset>`);
out("robots.txt", `User-agent: *\nAllow: /\nDisallow: ${SITE.base}compare/\nDisallow: ${SITE.base}mypage/\n\nSitemap: ${abs("sitemap.xml")}\n`);

const withImg = products.filter(p => rakuten[p.id] && rakuten[p.id].imageUrl).length;
const withAff = products.filter(p => rakuten[p.id] && rakuten[p.id].affiliateUrl).length;
console.log(`build: ${written} files -> dist/`);
console.log(`  商品 ${products.length} / 成分 ${index.size} / URL ${urls.length}`);
console.log(`  楽天データ: 画像 ${withImg}件・アフィリエイトリンク ${withAff}件${rkAt ? `（取得 ${rkAt}）` : "（未取得）"}`);
console.log(`  公開先: ${abs("")}`);
