(() => {
  const body = document.body;
  const root = document.documentElement;
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const storageKey = "tyr1onx:writing-transition";
  const WIND_CALM_MS = 420;
  const MIN_WIND_RATE = 0.24;
  const HOME_STAR_STAGGER_MS = 28;
  const DROP_STAGGER_MS = 38;
  const RETRACT_ANIMATION_NAMES = new Set([
    "writing-home-star-retract",
    "writing-home-thread-retract",
  ]);

  let calmFrame = 0;
  let slowedAnimations = [];
  let navigateTimer = 0;
  let navigating = false;
  let arrivalActive = false;
  const prefetched = new Map();

  const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
  const sleep = (duration) => new Promise((resolve) => setTimeout(resolve, duration));
  const afterStyleCommit = () => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });

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

  const noteIdFromHref = (href) => {
    try {
      return new URL(href, location.href).searchParams.get("id") || "";
    } catch {
      return "";
    }
  };

  const transitionDestination = (href, mode) => {
    let destination;
    try {
      destination = new URL(href, location.href);
    } catch {
      return null;
    }

    const key = `${destination.href}|${mode}`;
    if (!prefetched.has(key)) {
      destination.searchParams.set("__writing", mode);
      destination.searchParams.set("__t", Date.now().toString(36));
      prefetched.set(key, destination.href);
    }
    return prefetched.get(key);
  };

  const prefetchDestination = (href, mode) => {
    const destination = transitionDestination(href, mode);
    if (!destination || document.querySelector(`link[data-writing-prefetch="${CSS.escape(destination)}"]`)) return destination;

    const link = document.createElement("link");
    link.rel = "prefetch";
    link.href = destination;
    link.dataset.writingPrefetch = destination;
    document.head.append(link);

    const warm = () => {
      fetch(destination, {
        cache: "force-cache",
        credentials: "same-origin",
        priority: "low",
      }).catch(() => {});
    };
    if ("requestIdleCallback" in window) requestIdleCallback(warm, { timeout: 700 });
    else setTimeout(warm, 100);
    return destination;
  };

  const cleanTransitionQuery = () => {
    const url = new URL(location.href);
    if (!url.searchParams.has("__writing") && !url.searchParams.has("__t")) return;
    url.searchParams.delete("__writing");
    url.searchParams.delete("__t");
    history.replaceState(history.state, "", `${url.pathname}${url.search}${url.hash}`);
  };

  const setAnimationRate = (animation, rate) => {
    if (typeof animation.updatePlaybackRate === "function") animation.updatePlaybackRate(rate);
    else animation.playbackRate = rate;
  };

  const restoreWind = () => {
    cancelAnimationFrame(calmFrame);
    calmFrame = 0;

    slowedAnimations.forEach(({ animation, rate }) => {
      try {
        setAnimationRate(animation, rate);
      } catch {
        // Ignore animations replaced while the page was cached.
      }
    });
    slowedAnimations = [];
    body.style.removeProperty("--writing-flow-spread");
    body.style.removeProperty("--writing-flow-blur");
    body.style.removeProperty("--writing-calm-progress");
  };

  const releaseForwardWindWithoutClearingReturnState = () => {
    cancelAnimationFrame(calmFrame);
    calmFrame = 0;
    slowedAnimations = [];
    body.style.removeProperty("--writing-calm-progress");
  };

  const isWritingReturnArrival = () => {
    const mode = root.dataset.returnHomePending || "";
    return mode.startsWith("writing-") || body.classList.contains("is-returning-writing-home");
  };

  const calmWind = () => {
    restoreWind();
    document.querySelectorAll(".garden-current, .garden-trace").forEach((element) => {
      element.getAnimations().forEach((animation) => {
        slowedAnimations.push({ animation, rate: 1 });
      });
    });

    const startedAt = performance.now();
    const step = (now) => {
      const progress = Math.min(1, Math.max(0, (now - startedAt) / WIND_CALM_MS));
      const eased = 1 - Math.pow(1 - progress, 3);
      const factor = 1 - (1 - MIN_WIND_RATE) * eased;
      const spread = 1 + 0.16 * eased;
      const blur = 19 + 3.5 * eased;

      body.style.setProperty("--writing-flow-spread", spread.toFixed(3));
      body.style.setProperty("--writing-flow-blur", `${blur.toFixed(2)}px`);
      body.style.setProperty("--writing-calm-progress", eased.toFixed(3));

      slowedAnimations.forEach(({ animation, rate }) => {
        try {
          setAnimationRate(animation, Math.max(0.1, rate * factor));
        } catch {
          // One missing animation must not block navigation.
        }
      });

      calmFrame = progress < 1 ? requestAnimationFrame(step) : 0;
    };

    calmFrame = requestAnimationFrame(step);
  };

  const setIdentitySource = () => {
    document.querySelector(".cosmos-center img")?.classList.add("writing-site-avatar-source");
    document.querySelector(".cosmos-center h1")?.classList.add("writing-site-name-source");
  };

  const setIdentityTarget = () => {
    document.querySelector(".site-header .brand-avatar")?.classList.add("writing-site-avatar-target");
    document.querySelector(".site-header .brand > span")?.classList.add("writing-site-name-target");
  };

  const preparePlanetRetreat = () => {
    const field = document.querySelector("#cosmos-field");
    const orbitProject = document.querySelector(".orbit-project");
    const orbitLine = document.querySelector(".project-orbit-line");
    const shell = orbitProject?.querySelector(".orbit-icon-shell");

    if (!(field instanceof HTMLElement)
      || !(orbitProject instanceof HTMLElement)
      || !(orbitLine instanceof HTMLElement)
      || !(shell instanceof HTMLElement)) {
      return { x: 68, y: -22 };
    }

    const fieldRect = field.getBoundingClientRect();
    const projectRect = orbitProject.getBoundingClientRect();
    const orbitRect = orbitLine.getBoundingClientRect();
    const centerX = fieldRect.left + fieldRect.width / 2;
    const centerY = fieldRect.top + fieldRect.height / 2;
    const projectX = projectRect.left + projectRect.width / 2;
    const projectY = projectRect.top + projectRect.height / 2;
    const radiusX = Math.max(1, orbitRect.width / 2);
    const radiusY = Math.max(1, orbitRect.height / 2);
    const cosine = clamp((projectX - centerX) / radiusX, -1, 1);
    const sine = clamp((projectY - centerY) / radiusY, -1, 1);

    let tangentX = -radiusX * sine;
    let tangentY = radiusY * cosine;
    const tangentLength = Math.hypot(tangentX, tangentY) || 1;
    tangentX /= tangentLength;
    tangentY /= tangentLength;

    let outwardX = projectX - centerX;
    let outwardY = projectY - centerY;
    const outwardLength = Math.hypot(outwardX, outwardY) || 1;
    outwardX /= outwardLength;
    outwardY /= outwardLength;

    const drift = {
      x: Math.round(tangentX * 78 + outwardX * 26),
      y: Math.round(tangentY * 78 + outwardY * 26),
    };

    shell.classList.add("writing-planet-source");
    return drift;
  };

  const applyPlanetDrift = (payload) => {
    const x = Number(payload?.planet?.x);
    const y = Number(payload?.planet?.y);
    root.style.setProperty("--writing-planet-drift-x", `${Number.isFinite(x) ? x : 68}px`);
    root.style.setProperty("--writing-planet-drift-y", `${Number.isFinite(y) ? y : -22}px`);
  };

  const clearPlanetDrift = () => {
    root.style.removeProperty("--writing-planet-drift-x");
    root.style.removeProperty("--writing-planet-drift-y");
  };

  const prepareHomeStarRetraction = ({ focusIndex = null } = {}) => {
    const stars = [...document.querySelectorAll("#note-stars .note-star")];
    const threads = [...document.querySelectorAll("#star-threads .star-thread")];
    const ids = [];
    const elements = [];

    stars.forEach((star, index) => {
      if (!(star instanceof HTMLAnchorElement)) return;
      const id = noteIdFromHref(star.href);
      if (id) ids[index] = id;

      if (focusIndex !== null && index !== focusIndex) {
        star.classList.add("writing-retract-bystander");
        return;
      }

      const line = threads[index];
      const anchorX = Number.parseFloat(line?.getAttribute("x1") || "");
      const anchorY = Number.parseFloat(line?.getAttribute("y1") || "");
      const targetX = Number.isFinite(anchorX) ? anchorX - star.offsetWidth / 2 : star.offsetLeft;
      const targetY = Number.isFinite(anchorY) ? anchorY - star.offsetHeight / 2 : -star.offsetHeight;
      const delay = focusIndex === null ? index * HOME_STAR_STAGGER_MS : 0;

      star.style.setProperty("--writing-retract-x", `${targetX.toFixed(2)}px`);
      star.style.setProperty("--writing-retract-y", `${targetY.toFixed(2)}px`);
      star.style.setProperty("--writing-retract-delay", `${delay}ms`);
      star.classList.add("writing-retract-source");
      elements.push(star);

      if (line instanceof SVGElement) {
        line.style.setProperty("--writing-retract-delay", `${delay}ms`);
        line.classList.add("writing-retract-thread");
        elements.push(line);
      }
    });

    return { ids, elements };
  };

  const clearHomeState = () => {
    if (isWritingReturnArrival()) releaseForwardWindWithoutClearingReturnState();
    else restoreWind();

    clearTimeout(navigateTimer);
    navigateTimer = 0;
    navigating = false;
    body.classList.remove(
      "is-writing-pressed",
      "is-preparing-writing-archive",
      "is-entering-writing-archive",
      "is-preparing-writing-note",
      "is-entering-writing-note"
    );

    document.querySelectorAll(".writing-site-avatar-source, .writing-site-name-source").forEach((element) => {
      element.classList.remove("writing-site-avatar-source", "writing-site-name-source");
    });
    document.querySelectorAll(".writing-retract-source, .writing-retract-bystander").forEach((star) => {
      star.classList.remove("writing-retract-source", "writing-retract-bystander");
      star.style.removeProperty("--writing-retract-x");
      star.style.removeProperty("--writing-retract-y");
      star.style.removeProperty("--writing-retract-delay");
    });
    document.querySelectorAll(".writing-retract-thread").forEach((thread) => {
      thread.classList.remove("writing-retract-thread");
      thread.style.removeProperty("--writing-retract-delay");
    });
    document.querySelector(".writing-planet-source")?.classList.remove("writing-planet-source");
    clearPlanetDrift();
  };

  const saveTransition = (payload) => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(payload));
    } catch {
      // Navigation remains usable without the destination reveal.
    }
  };

  const beginArchiveTransition = async (link) => {
    if (navigating) return;
    navigating = true;
    const destination = prefetchDestination(link.href, "archive") || link.href;
    const { ids, elements } = prepareHomeStarRetraction();

    setIdentitySource();
    const planet = preparePlanetRetreat();
    saveTransition({ mode: "archive", ids, planet });
    body.classList.add("is-preparing-writing-archive");
    calmWind();

    await waitForNamedAnimations(elements, RETRACT_ANIMATION_NAMES, 760);
    body.classList.add("is-entering-writing-archive");
    location.assign(destination);
  };

  const beginNoteTransition = async (star, index) => {
    if (navigating) return;
    navigating = true;

    const id = noteIdFromHref(star.href);
    if (!id) {
      location.assign(star.href);
      return;
    }

    const destination = prefetchDestination(star.href, "note") || star.href;
    const { elements } = prepareHomeStarRetraction({ focusIndex: index });
    setIdentitySource();
    const planet = preparePlanetRetreat();
    saveTransition({ mode: "note", id, planet });
    body.classList.add("is-preparing-writing-note");
    calmWind();

    await waitForNamedAnimations(elements, RETRACT_ANIMATION_NAMES, 520);
    body.classList.add("is-entering-writing-note");
    location.assign(destination);
  };

  const installHomeTransitions = () => {
    if (body.dataset.page !== "home") return;

    const archiveLinks = [
      ...document.querySelectorAll(".all-writing-link, .site-header .nav-links a[href$='notes.html']"),
    ];
    archiveLinks.forEach((link) => {
      if (!(link instanceof HTMLAnchorElement)) return;
      link.addEventListener("pointerenter", () => prefetchDestination(link.href, "archive"), { passive: true });
      link.addEventListener("focus", () => prefetchDestination(link.href, "archive"), { passive: true });
      link.addEventListener("pointerdown", (event) => {
        if (event.button === 0 && !reducedMotion.matches) body.classList.add("is-writing-pressed");
      }, { passive: true });
      link.addEventListener("click", (event) => {
        const modified = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
        if (event.defaultPrevented || event.button !== 0 || modified || reducedMotion.matches) return;
        event.preventDefault();
        void beginArchiveTransition(link);
      });
    });

    [...document.querySelectorAll("#note-stars .note-star")].forEach((star, index) => {
      if (!(star instanceof HTMLAnchorElement)) return;
      star.addEventListener("pointerenter", () => prefetchDestination(star.href, "note"), { passive: true });
      star.addEventListener("focus", () => prefetchDestination(star.href, "note"), { passive: true });
      star.addEventListener("pointerdown", (event) => {
        if (event.button === 0 && !reducedMotion.matches) body.classList.add("is-writing-pressed");
      }, { passive: true });
      star.addEventListener("click", (event) => {
        const modified = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
        if (event.defaultPrevented || event.button !== 0 || modified || reducedMotion.matches) return;
        event.preventDefault();
        void beginNoteTransition(star, index);
      });
    });

    addEventListener("pageshow", clearHomeState);
  };

  const readArrival = () => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      sessionStorage.removeItem(storageKey);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  const createDropThread = (marker, index) => {
    const rect = marker.getBoundingClientRect();
    const headerBottom = document.querySelector(".site-header")?.getBoundingClientRect().bottom || 28;
    const anchorY = Math.max(18, Math.min(56, headerBottom));
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const distance = Math.max(38, centerY - anchorY);
    const delay = index * DROP_STAGGER_MS;

    marker.style.setProperty("--writing-drop-y", `${-distance.toFixed(2)}px`);
    marker.style.setProperty("--writing-drop-delay", `${delay}ms`);
    marker.classList.add("writing-drop-target");

    const thread = document.createElement("span");
    thread.className = "writing-drop-thread";
    thread.style.setProperty("--writing-thread-x", `${centerX.toFixed(2)}px`);
    thread.style.setProperty("--writing-thread-top", `${anchorY.toFixed(2)}px`);
    thread.style.setProperty("--writing-thread-height", `${distance.toFixed(2)}px`);
    thread.style.setProperty("--writing-drop-delay", `${delay}ms`);
    document.body.append(thread);
  };

  const clearArrivalNames = () => {
    arrivalActive = false;
    document.querySelectorAll(".writing-site-avatar-target, .writing-site-name-target").forEach((element) => {
      element.classList.remove("writing-site-avatar-target", "writing-site-name-target");
    });
    document.querySelectorAll(".writing-drop-target").forEach((marker) => {
      marker.classList.remove("writing-drop-target");
      marker.style.removeProperty("--writing-drop-y");
      marker.style.removeProperty("--writing-drop-delay");
    });
    document.querySelectorAll(".writing-drop-thread").forEach((thread) => thread.remove());
    document.querySelectorAll(".archive-row-v2").forEach((row) => row.style.removeProperty("--writing-arrival-delay"));
    body.classList.remove("is-arriving-writing-archive", "is-arriving-writing-note");
    delete root.dataset.writingArrivalPending;
    clearPlanetDrift();
  };

  const installArchiveArrival = (payload) => {
    if (body.dataset.page !== "notes" || payload?.mode !== "archive") return false;

    arrivalActive = true;
    cleanTransitionQuery();
    applyPlanetDrift(payload);
    setIdentityTarget();
    const rows = [...document.querySelectorAll(".archive-row-v2")];
    const ids = Array.isArray(payload.ids) ? payload.ids : [];

    ids.forEach((id, index) => {
      if (!id) return;
      const row = rows.find((candidate) => candidate instanceof HTMLAnchorElement && noteIdFromHref(candidate.href) === id);
      const marker = row?.querySelector(".note-kind-marker");
      if (!(row instanceof HTMLElement) || !(marker instanceof HTMLElement)) return;
      createDropThread(marker, index);
    });

    rows.forEach((row, index) => row.style.setProperty("--writing-arrival-delay", `${Math.min(index, 8) * 34}ms`));
    requestAnimationFrame(() => body.classList.add("is-arriving-writing-archive"));
    setTimeout(clearArrivalNames, 2300);
    return true;
  };

  const installNoteArrival = (payload) => {
    if (body.dataset.page !== "note" || payload?.mode !== "note") return false;

    const currentId = new URLSearchParams(location.search).get("id") || "";
    if (!currentId || currentId !== payload.id) return false;

    arrivalActive = true;
    cleanTransitionQuery();
    applyPlanetDrift(payload);
    setIdentityTarget();
    const marker = document.querySelector(".article-meta-line .note-kind-marker");
    if (marker instanceof HTMLElement) createDropThread(marker, 0);

    requestAnimationFrame(() => body.classList.add("is-arriving-writing-note"));
    setTimeout(clearArrivalNames, 2100);
    return true;
  };

  const installArrival = () => {
    if (reducedMotion.matches || body.dataset.page === "home" || arrivalActive) return;
    const payload = readArrival();
    if (!payload) {
      cleanTransitionQuery();
      delete root.dataset.writingArrivalPending;
      return;
    }
    root.dataset.writingArrivalPending = payload.mode;
    if (installArchiveArrival(payload)) return;
    installNoteArrival(payload);
  };

  installArrival();
  if (body.dataset.page !== "home") addEventListener("pageshow", installArrival);
  installHomeTransitions();
})();