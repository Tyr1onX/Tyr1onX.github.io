(() => {
  const root = document.documentElement;
  root.classList.add("js", "theme-initializing");

  let theme = null;
  try { theme = localStorage.getItem("tyr1onx-theme"); } catch {}
  if (theme !== "dark" && theme !== "light") {
    theme = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  root.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute(
    "content",
    theme === "dark" ? "#0d0d10" : "#f7f7fa"
  );

  const release = () => requestAnimationFrame(() => {
    root.classList.remove("theme-initializing");
    root.dataset.themeReady = "true";
  });

  if (document.readyState === "loading") {
    addEventListener("DOMContentLoaded", release, { once: true });
  } else {
    release();
  }
})();
