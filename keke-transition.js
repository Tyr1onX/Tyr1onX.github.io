(() => {
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const storageKey = "tyr1onx:keke-planet-transition";
  const body = document.body;
  const root = document.documentElement;
  const WIND_RAMP_MS = 820;
  const MAX_WIND_RATE = 7;
  const STAR_BASE_DELAY = 70;
  const STAR_STAGGER_MS = 42;
  const RETRACT_ANIMATION_NAMES = new Set([
    "keke-star-retract",
    "keke-thread-retract",
  ]);
  const ARRIVAL_ANIMATION_NAMES = new Set(["keke-content-arrive"]);

  let rampFrame = 0;
  let acceleratedAnimations = [];
  let prefetchedDestination = "";

  const sleep = (duration) => new Promise((resolve) => setTimeout(resolve, duration));
  const afterStyleCommit = () => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });

  const motionMs = (name, fallback) => {
    const raw = getComputedStyle(root).getPropertyValue(name).trim();
    const value = Number.parseFloat(raw);
    if (!Number.isFinite(value)) return fallback;
    return raw.endsWith("s") && !raw.endsWith("ms") ? value * 1000 : value;
  };

  const waitForNamedAnimations = async (elements, names, fallbackMs) => {
    await afterStyleCommit();
    const animations = [...new Set(elements.flatMap((element) => (
      element instanceof Element ? element.getAnimations() : []
    )))].filter((animation) => names.has(animation.animationName));

    if (!animations.length) {
      await sleep(fallbackMs);
      return;
    }
    await Promise.allSettled(animations.map((animation) => animation.finished));
  };

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
    body.style.removeProperty("--keke-flow-thickness");
    body.style.removeProperty("--keke-flow-energy");
  }

  function releaseForwardWindWithoutClearingReturnState() {
    cancelAnimationFrame(rampFrame);
    rampFrame = 0;
    acceleratedAnimations = [];
    body.style.removeProperty("--keke-flow-energy");
  }

  function isKekeReturnArrival() {
    return root.dataset.returnHomePending === "keke-return"
      || body.classList.contains("is-returning-keke-home");
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
      const eased = progress * progress * (3 - 2 * progress);
      const rate = 1 + (MAX_WIND_RATE - 1) * eased;
      const thickness = Math.max(0.38, 1 / Math.sqrt(rate));

      body.style.setProperty("--keke-flow-thickness", thickness.toFixed(3));
      body.style.setProperty("--keke-flow-energy", eased.toFixed(3));

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
    const elements = [];
    if (!(field instanceof HTMLElement)) return elements;

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
      elements.push(star);

      if (line instanceof SVGElement) {
        line.style.setProperty("--keke-retract-delay", `${delay}ms`);
        elements.push(line);
      }
    });
    return elements;
  }

  function clearPreparation(link, image, identityAvatar, identityName, { preserveReturnWind = false } = {}) {
    if (preserveReturnWind) releaseForwardWindWithoutClearingReturnState();
    else restoreWindRate();

    body.classList.remove("is-preparing-keke", "is-entering-keke");
    image.classList.remove("keke-transition-source");
    identityAvatar?.classList.remove("keke-site-avatar-source");
    identityName?.classList.remove("keke-site-name-source");
    link.removeAttribute("aria-disabled");

    document.querySelectorAll("#note-stars .note-star, #star-threads .star-thread").forEach((element) => {
      element.style.removeProperty("--keke-retract-x");
      element.style.removeProperty("--keke-retract-y");
      element.style.removeProperty("--keke-retract-delay");
    });
  }

  function prefetchDestination(link) {
    if (!(link instanceof HTMLAnchorElement)) return "";
    const destination = new URL(link.href, location.href).href;
    if (prefetchedDestination === destination) return destination;
    prefetchedDestination = destination;

    const preload = document.createElement("link");
    preload.rel = "prefetch";
    preload.href = destination;
    preload.dataset.kekePrefetch = "true";
    document.head.append(preload);

    const warm = () => {
      fetch(destination, {
        cache: "force-cache",
        credentials: "same-origin",
        priority: "low",
      }).catch(() => {});
    };
    if ("requestIdleCallback" in window) requestIdleCallback(warm, { timeout: 1600 });
    else setTimeout(warm, 180);
    return destination;
  }

  async function setArrivalState() {
    if (body.dataset.page !== "keke") return;

    let arrivedFromHome = false;
    try {
      arrivedFromHome = sessionStorage.getItem(storageKey) === "1";
      sessionStorage.removeItem(storageKey);
    } catch {
      arrivedFromHome = false;
    }

    if (!arrivedFromHome || reducedMotion.matches) return;
    const content = [
      ...document.querySelectorAll(".keke-summary > :not(.keke-title-row), .product-viewer"),
    ];
    body.classList.add("is-arriving-keke");
    await waitForNamedAnimations(
      content,
      ARRIVAL_ANIMATION_NAMES,
      motionMs("--motion-release", 620) + 240
    );
    body.classList.remove("is-arriving-keke");
  }

  function installHomeTransition() {
    if (body.dataset.page !== "home") return;

    const link = document.querySelector(".orbit-project[href$='keke.html']");
    const image = link?.querySelector("img");
    const identityAvatar = document.querySelector(".cosmos-center img");
    const identityName = document.querySelector(".cosmos-center h1");
    if (!(link instanceof HTMLAnchorElement) || !(image instanceof HTMLImageElement)) return;

    let navigating = false;

    link.addEventListener("pointerenter", () => prefetchDestination(link), { passive: true });
    link.addEventListener("focus", () => prefetchDestination(link), { passive: true });

    link.addEventListener("click", (event) => {
      const modified = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
      if (event.defaultPrevented || event.button !== 0 || modified || reducedMotion.matches) return;

      event.preventDefault();
      if (navigating) return;
      navigating = true;

      const destination = prefetchDestination(link) || new URL(link.href, location.href).href;
      link.focus({ preventScroll: true });
      image.classList.add("keke-transition-source");
      identityAvatar?.classList.add("keke-site-avatar-source");
      identityName?.classList.add("keke-site-name-source");
      link.setAttribute("aria-disabled", "true");
      const retractionElements = prepareStarRetraction();

      requestAnimationFrame(() => {
        body.classList.add("is-preparing-keke");
        rampWind();
      });

      try {
        sessionStorage.setItem(storageKey, "1");
      } catch {
        // The transition remains usable without storage; only the destination reveal is skipped.
      }

      void (async () => {
        const fallback = motionMs("--motion-project-retract", 520)
          + STAR_BASE_DELAY
          + 7 * STAR_STAGGER_MS
          + motionMs("--motion-micro", 180);
        await waitForNamedAnimations(retractionElements, RETRACT_ANIMATION_NAMES, fallback);
        if (!navigating) return;
        body.classList.add("is-entering-keke");
        location.assign(destination);
      })();
    });

    const idlePrefetch = () => prefetchDestination(link);
    if ("requestIdleCallback" in window) requestIdleCallback(idlePrefetch, { timeout: 2600 });
    else setTimeout(idlePrefetch, 1800);

    addEventListener("pageshow", () => {
      navigating = false;
      clearPreparation(link, image, identityAvatar, identityName, {
        preserveReturnWind: isKekeReturnArrival(),
      });
    });
  }

  void setArrivalState();
  installHomeTransition();
})();
