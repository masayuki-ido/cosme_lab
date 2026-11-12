// サイト全体の設定とレイアウト。BASE / SITE_URL は環境変数で差し替えられる（独自ドメインに移すときはここだけ）。
export const SITE = {
  name: "コスメ研究所",
  tagline: "化粧水の成分を見て選ぶ",
  desc: "化粧水の全成分をメーカー公式の表示どおりに掲載し、エタノール・香料・パラベンなど自分のNG成分が入っているかを判定できるサイトです。",
  // origin はドメインだけ、base はその下のディレクトリ。独自ドメインに移すときは SITE_ORIGIN と SITE_BASE=/ にする。
  origin: (process.env.SITE_ORIGIN || "https://masayuki-ido.github.io").replace(/\/+$/, ""),
  base: (process.env.SITE_BASE || "/cosme_lab/").replace(/\/*$/, "/"),
  locale: "ja_JP"
};

// 商品名がブランド名で始まるデータもあるので、タイトルでブランド名が二重に出ないようにする
export const fullName = p => (p.name || "").startsWith(p.brand) ? p.name : `${p.brand} ${p.name}`;

export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const yen = n => n == null ? "価格未確認" : "¥" + Number(n).toLocaleString("ja-JP");
// サイト内リンク。"" はトップ、"products/x/" のように末尾スラッシュ付きで渡す。
export const url = (p = "") => SITE.base + String(p).replace(/^\//, "");
// 絶対URL（canonical / sitemap / JSON-LD 用）
export const abs = (p = "") => SITE.origin + url(p);

export const ICONS = {
  search: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
  cmp: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="7" height="16" rx="1.5"/><rect x="14" y="4" width="7" height="16" rx="1.5"/></svg>',
  me: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
  ing: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h10"/></svg>',
  back: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
  ext: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6"/></svg>'
};

function tabbar(active) {
  const items = [
    ["", "さがす", ICONS.search, "search"],
    ["ingredients/", "成分", ICONS.ing, "ingredients"],
    ["compare/", "比較", ICONS.cmp, "compare"],
    ["mypage/", "マイページ", ICONS.me, "mypage"]
  ];
  return `<div class="tabbar"><nav aria-label="メインメニュー">${items.map(([p, l, ic, k]) =>
    `<a href="${url(p)}"${active === k ? ' aria-current="page"' : ""}>${ic}${l}${k === "compare" ? '<span class="badge" id="cmpbadge" hidden></span>' : ""}</a>`
  ).join("")}</nav></div>`;
}

function footer() {
  return `<footer class="site"><div>
    <nav aria-label="フッター">
      <a href="${url()}">化粧水をさがす</a>
      <a href="${url("ingredients/")}">成分から調べる</a>
      <a href="${url("compare/")}">比較</a>
      <a href="${url("mypage/")}">マイページ</a>
      <a href="${url("about/")}">このサイトについて・広告表記</a>
    </nav>
    <p>当サイトはアフィリエイトプログラムに参加しており、商品リンクから購入された場合に運営者が紹介料を受け取ることがあります。<a href="${url("about/")}">詳しくはこちら</a>。</p>
    <p>掲載している全成分はメーカー公式サイトなどの表示を転記したものです。成分の解説は一般的な配合目的の説明で、商品の効果・効能を示すものではありません。価格は確認日時点の参考値です。購入前に商品パッケージおよび販売店の表示をご確認ください。</p>
    <p>© ${new Date().getFullYear()} ${SITE.name}</p>
  </div></footer>`;
}

export function crumbs(items) {
  // items: [[label, path|null], ...] 最後は現在地（リンクなし）
  const li = items.map(([l, p]) => `<li>${p == null ? esc(l) : `<a href="${url(p)}">${esc(l)}</a>`}</li>`).join("");
  const ld = {
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: items.map(([l, p], i) => ({
      "@type": "ListItem", position: i + 1, name: l,
      ...(p == null ? {} : { item: abs(p) })
    }))
  };
  return { html: `<ol class="crumbs">${li}</ol>`, ld };
}

/**
 * ページ全体を組む。
 * head: {title, desc, path, ogImage, robots}  header: 文字列（トップは検索ボックス、他は戻るバー）
 */
export function page({ head, header, body, tab, jsonLd = [], bodyEnd = "" }) {
  const canonical = abs(head.path || "");
  const title = head.title;
  const ld = jsonLd.filter(Boolean).map(o => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, "\\u003c")}</script>`).join("");
  return `<!doctype html>
<html lang="ja" data-base="${SITE.base}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(head.desc)}">
<link rel="canonical" href="${esc(canonical)}">
${head.robots ? `<meta name="robots" content="${esc(head.robots)}">` : ""}
<meta property="og:type" content="${head.ogType || "website"}">
<meta property="og:site_name" content="${esc(SITE.name)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(head.desc)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:locale" content="${SITE.locale}">
${head.ogImage ? `<meta property="og:image" content="${esc(head.ogImage)}">` : ""}
<meta name="twitter:card" content="${head.ogImage ? "summary_large_image" : "summary"}">
<meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#141517" media="(prefers-color-scheme: dark)">
<link rel="icon" href="${url("favicon.svg")}" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&family=Zen+Kaku+Gothic+New:wght@500;700&display=swap">
<link rel="stylesheet" href="${url("site.css")}">
${ld}
</head>
<body>
<a class="skiplink" href="#main">本文へスキップ</a>
<div class="app">
<header class="top">${header}</header>
<main id="main">${body}</main>
</div>
${footer()}
${tabbar(tab)}
<div class="toast" id="toast" hidden></div>
<script src="${url("app.js")}" defer></script>
${bodyEnd}
</body>
</html>`;
}

// トップ用ヘッダー（検索ボックス＋タブ）
export function searchHeader(active) {
  const tabs = [["", "商品"], ["ingredients/", "成分"], ["ranking/", "ランキング"]];
  return `<div class="brandrow"><a class="logo" href="${url()}">${SITE.name}<small>${SITE.tagline}</small></a></div>
<label class="searchbox">${ICONS.search}<input id="q" type="search" aria-label="商品・ブランド・成分を検索" placeholder="化粧水、セラミド、トラネキサム酸…" autocomplete="off"></label>
<nav class="tabs" aria-label="検索対象">${tabs.map(([p, l]) => `<a href="${url(p)}"${active === p ? ' aria-current="page"' : ""}>${l}</a>`).join("")}</nav>`;
}

// 下層ページ用ヘッダー（戻る＋ページ名）
export function pageHeader(title, backTo = "") {
  return `<div class="backbar"><a class="iconbtn" href="${url(backTo)}" aria-label="戻る">${ICONS.back}</a><span class="ttl">${esc(title)}</span></div>`;
}
