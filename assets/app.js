/* ============================================================
   Design Case Atlas
   数据驱动：所有内容来自 data/cases.json
   ============================================================ */

const $ = (sel, root = document) => root.querySelector(sel);

const esc = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[ch]));

const state = {
  cases: [],
  meta: {},
  industry: "全部",
  q: "",
  current: null,
  view: null, // "case" | "compare"
  compareMode: false,
  compare: [],
};

const overlay = $("#overlay");
const sheet = $("#sheet");
const grid = $("#grid");
const empty = $("#empty");
const compareBar = $("#compareBar");
const progress = $("#progress");
let lastFocused = null;

/* ---------- 工具 ---------- */

const gateTotal = (c) => (c.resources || []).reduce((sum, r) => sum + (Number(r.level) || 0), 0);
const gateMax = (c) => (c.resources || []).length * 5;

const levelBars = (c, small = false) =>
  (c.resources || [])
    .map((r) => {
      const lv = Number(r.level) || 0;
      return `<i class="${lv >= 5 ? "top" : ""}" style="--lv:${lv}" title="${esc(r.name)}：${lv}/5"></i>`;
    })
    .join("");

/* ---------- 数据 ---------- */

async function load() {
  let data;
  try {
    const res = await fetch("data/cases.json", { cache: "no-cache" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
  } catch (err) {
    grid.innerHTML =
      '<p style="padding:40px 0;color:var(--ink-3)">数据加载失败：' +
      esc(err.message) +
      "。请用本地服务器打开（例如 <code>python -m http.server</code>），不要直接双击 HTML 文件。</p>";
    return;
  }

  state.meta = data.meta || {};
  state.cases = (data.cases || []).map((item) => ({
    ...item,
    _haystack: [
      item.name,
      item.nameEn,
      item.industry,
      item.type,
      item.location,
      item.oneLiner,
      item.positioning,
      item.model,
      ...(item.tags || []),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase(),
  }));

  renderStats();
  renderFilters();
  renderGrid();
  applyHash();
}

/* ---------- 顶部统计 ---------- */

function renderStats() {
  const industries = new Set(state.cases.map((c) => c.industry).filter(Boolean));
  const updated = state.meta.updated || new Date().toISOString().slice(0, 10);

  $("#stats").innerHTML = `
    <div class="stat"><b>${state.cases.length}</b><span>案例</span></div>
    <div class="stat"><b>${industries.size}</b><span>行业</span></div>
    <div class="stat"><b>${esc(updated.replace(/-/g, "."))}</b><span>最后更新</span></div>
  `;
}

/* ---------- 筛选 ---------- */

function renderFilters() {
  const industries = [...new Set(state.cases.map((c) => c.industry).filter(Boolean))];
  const items = ["全部", ...industries];

  $("#filters").innerHTML = items
    .map(
      (name) =>
        `<button class="chip${name === state.industry ? " is-active" : ""}" data-industry="${esc(
          name
        )}">${esc(name)}</button>`
    )
    .join("");

  $("#filters")
    .querySelectorAll(".chip")
    .forEach((chip) => {
      chip.addEventListener("click", () => {
        state.industry = chip.dataset.industry;
        renderFilters();
        renderGrid();
      });
    });
}

/* ---------- 网格 ---------- */

function filtered() {
  const q = state.q.trim().toLowerCase();
  return state.cases.filter((c) => {
    const byIndustry = state.industry === "全部" || c.industry === state.industry;
    const byQuery = !q || c._haystack.includes(q);
    return byIndustry && byQuery;
  });
}

function renderGrid() {
  const list = filtered();
  empty.hidden = list.length > 0;

  grid.innerHTML = list
    .map((c) => {
      const total = gateTotal(c);
      const max = gateMax(c);
      const pct = max ? Math.round((total / max) * 100) : 0;
      return `
    <article class="card${state.compare.includes(c.id) ? " is-selected" : ""}" role="button" tabindex="0"
      data-id="${esc(c.id)}" aria-label="${state.compareMode ? "选择" : "查看"} ${esc(c.name)}">
      ${state.compareMode ? `<span class="pick">✓</span>` : ""}
      <div class="card-top">
        <span>${esc(c.industry)}</span>
        ${c.type ? `<span class="card-type">${esc(c.type)}</span>` : ""}
      </div>
      <h3 class="card-title">${esc(c.name)}</h3>
      <p class="card-oneliner">${esc(c.oneLiner)}</p>
      <div class="card-snapshot">
        ${(c.snapshot || [])
          .slice(0, 3)
          .map((s) => `<div><b>${esc(s.value)}</b><span>${esc(s.label)}</span></div>`)
          .join("")}
      </div>
      <div class="card-gate">
        <span>门槛</span>
        <span class="bar"><i style="width:${pct}%"></i></span>
        <b>${total}<span style="color:var(--ink-3)">/${max}</span></b>
      </div>
      <div class="card-foot">
        <span>${esc([c.location, c.founded].filter(Boolean).join(" · "))}</span>
        <span class="arrow">${state.compareMode ? "选择" : "查看拆解"} →</span>
      </div>
    </article>`;
    })
    .join("");

  grid.querySelectorAll(".card").forEach((card) => {
    const activate = () => {
      if (state.compareMode) toggleCompare(card.dataset.id, card);
      else openCase(card.dataset.id);
    };
    card.addEventListener("click", activate);
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        activate();
      }
    });
  });
}

