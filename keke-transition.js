(() => {
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const storageKey = "tyr1onx:keke-planet-transition";
  const body = document.body;
  const PRELUDE_MS = 1040;
  const WIND_RAMP_MS = 900;
  const MAX_WIND_RATE = 7;
  const STAR_BASE_DELAY = 120;
  const STAR_STAGGER_MS = 55;

  let rampFrame = 0;
  let acceleratedAnimations = [];

  function setAnimationRate(animation, rate) {
    if (typeof animation.updatePlaybackRate === "function") {
      animation.updatePlaybackRate(rate);
    } else {
      animation.playbackRate = rate;
    }
  }

  function restoreWindRate() {
    cancelAnimationFrame(rampFrame);
    rampFrame = 0;

    acceleratedAnimations.forEach(({ animation, rate }) => {
      try {
        setAnimationRate(animation, rate);
      } catch {
        // Ignore animations that were replaced while the document was cached.
      }
    });
    acceleratedAnimations = [];
  }

  function collectWindAnimations() {
    const animations = [];
    document.querySelectorAll(".garden-current, .garden-trace").forEach((element) => {
      element.getAnimations().forEach((animation) => {
        animations.push({ animation, rate: animation.playbackRate || 1 });
      });
    });
    return animations;
  }

  function rampWind() {
    restoreWindRate();
    acceleratedAnimations = collectWindAnimations();
    const startedAt = performance.now();

    const step = (now) => {
      const progress = Math.min(1, Math.max(0, (now - startedAt) / WIND_RAMP_MS));
      const eased = progress * progress;
      const rate = 1 + (MAX_WIND_RATE - 1) * eased;

      acceleratedAnimations.forEach(({ animation }) => {
        try {
          setAnimationRate(animation, rate);
        } catch {
          // A missing animation should not block navigation.
        }
      });

      rampFrame = progress < 1 ? requestAnimationFrame(step) : 0;
    };

    rampFrame = requestAnimationFrame(step);
  }

  function prepareStarRetraction() {
    const field = document.querySelector("#cosmos-field");
    const stars = [...document.querySelectorAll("#note-stars .note-star")];
    const threads = [...document.querySelectorAll("#star-threads .star-thread")];
    if (!(field instanceof HTMLElement)) return;

    stars.forEach((star, index) => {
      if (!(star instanceof HTMLElement)) return;
      const line = threads[index];
      const anchorX = Number.parseFloat(line?.getAttribute("x1") || "");
      const anchorY = Number.parseFloat(line?.getAttribute("y1") || "");
      const targetX = Number.isFinite(anchorX) ? anchorX - star.offsetWidth / 2 : star.offsetLeft;
      const targetY = Number.isFinite(anchorY) ? anchorY - star.offsetHeight / 2 : -star.offsetHeight;
      const delay = STAR_BASE_DELAY + index * STAR_STAGGER_MS;

      star.style.setProperty("--keke-retract-x", `${targetX.toFixed(2)}px`);
      star.style.setProperty("--keke-retract-y", `${targetY.toFixed(2)}px`);
      star.style.setProperty("--keke-retract-delay", `${delay}ms`);
      line?.style.setProperty("--keke-retract-delay", `${delay}ms`);
    });
  }

  function clearPreparation(link, image) {
    restoreWindRate();
    body.classList.remove("is-preparing-keke", "is-entering-keke");
    image.classList.remove("keke-transition-source");
    link.removeAttribute("aria-disabled");

    document.querySelectorAll("#note-stars .note-star, #star-threads .star-thread").forEach((element) => {
      element.style.removeProperty("--keke-retract-x");
      element.style.removeProperty("--keke-retract-y");
      element.style.removeProperty("--keke-retract-delay");
    });
  }

  function setArrivalState() {
    if (body.dataset.page !== "keke") return;

    let arrivedFromHome = false;
    try {
      arrivedFromHome = sessionStorage.getItem(storageKey) === "1";
      sessionStorage.removeItem(storageKey);
    } catch {
      arrivedFromHome = false;
    }

    if (!arrivedFromHome || reducedMotion.matches) return;
    body.classList.add("is-arriving-keke");
    setTimeout(() => body.classList.remove("is-arriving-keke"), 1200);
  }

  function installHomeTransition() {
    if (body.dataset.page !== "home") return;

    const link = document.querySelector(".orbit-project[href$='keke.html']");
    const image = link?.querySelector("img");
    if (!(link instanceof HTMLAnchorElement) || !(image instanceof HTMLImageElement)) return;

    let navigating = false;
    let navigateTimer = 0;

    link.addEventListener("click", (event) => {
      const modified = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
      if (event.defaultPrevented || event.button !== 0 || modified || reducedMotion.matches) return;

      event.preventDefault();
      if (navigating) return;
      navigating = true;

      link.focus({ preventScroll: true });
      image.classList.add("keke-transition-source");
      link.setAttribute("aria-disabled", "true");
      prepareStarRetraction();

      requestAnimationFrame(() => {
        body.classList.add("is-preparing-keke");
        rampWind();
      });

      try {
        sessionStorage.setItem(storageKey, "1");
      } catch {
        // The transition remains usable without storage; only the destination reveal is skipped.
      }

      const destination = new URL(link.href, location.href).href;
      navigateTimer = window.setTimeout(() => {
        body.classList.add("is-entering-keke");
        requestAnimationFrame(() => location.assign(destination));
      }, PRELUDE_MS);
    });

    addEventListener("pageshow", () => {
      clearTimeout(navigateTimer);
      navigateTimer = 0;
      navigating = false;
      clearPreparation(link, image);
    });
  }

  setArrivalState();
  installHomeTransition();
})();
