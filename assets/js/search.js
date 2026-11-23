const INDEX_URL = "/pagefind/pagefind.js";
const MAX_RESULTS = 8;

const state = { open: false, query: "", status: "idle", results: [], active: 0 };

export function initSearch() {
  const root = document.documentElement;
  const dialog = document.querySelector("[data-search-popup]");
  const input = dialog.querySelector("input");
  const list = dialog.querySelector("[role=listbox]");
  const message = dialog.querySelector("[role=status]");
  const hint = document.querySelector("[data-search-hint]");
  let pagefind = null;
  let returnFocus = null;

  if (!/Mac|iPhone|iPad/.test(navigator.platform)) hint.textContent = "Ctrl K";

  function messageFor() {
    if (state.status === "error") return "grep: search index not found";
    if (state.status === "loading") return "grep: loading the search index";
    if (!state.query.trim()) return "Type a word to search the posts.";
    if (!state.results.length) return `grep: no posts match "${state.query.trim()}"`;
    return state.results.length === 1 ? "1 post" : `${state.results.length} posts`;
  }

  function rowFor(page, i) {
    const row = document.createElement("li");
    row.id = `search-option-${i}`;
    row.setAttribute("role", "option");
    row.dataset.index = i;
    row.className = "search-row";

    const meta = document.createElement("div");
    meta.className = "search-meta";
    meta.textContent = [page.meta.date, page.meta.tags].filter(Boolean).join(" · ");

    const title = document.createElement("div");
    title.className = "search-title";
    title.textContent = page.meta.title;

    const excerpt = document.createElement("div");
    excerpt.className = "search-excerpt";
    excerpt.innerHTML = page.excerpt;

    row.append(meta, title, excerpt);
    return row;
  }

  function render() {
    dialog.hidden = !state.open;
    root.classList.toggle("search-open", state.open);
    if (input.value !== state.query) input.value = state.query;

    list.replaceChildren(...state.results.map(rowFor));
    const options = [...list.children];
    options.forEach((row, i) => row.setAttribute("aria-selected", String(i === state.active)));
    const current = options[state.active];
    input.setAttribute("aria-expanded", String(options.length > 0));
    input.setAttribute("aria-activedescendant", current ? current.id : "");
    current?.scrollIntoView({ block: "nearest" });

    message.textContent = messageFor();
    message.classList.toggle("sr-only", options.length > 0);
  }

  function set(patch) {
    Object.assign(state, patch);
    render();
  }

  async function search() {
    const query = state.query.trim();
    if (!pagefind || !query) return set({ results: [], active: 0 });
    const found = await pagefind.debouncedSearch(query);
    if (!found) return;
    const pages = await Promise.all(found.results.slice(0, MAX_RESULTS).map((hit) => hit.data()));
    if (query === state.query.trim()) set({ results: pages, active: 0 });
  }

  async function load() {
    set({ status: "loading" });
    try {
      // A variable keeps the bundler from resolving a file that only exists after the index is built.
      pagefind = await import(INDEX_URL);
      set({ status: "ready" });
      search();
    } catch {
      set({ status: "error" });
    }
  }

  function open() {
    returnFocus = document.activeElement;
    set({ open: true, query: "", results: [], active: 0 });
    input.focus();
    if (state.status === "idle" || state.status === "error") load();
  }

  function close() {
    set({ open: false });
    returnFocus?.focus();
  }

  function move(step) {
    if (!state.results.length) return;
    set({ active: (state.active + step + state.results.length) % state.results.length });
  }

  function go() {
    const page = state.results[state.active];
    if (!page) return;
    close();
    location.href = page.url;
  }

  const typing = (el) => el.closest("input, textarea, select, [contenteditable]");

  document.addEventListener("keydown", (e) => {
    if (e.isComposing) return;
    const key = e.key.toLowerCase();
    if ((e.metaKey || e.ctrlKey) && key === "k") {
      e.preventDefault();
      state.open ? close() : open();
    } else if (!state.open) {
      if (key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey && !typing(e.target)) {
        e.preventDefault();
        open();
      }
    } else if (key === "escape") {
      e.preventDefault();
      close();
    } else if (key === "arrowdown" || key === "arrowup") {
      e.preventDefault();
      move(key === "arrowdown" ? 1 : -1);
    } else if (key === "enter") {
      e.preventDefault();
      go();
    } else if (key === "tab") {
      e.preventDefault();
    }
  });

  input.addEventListener("input", () => {
    set({ query: input.value, active: 0 });
    search();
  });

  list.addEventListener("mousemove", (e) => {
    const row = e.target.closest("[role=option]");
    if (row && Number(row.dataset.index) !== state.active) set({ active: Number(row.dataset.index) });
  });
  list.addEventListener("click", (e) => {
    if (e.target.closest("[role=option]")) go();
  });
  dialog.addEventListener("mousedown", (e) => {
    if (e.target === dialog) close();
  });
  document.querySelector("[data-search-open]").addEventListener("click", open);
}
