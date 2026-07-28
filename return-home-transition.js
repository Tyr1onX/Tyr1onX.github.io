(() => {
  const body = document.body;
  const root = document.documentElement;
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const returnKey = "tyr1onx:return-home-transition";
  const planetMemoryKey = "tyr1onx:writing-planet-memory";
  const KEKE_PRELUDE_MS = 90;
  const WRITING_PRELUDE_MS = 250;
  const WIND_WAKE_MS = 620;
  const WIND_SETTLE_MS = 700;
  const WRITING_CALM_RATE = 0.24;
  const KEKE_PEAK_RATE = 7;
  const MAX_SHARED_ARCHIVE_STARS = 5;

  let navigating = false;
  let navigateTimer = 0;
  let windFrame = 0;
  let returnAnimations = [];
  let warmupStarted = false;

  const noteIdFromHref = (href) => {
    try {
      return new URL(href, location.href).searchParams.get("id") || "";
    } catch {
      return "";
    }
  };

  const isPlainPrimaryClick = (event) => {
    const modified = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
    return !event.defaultPrevented && event.button === 0 && !modified;
  };

  const setAnimationRate = (animation, rate) => {
    if (typeof animation.updatePlaybackRate === "function") animation.updatePlaybackRate(rate);
    else animation.playbackRate = rate;
  };

  const writePayload = (payload) => {
    try {
      sessionStorage.setItem(returnKey, JSON.stringify(payload));
    } catch {
      // The page still navigates normally when storage is unavailable.
    }
  };

  const readPayload = () => {
    try {
      const raw = sessionStorage.getItem(returnKey);
      sessionStorage.removeItem(returnKey);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  const prefetchHome = () => {
    if (body.dataset.page === "home") return;
    if (!document.querySelector("link[data-return-home-prefetch]")) {
      const link = document.createElement("link");
      link.rel = "prefetch";
      link.href = "./";
      link.dataset.returnHomePrefetch = "true";
      document.head.append(link);
    }

    if (warmupStarted) return;
    warmupStarted = true;
    const warm = () => {
      fetch(new URL("./", location.href), {
        cache: "force-cache",
        credentials: "same-origin",
        priority: "low",
      }).catch(() => {});
    };
    if ("requestIdleCallback" in window) requestIdleCallback(warm, { timeout: 900 });
    else setTimeout(warm, 120);
  };

  const capturePlanetMemory = () => {
    if (body.dataset.page !== "notes" && body.dataset.page !== "note") return;
    const x = root.style.getPropertyValue("--writing-planet-drift-x").trim();
    const y = root.style.getPropertyValue("--writing-planet-drift-y").trim();
    if (!x && !y) return;

    try {
      sessionStorage.setItem(planetMemoryKey, JSON.stringify({ x: x || "68px", y: y || "-22px" }));
    } catch {
      // The return still works with the default direction.
    }
  };

  const readPlanetMemory = () => {
    try {
      const raw = sessionStorage.getItem(planetMemoryKey);
      return raw ? JSON.parse(raw) : { x: "68px", y: "-22px" };
    } catch {
      return { x: "68px", y: "-22px" };
    }
  };

  const setNamedElement = (element, className, transitionName) => {
    if (!(element instanceof HTMLElement)) return;
    element.classList.add(className);
    element.style.setProperty("view-transition-name", transitionName);
  };

  const setIdentitySource = () => {
    setNamedElement(document.querySelector(".site-header .brand-avatar"), "return-site-avatar-source", "return-site-avatar");
    setNamedElement(document.querySelector(".site-header .brand > span"), "return-site-name-source", "return-site-name");
  };

  const setIdentityTarget = () => {
    setNamedElement(document.querySelector(".cosmos-center img"), "return-site-avatar-target", "return-site-avatar");
    setNamedElement(document.querySelector(".cosmos-center h1"), "return-site-name-target", "return-site-name");
  };

  const collectHomeAnimations = () => {
    returnAnimations = [];
    document.querySelectorAll(".garden-current, .garden-trace").forEach((element) => {
      element.getAnimations().forEach((animation) => {
        returnAnimations.push({ animation, rate: animation.playbackRate || 1 });
      });
    });
  };

  const stopWindRamp = ({ clearVisuals = true } = {}) => {
    cancelAnimationFrame(windFrame);
    windFrame = 0;
    returnAnimations.forEach(({ animation, rate }) => {
      try {
        setAnimationRate(animation, rate);
      } catch {
        // Ignore animations replaced by resize or page-cache restoration.
      }
    });
    returnAnimations = [];
    if (clearVisuals) {
      body.style.removeProperty("--keke-flow-thickness");
      body.style.removeProperty("--writing-flow-spread");
      body.style.removeProperty("--writing-flow-blur");
    }
  };

  const settleKekeWind = () => {
    stopWindRamp({ clearVisuals: false });
    body.style.setProperty("--keke-flow-thickness", "0.38");
    collectHomeAnimations();
    const startedAt = performance.now();

    returnAnimations.forEach(({ animation, rate }) => {
      try {
        setAnimationRate(animation, rate * KEKE_PEAK_RATE);
      } catch {
        // One missing animation must not block the return.
      }
    });

    const step = (now) => {
      const progress = Math.min(1, Math.max(0, (now - startedAt) / WIND_SETTLE_MS));
      const eased = 1 - Math.pow(1 - progress, 3);
      const factor = KEKE_PEAK_RATE - (KEKE_PEAK_RATE - 1) * eased;
      const thickness = 0.38 + 0.62 * eased;

      body.style.setProperty("--keke-flow-thickness", thickness.toFixed(3));
      returnAnimations.forEach(({ animation, rate }) => {
        try {
          setAnimationRate(animation, rate * factor);
        } catch {
          // One missing animation must not block the return.
        }
      });

      if (progress < 1) windFrame = requestAnimationFrame(step);
      else stopWindRamp();
    };

    windFrame = requestAnimationFrame(step);
  };

  const awakenWritingWind = () => {
    stopWindRamp({ clearVisuals: false });
    body.style.setProperty("--writing-flow-spread", "1.16");
    body.style.setProperty("--writing-flow-blur", "22.5px");
    collectHomeAnimations();
    const startedAt = performance.now();

    returnAnimations.forEach(({ animation, rate }) => {
      try {
        setAnimationRate(animation, rate * WRITING_CALM_RATE);
      } catch {
        // One missing animation must not block the return.
      }
    });

    const step = (now) => {
      const progress = Math.min(1, Math.max(0, (now - startedAt) / WIND_WAKE_MS));
      const eased = progress * progress * (3 - 2 * progress);
      const factor = WRITING_CALM_RATE + (1 - WRITING_CALM_RATE) * eased;
      const spread = 1.16 - 0.16 * eased;
      const blur = 22.5 - 3.5 * eased;

      body.style.setProperty("--writing-flow-spread", spread.toFixed(3));
      body.style.setProperty("--writing-flow-blur", `${blur.toFixed(2)}px`);
      returnAnimations.forEach(({ animation, rate }) => {
        try {
          setAnimationRate(animation, rate * factor);
        } catch {
          // One missing animation must not block the return.
        }
      });

      if (progress < 1) windFrame = requestAnimationFrame(step);
      else stopWindRamp();
    };

    windFrame = requestAnimationFrame(step);
  };

  const createPullThread = (marker, index) => {
    const rect = marker.getBoundingClientRect();
    const anchorY = Math.max(18, Math.min(56, document.querySelector(".site-header")?.getBoundingClientRect().bottom || 28));
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const pullDistance = Math.max(38, centerY - anchorY);
    const delay = index * 22;

    marker.style.setProperty("--return-pull-y", `${-pullDistance.toFixed(2)}px`);
    marker.style.setProperty("--return-pull-delay", `${delay}ms`);
    marker.classList.add("is-return-pulled");

    const thread = document.createElement("span");
    thread.className = "return-pull-thread";
    thread.style.setProperty("--return-thread-x", `${centerX.toFixed(2)}px`);
    thread.style.setProperty("--return-thread-top", `${anchorY.toFixed(2)}px`);
    thread.style.setProperty("--return-thread-height", `${pullDistance.toFixed(2)}px`);
    thread.style.setProperty("--return-pull-delay", `${delay}ms`);
    document.body.append(thread);
  };

  const visibleArchiveRows = () => {
    const viewportHeight = innerHeight || document.documentElement.clientHeight;
    const rows = [...document.querySelectorAll(".archive-row-v2")].filter((row) => {
      const rect = row.getBoundingClientRect();
      return rect.bottom > 54 && rect.top < viewportHeight - 24;
    });
    return (rows.length ? rows : [...document.querySelectorAll(".archive-row-v2")])
      .slice(0, MAX_SHARED_ARCHIVE_STARS);
  };

  const clearSourceState = () => {
    clearTimeout(navigateTimer);
    navigateTimer = 0;
    navigating = false;
    body.classList.remove(
      "is-return-pressing",
      "is-leaving-keke-home",
      "is-leaving-writing-home",
      "is-leaving-writing-archive-home",
      "is-leaving-writing-note-home"
    );

    document.querySelectorAll(".return-site-avatar-source, .return-site-name-source, .return-keke-planet-source").forEach((element) => {
      element.classList.remove("return-site-avatar-source", "return-site-name-source", "return-keke-planet-source");
      element.style.removeProperty("view-transition-name");
    });
    document.querySelectorAll(".return-writing-source").forEach((element) => {
      element.classList.remove("return-writing-source", "is-return-pulled");
      element.style.removeProperty("view-transition-name");
      element.style.removeProperty("--return-pull-y");
      element.style.removeProperty("--return-pull-delay");
    });
    document.querySelectorAll(".return-pull-thread").forEach((thread) => thread.remove());
    document.querySelectorAll('[aria-disabled="true"][data-return-home-link]').forEach((link) => {
      link.removeAttribute("aria-disabled");
      delete link.dataset.returnHomeLink;
    });
  };

  const navigateHome = (link, delay) => {
    link.dataset.returnHomeLink = "true";
    link.setAttribute("aria-disabled", "true");
    navigateTimer = window.setTimeout(() => {
      location.assign(new URL("./", location.href).href);
    }, delay);
  };

  const beginKekeReturn = (link) => {
    if (navigating) return;
    navigating = true;
    prefetchHome();
    setIdentitySource();
    setNamedElement(document.querySelector(".keke-transition-target"), "return-keke-planet-source", "return-keke-planet");
    writePayload({ mode: "keke-return" });
    body.classList.add("is-leaving-keke-home");
    navigateHome(link, KEKE_PRELUDE_MS);
  };

  const beginWritingReturn = (link) => {
    if (navigating) return;
    navigating = true;
    prefetchHome();
    setIdentitySource();

    const planet = readPlanetMemory();
    if (body.dataset.page === "notes") {
      const ids = [];
      visibleArchiveRows().forEach((row, index) => {
        if (!(row instanceof HTMLAnchorElement)) return;
        const marker = row.querySelector(".note-kind-marker");
        const id = noteIdFromHref(row.href);
        if (!id || !(marker instanceof HTMLElement)) return;
        ids[index] = id;
        marker.classList.add("return-writing-source");
        marker.style.setProperty("view-transition-name", `return-writing-star-${index}`);
        createPullThread(marker, index);
      });
      writePayload({ mode: "writing-archive-return", ids, planet });
      body.classList.add("is-leaving-writing-home", "is-leaving-writing-archive-home");
    } else {
      const id = new URLSearchParams(location.search).get("id") || "";
      const marker = document.querySelector(".article-meta-line .note-kind-marker");
      if (marker instanceof HTMLElement && id) {
        marker.classList.add("return-writing-source");
        marker.style.setProperty("view-transition-name", "return-writing-focus-star");
        createPullThread(marker, 0);
      }
      writePayload({ mode: "writing-note-return", id, planet });
      body.classList.add("is-leaving-writing-home", "is-leaving-writing-note-home");
    }

    navigateHome(link, WRITING_PRELUDE_MS);
  };

  const installReturnLinks = () => {
    if (body.dataset.page === "home") return;
    const page = body.dataset.page;
    if (page !== "keke" && page !== "notes" && page !== "note") return;

    prefetchHome();
    const links = [...document.querySelectorAll('.site-header .brand[href="./"], .site-footer a[href="./"]')];
    links.forEach((link) => {
      if (!(link instanceof HTMLAnchorElement)) return;

      link.addEventListener("pointerenter", prefetchHome, { passive: true });
      link.addEventListener("focus", prefetchHome, { passive: true });
      link.addEventListener("pointerdown", (event) => {
        if (event.button === 0 && !reducedMotion.matches) body.classList.add("is-return-pressing");
      }, { passive: true });
      link.addEventListener("pointercancel", () => body.classList.remove("is-return-pressing"), { passive: true });
      link.addEventListener("click", (event) => {
        if (!isPlainPrimaryClick(event) || reducedMotion.matches) return;
        event.preventDefault();
        if (page === "keke") beginKekeReturn(link);
        else beginWritingReturn(link);
      });
    });

    addEventListener("pageshow", clearSourceState);
  };

  const stabilizeHomeStars = (duration = 1350) => {
    const field = document.querySelector("#cosmos-field");
    const stars = [...document.querySelectorAll("#note-stars .note-star")];
    const threads = [...document.querySelectorAll("#star-threads .star-thread")];
    if (!(field instanceof HTMLElement) || !stars.length) return;

    const layouts = [
      [0.10, 0.24, -0.19], [0.22, 0.39, 0.12], [0.35, 0.22, -0.13], [0.50, 0.31, 0.16],
      [0.66, 0.20, -0.12], [0.82, 0.35, 0.11], [0.18, 0.57, 0.08], [0.76, 0.56, -0.08],
    ];
    const startedAt = performance.now();

    const place = (now) => {
      const width = field.clientWidth;
      const height = field.clientHeight;
      if (width >= 120 && height >= 240) {
        stars.forEach((star, index) => {
          if (!(star instanceof HTMLElement) || !layouts[index]) return;
          const [anchorRatio, ropeRatio, angle] = layouts[index];
          const anchorX = width * anchorRatio;
          const anchorY = -10;
          const length = Math.max(140, height * ropeRatio);
          const x = anchorX + Math.sin(angle) * length;
          const y = anchorY + Math.cos(angle) * length;
          const size = Number.parseFloat(getComputedStyle(star).getPropertyValue("--note-star-size"));
          const tip = Number.isFinite(size) ? size / 2 : 6;

          star.style.transform = `translate(${(x - 22).toFixed(2)}px, ${(y - 22).toFixed(2)}px)`;
          const line = threads[index];
          if (line instanceof SVGElement) {
            line.setAttribute("x1", anchorX.toFixed(2));
            line.setAttribute("y1", String(anchorY));
            line.setAttribute("x2", x.toFixed(2));
            line.setAttribute("y2", (y - tip).toFixed(2));
          }
        });
      }

      if (now - startedAt < duration) requestAnimationFrame(place);
    };

    requestAnimationFrame(place);
  };

  const findHomeStar = (id) => {
    return [...document.querySelectorAll("#note-stars .note-star")].find(
      (star) => star instanceof HTMLAnchorElement && noteIdFromHref(star.href) === id
    );
  };

  const setWritingTargets = (payload) => {
    if (payload.mode === "writing-archive-return") {
      const ids = Array.isArray(payload.ids) ? payload.ids : [];
      ids.forEach((id, index) => {
        if (!id) return;
        const star = findHomeStar(id);
        const core = star?.querySelector(".note-star-core");
        if (!(star instanceof HTMLElement) || !(core instanceof HTMLElement)) return;
        star.classList.add("return-shared-star");
        core.classList.add("return-writing-target");
        core.style.setProperty("view-transition-name", `return-writing-star-${index}`);
      });
      return;
    }

    const star = findHomeStar(payload.id || "");
    const core = star?.querySelector(".note-star-core");
    if (star instanceof HTMLElement && core instanceof HTMLElement) {
      star.classList.add("return-shared-star");
      core.classList.add("return-writing-target");
      core.style.setProperty("view-transition-name", "return-writing-focus-star");
    }
  };

  const clearArrivalState = () => {
    stopWindRamp();
    delete root.dataset.returnHomePending;
    body.classList.remove(
      "is-returning-keke-home",
      "is-returning-writing-home",
      "is-returning-writing-archive-home",
      "is-returning-writing-note-home"
    );
    document.querySelectorAll(".return-site-avatar-target, .return-site-name-target, .return-keke-planet-target").forEach((element) => {
      element.classList.remove("return-site-avatar-target", "return-site-name-target", "return-keke-planet-target");
      element.style.removeProperty("view-transition-name");
    });
    document.querySelectorAll(".return-writing-target").forEach((element) => {
      element.classList.remove("return-writing-target");
      element.style.removeProperty("view-transition-name");
    });
    document.querySelectorAll(".return-shared-star").forEach((element) => element.classList.remove("return-shared-star"));
    root.style.removeProperty("--return-planet-drift-x");
    root.style.removeProperty("--return-planet-drift-y");
  };

  const installHomeArrival = () => {
    if (body.dataset.page !== "home") return;
    const payload = readPayload();
    if (!payload || reducedMotion.matches) {
      delete root.dataset.returnHomePending;
      return;
    }

    root.dataset.returnHomePending = payload.mode;
    setIdentityTarget();
    if (payload.mode === "keke-return") {
      body.style.setProperty("--keke-flow-thickness", "0.38");
      setNamedElement(document.querySelector(".orbit-project img"), "return-keke-planet-target", "return-keke-planet");
      body.classList.add("is-returning-keke-home");
      settleKekeWind();
    } else if (payload.mode === "writing-archive-return" || payload.mode === "writing-note-return") {
      body.style.setProperty("--writing-flow-spread", "1.16");
      body.style.setProperty("--writing-flow-blur", "22.5px");
      stabilizeHomeStars();
      setWritingTargets(payload);
      root.style.setProperty("--return-planet-drift-x", payload.planet?.x || "68px");
      root.style.setProperty("--return-planet-drift-y", payload.planet?.y || "-22px");
      body.classList.add(
        "is-returning-writing-home",
        payload.mode === "writing-archive-return" ? "is-returning-writing-archive-home" : "is-returning-writing-note-home"
      );
      awakenWritingWind();
    }

    setTimeout(clearArrivalState, 1550);
  };

  capturePlanetMemory();
  installHomeArrival();
  installReturnLinks();
})();