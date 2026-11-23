import { initIntro } from "./intro.js";
import { initSearch } from "./search.js";
import { initTheme } from "./theme.js";

// The 404 intro types the real path, so it must be in place before the intro reads it.
for (const el of document.querySelectorAll("[data-missing-path]")) {
  el.textContent = location.pathname;
}

initTheme();
initIntro();
initSearch();

for (const img of document.querySelectorAll(".prose img")) {
  if (img.complete) continue;
  img.classList.add("is-loading");
  const show = () => img.classList.remove("is-loading");
  img.addEventListener("load", show, { once: true });
  img.addEventListener("error", show, { once: true });
}
