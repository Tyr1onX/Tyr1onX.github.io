(() => {
  const body = document.body;
  const root = document.documentElement;
  const page = body.dataset.page || "";
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const writingKey = "tyr1onx:writing-transition";
  const returnKey = "tyr1onx:return-home-transition";
  const planetMemoryKey = "tyr1onx:writing-planet-memory";
  const HOME_STAR_STAGGER_MS = 28;
  const RETRACT_NAMES = new Set([
    "writing-home-star-retract",
    "writing-home-thread-retract",
  ]);
  const PULL_NAMES = new Set([
    "return-source-star-reel",
    "return-pull-thread-reel",
  ]);
  const destinationCache = new Map();
  let navigating = false;

  const sleep = (duration) => new Promise((resolve) => setTimeout(resolve, duration));
  const afterStyleCommit = () => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });

  const waitForAnimations = async (elements, names, fallbackMs) => {
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

  const uniqueDestination = (href, kind, mode) => {
    const key = `${href}|${kind}|${mode}`;
    if (destinationCache.has(key)) return destinationCache.get(key);

    const url = new URL(href, location.href);
    url.searchParams.set(kind, mode);
    url.searchParams.set("__t", Date.now().toString(36));
    destinationCache.set(key, url.href);
    return url.href;
  };

  const warmDestination = (href) => {
    if (!href || document.querySelector(`link[data-sequence-prefetch="${CSS.escape(href)}"]`)) return;
    const link = document.createElement("link");
    link.rel = "prefetch";
    link.href = href;
    link.dataset.sequencePrefetch = href;
    document.head.append(link);

    const warm = () => {
      fetch(href, {
        cache: "force-cache",
        credentials: "same-origin",
        priority: "low",
      }).catch(() => {});
    };
    if ("requestIdleCallback" in window) requestIdleCallback(warm, { timeout: 700 });
    else setTimeout(warm, 100);
  };

  const setNamed = (element, className, transitionName) => {
    if (!(element instanceof HTMLElement)) return;
    element.classList.add(className);
    if (transitionName) element.style.setProperty("view-transition-name", transitionName);
  };

  const prepareIdentityFromHome = () => {
    document.querySelector(".cosmos-center img")?.classList.add("writing-site-avatar-source");
    document.querySelector(".cosmos-center h1")?.classList.add("writing-site-name-source");
  };

  const prepareIdentityToHome = () => {
    setNamed(document.querySelector(".site-header .brand-avatar"), "return-site-avatar-source", "return-site-avatar");
    setNamed(document.querySelector(".site-header .brand > span"), "return-site-name-source", "return-site-name");
  };

  const preparePlanetRetreat = () => {
    const field = document.querySelector("#cosmos-field");
    const project = document.querySelector(".orbit-project");
    const orbit = document.querySelector(".project-orbit-line");
    const shell = project?.querySelector(".orbit-icon-shell");
    if (!(field instanceof HTMLElement)
      || !(project instanceof HTMLElement)
      || !(orbit instanceof HTMLElement)
      || !(shell instanceof HTMLElement)) {
      return { x: 68, y: -22 };
    }

    const fieldRect = field.getBoundingClientRect();
    const projectRect = project.getBoundingClientRect();
    const orbitRect = orbit.getBoundingClientRect();
    const centerX = fieldRect.left + fieldRect.width / 2;
    const centerY = fieldRect.top + fieldRect.height / 2;
    const projectX = projectRect.left + projectRect.width / 2;
    const projectY = projectRect.top + projectRect.height / 2;
    const radiusX = Math.max(1, orbitRect.width / 2);
    const radiusY = Math.max(1, orbitRect.height / 2);
    const cosine = Math.min(1, Math.max(-1, (projectX - centerX) / radiusX));
    const sine = Math.min(1, Math.max(-1, (projectY - centerY) / radiusY));

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

    shell.classList.add("writing-planet-source");
    return {
      x: Math.round(tangentX * 78 + outwardX * 26),
      y: Math.round(tangentY * 78 + outwardY * 26),
    };
  };

  const prepareHomeRetraction = (focusIndex = null) => {
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

  const saveWritingPayload = (payload) => {
    try {
      sessionStorage.setItem(writingKey, JSON.stringify(payload));
    } catch {}
  };

  const startWritingForward = async (link, focusStar = null) => {
    if (navigating) return;
    navigating = true;

    const mode = focusStar ? "note" : "archive";
    const destination = uniqueDestination(link.href, "__writing", mode);
    warmDestination(destination);
    const focusIndex = focusStar
      ? [...document.querySelectorAll("#note-stars .note-star")].indexOf(focusStar)
      : null;
    const { ids, elements } = prepareHomeRetraction(focusIndex);
    const id = focusStar ? noteIdFromHref(focusStar.href) : "";

    prepareIdentityFromHome();
    const planet = preparePlanetRetreat();
    saveWritingPayload(mode === "archive"
      ? { mode, ids, planet }
      : { mode, id, planet });
    body.classList.add(mode === "archive" ? "is-preparing-writing-archive" : "is-preparing-writing-note");

    await waitForAnimations(elements, RETRACT_NAMES, mode === "archive" ? 760 : 520);
    body.classList.add(mode === "archive" ? "is-entering-writing-archive" : "is-entering-writing-note");
    location.assign(destination);
  };

  const readPlanetMemory = () => {
    try {
      const raw = sessionStorage.getItem(planetMemoryKey);
      return raw ? JSON.parse(raw) : { x: "68px", y: "-22px" };
    } catch {
      return { x: "68px", y: "-22px" };
    }
  };

  const createPullThread = (marker, index) => {
    const rect = marker.getBoundingClientRect();
    const headerBottom = document.querySelector(".site-header")?.getBoundingClientRect().bottom || 28;
    const anchorY = Math.max(18, Math.min(56, headerBottom));
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const distance = Math.max(38, centerY - anchorY);
    const delay = index * 22;

    marker.style.setProperty("--return-pull-y", `${-distance.toFixed(2)}px`);
    marker.style.setProperty("--return-pull-delay", `${delay}ms`);
    marker.classList.add("return-writing-source", "is-return-pulled");

    const thread = document.createElement("span");
    thread.className = "return-pull-thread";
    thread.style.setProperty("--return-thread-x", `${centerX.toFixed(2)}px`);
    thread.style.setProperty("--return-thread-top", `${anchorY.toFixed(2)}px`);
    thread.style.setProperty("--return-thread-height", `${distance.toFixed(2)}px`);
    thread.style.setProperty("--return-pull-delay", `${delay}ms`);
    document.body.append(thread);
    return [marker, thread];
  };

  const saveReturnPayload = (payload) => {
    try {
      sessionStorage.setItem(returnKey, JSON.stringify(payload));
    } catch {}
  };

  const startWritingReturn = async (link) => {
    if (navigating) return;
    navigating = true;
    prepareIdentityToHome();
    const destination = uniqueDestination("./", "__return", "writing");
    warmDestination(destination);
    const planet = readPlanetMemory();
    const elements = [];

    if (page === "notes") {
      const viewportHeight = innerHeight || document.documentElement.clientHeight;
      const rows = [...document.querySelectorAll(".archive-row-v2")].filter((row) => {
        const rect = row.getBoundingClientRect();
        return rect.bottom > 54 && rect.top < viewportHeight - 24;
      }).slice(0, 5);
      const ids = [];
      rows.forEach((row, index) => {
        if (!(row instanceof HTMLAnchorElement)) return;
        const marker = row.querySelector(".note-kind-marker");
        const id = noteIdFromHref(row.href);
        if (!id || !(marker instanceof HTMLElement)) return;
        ids[index] = id;
        marker.style.setProperty("view-transition-name", `return-writing-star-${index}`);
        elements.push(...createPullThread(marker, index));
      });
      saveReturnPayload({ mode: "writing-archive-return", ids, planet });
      body.classList.add("is-leaving-writing-home", "is-leaving-writing-archive-home");
      await waitForAnimations(elements, PULL_NAMES, 540);
    } else {
      const id = new URLSearchParams(location.search).get("id") || "";
      const marker = document.querySelector(".article-meta-line .note-kind-marker");
      if (marker instanceof HTMLElement && id) {
        marker.style.setProperty("view-transition-name", "return-writing-focus-star");
        elements.push(...createPullThread(marker, 0));
      }
      saveReturnPayload({ mode: "writing-note-return", id, planet });
      body.classList.add("is-leaving-writing-home", "is-leaving-writing-note-home");
      await waitForAnimations(elements, PULL_NAMES, 460);
    }

    location.assign(destination);
  };

  if (page === "home") {
    document.addEventListener("click", (event) => {
      if (reducedMotion.matches || event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target.closest("a") : null;
      if (!(target instanceof HTMLAnchorElement)) return;

      const isArchive = target.matches(".all-writing-link, .site-header .nav-links a[href$='notes.html']");
      const star = target.matches("#note-stars .note-star") ? target : null;
      if (!isArchive && !(star instanceof HTMLAnchorElement)) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      void startWritingForward(target, star);
    }, true);
    return;
  }

  if (page === "notes" || page === "note") {
    const returnDestination = uniqueDestination("./", "__return", "writing");
    warmDestination(returnDestination);
    document.addEventListener("click", (event) => {
      if (reducedMotion.matches || event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target instanceof Element
        ? event.target.closest('.site-header .brand[href="./"], .site-footer a[href="./"]')
        : null;
      if (!(target instanceof HTMLAnchorElement)) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      void startWritingReturn(target);
    }, true);
  }
})();