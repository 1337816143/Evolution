(() => {
  const script = document.querySelector('script[src*="global-search.js"]');
  if (!script) return;

  const siteRoot = new URL("../", script.src);
  const indexUrl = new URL("data/search-index.json", siteRoot);
  const state = { index: null, query: "", active: 0, filtered: [] };
  const normalize = (value = "") => String(value).normalize("NFKC").toLocaleLowerCase("zh-CN").replace(/\s+/g, " ").trim();
  const compact = (value = "") => normalize(value).replace(/[\s\p{P}\p{S}]+/gu, "");
  const isTypingTarget = (target) => target && (target.matches?.("input,textarea,select,[contenteditable=true]") || target.closest?.("input,textarea,select,[contenteditable=true]"));

  function create(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  const overlay = create("div", "global-search-overlay");
  overlay.hidden = true;
  overlay.innerHTML = `
    <div class="global-search-backdrop" data-global-search-close></div>
    <section class="global-search-dialog" role="dialog" aria-modal="true" aria-label="全站搜索">
      <header class="global-search-head">
        <span class="global-search-logo">⌕</span>
        <input type="search" autocomplete="off" spellcheck="false" placeholder="搜索整个个人进化站：模块、报告、提示词、系统页面…" data-global-search-input>
        <kbd>Esc</kbd>
      </header>
      <div class="global-search-meta"><span data-global-search-status>输入关键词开始搜索</span><span>↑↓ 选择 · Enter 打开</span></div>
      <div class="global-search-results" data-global-search-results></div>
      <footer class="global-search-foot"><span>⌘/Ctrl + K 随时打开</span><span>索引随网站构建自动更新</span></footer>
    </section>`;
  document.body.append(overlay);

  const input = overlay.querySelector("[data-global-search-input]");
  const results = overlay.querySelector("[data-global-search-results]");
  const status = overlay.querySelector("[data-global-search-status]");

  if (!document.querySelector("[data-global-search-trigger]")) {
    const floating = create("button", "global-search-floating");
    floating.type = "button";
    floating.dataset.globalSearchTrigger = "";
    floating.setAttribute("aria-label", "全站搜索");
    floating.innerHTML = '<span>⌕</span><span>全站搜索</span><kbd>⌘K</kbd>';
    document.body.append(floating);
  }

  async function loadIndex() {
    if (state.index) return state.index;
    const response = await fetch(indexUrl, { cache: "no-store" });
    if (!response.ok) throw new Error(`搜索索引加载失败：${response.status}`);
    state.index = await response.json();
    return state.index;
  }

  function score(entry, rawQuery) {
    const q = normalize(rawQuery);
    if (!q) return entry.type === "module" ? 10 : entry.type === "prompt" ? 8 : 4;
    const qCompact = compact(q);
    const tokens = q.split(/\s+/).filter(Boolean);
    const title = normalize(entry.title);
    const summary = normalize(entry.summary);
    const keywords = normalize(entry.keywords);
    const text = normalize(entry.text);
    const titleCompact = compact(title);
    const textCompact = compact(`${summary} ${keywords} ${text}`);
    let value = 0;
    if (title === q) value += 140;
    if (title.includes(q)) value += 90;
    if (qCompact && titleCompact.includes(qCompact)) value += 60;
    if (summary.includes(q)) value += 34;
    if (keywords.includes(q)) value += 44;
    if (text.includes(q)) value += 18;
    if (qCompact && textCompact.includes(qCompact)) value += 12;
    for (const token of tokens) {
      if (title.includes(token)) value += 24;
      else if (keywords.includes(token)) value += 12;
      else if (summary.includes(token)) value += 8;
      else if (text.includes(token)) value += 4;
      else return 0;
    }
    if (entry.type === "prompt") value += 3;
    if (entry.type === "module") value += 2;
    return value;
  }

  function snippet(entry, query) {
    const fallback = entry.summary || entry.text || "";
    if (!query) return fallback.slice(0, 180);
    const source = String(entry.text || entry.summary || "").replace(/\s+/g, " ");
    const index = normalize(source).indexOf(normalize(query));
    if (index < 0) return fallback.slice(0, 180);
    const start = Math.max(0, index - 70);
    const end = Math.min(source.length, index + query.length + 120);
    return `${start > 0 ? "…" : ""}${source.slice(start, end)}${end < source.length ? "…" : ""}`;
  }

  function render() {
    results.replaceChildren();
    const entries = state.index?.entries || [];
    const scored = entries
      .map((entry) => ({ entry, score: score(entry, state.query) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || String(a.entry.title).localeCompare(String(b.entry.title), "zh-CN"))
      .slice(0, state.query ? 40 : 12);
    state.filtered = scored.map((item) => item.entry);
    if (state.active >= state.filtered.length) state.active = Math.max(0, state.filtered.length - 1);

    status.textContent = state.query
      ? `找到 ${state.filtered.length} 个相关结果${entries.length > state.filtered.length ? ` · 全站索引 ${entries.length} 项` : ""}`
      : `全站索引 ${entries.length} 项 · 输入关键词搜索`;

    if (!state.filtered.length) {
      const empty = create("div", "global-search-empty");
      empty.innerHTML = '<span>⌕</span><h3>没有找到匹配内容</h3><p>试试更短的关键词、模块名称、Prompt用途或报告主题。</p>';
      results.append(empty);
      return;
    }

    state.filtered.forEach((entry, index) => {
      const link = create("a", `global-search-result${index === state.active ? " active" : ""}`);
      link.href = new URL(entry.url, siteRoot).href;
      link.dataset.resultIndex = String(index);
      const icon = create("span", `global-search-type type-${entry.type}`, entry.type === "prompt" ? "✦" : entry.type === "module" ? "◉" : entry.type === "report" ? "▤" : "⌁");
      const copy = create("div", "global-search-result-copy");
      const top = create("div", "global-search-result-top");
      top.append(create("b", "", entry.title), create("span", "", entry.typeLabel || entry.type));
      copy.append(top, create("p", "", snippet(entry, state.query)));
      const arrow = create("span", "global-search-arrow", "→");
      link.append(icon, copy, arrow);
      link.addEventListener("mouseenter", () => { state.active = index; updateActive(); });
      results.append(link);
    });
  }

  function updateActive() {
    [...results.querySelectorAll(".global-search-result")].forEach((element, index) => {
      element.classList.toggle("active", index === state.active);
      if (index === state.active) element.scrollIntoView({ block: "nearest" });
    });
  }

  async function openSearch(seed = "") {
    overlay.hidden = false;
    document.body.classList.add("global-search-open");
    input.value = seed;
    state.query = seed;
    state.active = 0;
    status.textContent = "正在加载全站索引…";
    try {
      await loadIndex();
      render();
    } catch (error) {
      status.textContent = error.message;
      results.innerHTML = `<div class="global-search-empty"><span>!</span><h3>搜索暂不可用</h3><p>${error.message}</p></div>`;
    }
    setTimeout(() => input.focus(), 20);
  }

  function closeSearch() {
    overlay.hidden = true;
    document.body.classList.remove("global-search-open");
  }

  document.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-global-search-trigger]");
    if (trigger) { event.preventDefault(); openSearch(); }
    if (event.target.closest("[data-global-search-close]")) closeSearch();
  });

  input.addEventListener("input", () => {
    state.query = input.value.trim();
    state.active = 0;
    render();
  });

  input.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown") { event.preventDefault(); state.active = Math.min(state.active + 1, state.filtered.length - 1); updateActive(); }
    if (event.key === "ArrowUp") { event.preventDefault(); state.active = Math.max(state.active - 1, 0); updateActive(); }
    if (event.key === "Enter" && state.filtered[state.active]) {
      event.preventDefault();
      window.location.href = new URL(state.filtered[state.active].url, siteRoot).href;
    }
  });

  document.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      overlay.hidden ? openSearch() : closeSearch();
      return;
    }
    if (event.key === "Escape" && !overlay.hidden) closeSearch();
    if (event.key === "/" && overlay.hidden && !isTypingTarget(event.target)) {
      event.preventDefault();
      openSearch();
    }
  });

  async function focusPromptFromUrl() {
    const promptId = new URLSearchParams(window.location.search).get("globalPrompt");
    if (!promptId) return;
    try {
      const index = await loadIndex();
      const entry = (index.entries || []).find((item) => item.promptId === promptId);
      if (!entry) return;
      let attempts = 0;
      const timer = setInterval(() => {
        attempts += 1;
        const promptSearch = document.querySelector("[data-prompt-search]");
        if (promptSearch) {
          promptSearch.value = entry.title;
          promptSearch.dispatchEvent(new Event("input", { bubbles: true }));
          clearInterval(timer);
        } else if (attempts > 30) clearInterval(timer);
      }, 100);
    } catch { /* deep-link enrichment failure does not disable global search */ }
  }

  focusPromptFromUrl();
})();
