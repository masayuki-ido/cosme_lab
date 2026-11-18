/**
 * 通販サイトの画像・価格・購入リンク。
 * 画像はダウンロードせず、各サイトの画像URLをそのまま表示し、その商品ページへリンクする。
 *
 * 楽天とYahoo!の両方に対応する。商品が確定しているほう（itemCode / 商品コードが入っているほう）を
 * 画像と主リンクに使い、確定していないサイトは検索結果へのリンクにする。
 */
import { esc, fullName } from "./site.mjs";

export const AFF = {
  rakutenId: process.env.RAKUTEN_AFFILIATE_ID || "",
  valuecommerceSid: process.env.VALUECOMMERCE_SID || "",
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

// バリューコマース経由のYahoo!ショッピングリンク。APIが返す url はすでにアフィリエイトURLなので、
// ここで包むのは検索結果へのリンクだけ。
const aflYahoo = url => AFF.valuecommerceSid
  ? `https://ck.jp.ap.valuecommerce.com/servlet/referral?sid=${AFF.valuecommerceSid}&pid=&vc_url=${encodeURIComponent(url)}`
  : url;

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
      fetchedAt: rk.fetchedAt || null
    };
  }
  if (yh && yh.imageUrl) {
    return {
      site: "yahoo", label: "Yahoo!ショッピング",
      image: yh.imageUrl, imageW: yh.imageWidth || 600, imageH: yh.imageHeight || 600,
      price: yh.price ?? null, sellerName: yh.sellerName || null,
      url: yh.url, sponsored: !!yh.affiliate,
      fetchedAt: yh.fetchedAt || null
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
    links.push({ label: `${src.label}で見る`, url: src.url, sponsored: src.sponsored, main: true, shop: src.sellerName });
  }
  if (!src || src.site !== "rakuten") links.push({ label: "楽天市場", url: rkSearch, sponsored: !!AFF.rakutenId });
  links.push({ label: "Amazon", url: amazon, sponsored: !!AFF.amazonTag });
  if (!src || src.site !== "yahoo") links.push({ label: "Yahoo!ショッピング", url: yhSearch, sponsored: !!AFF.valuecommerceSid });
  return links;
}

export function buyLinksHtml(p, shops) {
  return buyLinks(p, shops).map(l =>
    `<a class="buybtn${l.main ? " main" : ""}" href="${esc(l.url)}" target="_blank" rel="${l.sponsored ? "nofollow sponsored noopener" : "nofollow noopener"}">${esc(l.label)}${
      l.shop ? `<span class="meta" style="font-size:11px;display:block;font-weight:400">${esc(l.shop)}</span>` : ""}</a>`
  ).join("");
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
