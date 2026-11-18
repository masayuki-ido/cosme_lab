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
const BAD = /セット|まとめ買い|お得用|詰め合わせ|福袋|訳あり|中古|選べる|[×x✕]\s*[2-9]\b|[2-9]\s*個|[2-9]\s*本(?!体)/;

/**
 * 「どちらか一方にだけあると別物」とわかる語。
 * 商品名の語がそろっているかだけ見ていると、相手側にだけある
 * 「Men」「ドット」のような語を見落として、別のバリエーションに当たってしまう。
 */
const VARIANTS = [
  // 「メラノCCMen」のように連結していることがあるので、左側の区切りは求めない。
  // women を巻き込まないようにだけ気をつける。
  /(?<!wo)men'?s?(?![a-z])|メンズ|男性用/i,
  /ドット|(?:^|[^a-z])dot(?:[^a-z]|$)/i,
  /詰替|つめかえ|詰め替え|レフィル/,
  /ミニ|トライアル|お試し|サンプル|携帯用|トラベル/,
  /ふきとり|拭き取り/,
  // 化粧水でよくある「同じ名前で中身が違う」軸。片方にしか無ければ別商品として扱う。
  /さっぱり/,
  /とてもしっとり/,
  /ややしっとり/,
  /もっとしっとり/,
  /(?<!とても|やや|もっと)しっとり/,
  /エンリッチ/,
  /ブライトニング/,
  /みずみずしい/,
  /高保湿/,
  /(?:^|[^ァ-ヶー])リッチ/,
  /(?:^|[^ァ-ヶー])ライト/
];

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

  // 容量違いは別のSKU＝価格も画像も別物なので、掲載容量がわかっているものは確定させない
  const st = sizeTokens(p.size);
  const sizeOk = !st.length || st.some(t => itemText.includes(t));
  if (st.length) score += sizeOk ? 25 : -20;

  if (p.kind === "医薬部外品" && /薬用|医薬部外品/.test(item.name)) score += 5;
  const bad = BAD.test(item.name);     // セット品・複数本は価格も画像も別物なので確定させない
  if (bad) score -= 40;

  // 片方にだけある「別物を示す語」。1つでも食い違えば確定させない
  const variantMismatch = VARIANTS.filter(re => re.test(item.name) !== re.test(p.name));
  score -= variantMismatch.length * 45;

  if (p.price && item.price) {
    const r = item.price / p.price;
    if (r < 0.4 || r > 2.5) score -= 25;
    else if (r >= 0.7 && r <= 1.4) score += 10;
  }
  if (!item.imageUrl) score -= 20;

  // ratio は商品名の語がどれだけ揃ったか。ブランド名や容量の加点だけで
  // 別のバリエーション（Ⅰ／Ⅱ／Ⅲ、しっとり／さっぱり など）に当たらないよう、確定の条件に使う。
  return {
    score,
    ratio: toks.length ? hit / toks.length : 0,
    missed,
    variantMismatch: variantMismatch.length > 0,
    bad,
    sizeMismatch: !sizeOk
  };
}

export function pickBest(p, items) {
  return items.map(it => ({ item: it, ...scoreItem(p, it) })).sort((a, b) => b.score - a.score);
}

// 自動で商品データに書き込んでよいか。点数だけでなく、商品名の語がほぼ揃っていることを条件にする。
export const isConfident = s => !!s && s.score >= MATCH_THRESHOLD && s.ratio >= NAME_COVERAGE && !s.variantMismatch && !s.bad && !s.sizeMismatch;

/**
 * 同じ商品コードが複数の商品に当たっていたら、どれも確定させない。
 * 別のバリエーションを取り違えたときに必ず起きるので、取りこぼしの網になる。
 * assigned: { productId -> code } を受け取り、外すべき productId の Set を返す。
 */
export function duplicateAssignments(assigned) {
  const byCode = new Map();
  for (const [id, code] of Object.entries(assigned)) {
    if (!code) continue;
    if (!byCode.has(code)) byCode.set(code, []);
    byCode.get(code).push(id);
  }
  const drop = new Set();
  for (const ids of byCode.values()) if (ids.length > 1) for (const id of ids) drop.add(id);
  return drop;
}

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
  ? `${s.score}点・名前一致${Math.round(s.ratio * 100)}%${s.missed.length ? `・不足[${s.missed.join(",")}]` : ""}${s.variantMismatch ? "・別バリエーションの疑い" : ""}${s.bad ? "・セット品や複数本の疑い" : ""}${s.sizeMismatch ? "・容量違い" : ""}`
  : "候補なし";
