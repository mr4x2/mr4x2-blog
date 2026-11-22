const KEY = "mk-theme";
const root = document.documentElement;
const system = matchMedia("(prefers-color-scheme: dark)");

function saved() {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function syncMeta() {
  document.querySelector('meta[name="color-scheme"]').content =
    root.dataset.theme;
  let color = document.querySelector('meta[name="theme-color"]');
  if (!color) {
    color = document.createElement("meta");
    color.name = "theme-color";
    document.head.append(color);
  }
  color.content = getComputedStyle(root).getPropertyValue("--bg").trim();
}

function apply(theme, toggle) {
  root.classList.add("theme-swapping");
  root.dataset.theme = theme;
  toggle.setAttribute("aria-pressed", String(theme === "dark"));
  syncMeta();
  document
    .querySelector("iframe.giscus-frame")
    ?.contentWindow.postMessage(
      { giscus: { setConfig: { theme } } },
      "https://giscus.app",
    );
  requestAnimationFrame(() =>
    requestAnimationFrame(() => root.classList.remove("theme-swapping")),
  );
}

export function initTheme() {
  const toggle = document.querySelector("[data-theme-toggle]");
  toggle.setAttribute("aria-pressed", String(root.dataset.theme === "dark"));
  syncMeta();

  toggle.addEventListener("click", () => {
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    try {
      localStorage.setItem(KEY, next);
    } catch {}
    apply(next, toggle);
  });

  system.addEventListener("change", (e) => {
    if (!saved()) apply(e.matches ? "dark" : "light", toggle);
  });
}
