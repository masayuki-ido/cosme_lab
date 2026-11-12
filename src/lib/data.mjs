import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { norm } from "./norm.mjs";
import { NG_GROUPS } from "./ng.mjs";
import { buildSlugMap } from "./slug.mjs";

export const ROOT = new URL("../../", import.meta.url).pathname;
const DATA = join(ROOT, "data");

export function loadDictionary() {
  const d = JSON.parse(readFileSync(join(DATA, "dictionary.json"), "utf8"));
  return { entries: d.entries || {}, updatedAt: d.updatedAt || null };
}

// data/rakuten.json：楽天APIで取得した画像・価格・アフィリエイトリンク（毎日の Actions が書き換える）
export function loadRakuten() {
  const f = join(DATA, "rakuten.json");
  if (!existsSync(f)) return { updatedAt: null, items: {} };
  const d = JSON.parse(readFileSync(f, "utf8"));
  return { updatedAt: d.updatedAt || null, items: d.items || {} };
}

export function loadProducts() {
  const dir = join(DATA, "products");
  return readdirSync(dir)
    .filter(f => f.endsWith(".json"))
    .map(f => {
      const p = JSON.parse(readFileSync(join(dir, f), "utf8"));
      p.id = p.id || f.replace(/\.json$/, "");
      p.ingredients = p.ingredients || [];
      p.activeIngredients = p.activeIngredients || [];
      p.claims = p.claims || [];
      return p;
    })
    .sort((a, b) => (a.popularRank || 999) - (b.popularRank || 999) || a.id.localeCompare(b.id));
}

// ---------- 成分の判定 ----------

export function makeCatOf(dict) {
  const fragrance = NG_GROUPS.find(g => g.key === "fragrance");
  return function catOf(raw) {
    const name = norm(raw);
    const d = dict[name];
    if (d && d.cat) return d.cat;
    if (fragrance.re.test(name)) return "香料";
    if (/パラベン|フェノキシエタノール|安息香酸Na|ソルビン酸/.test(name)) return "防腐";
    if (/^(水|精製水|BG|DPG|グリセリン|濃グリセリン|ペンチレングリコール)$/.test(name)) return "ベース";
    return null;
  };
}

// その商品に入っている注意成分（NGグループに当たる成分）を、グループ単位でまとめる
export function cautionGroups(p) {
  const all = [...p.ingredients, ...p.activeIngredients].map(norm);
  return NG_GROUPS.filter(g => all.some(n => g.re.test(n)));
}
// 注意成分の「本数」（legacy の cautionCount と同じで、全成分のみを数える）
export function cautionCount(p) {
  return p.ingredients.filter(n => NG_GROUPS.some(g => g.re.test(norm(n)))).length;
}
export function catCounts(p, catOf) {
  const c = {};
  for (const n of p.ingredients) { const k = catOf(n); if (k) c[k] = (c[k] || 0) + 1; }
  return c;
}
export function perMl(p) {
  const m = /([0-9.]+)\s*m[lL]/.exec(p.size || "");
  return (m && p.price) ? Math.round(p.price / parseFloat(m[1]) * 10) / 10 : null;
}
export function ingNamesOf(p) {
  return [...new Set([...p.activeIngredients, ...p.ingredients].map(norm))];
}

// ---------- 成分の索引 ----------
export function buildIngredientIndex(products, dict) {
  const map = new Map(); // 正規化名 -> { name, products:[id], count, active:[id] }
  for (const p of products) {
    for (const n of new Set(p.ingredients.map(norm))) {
      if (!map.has(n)) map.set(n, { name: n, products: [], active: [] });
      map.get(n).products.push(p.id);
    }
    for (const n of new Set(p.activeIngredients.map(norm))) {
      if (!map.has(n)) map.set(n, { name: n, products: [], active: [] });
      const e = map.get(n);
      e.active.push(p.id);
      if (!e.products.includes(p.id)) e.products.push(p.id);
    }
  }
  const { toSlug } = buildSlugMap([...map.keys()]);
  for (const [name, e] of map) {
    e.slug = toSlug.get(name);
    e.count = e.products.length;
    e.desc = (dict[name] || {}).desc || null;
    e.cat = (dict[name] || {}).cat || null;
  }
  return map;
}
