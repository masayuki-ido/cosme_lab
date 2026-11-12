// 成分名の正規化。HANDOFF.md の「成分名の正規化ルール」と legacy/index.html の norm() と同じ規則。
// 辞書 data/dictionary.json のキーはこの関数を通した形で持つ。
const JP = /[぀-ヿ㐀-鿿]/;
const cache = new Map();

export function norm(s) {
  const key = String(s);
  if (cache.has(key)) return cache.get(key);
  let t = key
    .normalize("NFKC")
    .replace(/−/g, "-")   // −
    .replace(/‐/g, "-")   // ‐
    .replace(/、/g, ",")   // 、
    .replace(/[*※]/g, "") // * ※
    .trim();
  // 末尾の括弧書きは、説明的なもの（日本語を含み「/」を含まない／2文字以下）だけ落とす
  const m = /^(.*\S)\(([^()]*)\)$/.exec(t);
  if (m && ((JP.test(m[2]) && !m[2].includes("/")) || (m[2].length <= 2 && JP.test(m[1].slice(-1))))) {
    t = m[1].trim();
  }
  cache.set(key, t);
  return t;
}
