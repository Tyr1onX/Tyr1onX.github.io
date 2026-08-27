(() => {
  const root = document.documentElement;
  root.classList.add("js");

  const nav = document.querySelector(".nav-links");
  if (nav && !nav.querySelector('a[href="./knowledge.html"]')) {
    const knowledgeLink = document.createElement("a");
    knowledgeLink.href = "./knowledge.html";
    knowledgeLink.textContent = "星图";
    nav.append(knowledgeLink);
  }

  let storedTheme = null;
  try {
    storedTheme = localStorage.getItem("tyr1onx-theme");
  } catch {
    storedTheme = null;
  }

  const prefersDark = matchMedia("(prefers-color-scheme: dark)").matches;
  const initialTheme = storedTheme || (prefersDark ? "dark" : "light");

  const applyTheme = (theme) => {
    root.dataset.theme = theme;
    const toggle = document.querySelector(".theme-toggle");
    toggle?.setAttribute(
      "aria-label",
      theme === "dark" ? "切换到浅色模式" : "切换到深色模式"
    );
    if (toggle?.getAttribute("role") === "switch") {
      toggle.setAttribute("aria-checked", String(theme === "dark"));
    }
    document.querySelector('meta[name="theme-color"]')?.setAttribute(
      "content",
      theme === "dark" ? "#0d0d10" : "#f7f7fa"
    );
  };

  applyTheme(initialTheme);

  document.querySelector(".theme-toggle")?.addEventListener("click", () => {
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    try {
      localStorage.setItem("tyr1onx-theme", next);
    } catch {
      // Theme switching still works for the current page without storage.
    }
    applyTheme(next);
  });

  const siteHeader = document.querySelector(".site-header");
  let headerFrame = 0;

  const updateHeader = () => {
    headerFrame = 0;
    siteHeader?.setAttribute("data-scrolled", String(scrollY > 8));
  };

  const scheduleHeaderUpdate = () => {
    if (!headerFrame) headerFrame = requestAnimationFrame(updateHeader);
  };

  updateHeader();
  addEventListener("scroll", scheduleHeaderUpdate, { passive: true });

  const currentYear = document.querySelector("#current-year");
  if (currentYear) currentYear.textContent = String(new Date().getFullYear());

  const revealElements = document.querySelectorAll(".reveal");
  if (revealElements.length && "IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.1 });
    revealElements.forEach((element) => observer.observe(element));
  } else {
    revealElements.forEach((element) => element.classList.add("is-visible"));
  }
})();
