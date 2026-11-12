/* コスメ研究所：クライアント側。
   ページ本体は静的HTMLで配信し、ここでは「閲覧者ごとに変わるところ」だけを上書きする。
   - 肌質とNG成分の設定（localStorage）
   - NG判定の表示（サーバー側は「注意成分」を出しておき、設定があれば言い換える）
   - 一覧の検索・絞り込み、比較リスト
   NG_GROUPS と SKIN_TYPES はビルド時に src/lib/ng.mjs から埋め込む。 */
(() => {
"use strict";
const NG_GROUPS = /*__NG_GROUPS__*/[];
const SKIN_TYPES = /*__SKIN_TYPES__*/[];
const BASE = document.documentElement.dataset.base || "/";

const ICON_WARN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17h.01"/></svg>';
const ICON_OK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/></svg>';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
const yen = n => n == null ? "価格未確認" : "¥" + Number(n).toLocaleString("ja-JP");
function load(k, d) { try { const v = JSON.parse(localStorage.getItem("cl_" + k)); return v ?? d; } catch (e) { return d; } }
function save(k, v) { try { localStorage.setItem("cl_" + k, JSON.stringify(v)); } catch (e) {} }

// 初期値は legacy と同じ（乾燥肌・敏感肌／エタノール・香料）
const prefs = load("prefs", { skin: ["乾燥肌", "敏感肌"], ng: ["ethanol", "fragrance"] });
let compare = load("compare", []);
const labelOf = k => (NG_GROUPS.find(g => g.key === k) || {}).label || k;

function toast(msg) {
  const t = $("#toast"); if (!t) return;
  t.textContent = msg; t.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => { t.hidden = true; }, 2200);
}

// ---------- NG判定の個人化 ----------
// 商品が持つ注意成分グループ（data-caution）と、閲覧者のNG設定の重なりを取る
const hitsOf = el => (el.dataset.caution || "").split(/\s+/).filter(k => k && prefs.ng.includes(k)).map(labelOf);

function applyCards() {
  for (const card of $$("[data-pid][data-caution]")) {
    const slot = card.querySelector("[data-ngslot]");
    if (!slot) continue;
    const tag = slot.querySelector(".tag.ng, .tag.ok");
    if (!tag) continue;
    if (!prefs.ng.length) continue; // 設定が空なら、サーバー側の「注意成分」表示のまま
    const h = hitsOf(card);
    if (h.length) { tag.className = "tag ng"; tag.innerHTML = ICON_WARN + "NG：" + esc(h.join("・")); }
    else { tag.className = "tag ok"; tag.innerHTML = ICON_OK + "NG成分なし"; }
  }
}

function applyVerdict() {
  const v = $("#verdict");
  if (!v) return;
  const h = hitsOf(v);
  const names = prefs.ng.map(labelOf).join("、") || "なし";
  if (h.length) {
    v.className = "verdict ng";
    v.innerHTML = `<b class="vh">${ICON_WARN}あなたのNG成分が入っています</b><p>含まれるNG成分：${esc(h.join("、"))}</p>`;
  } else {
    v.className = "verdict ok";
    v.innerHTML = `<b class="vh">${ICON_OK}あなたのNG成分は入っていません</b><p>設定中のNG成分（${esc(names)}）は全成分に見当たりません。</p>`;
  }
}

function applyIngRows() {
  for (const a of $$(".ingbtn[data-cg]")) {
    const hit = (a.dataset.cg || "").split(/\s+/).some(k => k && prefs.ng.includes(k));
    a.classList.toggle("hit", hit);
    const row = a.querySelector(".nmrow");
    if (!row) continue;
    const pill = row.querySelector(".ngpill");
    if (hit && !pill) row.insertAdjacentHTML("beforeend", `<span class="ngpill">${ICON_WARN}NG</span>`);
    if (!hit && pill) pill.remove();
  }
}

function applyCond() {
  const t = $("#condtext");
  if (!t) return;
  t.textContent = `${prefs.skin.join("・") || "肌質未設定"} ／ NG成分：${prefs.ng.map(labelOf).join("、") || "なし"}`;
}

function applyAll() { applyCond(); applyCards(); applyVerdict(); applyIngRows(); applyChips(); applyBadge(); }

// ---------- 比較リスト ----------
function applyBadge() {
  const b = $("#cmpbadge");
  if (b) { b.textContent = compare.length; b.hidden = !compare.length; }
  for (const btn of $$("[data-cmp]")) {
    const on = compare.includes(btn.dataset.cmp);
    if (btn.dataset.cmpRemove !== undefined) continue;
    btn.classList.toggle("on", on);
    btn.setAttribute("aria-pressed", String(on));
    btn.textContent = on ? "✓ 比較中" : "＋ 比較";
  }
}
function toggleCompare(id) {
  if (compare.includes(id)) { compare = compare.filter(x => x !== id); toast("比較リストから外しました"); }
  else if (compare.length >= 3) { toast("比較できるのは3つまでです"); return; }
  else { compare = compare.concat(id); toast("比較リストに追加しました"); }
  save("compare", compare); applyBadge();
  if ($("#cmparea")) renderCompare();
}

// ---------- 一覧の検索・絞り込み ----------
let filter = "all";
function applyChips() {
  for (const c of $$("[data-filter]")) c.setAttribute("aria-pressed", String(c.dataset.filter === filter));
}
function applyList() {
  const list = $("#plist");
  if (!list) return;
  const q = ($("#q") && $("#q").value || "").trim().toLowerCase();
  const terms = q ? q.split(/\s+/) : [];
  let n = 0;
  for (const card of list.querySelectorAll("[data-pid]")) {
    const hay = card.dataset.hay || "";
    let ok = terms.every(t => hay.includes(t));
    if (ok && filter === "ok") ok = !hitsOf(card).length && card.dataset.has !== "0";
    if (ok && filter === "cos") ok = card.dataset.kind === "化粧品";
    if (ok && filter === "quasi") ok = card.dataset.kind === "医薬部外品";
    card.hidden = !ok;
    if (ok) n++;
  }
  const c = $("#listcount");
  if (c) c.textContent = `化粧水 ${n}件`;
  const e = $("#listempty");
  if (e) e.hidden = n > 0;
}

// 成分一覧の絞り込み
function applyIngFilter() {
  const list = $("#inglist");
  if (!list) return;
  const q = ($("#q") && $("#q").value || "").trim().toLowerCase();
  let n = 0;
  for (const li of list.querySelectorAll("li[data-name]")) {
    const ok = !q || li.dataset.name.toLowerCase().includes(q);
    li.hidden = !ok;
    if (ok) n++;
  }
  const c = $("#listcount");
  if (c) c.textContent = `成分 ${n}種`;
}

// ---------- 比較ページ ----------
let CATALOG = null;
async function catalog() {
  if (CATALOG) return CATALOG;
  const r = await fetch(BASE + "products.json");
  CATALOG = await r.json();
  return CATALOG;
}
async function renderCompare() {
  const area = $("#cmparea");
  if (!area) return;
  const cat = await catalog();
  const ps = compare.map(id => cat.products.find(p => p.id === id)).filter(Boolean);
  if (!ps.length) {
    area.innerHTML = `<div class="card empty">比較する商品がありません。<br>商品の「＋ 比較」を押すと、ここに並びます（最大3つ）。</div>
      <a class="pillbtn solid" href="${BASE}">化粧水をさがす</a>`;
    return;
  }
  const sets = ps.map(p => new Set([...(p.active || []), ...(p.ing || [])]));
  const common = ps.length > 1 ? [...sets[0]].filter(n => sets.every(s => s.has(n))) : [];
  const cell = f => ps.map(p => `<td>${f(p)}</td>`).join("");
  const ngOf = p => {
    if (!p.ing.length) return `<span class="tag">確認中</span>`;
    const h = (p.caution || []).filter(k => prefs.ng.includes(k)).map(labelOf);
    return h.length ? `<span class="tag ng">${ICON_WARN}NG：${esc(h.join("・"))}</span>` : `<span class="tag ok">${ICON_OK}NG成分なし</span>`;
  };
  const ingTag = n => `<a class="tag" href="${BASE}ingredients/${encodeURIComponent(cat.slugs[n] || n)}/">${esc(n)}</a>`;
  area.innerHTML = `<div class="cmpwrap"><table class="cmp">
      <tr><th>商品</th>${cell(p => `<a class="pname" style="font-size:13px" href="${BASE}products/${p.id}/">${esc(p.name)}</a><div class="meta" style="font-size:12px">${esc(p.brand)}</div>`)}</tr>
      <tr><th>区分</th>${cell(p => `<span class="kind${p.kind === "医薬部外品" ? " q" : ""}">${esc(p.kind)}</span>`)}</tr>
      <tr><th>価格</th>${cell(p => `${yen(p.price)}<div class="meta" style="font-size:12px">${esc(p.size || "")}</div>`)}</tr>
      <tr><th>1mLあたり</th>${cell(p => p.perMl ? `約${p.perMl}円` : "—")}</tr>
      <tr><th>NG判定</th>${cell(ngOf)}</tr>
      <tr><th>有効成分</th>${cell(p => esc((p.active || []).join("、") || "—"))}</tr>
      <tr><th>保湿成分</th>${cell(p => (p.moist || 0) + "種")}</tr>
      <tr><th>注意成分</th>${cell(p => p.cautionN || 0)}</tr>
      <tr><th>成分数</th>${cell(p => p.ing.length)}</tr>
      <tr><th></th>${cell(p => `<button type="button" class="pillbtn" data-cmp="${esc(p.id)}" data-cmp-remove>外す</button>`)}</tr>
    </table></div>
    ${ps.length > 1 ? `<section class="card col" style="gap:8px"><h3>共通して入っている成分（${common.length}）</h3><div class="row">${common.map(ingTag).join("") || '<span class="meta">ありません</span>'}</div></section>
      ${ps.map((p, i) => { const only = [...sets[i]].filter(n => sets.every((s, j) => j === i || !s.has(n))); return `<section class="card col" style="gap:8px"><h3>${esc(p.name)}だけの成分（${only.length}）</h3><div class="row">${only.map(ingTag).join("") || '<span class="meta">ありません</span>'}</div></section>`; }).join("")}`
    : `<p class="meta">もう1つ追加すると、共通の成分と違う成分を並べて見られます。</p>`}`;
}

// ---------- マイページ ----------
function renderMyPage() {
  const sk = $("#skinchips"), ng = $("#ngchips");
  if (!sk || !ng) return;
  const draft = { skin: prefs.skin.slice(), ng: prefs.ng.slice() };
  sk.innerHTML = SKIN_TYPES.map(s => `<button type="button" class="chip" data-dskin="${esc(s)}" aria-pressed="${draft.skin.includes(s)}">${esc(s)}</button>`).join("");
  ng.innerHTML = NG_GROUPS.map(g => `<button type="button" class="chip" data-dng="${esc(g.key)}" aria-pressed="${draft.ng.includes(g.key)}">${esc(g.label)}</button>`).join("");
  document.addEventListener("click", e => {
    const t = e.target.closest("[data-dskin],[data-dng],[data-prefs]");
    if (!t) return;
    if (t.dataset.dskin || t.dataset.dng) {
      const [k, v] = t.dataset.dskin ? ["skin", t.dataset.dskin] : ["ng", t.dataset.dng];
      draft[k] = draft[k].includes(v) ? draft[k].filter(x => x !== v) : draft[k].concat(v);
      t.setAttribute("aria-pressed", String(draft[k].includes(v)));
      return;
    }
    if (t.dataset.prefs === "reset") {
      draft.skin = prefs.skin.slice(); draft.ng = prefs.ng.slice();
      renderChipState(); toast("変更前の条件に戻しました"); return;
    }
    if (t.dataset.prefs === "apply") {
      prefs.skin = draft.skin.slice(); prefs.ng = draft.ng.slice(); save("prefs", prefs);
      applyAll(); toast("この条件で判定します"); return;
    }
  });
  function renderChipState() {
    for (const b of sk.querySelectorAll("[data-dskin]")) b.setAttribute("aria-pressed", String(draft.skin.includes(b.dataset.dskin)));
    for (const b of ng.querySelectorAll("[data-dng]")) b.setAttribute("aria-pressed", String(draft.ng.includes(b.dataset.dng)));
  }
}

// ---------- イベント ----------
document.addEventListener("click", e => {
  const t = e.target.closest("button");
  if (!t) return;
  if (t.dataset.cmp) { toggleCompare(t.dataset.cmp); return; }
  if (t.dataset.filter) { filter = t.dataset.filter; applyChips(); applyList(); return; }
  if (t.dataset.ingmode) {
    const m = t.dataset.ingmode;
    for (const b of $$("[data-ingmode]")) b.setAttribute("aria-pressed", String(b.dataset.ingmode === m));
    for (const l of $$("[data-inglist]")) l.hidden = l.dataset.inglist !== m;
    return;
  }
});

const qbox = $("#q");
if (qbox) {
  const p = new URLSearchParams(location.search).get("q");
  if (p) qbox.value = p;
  const run = () => { applyList(); applyIngFilter(); };
  qbox.addEventListener("input", run);
  run();
}

applyAll();
renderMyPage();
renderCompare();
})();
