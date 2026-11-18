/**
 * 商品データと、通販サイトの検索結果を突き合わせる。
 * 楽天とYahoo!で同じ規則を使うため、採点はここに1つだけ置く。
 *
 * 通販側の商品は { name, price, imageUrl } の形に揃えてから渡す。
 */
export const MATCH_THRESHOLD = Number(process.env.MATCH_THRESHOLD || 60);
const NAME_COVERAGE = Number(process.env.MATCH_NAME_COVERAGE || 0.8);

const flat = s => String(s || "").normalize("NFKC").toLowerCase().replace(/\s+/g, "");

// セット品・訳あり品など、その商品そのものではないもの
const BAD = /セット|まとめ買い|お得用|詰め合わせ|福袋|訳あり|中古|[2-9]\s*個|[2-9]本セット|選べる/;
const REFILL = /詰替|つめかえ|詰め替え|レフィル/;

// 容量。"150mL" -> ["150ml"]。容量が書かれていない商品は空。
export function sizeTokens(size) {
  const m = /([0-9.]+)\s*(m[lL]|ｍｌ|g|G)/.exec(size || "");
  return m ? [flat(m[1] + (/[gG]/.test(m[2]) ? "g" : "ml"))] : [];
}

// 商品名を語に切る。「Ⅱしっとり」は NFKC で "iiしっとり" になるので、英数字とかなの境目でも切る。
export function tokenize(name) {
  return String(name).normalize("NFKC").toLowerCase()
    .split(/[\s　・（）()\[\]【】,、。\/\\+＋]+/)
    .flatMap(w => w.match(/[a-z]+|[0-9]+(?:\.[0-9]+)?|[^\sa-z0-9]+/g) || [])
    .filter(Boolean);
}

// 商品名の語が、通販側の商品名に入っているか。
// 「Ⅰ」と「Ⅱ」のように1〜2文字の英数字は、部分一致だと取り違えるので語として一致するか見る。
export function tokenHit(tok, itemText, itemTokens) {
  if (/^[a-z0-9.]+$/.test(tok) && tok.length <= 2) return itemTokens.includes(tok);
  return itemText.includes(tok);
}

export function scoreItem(p, item) {
  const itemText = flat(item.name);
  const itemTokens = tokenize(item.name);
  const brand = flat(p.brand);

  // 商品名の語（ブランド名は別で見るので除く）
  const toks = tokenize(p.name).filter(t => !(brand && brand.includes(t) && t.length >= 2));
  const missed = toks.filter(t => !tokenHit(t, itemText, itemTokens));
  const hit = toks.length - missed.length;

  let score = toks.length ? Math.round((hit / toks.length) * 60) : 0;
  score -= missed.length * 12;                 // 名前の語が欠けているものは大きく下げる

  if (brand && itemText.includes(brand)) score += 20;

  const st = sizeTokens(p.size);
  if (st.length) score += st.some(t => itemText.includes(t)) ? 25 : -20;

  if (p.kind === "医薬部外品" && /薬用|医薬部外品/.test(item.name)) score += 5;
  if (BAD.test(item.name)) score -= 40;
  if (REFILL.test(item.name) !== REFILL.test(p.name)) score -= 30;

  if (p.price && item.price) {
    const r = item.price / p.price;
    if (r < 0.4 || r > 2.5) score -= 25;
    else if (r >= 0.7 && r <= 1.4) score += 10;
  }
  if (!item.imageUrl) score -= 20;

  // ratio は商品名の語がどれだけ揃ったか。ブランド名や容量の加点だけで
  // 別のバリエーション（Ⅰ／Ⅱ／Ⅲ、しっとり／さっぱり など）に当たらないよう、確定の条件に使う。
  return { score, ratio: toks.length ? hit / toks.length : 0, missed };
}

export function pickBest(p, items) {
  return items.map(it => ({ item: it, ...scoreItem(p, it) })).sort((a, b) => b.score - a.score);
}

// 自動で商品データに書き込んでよいか。点数だけでなく、商品名の語がほぼ揃っていることを条件にする。
export const isConfident = s => !!s && s.score >= MATCH_THRESHOLD && s.ratio >= NAME_COVERAGE;

// 検索に使うキーワードを、広い順に並べて返す
export function searchQueries(p) {
  return [
    [p.brand, p.name, p.size].filter(Boolean).join(" "),
    [p.name, p.size].filter(Boolean).join(" "),
    [p.brand, p.name].filter(Boolean).join(" "),
    p.name
  ].filter((q, i, a) => q && a.indexOf(q) === i);
}

export const describe = s => s
  ? `${s.score}点・名前一致${Math.round(s.ratio * 100)}%${s.missed.length ? `・不足[${s.missed.join(",")}]` : ""}`
  : "候補なし";
