#!/usr/bin/env node
/**
 * 楽天商品検索APIから、商品画像・価格・アフィリエイトリンクを取得する。
 *
 *   node scripts/rakuten-sync.mjs match    商品名＋容量で検索して itemCode を探す（確度が高いものだけ商品データに保存）
 *   node scripts/rakuten-sync.mjs update   itemCode が入っている商品の、価格・画像・リンクを取り直す
 *   node scripts/rakuten-sync.mjs all      match のあと update
 *
 * 必要な環境変数
 *   RAKUTEN_APP_ID        楽天ウェブサービスのアプリID（必須）
 *   RAKUTEN_AFFILIATE_ID  楽天アフィリエイトID（あればアフィリエイトリンクが返る）
 *
 * 画像はダウンロードせず、楽天の画像URLをそのまま data/rakuten.json に保存して表示する（規約順守）。
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { ROOT, loadProducts } from "../src/lib/data.mjs";

const APP_ID = process.env.RAKUTEN_APP_ID || "";
const AFF_ID = process.env.RAKUTEN_AFFILIATE_ID || "";
const API = "https://app.rakuten.co.jp/services/api/IchibaItem/Search/20220601";
const WAIT = Number(process.env.RAKUTEN_WAIT_MS || 1200); // 楽天APIは概ね1秒1リクエストまで
const MATCH_THRESHOLD = Number(process.env.RAKUTEN_MATCH_THRESHOLD || 60);

const RAKUTEN_JSON = join(ROOT, "data/rakuten.json");
const CAND_JSON = join(ROOT, "data/rakuten-candidates.json");

if (!APP_ID) {
  console.error("RAKUTEN_APP_ID がありません。https://webservice.rakuten.co.jp/ でアプリIDを取って、環境変数に入れてください。");
  process.exit(1);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
const norm = s => String(s || "").normalize("NFKC").toLowerCase().replace(/\s+/g, "");

async function callApi(params) {
  const q = new URLSearchParams({ applicationId: APP_ID, format: "json", formatVersion: "2", ...params });
  if (AFF_ID) q.set("affiliateId", AFF_ID);
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(`${API}?${q}`, { headers: { "user-agent": "cosme_lab/1.0 (+https://github.com/masayuki-ido/cosme_lab)" } });
    if (res.status === 429 || res.status >= 500) { await sleep(WAIT * attempt * 2); continue; }
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      // 404 は「該当商品なし」なので候補ゼロとして返す
      if (res.status === 404) return { Items: [] };
      throw new Error(`楽天API ${res.status} ${body && body.error_description || ""}`);
    }
    return body;
  }
  throw new Error("楽天APIが繰り返し失敗しました");
}

// ---------- 候補の採点 ----------
const BAD = /セット|まとめ買い|お得用|詰め合わせ|福袋|訳あり|中古|[2-9]\s*個|[2-9]本セット|選べる/;

function sizeTokens(size) {
  // "150mL" -> ["150ml"] / "360mL" など。容量が書かれていない商品は空。
  const m = /([0-9.]+)\s*(m[lL]|ｍｌ|g|G)/.exec(size || "");
  return m ? [norm(m[1] + (/[gG]/.test(m[2]) ? "g" : "ml"))] : [];
}

function scoreItem(p, item) {
  const name = norm(item.itemName);
  let score = 0;
  // 商品名の語がどれだけ入っているか
  const words = String(p.name).normalize("NFKC").split(/[\s　・（）()]+/).filter(w => w.length >= 2);
  const hit = words.filter(w => name.includes(norm(w))).length;
  score += words.length ? Math.round((hit / words.length) * 50) : 0;
  // ブランド名
  if (norm(p.brand) && name.includes(norm(p.brand))) score += 20;
  // 容量
  const st = sizeTokens(p.size);
  if (st.length) score += st.some(t => name.includes(t)) ? 25 : -15;
  // 区分（医薬部外品は「薬用」と書かれることが多い）
  if (p.kind === "医薬部外品" && /薬用/.test(item.itemName)) score += 5;
  // セット品・詰め替えなどは下げる
  if (BAD.test(item.itemName)) score -= 30;
  if (/詰替|つめかえ|詰め替え|レフィル/.test(item.itemName) && !/詰替|つめかえ|詰め替え|レフィル/.test(p.name)) score -= 25;
  // 価格が離れすぎていないか
  if (p.price && item.itemPrice) {
    const r = item.itemPrice / p.price;
    if (r < 0.4 || r > 2.5) score -= 20;
    else if (r >= 0.7 && r <= 1.4) score += 10;
  }
  if (!firstImage(item)) score -= 20;
  return score;
}

function pickBest(p, items) {
  const scored = items.map(it => ({ item: it, score: scoreItem(p, it) })).sort((a, b) => b.score - a.score);
  return scored;
}

async function searchFor(p) {
  const queries = [
    [p.brand, p.name, p.size].filter(Boolean).join(" "),
    [p.name, p.size].filter(Boolean).join(" "),
    [p.brand, p.name].filter(Boolean).join(" "),
    p.name
  ].filter((q, i, a) => q && a.indexOf(q) === i);
  for (const keyword of queries) {
    const body = await callApi({ keyword, hits: "20", imageFlag: "1", availability: "1", sort: "standard" });
    await sleep(WAIT);
    const items = (body.Items || []).map(x => x.Item || x);
    if (items.length) {
      const scored = pickBest(p, items);
      if (scored[0].score >= 40) return { keyword, scored };
      // 点が低くても最後のクエリなら返す
      if (keyword === queries[queries.length - 1]) return { keyword, scored };
    }
  }
  return { keyword: queries[0], scored: [] };
}

// formatVersion=2 では画像URLは文字列の配列、1 では {imageUrl} の配列。どちらでも取れるようにする。
const firstImage = item => {
  for (const key of ["mediumImageUrls", "smallImageUrls"]) {
    const v = (item[key] || [])[0];
    if (typeof v === "string") return v;
    if (v && v.imageUrl) return v.imageUrl;
  }
  return null;
};

const toRecord = item => ({
  itemCode: item.itemCode,
  itemName: item.itemName,
  shopName: item.shopName || null,
  price: item.itemPrice ?? null,
  imageUrl: firstImage(item),
  itemUrl: item.itemUrl || null,
  affiliateUrl: item.affiliateUrl || item.itemUrl || null,
  fetchedAt: new Date().toISOString()
});

function loadJson(f, d) { return existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : d; }
const saveJson = (f, o) => writeFileSync(f, JSON.stringify(o, null, 2) + "\n");

// ---------- match ----------
async function cmdMatch(products) {
  const cands = loadJson(CAND_JSON, { updatedAt: null, items: {} });
  let applied = 0, review = 0;
  const targets = products.filter(p => !p.rakutenItemCode);
  console.log(`match: ${targets.length}品を検索します（${products.length - targets.length}品は itemCode 済み）`);
  for (const p of targets) {
    let r;
    try { r = await searchFor(p); }
    catch (e) { console.error(`  × ${p.id}: ${e.message}`); continue; }
    const top = r.scored[0];
    cands.items[p.id] = {
      keyword: r.keyword,
      candidates: r.scored.slice(0, 5).map(s => ({ score: s.score, itemCode: s.item.itemCode, itemName: s.item.itemName, price: s.item.itemPrice, shopName: s.item.shopName }))
    };
    if (top && top.score >= MATCH_THRESHOLD) {
      const f = join(ROOT, "data/products", `${p.id}.json`);
      const raw = JSON.parse(readFileSync(f, "utf8"));
      raw.rakutenItemCode = top.item.itemCode;
      saveJson(f, raw);
      applied++;
      console.log(`  ✓ ${p.id} (${top.score}) ${top.item.itemName.slice(0, 40)}`);
    } else {
      review++;
      console.log(`  ? ${p.id} (${top ? top.score : "候補なし"}) → data/rakuten-candidates.json を確認してください`);
    }
  }
  cands.updatedAt = new Date().toISOString();
  saveJson(CAND_JSON, cands);
  console.log(`match: 自動確定 ${applied}件 / 要確認 ${review}件`);
}

// ---------- update ----------
async function cmdUpdate(products) {
  const store = loadJson(RAKUTEN_JSON, { updatedAt: null, items: {} });
  const targets = products.filter(p => p.rakutenItemCode);
  console.log(`update: ${targets.length}品の価格・画像を取り直します`);
  let ok = 0, miss = 0;
  for (const p of targets) {
    try {
      const body = await callApi({ itemCode: p.rakutenItemCode, hits: "1" });
      await sleep(WAIT);
      const items = (body.Items || []).map(x => x.Item || x);
      if (!items.length) { miss++; console.log(`  - ${p.id}: 見つかりません（itemCode が無効かもしれません）`); continue; }
      store.items[p.id] = toRecord(items[0]);
      ok++;
    } catch (e) {
      miss++;
      console.error(`  × ${p.id}: ${e.message}`);
    }
  }
  // itemCode が外れた商品は古い情報を残さない
  for (const id of Object.keys(store.items)) {
    if (!targets.some(p => p.id === id)) delete store.items[id];
  }
  store.updatedAt = new Date().toISOString();
  saveJson(RAKUTEN_JSON, store);
  console.log(`update: 成功 ${ok}件 / 失敗 ${miss}件 → data/rakuten.json`);
  if (!AFF_ID) console.log("※ RAKUTEN_AFFILIATE_ID が未設定のため、アフィリエイトリンクではなく通常の商品URLが入ります。");
}

const mode = process.argv[2] || "all";
const products = loadProducts();
if (mode === "match" || mode === "all") await cmdMatch(products);
if (mode === "update" || mode === "all") await cmdUpdate(loadProducts());
if (!["match", "update", "all"].includes(mode)) {
  console.error("使い方: node scripts/rakuten-sync.mjs [match|update|all]");
  process.exit(1);
}