/* ---------- 详情 ---------- */

function fingerprintBlock(c) {
  const res = c.resources || [];
  if (!res.length) return "";
  const total = gateTotal(c);
  const max = gateMax(c);

  return `
    <div class="fingerprint">
      ${res
        .map(
          (r) => `<div class="fp-col${Number(r.level) >= 5 ? " is-top" : ""}">
            <span class="fp-val">${Number(r.level) || 0}</span>
            <i class="fp-bar" style="--lv:${Number(r.level) || 0}"></i>
          </div>`
        )
        .join("")}
    </div>
    <div class="fp-labels">
      ${res.map((r) => `<span>${esc(r.short || r.name)}</span>`).join("")}
    </div>
    <p class="fp-note">门槛总分 ${total} / ${max}　·　5 分 = 没有它这件事根本做不成</p>
  `;
}

function openCase(id) {
  const c = state.cases.find((x) => x.id === id);
  if (!c) return;

  state.current = c;
  state.view = "case";
  lastFocused = document.activeElement;

  sheet.innerHTML = `
    <header class="sheet-head">
      <div>
        <div class="kicker">
          <span>${esc(c.industry)}</span>
          ${c.location ? `<span>${esc(c.location)}</span>` : ""}
          ${c.founded ? `<span>${esc(c.founded)}创立</span>` : ""}
          ${c.type ? `<span>${esc(c.type)}</span>` : ""}
        </div>
        <h2 id="sheet-title">${esc(c.name)}</h2>
        <p class="oneliner">${esc(c.oneLiner)}</p>
      </div>
      <button class="close" type="button" aria-label="关闭">✕</button>
    </header>

    ${
      (c.snapshot || []).length
        ? `<div class="sheet-snapshot">${c.snapshot
            .map((s) => `<div><b>${esc(s.value)}</b><span>${esc(s.label)}</span></div>`)
            .join("")}</div>`
        : ""
    }

    ${
      c.positioning
        ? `<div class="section-title">定位</div><p class="body">${esc(c.positioning)}</p>`
        : ""
    }

    ${
      (c.growth || []).length
        ? `<div class="section-title">成长路径</div>
           <ol class="timeline">${c.growth
             .map(
               (g) => `<li>
                 <span class="phase">${esc(g.phase)}</span>
                 <h4>${esc(g.title)}</h4>
                 <p>${esc(g.detail)}</p>
               </li>`
             )
             .join("")}</ol>`
        : ""
    }

    ${(c.resources || []).length ? `<div class="section-title">门槛指纹</div>${fingerprintBlock(c)}` : ""}

    ${
      (c.monetization || []).length
        ? `<div class="section-title">怎么赚钱</div>
           <ul class="money-list">${c.monetization
             .map((m) => `<li><b>${esc(m.name)}</b><span>${esc(m.detail)}</span></li>`)
             .join("")}</ul>`
        : ""
    }

    ${
      (c.resources || []).length
        ? `<div class="section-title">需要什么</div>
           <table class="res">
             <thead><tr><th>能力 / 资源</th><th>具体要求</th><th>门槛</th></tr></thead>
             <tbody>${c.resources
               .map(
                 (r) => `<tr>
                   <td>${esc(r.name)}</td>
                   <td class="need">${esc(r.need)}${
                   r.note ? `<span class="note">${esc(r.note)}</span>` : ""
                 }</td>
                   <td>${[1, 2, 3, 4, 5]
                     .map((i) => `<i class="dot" style="opacity:${i <= (Number(r.level) || 0) ? 1 : .18}"></i>`)
                     .join("")}</td>
                 </tr>`
               )
               .join("")}</tbody>
           </table>`
        : ""
    }

    ${
      (c.learnable || []).length || (c.notLearnable || []).length
        ? `<div class="section-title">可迁移 / 不可迁移</div>
           <div class="two-col">
             <div class="learn">
               <h3>能学的</h3>
               <ul>${(c.learnable || []).map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
             </div>
             <div class="dont">
               <h3>学不来的</h3>
               <ul>${(c.notLearnable || []).map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
             </div>
           </div>`
        : ""
    }

    ${
      c.takeaway
        ? `<div class="section-title">一句话</div>
           <div class="takeaway">
             <blockquote>${esc(c.takeaway)}</blockquote>
             ${c.fitFor ? `<p class="fit">${esc(c.fitFor)}</p>` : ""}
           </div>`
        : ""
    }

    ${
      (c.sources || []).length
        ? `<div class="section-title">来源</div>
           <ul class="sources">${c.sources
             .map(
               (s) =>
                 `<li><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(
                   s.label
                 )}</a></li>`
             )
             .join("")}</ul>`
        : ""
    }
  `;

  showOverlay();

  if (location.hash !== `#case/${id}`) {
    history.pushState({ view: "case", id }, "", `#case/${id}`);
  }
}

function openCompare(ids) {
  const items = ids.map((id) => state.cases.find((c) => c.id === id)).filter(Boolean);
  if (items.length < 2) return;

  state.view = "compare";
  state.current = null;
  lastFocused = document.activeElement;

  const rows = [
    ["类型", (c) => esc(c.type || "—")],
    ["地区", (c) => esc([c.location, c.founded].filter(Boolean).join(" · ") || "—")],
    ["商业模式", (c) => esc(c.model || "—")],
    ["定位", (c) => esc(c.positioning || c.oneLiner || "—")],
    [
      "门槛",
      (c) =>
        `<div class="cmp-bars">${levelBars(c, true)}</div>
         <div class="cmp-total">${gateTotal(c)} / ${gateMax(c)}</div>`,
    ],
    ["一句话", (c) => esc(c.takeaway || "—")],
  ];

  sheet.innerHTML = `
    <div class="cmp-wrap">
      <header class="sheet-head">
        <div>
          <h2 id="sheet-title" class="cmp-title">并排对比</h2>
          <p class="cmp-sub">同一套坐标下看两个案例，差异本身就是结论。</p>
        </div>
        <button class="close" type="button" aria-label="关闭">✕</button>
      </header>
      <table class="cmp">
        <thead>
          <tr>
            <th></th>
            ${items
              .map(
                (c) => `<th class="name">${esc(c.name)}<span class="sub">${esc(c.industry)}</span></th>`
              )
              .join("")}
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              ([label, fn]) =>
                `<tr><th>${label}</th>${items.map((c) => `<td>${fn(c)}</td>`).join("")}</tr>`
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;

  showOverlay();
  if (location.hash) history.replaceState(null, "", location.pathname + location.search);
}

function showOverlay() {
  overlay.hidden = false;
  compareBar.hidden = true;
  document.body.style.overflow = "hidden";
  overlay.scrollTop = 0;
  progress.style.width = "0%";

  const closeBtn = sheet.querySelector(".close");
  if (closeBtn) {
    closeBtn.addEventListener("click", closeCase);
    closeBtn.focus({ preventScroll: true });
  }
}

function closeCase() {
  if (overlay.hidden) return;
  overlay.hidden = true;
  state.current = null;
  state.view = null;
  document.body.style.overflow = "";
  progress.style.width = "0%";

  if (location.hash.startsWith("#case/")) {
    history.replaceState(null, "", location.pathname + location.search);
  }
  if (lastFocused && document.contains(lastFocused)) {
    lastFocused.focus({ preventScroll: true });
  }
  if (state.compareMode) renderCompareBar();
}

function applyHash() {
  if (state.view === "compare") return;
  const match = location.hash.match(/^#case\/(.+)$/);
  if (match) {
    const id = decodeURIComponent(match[1]);
    if (!state.current || state.current.id !== id) openCase(id);
  } else if (!overlay.hidden) {
    closeCase();
  }
}

/* ---------- 对比模式 ---------- */

function setCompareMode(on) {
  state.compareMode = on;
  if (!on) state.compare = [];
  $("#compareBtn").classList.toggle("is-active", on);
  renderGrid();
  renderCompareBar();
}

function toggleCompare(id, card) {
  const i = state.compare.indexOf(id);
  if (i >= 0) {
    state.compare.splice(i, 1);
    card.classList.remove("is-selected");
  } else if (state.compare.length < 3) {
    state.compare.push(id);
    card.classList.add("is-selected");
  }
  renderCompareBar();
}

function renderCompareBar() {
  if (!state.compareMode) {
    compareBar.hidden = true;
    return;
  }

  const n = state.compare.length;
  compareBar.hidden = false;
  compareBar.innerHTML = `
    <span>已选 ${n} / 3</span>
    <button class="primary" id="doCompare" ${n < 2 ? "disabled" : ""}>开始对比</button>
    <button id="cancelCompare">退出</button>
  `;

  $("#doCompare").addEventListener("click", () => openCompare(state.compare));
  $("#cancelCompare").addEventListener("click", () => setCompareMode(false));
}

/* ---------- 主题 ---------- */

const SUN = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.1 5.1l1.6 1.6M17.3 17.3l1.6 1.6M18.9 5.1l-1.6 1.6M6.7 17.3l-1.6 1.6"/></svg>';
const MOON = '<svg viewBox="0 0 24 24"><path d="M20.5 14.6A8.5 8.5 0 0 1 9.4 3.5a8.5 8.5 0 1 0 11.1 11.1Z"/></svg>';

function effectiveTheme() {
  const attr = document.documentElement.getAttribute("data-theme");
  if (attr === "light" || attr === "dark") return attr;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function paintThemeButton() {
  const btn = $("#themeBtn");
  const current = effectiveTheme();
  btn.innerHTML = current === "dark" ? SUN : MOON;
  btn.title = current === "dark" ? "切换到浅色" : "切换到深色";
}

function initTheme() {
  paintThemeButton();
  $("#themeBtn").addEventListener("click", () => {
    const next = effectiveTheme() === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("atlas-theme", next);
    } catch (e) {}
    paintThemeButton();
  });
}

/* ---------- 阅读进度 ---------- */

overlay.addEventListener("scroll", () => {
  if (overlay.hidden) return;
  const max = overlay.scrollHeight - overlay.clientHeight;
  if (max <= 0) {
    progress.style.width = "0%";
    return;
  }
  progress.style.width = `${(overlay.scrollTop / max) * 100}%`;
});

/* ---------- 事件 ---------- */

overlay.addEventListener("mousedown", (e) => {
  if (e.target === overlay) closeCase();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeCase();
});

window.addEventListener("hashchange", applyHash);
window.addEventListener("popstate", applyHash);

$("#search").addEventListener("input", (e) => {
  state.q = e.target.value;
  renderGrid();
});

$("#compareBtn").addEventListener("click", () => setCompareMode(!state.compareMode));

window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  if (!document.documentElement.getAttribute("data-theme")) paintThemeButton();
});

/* ---------- boot ---------- */

initTheme();
load();
