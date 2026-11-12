// 配合目的ごとのアイコンと色。legacy/index.html の CAT_META と同じ（色は CSS の --c-* トークン）。
const SV = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const SHIELD = '<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/>';

export const CAT_META = {
  "保湿":       ["moist", SV('<path d="M12 3c3.5 4.2 6 7.6 6 10.5a6 6 0 0 1-12 0C6 10.6 8.5 7.2 12 3z"/>')],
  "美白":       ["white", SV('<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M18 16l.7 1.8 1.8.7-1.8.7L18 21l-.7-1.8-1.8-.7 1.8-.7z"/>')],
  "肌荒れ防止": ["calm",  SV(SHIELD + '<path d="M9.5 12h5M12 9.5v5"/>')],
  "整肌":       ["cond",  SV('<path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14"/><path d="M5 19l7-7"/>')],
  "エモリエント": ["emol", SV('<circle cx="12" cy="13" r="7"/><path d="M8.5 13.5a3.5 3.5 0 0 0 3.5 3"/>')],
  "ベース":     ["func",  SV('<path d="M3 9c3-2 6 2 9 0s6-2 9 0M3 15c3-2 6 2 9 0s6-2 9 0"/>')],
  "乳化・可溶化": ["func", SV('<circle cx="9" cy="12" r="5"/><circle cx="15" cy="12" r="5"/>')],
  "増粘・使用感": ["func", SV('<path d="M12 4l9 5-9 5-9-5z"/><path d="M3 14l9 5 9-5"/>')],
  "pH調整":     ["func",  SV('<path d="M12 4v16M7 20h10M5 7h14M5 7l-2.5 6h5zM19 7l-2.5 6h5z"/>')],
  "安定化":     ["func",  SV('<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>')],
  "防腐":       ["func",  SV(SHIELD + '<path d="M9 12l2 2 4-4"/>')],
  "香料":       ["frag",  SV('<circle cx="12" cy="7.5" r="3"/><circle cx="12" cy="16.5" r="3"/><circle cx="7.5" cy="12" r="3"/><circle cx="16.5" cy="12" r="3"/>')],
  "清涼":       ["moist", SV('<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9"/>')],
  "紫外線吸収": ["white", SV('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5"/>')]
};
export const OTHER_META = ["func", SV('<circle cx="12" cy="12" r="8"/><path d="M8.5 12h.01M12 12h.01M15.5 12h.01"/>')];
export const ICON_WARN = SV('<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17h.01"/>');
export const ICON_OK = SV('<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>');

// 判定の主役になる配合目的（この順で前に出す）
export const CAT_ORDER = ["保湿", "美白", "肌荒れ防止", "整肌", "エモリエント"];
// 基剤・品質保持側の配合目的
export const FUNC_ORDER = ["ベース", "乳化・可溶化", "増粘・使用感", "pH調整", "安定化", "防腐", "香料", "清涼", "紫外線吸収"];
export const ALL_CATS = [...CAT_ORDER, ...FUNC_ORDER];

export const metaOf = cat => CAT_META[cat] || OTHER_META;
export const catVars = cat => `--cc:var(--c-${metaOf(cat)[0]});--cs:var(--c-${metaOf(cat)[0]}-s)`;
export const ci = (cat, size) => `<span class="ci${size ? " " + size : ""}" style="${catVars(cat)}">${metaOf(cat)[1]}</span>`;
