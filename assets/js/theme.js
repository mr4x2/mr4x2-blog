const KEY = "mk-theme";
const root = document.documentElement;
const system = matchMedia("(prefers-color-scheme: dark)");
let latestReveal = null;
// The theme the reader last asked for. A reveal applies it a frame later, so a quick second click reads this, not data-theme.
let wanted;

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
  wanted = root.dataset.theme;

  toggle.addEventListener("click", () => {
    const next = wanted === "dark" ? "light" : "dark";
    wanted = next;
    try {
      localStorage.setItem(KEY, next);
    } catch {}
    if (
      !document.startViewTransition ||
      matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      apply(next, toggle);
      return;
    }
    // The new theme grows as a circle from the toggle until it covers the farthest corner.
    const box = toggle.getBoundingClientRect();
    const x = box.left + box.width / 2;
    const y = box.top + box.height / 2;
    const r = Math.hypot(
      Math.max(x, innerWidth - x),
      Math.max(y, innerHeight - y),
    );
    root.style.setProperty("--reveal-x", `${x}px`);
    root.style.setProperty("--reveal-y", `${y}px`);
    root.style.setProperty("--reveal-r", `${r}px`);
    root.classList.add("theme-reveal");
    const reveal = document.startViewTransition(() => apply(next, toggle));
    latestReveal = reveal;
    // A second click skips the first reveal, whose cleanup must not cut the second one short.
    reveal.finished.finally(() => {
      if (latestReveal === reveal) root.classList.remove("theme-reveal");
    });
  });

  system.addEventListener("change", (e) => {
    if (saved()) return;
    wanted = e.matches ? "dark" : "light";
    apply(wanted, toggle);
  });
}
