#!/usr/bin/env node
/**
 * Yahoo!ショッピング商品検索API(v3)から、商品画像・価格・商品リンクを取得する。
 *
 *   node scripts/yahoo-sync.mjs match    商品名＋容量で検索して商品コードを探す（確度が高いものだけ商品データに保存）
 *   node scripts/yahoo-sync.mjs update   商品コードが入っている商品の、価格・画像・リンクを取り直す
 *   node scripts/yahoo-sync.mjs all      match のあと update
 *
 * 必要な環境変数
 *   YAHOO_APP_ID       Yahoo!デベロッパーネットワークの Client ID（必須）
 *                      https://e.developer.yahoo.co.jp/register
 *   VALUECOMMERCE_SID  バリューコマースのサイトID（sid）
 *   VALUECOMMERCE_PID  バリューコマースのプログラムID（pid）
 *                      両方そろうと、APIが返す商品URLがアフィリエイトURLになる
 *
 * 画像はダウンロードせず、Yahoo!の画像URLをそのまま data/yahoo.json に保存して表示する。
 * APIの利用にあたっては「Webサービス by Yahoo! JAPAN」のクレジット表示が必須
 * （https://developer.yahoo.co.jp/attribution/）。表示はサイトのフッターで行っている。
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { ROOT, loadProducts } from "../src/lib/data.mjs";
import { pickBest, isConfident, searchQueries, describe, duplicateAssignments } from "../src/lib/match.mjs";

const APP_ID = process.env.YAHOO_APP_ID || "";
const VC_SID = process.env.VALUECOMMERCE_SID || "";
const VC_PID = process.env.VALUECOMMERCE_PID || "";
// affiliate_id には単なるIDではなく、バリューコマースのリンクURL（末尾が &vc_url=）を渡す仕様。
// URLSearchParams が1回だけURLエンコードするので、ここでは素のURLのまま組み立てる。
const VC_REFERRAL = (VC_SID && VC_PID)
  ? `https://ck.jp.ap.valuecommerce.com/servlet/referral?sid=${VC_SID}&pid=${VC_PID}&vc_url=`
  : "";
const API = "https://shopping.yahooapis.jp/ShoppingWebService/V3/itemSearch";
const WAIT = Number(process.env.YAHOO_WAIT_MS || 1100);  // 1クエリ/秒まで
const IMAGE_SIZE = 600;                                   // 指定できるのは 76/106/132/146/300/600

const STORE_JSON = join(ROOT, "data/yahoo.json");
const CAND_JSON = join(ROOT, "data/yahoo-candidates.json");
const candFileName = "data/yahoo-candidates.json";

if (!APP_ID) {
  console.error("YAHOO_APP_ID がありません。https://e.developer.yahoo.co.jp/register で Client ID を取って、環境変数に入れてください。");
  process.exit(1);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
const loadJson = (f, d) => existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : d;
const saveJson = (f, o) => writeFileSync(f, JSON.stringify(o, null, 2) + "\n");

async function callApi(params) {
  const q = new URLSearchParams({ appid: APP_ID, image_size: String(IMAGE_SIZE), ...params });
  if (VC_REFERRAL) { q.set("affiliate_type", "vc"); q.set("affiliate_id", VC_REFERRAL); }
  for (let attempt = 1; attempt <= 5; attempt++) {
    const res = await fetch(`${API}?${q}`, { headers: { "user-agent": "cosme_lab/1.0 (+https://github.com/masayuki-ido/cosme_lab)" } });
    if (res.status === 429 || res.status >= 500) { await sleep(WAIT * 2 ** attempt); continue; }
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new Error(`Yahoo!API ${res.status} ${(body && body.Error && body.Error.Message) || ""}`);
    return body;
  }
  throw new Error("Yahoo!APIが繰り返し失敗しました");
}

// APIの hit を、照合と保存で使う共通の形にする
const toItem = h => ({
  code: h.code,
  name: h.name,
  price: h.price ?? null,
  sellerName: (h.seller && h.seller.name) || null,
  sellerId: (h.seller && h.seller.sellerId) || null,
  imageUrl: (h.exImage && h.exImage.url) || (h.image && (h.image.medium || h.image.small)) || null,
  imageWidth: (h.exImage && h.exImage.width) || null,
  imageHeight: (h.exImage && h.exImage.height) || null,
  url: h.url || null,
  janCode: h.janCode || null,
  inStock: h.inStock !== false
});

const toRecord = it => ({
  code: it.code,
  sellerId: it.sellerId,
  name: it.name,
  sellerName: it.sellerName,
  price: it.price,
  imageUrl: it.imageUrl,
  imageWidth: it.imageWidth,
  imageHeight: it.imageHeight,
  // affiliate_id を付けて呼ぶと url がアフィリエイトURLに置き換わる
  url: it.url,
  affiliate: !!VC_REFERRAL,
  fetchedAt: new Date().toISOString()
});

async function searchFor(p) {
  const queries = searchQueries(p);
  for (const query of queries) {
    const body = await callApi({ query, results: "20", in_stock: "true" });
    await sleep(WAIT);
    const items = (body.hits || []).map(toItem);
    if (items.length) {
      const scored = pickBest(p, items);
      if (scored[0].score >= 40 || query === queries[queries.length - 1]) return { query, scored };
    }
  }
  return { query: queries[0], scored: [] };
}

// ---------- match ----------
async function cmdMatch(products) {
  const cands = loadJson(CAND_JSON, { updatedAt: null, items: {} });
  const store = loadJson(STORE_JSON, { updatedAt: null, items: {} });
  const targets = products.filter(p => !p.yahooItemCode);
  console.log(`match: ${targets.length}品を検索します（${products.length - targets.length}品は商品コード済み）`);
  let applied = 0, review = 0;
  for (const p of targets) {
    let r;
    try { r = await searchFor(p); }
    catch (e) { console.error(`  × ${p.id}: ${e.message}`); continue; }
    const top = r.scored[0];
    cands.items[p.id] = {
      query: r.query,
      candidates: r.scored.slice(0, 5).map(s => ({
        score: s.score, nameMatch: Math.round(s.ratio * 100) + "%", missing: s.missed,
        code: s.item.code, name: s.item.name, price: s.item.price, sellerName: s.item.sellerName, url: s.item.url
      }))
    };
    if (isConfident(top)) {
      const f = join(ROOT, "data/products", `${p.id}.json`);
      const raw = JSON.parse(readFileSync(f, "utf8"));
      raw.yahooItemCode = top.item.code;
      raw.yahooSellerId = top.item.sellerId;
      saveJson(f, raw);
      // 検索で得た情報をそのまま保存しておく（update はこれを起点に引き直す）
      store.items[p.id] = toRecord(top.item);
      applied++;
      console.log(`  ✓ ${p.id} (${top.score}) ${String(top.item.name).slice(0, 40)}`);
    } else {
      review++;
      console.log(`  ? ${p.id} (${describe(top)}) → data/yahoo-candidates.json を確認してください`);
    }
  }
  cands.updatedAt = new Date().toISOString();
  saveJson(CAND_JSON, cands);

  // 同じ商品コードが複数の商品に当たっていたら、どれも外す（別バリエーションの取り違え）
  const assigned = {};
  for (const p of loadProducts()) if (p.yahooItemCode) assigned[p.id] = p.yahooItemCode;
  const drop = duplicateAssignments(assigned);
  for (const id of drop) {
    const f = join(ROOT, "data/products", `${id}.json`);
    const raw = JSON.parse(readFileSync(f, "utf8"));
    delete raw.yahooItemCode;
    delete raw.yahooSellerId;
    saveJson(f, raw);
    delete store.items[id];
    applied--; review++;
    console.log(`  ! ${id} → 同じ商品コードが別の商品にも当たったので外しました（${candFileName} を確認してください）`);
  }

  store.updatedAt = new Date().toISOString();
  saveJson(STORE_JSON, store);
  console.log(`match: 自動確定 ${applied}件 / 要確認 ${review}件`);
}

// ---------- update ----------
async function cmdUpdate(products) {
  const store = loadJson(STORE_JSON, { updatedAt: null, items: {} });
  const targets = products.filter(p => p.yahooItemCode);
  console.log(`update: ${targets.length}品の価格・画像を取り直します`);
  let ok = 0, miss = 0;
  for (const p of targets) {
    try {
      // 商品コードを直接引くパラメータが無いので、JANコード、または
      // 前回保存した商品名＋ストアIDで検索して、同じ商品コードのものを拾う。
      const prev = store.items[p.id] || {};
      const jan = /(?:^|_)(\d{13})$/.exec(p.yahooItemCode);
      const attempts = [];
      if (jan) attempts.push({ jan_code: jan[1], results: "20" });
      if (prev.name) attempts.push({ query: prev.name.slice(0, 60), seller_id: p.yahooSellerId || "", results: "30" });
      attempts.push({ query: [p.brand, p.name, p.size].filter(Boolean).join(" "), seller_id: p.yahooSellerId || "", results: "30" });

      let exact = null;
      for (const params of attempts) {
        const body = await callApi(params);
        await sleep(WAIT);
        exact = (body.hits || []).map(toItem).find(it => it.code === p.yahooItemCode);
        if (exact) break;
      }
      if (!exact) {
        miss++;
        console.log(`  - ${p.id}: 見つかりません（商品コードが変わったか、販売終了かもしれません）`);
        continue;
      }
      store.items[p.id] = toRecord(exact);
      ok++;
    } catch (e) {
      miss++;
      console.error(`  × ${p.id}: ${e.message}`);
    }
  }
  // 商品コードが外れた商品は古い情報を残さない
  for (const id of Object.keys(store.items)) {
    if (!targets.some(p => p.id === id)) delete store.items[id];
  }
  store.updatedAt = new Date().toISOString();
  saveJson(STORE_JSON, store);
  console.log(`update: 成功 ${ok}件 / 失敗 ${miss}件 → data/yahoo.json`);
  if (!VC_REFERRAL) console.log("※ VALUECOMMERCE_SID / VALUECOMMERCE_PID が未設定のため、アフィリエイトリンクではなく通常の商品URLが入ります。");
}

const mode = process.argv[2] || "all";
if (!["match", "update", "all"].includes(mode)) {
  console.error("使い方: node scripts/yahoo-sync.mjs [match|update|all]");
  process.exit(1);
}
if (mode === "match" || mode === "all") await cmdMatch(loadProducts());
if (mode === "update" || mode === "all") await cmdUpdate(loadProducts());
