import { SITE, esc, page, pageHeader, abs, fullName } from "../lib/site.mjs";
import { productCard } from "../lib/components.mjs";

export function rankingPage(ctx) {
  const { products, rakuten, catOf } = ctx;
  const ranked = products.filter(p => p.popularRank).sort((a, b) => a.popularRank - b.popularRank);
  const body = `<h1 class="title" style="font-size:18px">人気の化粧水ランキング（全成分つき）</h1>
<p class="meta" style="margin:0">大手通販サイトの人気順を参考にした並び順です。それぞれの全成分と、あなたのNG成分が入っているかを一緒に確認できます。</p>
<div class="plist">${ranked.map((p, i) => `<div style="display:flex;flex-direction:column;gap:4px"><span class="meta" style="font-weight:700;color:var(--accent-ink)">${i + 1}位</span>${productCard(p, rakuten[p.id], catOf)}</div>`).join("")}</div>
<p class="note">順位は各通販サイトの人気順を参考にしたもので、当サイトが品質や効果を評価したものではありません。</p>`;
  const ld = { "@context": "https://schema.org", "@type": "ItemList", name: "人気の化粧水ランキング",
    itemListElement: ranked.slice(0, 50).map((p, i) => ({ "@type": "ListItem", position: i + 1, url: abs(`products/${p.id}/`), name: fullName(p) })) };
  return page({
    head: { title: `人気の化粧水ランキング${ranked.length}選｜全成分とNG成分チェック - ${SITE.name}`,
      desc: `人気の化粧水${ranked.length}品を、全成分つきで並べました。エタノール・香料・パラベンなど避けたい成分が入っているかを一覧で確認できます。`, path: "ranking/" },
    header: pageHeader("ランキング"), body, tab: "search", jsonLd: [ld]
  });
}
