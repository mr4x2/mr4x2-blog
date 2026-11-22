import { initIntro } from "./intro.js";
import { initSearch } from "./search.js";
import { initTheme } from "./theme.js";

initTheme();
initIntro();
initSearch();

const missing = document.querySelector("[data-missing-path]");
if (missing) missing.textContent = location.pathname;
