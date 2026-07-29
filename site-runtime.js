(() => {
  const root = document.documentElement;
  root.classList.add("js");

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
    document.querySelector(".theme-toggle")?.setAttribute(
      "aria-label",
      theme === "dark" ? "切换到浅色模式" : "切换到深色模式"
    );
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

  if (document.body?.dataset.page === "home") {
    const FINAL_RETRACT_SCALE = 0.72;
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

    const style = document.createElement("style");
    style.dataset.rigidStarRetraction = "true";
    style.textContent = `
      @keyframes writing-home-star-retract {
        0% { opacity: 1; translate: 0 0; scale: 1; }
        80% { opacity: 1; }
        100% {
          opacity: 0;
          translate: var(--writing-retract-x, 0) var(--writing-retract-y, -160px);
          scale: .72;
        }
      }
      @keyframes writing-home-thread-retract {
        0% { opacity: 1; stroke-dasharray: 1 1; stroke-dashoffset: 0; }
        80% { opacity: 1; }
        100% { opacity: 0; stroke-dasharray: 0 1; stroke-dashoffset: 0; }
      }
      @keyframes keke-star-retract {
        0% { opacity: 1; translate: 0 0; scale: 1; }
        80% { opacity: 1; }
        100% {
          opacity: 0;
          translate: var(--keke-retract-x, 0) var(--keke-retract-y, -160px);
          scale: .72;
        }
      }
      @keyframes keke-thread-retract {
        0% { opacity: 1; stroke-dasharray: 1 1; stroke-dashoffset: 0; }
        80% { opacity: 1; }
        100% { opacity: 0; stroke-dasharray: 0 1; stroke-dashoffset: 0; }
      }
    `;
    document.head.append(style);

    const setRigidRetraction = (star, line, prefix) => {
      if (!(star instanceof HTMLElement) || !(line instanceof SVGLineElement)) return;

      const anchorX = Number.parseFloat(line.getAttribute("x1") || "");
      const anchorY = Number.parseFloat(line.getAttribute("y1") || "");
      const tipX = Number.parseFloat(line.getAttribute("x2") || "");
      const tipY = Number.parseFloat(line.getAttribute("y2") || "");
      const starSize = Number.parseFloat(getComputedStyle(star).getPropertyValue("--note-star-size"));
      const tipOffset = Number.isFinite(starSize) ? starSize / 2 : 6;

      if (![anchorX, anchorY, tipX, tipY].every(Number.isFinite)) return;

      const centerX = tipX;
      const centerY = tipY + tipOffset;
      const deltaX = anchorX - centerX;
      const deltaY = anchorY + tipOffset * FINAL_RETRACT_SCALE - centerY;

      star.style.setProperty(`--${prefix}-retract-x`, `${deltaX.toFixed(2)}px`);
      star.style.setProperty(`--${prefix}-retract-y`, `${deltaY.toFixed(2)}px`);
      line.setAttribute("pathLength", "1");
    };

    const setAllRigidRetractions = (prefix) => {
      const stars = [...document.querySelectorAll("#note-stars .note-star")];
      const lines = [...document.querySelectorAll("#star-threads .star-thread")];
      stars.forEach((star, index) => setRigidRetraction(star, lines[index], prefix));
    };

    document.addEventListener("click", (event) => {
      if (reducedMotion.matches || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (!(event.target instanceof Element)) return;

      const projectLink = event.target.closest(".orbit-project[href$='keke.html']");
      if (projectLink) {
        setAllRigidRetractions("keke");
        return;
      }

      const noteStar = event.target.closest("#note-stars .note-star");
      if (noteStar instanceof HTMLElement) {
        const stars = [...document.querySelectorAll("#note-stars .note-star")];
        const lines = [...document.querySelectorAll("#star-threads .star-thread")];
        const index = stars.indexOf(noteStar);
        if (index >= 0) setRigidRetraction(noteStar, lines[index], "writing");
        return;
      }

      const archiveLink = event.target.closest(".all-writing-link, .site-header .nav-links a[href$='notes.html']");
      if (archiveLink) setAllRigidRetractions("writing");
    });
  }
})();