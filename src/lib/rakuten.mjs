// 楽天の画像とリンク。画像はダウンロードせず楽天の画像URLをそのまま表示し、商品ページへリンクする（規約順守）。
import { esc } from "./site.mjs";

export const AFF = {
  rakutenId: process.env.RAKUTEN_AFFILIATE_ID || "",
  amazonTag: process.env.AMAZON_TAG || "",
  yahooVcSid: process.env.YAHOO_VC_SID || "",
  yahooVcPid: process.env.YAHOO_VC_PID || ""
};

// 楽天のサムネイルURLは ?_ex=128x128 で寸法を指定する。表示したい寸法に差し替える。
export function rkImage(u, size = 400) {
  if (!u) return null;
  return /[?&]_ex=/.test(u) ? u.replace(/_ex=\d+x\d+/, `_ex=${size}x${size}`) : u + (u.includes("?") ? "&" : "?") + `_ex=${size}x${size}`;
}

const afl = pcUrl => AFF.rakutenId
  ? `https://hb.afl.rakuten.co.jp/hgc/${AFF.rakutenId}/?pc=${encodeURIComponent(pcUrl)}&m=${encodeURIComponent(pcUrl)}`
  : pcUrl;

export function searchQuery(p) {
  return [p.brand, p.name, p.size].filter(Boolean).join(" ");
}

/**
 * 購入リンク。rk は data/rakuten.json のその商品のぶん（なければ null）。
 * 返り値 [{label, url, sponsored, note}]
 */
export function buyLinks(p, rk) {
  const q = encodeURIComponent(searchQuery(p));
  const links = [];

  // 楽天：APIで商品が確定していれば affiliateUrl（＝アフィリエイトリンク）、無ければ検索結果へ
  if (rk && rk.affiliateUrl) {
    links.push({ label: "楽天市場で見る", url: rk.affiliateUrl, sponsored: true, main: true, shop: rk.shopName || null });
  } else {
    const s = `https://search.rakuten.co.jp/search/mall/${q}/`;
    links.push({ label: "楽天市場", url: afl(s), sponsored: !!AFF.rakutenId, main: !!rk });
  }
  const amazon = `https://www.amazon.co.jp/s?k=${q}${AFF.amazonTag ? "&tag=" + encodeURIComponent(AFF.amazonTag) : ""}`;
  links.push({ label: "Amazon", url: amazon, sponsored: !!AFF.amazonTag });
  const yh = `https://shopping.yahoo.co.jp/search?p=${q}`;
  const yahoo = AFF.yahooVcSid && AFF.yahooVcPid
    ? `https://ck.jp.ap.valuecommerce.com/servlet/referral?sid=${AFF.yahooVcSid}&pid=${AFF.yahooVcPid}&vc_url=${encodeURIComponent(yh)}`
    : yh;
  links.push({ label: "Yahoo!ショッピング", url: yahoo, sponsored: !!(AFF.yahooVcSid && AFF.yahooVcPid) });
  return links;
}

export function buyLinksHtml(p, rk) {
  const ls = buyLinks(p, rk);
  return ls.map(l =>
    `<a class="buybtn${l.main ? " main" : ""}" href="${esc(l.url)}" target="_blank" rel="noopener ${l.sponsored ? "sponsored" : "nofollow"}">${esc(l.label)}${l.shop ? `<span class="meta" style="font-size:11px;display:block;font-weight:400">${esc(l.shop)}</span>` : ""}</a>`
  ).join("");
}

// 商品画像（楽天の画像URLをそのまま表示）。無ければ null を返して、呼び出し側が代替の色面を出す。
export function productImage(p, rk, size = 400) {
  const u = rkImage(rk && rk.imageUrl, size);
  if (!u) return null;
  return { src: u, alt: `${p.brand} ${p.name}`.trim(), href: (rk && rk.affiliateUrl) || null };
}
