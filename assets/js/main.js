import { initIntro } from "./intro.js";
import { initTheme } from "./theme.js";

initTheme();
initIntro();

const missing = document.querySelector("[data-missing-path]");
if (missing) missing.textContent = location.pathname;
