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
};

const overlay = $("#overlay");
const sheet = $("#sheet");
const grid = $("#grid");
const empty = $("#empty");
let lastFocused = null;

/* ---------- data ---------- */

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

/* ---------- masthead stats ---------- */

function renderStats() {
  const industries = new Set(state.cases.map((c) => c.industry).filter(Boolean));
  const updated = state.meta.updated || new Date().toISOString().slice(0, 10);

  $("#stats").innerHTML = `
    <div class="stat"><b>${state.cases.length}</b><span>案例</span></div>
    <div class="stat"><b>${industries.size}</b><span>行业</span></div>
    <div class="stat"><b>${esc(updated.replace(/-/g, "."))}</b><span>最后更新</span></div>
  `;
}

/* ---------- filters ---------- */

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

/* ---------- grid ---------- */

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
    .map(
      (c) => `
    <article class="card" role="button" tabindex="0" data-id="${esc(c.id)}" aria-label="查看 ${esc(
        c.name
      )} 的拆解">
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
      <div class="card-foot">
        <span>${esc([c.location, c.founded].filter(Boolean).join(" · "))}</span>
        <span class="arrow">查看拆解 →</span>
      </div>
    </article>`
    )
    .join("");

  grid.querySelectorAll(".card").forEach((card) => {
    const open = () => openCase(card.dataset.id);
    card.addEventListener("click", open);
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        open();
      }
    });
  });
}

/* ---------- detail ---------- */

const levelBar = (n) => {
  const v = Number(n) || 0;
  return `<span class="level">${[1, 2, 3, 4, 5]
    .map((i) => `<i class="${i <= v ? "on" : ""}"></i>`)
    .join("")}</span>`;
};

function openCase(id) {
  const c = state.cases.find((x) => x.id === id);
  if (!c) return;

  state.current = c;
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
                   <td>${levelBar(r.level)}</td>
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

  overlay.hidden = false;
  document.body.style.overflow = "hidden";
  overlay.scrollTop = 0;

  sheet.querySelector(".close").addEventListener("click", closeCase);
  sheet.querySelector(".close").focus({ preventScroll: true });

  if (location.hash !== `#case/${id}`) {
    history.pushState({ case: id }, "", `#case/${id}`);
  }
}

function closeCase() {
  if (overlay.hidden) return;
  overlay.hidden = true;
  state.current = null;
  document.body.style.overflow = "";

  if (location.hash.startsWith("#case/")) {
    history.replaceState(null, "", location.pathname + location.search);
  }
  if (lastFocused && document.contains(lastFocused)) {
    lastFocused.focus({ preventScroll: true });
  }
}

function applyHash() {
  const match = location.hash.match(/^#case\/(.+)$/);
  if (match) {
    const id = decodeURIComponent(match[1]);
    if (!state.current || state.current.id !== id) openCase(id);
  } else if (!overlay.hidden) {
    closeCase();
  }
}

/* ---------- events ---------- */

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

/* ---------- boot ---------- */

load();
