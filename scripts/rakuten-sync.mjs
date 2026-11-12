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

// 商品名を語に切る。「Ⅱしっとり」は NFKC で "iiしっとり" になるので、英数字とかなの境目でも切る。
function tokenize(name) {
  return String(name).normalize("NFKC").toLowerCase()
    .split(/[\s\u3000・（）()\[\]【】,、。\/\\+＋]+/)
    .flatMap(w => w.match(/[a-z]+|[0-9]+(?:\.[0-9]+)?|[^\sa-z0-9]+/g) || [])
    .filter(Boolean);
}

// 商品名の語が、楽天の商品名に入っているか。
// 「Ⅰ」と「Ⅱ」のように1〜2文字の英数字は、部分一致だと取り違えるので語として一致するか見る。
function tokenHit(tok, itemText, itemTokens) {
  if (/^[a-z0-9.]+$/.test(tok) && tok.length <= 2) return itemTokens.includes(tok);
  return itemText.includes(tok);
}

function scoreItem(p, item) {
  const itemText = norm(item.itemName);
  const itemTokens = tokenize(item.itemName);
  const brand = norm(p.brand);

  // 商品名の語（ブランド名は別で見るので除く）
  const toks = tokenize(p.name).filter(t => t.length >= 1 && !(brand && brand.includes(t) && t.length >= 2));
  let hit = 0, miss = 0;
  for (const t of toks) (tokenHit(t, itemText, itemTokens) ? hit++ : miss++);
  let score = toks.length ? Math.round((hit / toks.length) * 60) : 0;
  score -= miss * 12;                              // 名前の語が欠けているものは大きく下げる

  if (brand && itemText.includes(brand)) score += 20;

  const st = sizeTokens(p.size);
  if (st.length) score += st.some(t => itemText.includes(t)) ? 25 : -20;

  if (p.kind === "医薬部外品" && /薬用|医薬部外品/.test(item.itemName)) score += 5;
  if (BAD.test(item.itemName)) score -= 40;
  const refill = /詰替|つめかえ|詰め替え|レフィル/;
  if (refill.test(item.itemName) !== refill.test(p.name)) score -= 30;

  if (p.price && item.itemPrice) {
    const r = item.itemPrice / p.price;
    if (r < 0.4 || r > 2.5) score -= 25;
    else if (r >= 0.7 && r <= 1.4) score += 10;
  }
  if (!firstImage(item)) score -= 20;
  // ratio は商品名の語がどれだけ揃ったか。ブランド名や容量の加点だけで
  // 別のバリエーション（Ⅰ／Ⅱ／Ⅲ、しっとり／さっぱり など）に当たらないよう、確定の条件に使う。
  return { score, ratio: toks.length ? hit / toks.length : 0, missed: toks.filter(t => !tokenHit(t, itemText, itemTokens)) };
}

function pickBest(p, items) {
  return items.map(it => ({ item: it, ...scoreItem(p, it) })).sort((a, b) => b.score - a.score);
}
// 自動で商品データに書き込んでよいか。点数だけでなく、商品名の語がほぼ揃っていることを条件にする。
const isConfident = s => s && s.score >= MATCH_THRESHOLD && s.ratio >= 0.8;

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
      candidates: r.scored.slice(0, 5).map(s => ({ score: s.score, nameMatch: Math.round(s.ratio * 100) + "%", missing: s.missed, itemCode: s.item.itemCode, itemName: s.item.itemName, price: s.item.itemPrice, shopName: s.item.shopName }))
    };
    if (isConfident(top)) {
      const f = join(ROOT, "data/products", `${p.id}.json`);
      const raw = JSON.parse(readFileSync(f, "utf8"));
      raw.rakutenItemCode = top.item.itemCode;
      saveJson(f, raw);
      applied++;
      console.log(`  ✓ ${p.id} (${top.score}) ${top.item.itemName.slice(0, 40)}`);
    } else {
      review++;
      console.log(`  ? ${p.id} (${top ? `${top.score}点・名前一致${Math.round(top.ratio * 100)}%・不足[${top.missed.join(",")}]` : "候補なし"}) → data/rakuten-candidates.json を確認してください`);
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
