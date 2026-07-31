(() => {
  const root = document.querySelector("[data-prompt-list]");
  if (!root) return;

  const STORAGE_KEY = "evolution.promptLibrary.local.v1";
  const FAVORITES_KEY = "evolution.promptLibrary.favorites.v1";
  const state = {
    base: [],
    local: {},
    favorites: new Set(),
    filtered: [],
    selectedId: null,
    favoriteOnly: false,
    api: { write: { enabled: false, baseUrl: "" } },
  };

  const $ = (selector, context = document) => context.querySelector(selector);
  const $$ = (selector, context = document) => [...context.querySelectorAll(selector)];
  const normalizeList = (value) => Array.isArray(value) ? value.filter(Boolean).map(String) : String(value || "").split(/[,，]/).map((item) => item.trim()).filter(Boolean);
  const nowIso = () => new Date().toISOString();
  const slugify = (value) => {
    const ascii = String(value || "prompt")
      .normalize("NFKD")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40);
    return ascii || `item-${Date.now().toString(36)}`;
  };
  const formatDate = (value) => {
    if (!value) return "未记录";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  };
  const statusLabel = { active: "使用中", draft: "草稿", archived: "已归档" };
  const sourceLabel = { repository: "仓库", local: "本机", agent: "Agent", import: "导入" };

  function loadLocal() {
    try { state.local = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch { state.local = {}; }
    try { state.favorites = new Set(JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]")); } catch { state.favorites = new Set(); }
  }

  function saveLocal() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.local));
    localStorage.setItem(FAVORITES_KEY, JSON.stringify([...state.favorites]));
  }

  function allPrompts() {
    const merged = new Map(state.base.map((item) => [item.id, { ...item, syncState: "synced" }]));
    Object.values(state.local).forEach((item) => merged.set(item.id, { ...merged.get(item.id), ...item, syncState: "pending" }));
    return [...merged.values()].map((item) => ({ ...item, favorite: state.favorites.has(item.id) || Boolean(item.favorite) }));
  }

  function showToast(message, tone = "success") {
    const toast = $("[data-prompt-toast]");
    toast.textContent = message;
    toast.dataset.tone = tone;
    toast.hidden = false;
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => { toast.hidden = true; }, 2800);
  }

  async function copyText(text, message = "已复制") {
    try {
      await navigator.clipboard.writeText(text);
      showToast(message);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.append(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
      showToast(message);
    }
  }

  function downloadJson(filename, value) {
    const blob = new Blob([JSON.stringify(value, null, 2) + "\n"], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function makeSyncPacket(prompt) {
    const clean = { ...prompt };
    delete clean.syncState;
    delete clean.sourceFile;
    return {
      contract: "evolution.prompt.upsert.v1",
      operation: "upsert",
      target: {
        repository: "1337816143/My-Evolution",
        workflow: ".github/workflows/prompt-upsert.yml",
        command: "node scripts/prompt-upsert.mjs --file=prompt.json",
        publicMirror: "1337816143/Evolution",
      },
      requestedAt: nowIso(),
      prompt: { ...clean, privacy: "public", publish: true },
    };
  }

  function createElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function populateFilters(prompts) {
    const categorySelect = $("[data-prompt-category]");
    const modelSelect = $("[data-prompt-model]");
    const selectedCategory = categorySelect.value;
    const selectedModel = modelSelect.value;
    const categories = [...new Set(prompts.map((item) => item.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-CN"));
    const models = [...new Set(prompts.flatMap((item) => item.modelCompatibility || []).filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-CN"));
    categorySelect.replaceChildren(new Option("全部用途", ""), ...categories.map((item) => new Option(item, item)));
    modelSelect.replaceChildren(new Option("全部模型", ""), ...models.map((item) => new Option(item, item)));
    categorySelect.value = categories.includes(selectedCategory) ? selectedCategory : "";
    modelSelect.value = models.includes(selectedModel) ? selectedModel : "";
  }

  function filterPrompts() {
    const query = $("[data-prompt-search]").value.trim().toLocaleLowerCase("zh-CN");
    const category = $("[data-prompt-category]").value;
    const model = $("[data-prompt-model]").value;
    const status = $("[data-prompt-status]").value;
    const sort = $("[data-prompt-sort]").value;
    let prompts = allPrompts().filter((prompt) => {
      const haystack = [prompt.title, prompt.summary, prompt.content, prompt.category, prompt.subcategory, ...(prompt.tags || []), ...(prompt.modelCompatibility || [])].join(" ").toLocaleLowerCase("zh-CN");
      return (!query || haystack.includes(query)) && (!category || prompt.category === category) && (!model || (prompt.modelCompatibility || []).includes(model)) && (!status || prompt.status === status) && (!state.favoriteOnly || prompt.favorite);
    });
    prompts.sort((a, b) => {
      if (sort === "title-asc") return String(a.title).localeCompare(String(b.title), "zh-CN");
      if (sort === "quality-desc") return Number(b.qualityScore || 0) - Number(a.qualityScore || 0);
      return String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || ""));
    });
    state.filtered = prompts;
    if (!state.selectedId || !prompts.some((item) => item.id === state.selectedId)) state.selectedId = prompts[0]?.id || null;
    render();
  }

  function renderList() {
    const list = $("[data-prompt-list]");
    list.replaceChildren();
    for (const prompt of state.filtered) {
      const button = createElement("button", `prompt-list-item${prompt.id === state.selectedId ? " active" : ""}`);
      button.type = "button";
      const top = createElement("div", "prompt-list-item-top");
      top.append(createElement("b", "", prompt.title), createElement("span", "prompt-mini-star", prompt.favorite ? "★" : "☆"));
      const summary = createElement("p", "", prompt.summary || prompt.content.slice(0, 90));
      const meta = createElement("div", "prompt-list-meta");
      meta.append(createElement("span", "", prompt.category || "未分类"), createElement("span", `prompt-status status-${prompt.status || "draft"}`, statusLabel[prompt.status] || prompt.status || "草稿"), createElement("span", prompt.syncState === "pending" ? "sync-pending" : "sync-ok", prompt.syncState === "pending" ? "待同步" : "已同步"));
      button.append(top, summary, meta);
      button.addEventListener("click", () => { state.selectedId = prompt.id; render(); });
      list.append(button);
    }
    $("[data-prompt-empty]").hidden = state.filtered.length !== 0;
    $("[data-prompt-result-count]").textContent = `${state.filtered.length}项`;
  }

  function renderDetail() {
    const panel = $("[data-prompt-detail]");
    const prompt = allPrompts().find((item) => item.id === state.selectedId);
    if (!prompt) {
      panel.innerHTML = '<div class="prompt-detail-placeholder"><span>✦</span><h2>没有可显示的提示词</h2><p>新增一条，或调整筛选条件。</p></div>';
      return;
    }
    panel.replaceChildren();
    const header = createElement("header", "prompt-detail-head");
    const titleBlock = createElement("div");
    const overline = createElement("div", "prompt-detail-overline");
    overline.append(createElement("span", `prompt-status status-${prompt.status || "draft"}`, statusLabel[prompt.status] || prompt.status), createElement("span", prompt.syncState === "pending" ? "sync-pending" : "sync-ok", prompt.syncState === "pending" ? "本机待同步" : "仓库版本"), createElement("span", "", `v${prompt.revision || 1}`));
    titleBlock.append(overline, createElement("h2", "", prompt.title), createElement("p", "", prompt.summary || "未填写说明"));
    const actions = createElement("div", "prompt-detail-actions");
    const favorite = createElement("button", "prompt-icon-action", prompt.favorite ? "★" : "☆");
    favorite.type = "button";
    favorite.addEventListener("click", () => toggleFavorite(prompt.id));
    const edit = createElement("button", "prompt-icon-action", "编辑");
    edit.type = "button";
    edit.addEventListener("click", () => openEditor(prompt));
    actions.append(favorite, edit);
    header.append(titleBlock, actions);
    const tags = createElement("div", "prompt-tags");
    [prompt.category, prompt.subcategory, ...(prompt.tags || []), ...(prompt.modelCompatibility || [])].filter(Boolean).forEach((item) => tags.append(createElement("span", "", item)));
    const body = createElement("section", "prompt-content-block");
    const bodyHead = createElement("div", "prompt-content-head");
    bodyHead.append(createElement("b", "", "提示词正文"));
    const copyButton = createElement("button", "prompt-copy-button", "复制全文");
    copyButton.type = "button";
    copyButton.addEventListener("click", () => copyText(prompt.content, "提示词已复制"));
    bodyHead.append(copyButton);
    const pre = createElement("pre");
    pre.textContent = prompt.content;
    body.append(bodyHead, pre);
    const variables = createElement("section", "prompt-variable-block");
    variables.append(createElement("h3", "", "变量"));
    if ((prompt.variables || []).length) {
      const grid = createElement("div", "prompt-variable-grid");
      prompt.variables.forEach((variable) => {
        const item = createElement("div");
        item.append(createElement("code", "", `{{${variable.name}}}`), createElement("p", "", variable.description || "未填写说明"), createElement("small", "", variable.default ? `默认：${variable.default}` : variable.required ? "必填" : "可选"));
        grid.append(item);
      });
      variables.append(grid);
    } else variables.append(createElement("p", "prompt-muted", "该提示词没有定义变量。"));
    const meta = createElement("section", "prompt-meta-grid");
    [["用途", prompt.category || "未分类"], ["语言", prompt.language || "zh-CN"], ["来源", sourceLabel[prompt.source?.type] || prompt.source?.type || "仓库"], ["质量", `${prompt.qualityScore ?? 0}/100`], ["创建", formatDate(prompt.createdAt)], ["更新", formatDate(prompt.updatedAt)]].forEach(([label, value]) => {
      const item = createElement("div"); item.append(createElement("span", "", label), createElement("b", "", value)); meta.append(item);
    });
    const notes = createElement("section", "prompt-notes");
    notes.append(createElement("h3", "", "使用说明"), createElement("p", "", prompt.notes || "暂无补充说明。"));
    const footer = createElement("footer", "prompt-detail-footer");
    const packet = createElement("button", "button prompt-button-light", "生成AI同步包");
    packet.type = "button";
    packet.addEventListener("click", async () => { const syncPacket = makeSyncPacket(prompt); downloadJson(`${prompt.id}.sync.json`, syncPacket); await copyText(JSON.stringify(syncPacket, null, 2), "同步包已下载并复制"); });
    const sync = createElement("button", "button button-primary", prompt.syncState === "pending" ? "同步到持久化接口" : "重新提交更新");
    sync.type = "button";
    sync.addEventListener("click", () => syncPrompt(prompt));
    footer.append(packet, sync);
    panel.append(header, tags, body, variables, meta, notes, footer);
  }

  function renderStats() {
    const prompts = allPrompts();
    const values = { total: prompts.length, favorite: prompts.filter((item) => item.favorite).length, local: prompts.filter((item) => item.syncState === "pending").length, category: new Set(prompts.map((item) => item.category).filter(Boolean)).size };
    Object.entries(values).forEach(([key, value]) => { const element = document.querySelector(`[data-prompt-stat="${key}"]`); if (element) element.textContent = value; });
  }

  function render() { renderList(); renderDetail(); renderStats(); $("[data-prompt-favorites]").classList.toggle("active", state.favoriteOnly); }
  function toggleFavorite(id) { if (state.favorites.has(id)) state.favorites.delete(id); else state.favorites.add(id); saveLocal(); filterPrompts(); }

  function openEditor(prompt = null) {
    const modal = $("[data-prompt-modal]");
    const form = $("[data-prompt-form]");
    form.reset();
    $("[data-prompt-form-title]").textContent = prompt ? "编辑提示词" : "新增提示词";
    const values = prompt || { status: "active", language: "zh-CN", qualityScore: 70, favorite: false, tags: [], modelCompatibility: [], variables: [] };
    form.elements.id.value = values.id || "";
    form.elements.title.value = values.title || "";
    form.elements.category.value = values.category || "";
    form.elements.subcategory.value = values.subcategory || "";
    form.elements.summary.value = values.summary || "";
    form.elements.tags.value = (values.tags || []).join(", ");
    form.elements.models.value = (values.modelCompatibility || []).join(", ");
    form.elements.language.value = values.language || "zh-CN";
    form.elements.status.value = values.status || "active";
    form.elements.qualityScore.value = values.qualityScore ?? 70;
    form.elements.favorite.checked = Boolean(values.favorite);
    form.elements.content.value = values.content || "";
    form.elements.variables.value = (values.variables || []).map((item) => [item.name, item.description || "", item.default || ""].join(" | ")).join("\n");
    form.elements.notes.value = values.notes || "";
    modal.hidden = false;
    document.body.classList.add("prompt-modal-open");
    setTimeout(() => form.elements.title.focus(), 50);
  }
  function closeEditor() { $("[data-prompt-modal]").hidden = true; document.body.classList.remove("prompt-modal-open"); }
  function parseVariables(raw) { return String(raw || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => { const [name, description = "", defaultValue = ""] = line.split("|").map((part) => part.trim()); return { name, description, default: defaultValue, required: !defaultValue }; }).filter((item) => item.name); }

  function savePromptFromForm(form) {
    const data = new FormData(form);
    const existing = allPrompts().find((item) => item.id === data.get("id"));
    const timestamp = nowIso();
    const id = existing?.id || `prompt-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${slugify(data.get("title"))}`;
    const prompt = { ...existing, id, title: String(data.get("title")).trim(), summary: String(data.get("summary")).trim(), content: String(data.get("content")).trim(), category: String(data.get("category")).trim(), subcategory: String(data.get("subcategory")).trim(), tags: normalizeList(data.get("tags")), modelCompatibility: normalizeList(data.get("models")), variables: parseVariables(data.get("variables")), language: String(data.get("language") || "zh-CN"), status: String(data.get("status") || "active"), favorite: data.get("favorite") === "on", qualityScore: Math.max(0, Math.min(100, Number(data.get("qualityScore") || 0))), notes: String(data.get("notes")).trim(), privacy: "public", publish: true, revision: Number(existing?.revision || 0) + 1, createdAt: existing?.createdAt || timestamp, updatedAt: timestamp, source: { type: "local", agent: "browser-editor" } };
    state.local[id] = prompt;
    if (prompt.favorite) state.favorites.add(id); else state.favorites.delete(id);
    state.selectedId = id;
    saveLocal(); closeEditor(); populateFilters(allPrompts()); filterPrompts(); showToast("已保存为本机待同步版本");
  }

  async function syncPrompt(prompt) {
    const config = state.api?.write || {};
    if (!config.enabled || !config.baseUrl) {
      const packet = makeSyncPacket(prompt); downloadJson(`${prompt.id}.sync.json`, packet); await copyText(JSON.stringify(packet, null, 2), "未配置写入服务：已生成同步包"); return;
    }
    const endpoint = `${config.baseUrl.replace(/\/$/, "")}/v1/prompts/${encodeURIComponent(prompt.id)}`;
    try {
      const response = await fetch(endpoint, { method: "PUT", headers: { "Content-Type": "application/json", "If-Match": String(prompt.revision || 0) }, credentials: "include", body: JSON.stringify(makeSyncPacket(prompt)) });
      if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);
      delete state.local[prompt.id]; saveLocal(); showToast("已提交到持久化接口"); await loadCatalog();
    } catch (error) { showToast(`同步失败：${error.message}`, "error"); }
  }

  async function importPacket(file) {
    try {
      const parsed = JSON.parse(await file.text());
      const candidates = Array.isArray(parsed) ? parsed : parsed.prompts || [parsed.prompt || parsed];
      let count = 0;
      for (const candidate of candidates) {
        if (!candidate?.title || !candidate?.content) continue;
        const timestamp = nowIso();
        const id = candidate.id || `prompt-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${slugify(candidate.title)}`;
        state.local[id] = { ...candidate, id, privacy: "public", publish: true, status: candidate.status || "draft", revision: Number(candidate.revision || 0) + 1, createdAt: candidate.createdAt || timestamp, updatedAt: timestamp, source: { type: "import", agent: candidate.source?.agent || "browser-import" } };
        count += 1;
      }
      saveLocal(); populateFilters(allPrompts()); filterPrompts(); showToast(`已导入${count}条提示词`);
    } catch (error) { showToast(`导入失败：${error.message}`, "error"); }
  }

  async function loadCatalog() {
    const [catalogResponse, apiResponse] = await Promise.all([fetch("../data/prompts.json", { cache: "no-store" }), fetch("../data/prompt-api.json", { cache: "no-store" }).catch(() => null)]);
    if (!catalogResponse.ok) throw new Error(`无法加载提示词目录：${catalogResponse.status}`);
    const catalog = await catalogResponse.json();
    state.base = catalog.prompts || [];
    if (apiResponse?.ok) state.api = await apiResponse.json();
    const status = $("[data-prompt-api-status]");
    if (state.api?.write?.enabled && state.api.write.baseUrl) { status.textContent = "安全写入接口已启用"; status.dataset.ready = "true"; }
    else { status.textContent = "本机编辑模式 · 可导出AI同步包"; status.dataset.ready = "false"; }
    loadLocal(); populateFilters(allPrompts()); filterPrompts();
  }

  $("[data-prompt-form]").addEventListener("submit", (event) => { event.preventDefault(); savePromptFromForm(event.currentTarget); });
  $$("[data-prompt-close]").forEach((button) => button.addEventListener("click", closeEditor));
  $("[data-prompt-new]").addEventListener("click", () => openEditor());
  $("[data-prompt-import]").addEventListener("click", () => $("[data-prompt-file]").click());
  $("[data-prompt-file]").addEventListener("change", (event) => { const [file] = event.target.files || []; if (file) importPacket(file); event.target.value = ""; });
  $("[data-prompt-export-all]").addEventListener("click", () => { downloadJson("my-prompts-export.json", { schemaVersion: "1.0.0", exportedAt: nowIso(), prompts: allPrompts().map(({ syncState, sourceFile, ...prompt }) => prompt) }); showToast("已导出全部提示词"); });
  $("[data-prompt-favorites]").addEventListener("click", () => { state.favoriteOnly = !state.favoriteOnly; filterPrompts(); });
  ["[data-prompt-search]", "[data-prompt-category]", "[data-prompt-model]", "[data-prompt-status]", "[data-prompt-sort]"].forEach((selector) => $(selector).addEventListener(selector.includes("search") ? "input" : "change", filterPrompts));
  document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !$("[data-prompt-modal]").hidden) closeEditor(); });
  loadCatalog().catch((error) => { $("[data-prompt-empty]").hidden = false; $("[data-prompt-empty]").textContent = error.message; showToast(error.message, "error"); });
})();