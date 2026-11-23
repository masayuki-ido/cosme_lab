/**
 * 通販サイトの画像・価格・購入リンク。
 * 画像はダウンロードせず、各サイトの画像URLをそのまま表示し、その商品ページへリンクする。
 *
 * 楽天とYahoo!の両方に対応する。商品が確定しているほう（itemCode / 商品コードが入っているほう）を
 * 画像と主リンクに使い、確定していないサイトは検索結果へのリンクにする。
 */
import { esc, yen, fullName } from "./site.mjs";

export const AFF = {
  rakutenId: process.env.RAKUTEN_AFFILIATE_ID || "",
  valuecommerceSid: process.env.VALUECOMMERCE_SID || "",
  valuecommercePid: process.env.VALUECOMMERCE_PID || "",
  amazonTag: process.env.AMAZON_TAG || ""
};

// 楽天のサムネイルURLは ?_ex=128x128 で寸法を指定する。表示したい寸法に差し替える。
export function rkImage(u, size = 400) {
  if (!u) return null;
  return /[?&]_ex=/.test(u) ? u.replace(/_ex=\d+x\d+/, `_ex=${size}x${size}`) : u + (u.includes("?") ? "&" : "?") + `_ex=${size}x${size}`;
}

// 楽天アフィリエイトのリンク形式。アフィリエイトIDは 8桁hex を4つドットでつないだもの。
const aflRakuten = pcUrl => AFF.rakutenId
  ? `https://hb.afl.rakuten.co.jp/ichiba/${AFF.rakutenId}/?pc=${encodeURIComponent(pcUrl)}&m=${encodeURIComponent(pcUrl)}&link_type=text`
  : pcUrl;

// バリューコマース経由のYahoo!ショッピングリンク。sid と pid の両方が要る。
// APIが返す商品URLはすでにアフィリエイトURLなので、ここで包むのは検索結果へのリンクだけ。
const aflYahoo = url => (AFF.valuecommerceSid && AFF.valuecommercePid)
  ? `https://ck.jp.ap.valuecommerce.com/servlet/referral?sid=${AFF.valuecommerceSid}&pid=${AFF.valuecommercePid}&vc_url=${encodeURIComponent(url)}`
  : url;

// JANコード（＝GTIN-13）。APIが返した値か、商品コードの末尾13桁から取る。
// 商品コードの13桁はJANでない数字のこともあるので、チェックディジットが
// 合うものだけを採用する（誤ったGTINを構造化データに出すと有害なため）。
function isValidGtin13(v) {
  if (!/^\d{13}$/.test(v)) return false;
  const d = [...v].map(Number);
  const sum = d.slice(0, 12).reduce((a, n, i) => a + n * (i % 2 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === d[12];
}

function gtin13Of(rec) {
  for (const cand of [rec.janCode, (/(?:^|[_-])(\d{13})$/.exec(rec.code || rec.itemCode || "") || [])[1]]) {
    if (cand && isValidGtin13(String(cand))) return String(cand);
  }
  return null;
}

export const searchQuery = p => [fullName(p), p.size].filter(Boolean).join(" ");

/**
 * その商品について、どのサイトの情報を画像と主リンクに使うか決める。
 * 楽天のほうがアフィリエイトの設定が先に済んでいるので、両方あれば楽天を優先する。
 */
export function sourceOf(p, shops) {
  const rk = (shops.rakuten || {})[p.id];
  const yh = (shops.yahoo || {})[p.id];
  if (rk && rk.imageUrl) {
    return {
      site: "rakuten", label: "楽天市場",
      image: rkImage(rk.imageUrl, 600), imageW: 600, imageH: 600,
      price: rk.price ?? null, sellerName: rk.shopName || null,
      url: rk.affiliateUrl || rk.itemUrl, sponsored: !!AFF.rakutenId,
      gtin13: gtin13Of(rk), fetchedAt: rk.fetchedAt || null
    };
  }
  if (yh && yh.imageUrl) {
    return {
      site: "yahoo", label: "Yahoo!ショッピング",
      image: yh.imageUrl, imageW: yh.imageWidth || 600, imageH: yh.imageHeight || 600,
      price: yh.price ?? null, sellerName: yh.sellerName || null,
      url: yh.url, sponsored: !!yh.affiliate,
      gtin13: gtin13Of(yh), fetchedAt: yh.fetchedAt || null
    };
  }
  return null;
}

/**
 * 購入リンク。src は sourceOf() の結果（なければ null）。
 * 確定している通販サイトは商品ページへ、ほかは検索結果へ。
 */
export function buyLinks(p, shops) {
  const src = sourceOf(p, shops);
  const q = encodeURIComponent(searchQuery(p));
  const rkSearch = aflRakuten(`https://search.rakuten.co.jp/search/mall/${q}/`);
  const yhSearch = aflYahoo(`https://shopping.yahoo.co.jp/search?p=${q}`);
  const amazon = `https://www.amazon.co.jp/s?k=${q}${AFF.amazonTag ? "&tag=" + encodeURIComponent(AFF.amazonTag) : ""}`;

  const links = [];
  if (src) {
    // 価格を出せるのは、APIで商品が確定していて価格を取得できた通販サイトだけ。
    // 検索結果へのリンクには価格を出さない（どの商品の価格か保証できないため）。
    links.push({
      label: `${src.label}で見る`, url: src.url, sponsored: src.sponsored, main: true,
      shop: src.sellerName, price: src.price, fetchedAt: src.fetchedAt
    });
  }
  if (!src || src.site !== "rakuten") links.push({ label: "楽天市場", url: rkSearch, sponsored: !!AFF.rakutenId });
  links.push({ label: "Amazon", url: amazon, sponsored: !!AFF.amazonTag });
  if (!src || src.site !== "yahoo") links.push({ label: "Yahoo!ショッピング", url: yhSearch, sponsored: !!(AFF.valuecommerceSid && AFF.valuecommercePid) });
  return links;
}

export function buyLinksHtml(p, shops) {
  return buyLinks(p, shops).map(l => {
    const sub = l.price != null
      ? `<span class="bprice">${yen(l.price)}</span>${l.shop ? `<span class="bshop">${esc(l.shop)}</span>` : ""}`
      : `<span class="bshop">価格を見る</span>`;
    return `<a class="buybtn${l.main ? " main" : ""}" href="${esc(l.url)}" target="_blank" rel="${l.sponsored ? "nofollow sponsored noopener" : "nofollow noopener"}"><span class="blabel">${esc(l.label)}</span>${sub}</a>`;
  }).join("");
}

// 商品画像。無ければ null を返して、呼び出し側が代替の色面を出す。
export function productImage(p, shops, size = 400) {
  const src = sourceOf(p, shops);
  if (!src || !src.image) return null;
  const image = src.site === "rakuten" ? rkImage(src.image, size) : src.image;
  return { src: image, alt: fullName(p), href: src.url, credit: src.label, site: src.site };
}

// Yahoo!のAPIを使っている場合は、クレジット表示が必須（https://developer.yahoo.co.jp/attribution/）
export const usesYahoo = shops => Object.keys(shops.yahoo || {}).length > 0;
export const YAHOO_ATTRIBUTION = `<!-- Begin Yahoo! JAPAN Web Services Attribution Snippet -->
<span style="margin:15px 15px 15px 15px"><a href="https://developer.yahoo.co.jp/sitemap/">Webサービス by Yahoo! JAPAN</a></span>
<!-- End Yahoo! JAPAN Web Services Attribution Snippet -->`;
