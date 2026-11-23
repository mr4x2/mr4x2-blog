(function () {
  var root = document.documentElement;
  var saved = null;
  try {
    saved = localStorage.getItem("mk-theme");
  } catch (e) {}
  var dark =
    saved === "dark" ||
    (saved !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);
  root.dataset.theme = dark ? "dark" : "light";
  document.querySelector('meta[name="color-scheme"]').content =
    root.dataset.theme;
  try {
    if (
      root.hasAttribute("data-intro") &&
      (root.dataset.intro === "always" ||
        !sessionStorage.getItem("mk-intro-seen"))
    ) {
      root.classList.add("intro-pending");
    }
  } catch (e) {}
})();
