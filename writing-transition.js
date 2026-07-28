(() => {
  const body = document.body;
  const root = document.documentElement;
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const storageKey = "tyr1onx:writing-transition";
  const ARCHIVE_PRELUDE_MS = 390;
  const NOTE_PRELUDE_MS = 330;
  const WIND_CALM_MS = 420;
  const MIN_WIND_RATE = 0.24;

  let calmFrame = 0;
  let slowedAnimations = [];
  let navigateTimer = 0;
  let navigating = false;
  const prefetched = new Set();

  const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

  const noteIdFromHref = (href) => {
    try {
      return new URL(href, location.href).searchParams.get("id") || "";
    } catch {
      return "";
    }
  };

  const prefetchDestination = (href) => {
    let destination;
    try {
      destination = new URL(href, location.href).href;
    } catch {
      return;
    }
    if (prefetched.has(destination)) return;
    prefetched.add(destination);

    const link = document.createElement("link");
    link.rel = "prefetch";
    link.href = destination;
    document.head.append(link);
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

  const calmWind = () => {
    restoreWind();
    document.querySelectorAll(".garden-current, .garden-trace").forEach((element) => {
      element.getAnimations().forEach((animation) => {
        slowedAnimations.push({ animation, rate: animation.playbackRate || 1 });
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

  const clearHomeState = () => {
    restoreWind();
    clearTimeout(navigateTimer);
    navigateTimer = 0;
    navigating = false;
    body.classList.remove(
      "is-preparing-writing-archive",
      "is-entering-writing-archive",
      "is-preparing-writing-note",
      "is-entering-writing-note"
    );

    document.querySelectorAll(".writing-site-avatar-source, .writing-site-name-source").forEach((element) => {
      element.classList.remove("writing-site-avatar-source", "writing-site-name-source");
    });

    document.querySelectorAll(".note-star").forEach((star) => {
      star.classList.remove("writing-focus-source");
    });
    document.querySelectorAll(".note-star-core").forEach((core) => {
      core.style.removeProperty("view-transition-name");
    });
    document.querySelectorAll(".star-thread").forEach((thread) => thread.classList.remove("writing-focus-thread"));
    document.querySelector(".writing-planet-source")?.classList.remove("writing-planet-source");
    clearPlanetDrift();
  };

  const saveTransition = (payload) => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(payload));
    } catch {
      // The navigation remains usable without the destination reveal.
    }
  };

  const beginArchiveTransition = (link) => {
    if (navigating) return;
    navigating = true;
    prefetchDestination(link.href);

    const stars = [...document.querySelectorAll("#note-stars .note-star")];
    const ids = [];
    stars.forEach((star, index) => {
      if (!(star instanceof HTMLAnchorElement)) return;
      const id = noteIdFromHref(star.href);
      const core = star.querySelector(".note-star-core");
      if (!id || !(core instanceof HTMLElement)) return;
      ids[index] = id;
      core.style.setProperty("view-transition-name", `writing-star-${index}`);
    });

    setIdentitySource();
    const planet = preparePlanetRetreat();
    saveTransition({ mode: "archive", ids, planet });
    body.classList.add("is-preparing-writing-archive");
    calmWind();

    navigateTimer = window.setTimeout(() => {
      body.classList.add("is-entering-writing-archive");
      location.assign(link.href);
    }, ARCHIVE_PRELUDE_MS);
  };

  const beginNoteTransition = (star, index) => {
    if (navigating) return;
    navigating = true;

    const id = noteIdFromHref(star.href);
    const core = star.querySelector(".note-star-core");
    if (!id || !(core instanceof HTMLElement)) {
      location.assign(star.href);
      return;
    }

    prefetchDestination(star.href);
    star.classList.add("writing-focus-source");
    core.style.setProperty("view-transition-name", "writing-focus-star");
    document.querySelectorAll("#star-threads .star-thread")[index]?.classList.add("writing-focus-thread");
    setIdentitySource();
    const planet = preparePlanetRetreat();
    saveTransition({ mode: "note", id, planet });
    body.classList.add("is-preparing-writing-note");
    calmWind();

    navigateTimer = window.setTimeout(() => {
      body.classList.add("is-entering-writing-note");
      location.assign(star.href);
    }, NOTE_PRELUDE_MS);
  };

  const installHomeTransitions = () => {
    if (body.dataset.page !== "home") return;

    const archiveLinks = [
      ...document.querySelectorAll(".all-writing-link, .site-header .nav-links a[href$='notes.html']"),
    ];
    archiveLinks.forEach((link) => {
      if (!(link instanceof HTMLAnchorElement)) return;
      link.addEventListener("pointerenter", () => prefetchDestination(link.href), { passive: true });
      link.addEventListener("focus", () => prefetchDestination(link.href), { passive: true });
      link.addEventListener("click", (event) => {
        const modified = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
        if (event.defaultPrevented || event.button !== 0 || modified || reducedMotion.matches) return;
        event.preventDefault();
        beginArchiveTransition(link);
      });
    });

    [...document.querySelectorAll("#note-stars .note-star")].forEach((star, index) => {
      if (!(star instanceof HTMLAnchorElement)) return;
      star.addEventListener("pointerenter", () => prefetchDestination(star.href), { passive: true });
      star.addEventListener("focus", () => prefetchDestination(star.href), { passive: true });
      star.addEventListener("click", (event) => {
        const modified = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
        if (event.defaultPrevented || event.button !== 0 || modified || reducedMotion.matches) return;
        event.preventDefault();
        beginNoteTransition(star, index);
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

  const setIdentityTarget = () => {
    document.querySelector(".site-header .brand-avatar")?.classList.add("writing-site-avatar-target");
    document.querySelector(".site-header .brand > span")?.classList.add("writing-site-name-target");
  };

  const clearArrivalNames = () => {
    document.querySelectorAll(".writing-site-avatar-target, .writing-site-name-target").forEach((element) => {
      element.classList.remove("writing-site-avatar-target", "writing-site-name-target");
    });
    document.querySelectorAll(".writing-archive-target, .writing-note-target").forEach((element) => {
      element.classList.remove("writing-archive-target", "writing-note-target");
      element.style.removeProperty("view-transition-name");
    });
    document.querySelectorAll(".archive-row-v2").forEach((row) => row.style.removeProperty("--writing-arrival-delay"));
    clearPlanetDrift();
  };

  const installArchiveArrival = (payload) => {
    if (body.dataset.page !== "notes" || payload?.mode !== "archive") return false;

    applyPlanetDrift(payload);
    setIdentityTarget();
    const rows = [...document.querySelectorAll(".archive-row-v2")];
    const ids = Array.isArray(payload.ids) ? payload.ids : [];

    ids.forEach((id, index) => {
      if (!id) return;
      const row = rows.find((candidate) => candidate instanceof HTMLAnchorElement && noteIdFromHref(candidate.href) === id);
      const marker = row?.querySelector(".note-kind-marker");
      if (!(row instanceof HTMLElement) || !(marker instanceof HTMLElement)) return;

      marker.classList.add("writing-archive-target");
      marker.style.setProperty("view-transition-name", `writing-star-${index}`);
    });

    rows.forEach((row, index) => row.style.setProperty("--writing-arrival-delay", `${index * 36}ms`));
    body.classList.add("is-arriving-writing-archive");
    setTimeout(() => {
      body.classList.remove("is-arriving-writing-archive");
      clearArrivalNames();
    }, 1500);
    return true;
  };

  const installNoteArrival = (payload) => {
    if (body.dataset.page !== "note" || payload?.mode !== "note") return false;

    const currentId = new URLSearchParams(location.search).get("id") || "";
    if (!currentId || currentId !== payload.id) return false;

    applyPlanetDrift(payload);
    setIdentityTarget();
    const marker = document.querySelector(".article-meta-line .note-kind-marker");
    if (marker instanceof HTMLElement) {
      marker.classList.add("writing-note-target");
      marker.style.setProperty("view-transition-name", "writing-focus-star");
    }

    body.classList.add("is-arriving-writing-note");
    setTimeout(() => {
      body.classList.remove("is-arriving-writing-note");
      clearArrivalNames();
    }, 1900);
    return true;
  };

  const installArrival = () => {
    if (reducedMotion.matches || body.dataset.page === "home") return;
    const payload = readArrival();
    if (!payload) return;
    if (installArchiveArrival(payload)) return;
    installNoteArrival(payload);
  };

  installArrival();
  installHomeTransitions();
})();