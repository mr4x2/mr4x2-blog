const TYPE_DELAY_MS = 180;
const TYPE_STEP_MS = 65;
const TYPE_MAX_MS = 700;

export function initIntro() {
  const root = document.documentElement;
  const typed = document.querySelector("[data-typed]");
  if (!typed || !root.classList.contains("intro-pending")) return;

  if (root.dataset.intro !== "always") {
    try {
      sessionStorage.setItem("mk-intro-seen", "1");
    } catch {}
  }

  // Reading layout commits the hidden state to style, so removing the class fades in instead of jumping.
  root.getBoundingClientRect();

  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    root.classList.remove("intro-pending");
    return;
  }

  const word = typed.textContent;
  // A long 404 path types faster, so it never holds the page longer than a short word does.
  const step = Math.min(TYPE_STEP_MS, TYPE_MAX_MS / word.length);
  typed.textContent = "";
  root.classList.replace("intro-pending", "intro-typing");
  [...word].forEach((char, i) => {
    setTimeout(
      () => {
        typed.textContent += char;
      },
      TYPE_DELAY_MS + i * step,
    );
  });
  setTimeout(
    () => root.classList.remove("intro-typing"),
    TYPE_DELAY_MS + word.length * step,
  );
}
