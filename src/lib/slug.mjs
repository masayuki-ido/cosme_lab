// 成分名から URL に使える slug を作る。日本語はそのまま残し（日本語URLは検索エンジンも扱える）、
// パスを壊す記号だけ落とす。衝突したら登場順に -2, -3 を付ける。
const UNSAFE = /[\/\\?#%&=+:;,()\[\]{}<>"'`^|~!$@\s　]+/g;

export function slugify(name) {
  let s = String(name).normalize("NFKC").replace(UNSAFE, "-").replace(/-{2,}/g, "-").replace(/^-+|-+$/g, "");
  return s || "x";
}

// 成分名の配列から { name -> slug } と { slug -> name } を作る（名前でソートして決める＝ビルドのたびに変わらない）
export function buildSlugMap(names) {
  const toSlug = new Map();
  const toName = new Map();
  for (const name of [...names].sort((a, b) => a.localeCompare(b, "ja"))) {
    if (toSlug.has(name)) continue;
    const base = slugify(name);
    let s = base, i = 2;
    while (toName.has(s)) s = `${base}-${i++}`;
    toSlug.set(name, s);
    toName.set(s, name);
  }
  return { toSlug, toName };
}
