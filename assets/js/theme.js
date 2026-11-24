import { syncGarden } from "./garden.js";

const THEME_KEY = "mk-theme";
const GARDEN_KEY = "mk-garden";
const root = document.documentElement;
const system = matchMedia("(prefers-color-scheme: dark)");
const NEXT = { dark: "garden", garden: "light", light: "dark" };
let latestReveal = null;
// The mode the reader last asked for. A reveal applies it a frame later, so a quick second click reads this, not the page.
let wanted;
let toggle;
let gardenToggle;

function store(key, value) {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {}
}

function savedTheme() {
  try {
    return localStorage.getItem(THEME_KEY);
  } catch {
    return null;
  }
}

function systemTheme() {
  return system.matches ? "dark" : "light";
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

function syncButtons(mode) {
  toggle.setAttribute("aria-label", `Switch to ${NEXT[mode]} mode`);
  gardenToggle?.setAttribute("aria-pressed", String(mode === "garden"));
}

function apply(mode, origin) {
  root.classList.add("theme-swapping");
  const theme = mode === "dark" ? "dark" : "light";
  root.dataset.theme = theme;
  root.toggleAttribute("data-garden", mode === "garden");
  syncButtons(mode);
  syncMeta();
  document
    .querySelector("iframe.giscus-frame")
    ?.contentWindow.postMessage(
      { giscus: { setConfig: { theme } } },
      "https://giscus.app",
    );
  syncGarden(origin);
  requestAnimationFrame(() =>
    requestAnimationFrame(() => root.classList.remove("theme-swapping")),
  );
}

function switchTo(mode, button) {
  wanted = mode;
  const box = button.getBoundingClientRect();
  const origin = { x: box.left + box.width / 2, y: box.top + box.height / 2 };
  if (!document.startViewTransition) {
    apply(mode, origin);
    return;
  }
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    root.classList.add("theme-fade");
  } else {
    // The new mode grows as a circle from the button pressed until it covers the farthest corner.
    const r = Math.hypot(
      Math.max(origin.x, innerWidth - origin.x),
      Math.max(origin.y, innerHeight - origin.y),
    );
    root.style.setProperty("--reveal-x", `${origin.x}px`);
    root.style.setProperty("--reveal-y", `${origin.y}px`);
    root.style.setProperty("--reveal-r", `${r}px`);
    root.classList.add("theme-reveal");
  }
  const reveal = document.startViewTransition(() => apply(mode, origin));
  latestReveal = reveal;
  // A second click skips the first reveal, whose cleanup must not cut the second one short.
  reveal.finished.finally(() => {
    if (latestReveal === reveal)
      root.classList.remove("theme-reveal", "theme-fade");
  });
}

export function initTheme() {
  toggle = document.querySelector("[data-theme-toggle]");
  gardenToggle = document.querySelector("[data-garden-toggle]");
  wanted = root.hasAttribute("data-garden") ? "garden" : root.dataset.theme;
  syncButtons(wanted);
  syncMeta();

  toggle.addEventListener("click", () => {
    const next = NEXT[wanted];
    store(GARDEN_KEY, next === "garden" ? "on" : null);
    if (next !== "garden") store(THEME_KEY, next);
    switchTo(next, toggle);
  });
  // The footer bee jumps to the garden, and back to the theme the reader had before it.
  gardenToggle?.addEventListener("click", () => {
    const next =
      wanted === "garden" ? (savedTheme() ?? systemTheme()) : "garden";
    store(GARDEN_KEY, next === "garden" ? "on" : null);
    switchTo(next, gardenToggle);
  });

  system.addEventListener("change", () => {
    if (savedTheme() || wanted === "garden") return;
    wanted = systemTheme();
    apply(wanted);
  });
}
