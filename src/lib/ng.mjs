// NG成分グループ。legacy/index.html の NG_GROUPS と同じ。source は client 側へ正規表現を渡すため。
export const NG_GROUPS = [
  { key: "ethanol",   label: "エタノール",           re: /^(無水)?エタノール$|^変性アルコール$|^アルコール$/ },
  { key: "fragrance", label: "香料",                 re: /^(合成)?香料$/ },
  { key: "paraben",   label: "パラベン",             re: /パラベン|パラオキシ安息香酸/ },
  { key: "phenoxy",   label: "フェノキシエタノール", re: /^フェノキシエタノール$/ },
  { key: "color",     label: "合成着色料",           re: /^(赤|黄|青|緑|橙|紫)[0-9]+号?$|^(赤|黄|青|緑|橙|紫)色[0-9]+号$/ },
  { key: "mineral",   label: "鉱物油",               re: /^(ミネラルオイル|流動パラフィン)$/ },
  { key: "silicone",  label: "シリコーン",           re: /ジメチコン|メチコン|シロキサン|シリコーン/ },
  { key: "pg",        label: "PG",                   re: /^(PG|プロピレングリコール)$/ }
];
export const SKIN_TYPES = ["乾燥肌", "脂性肌", "混合肌", "普通肌", "敏感肌", "ゆらぎ肌"];

export const ngGroupsOf = name => NG_GROUPS.filter(g => g.re.test(name));
