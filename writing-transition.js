(() => {
  const body = document.body;
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const storageKey = "tyr1onx:writing-transition";
  const ARCHIVE_PRELUDE_MS = 520;
  const NOTE_PRELUDE_MS = 430;
  const WIND_CALM_MS = 480;
  const MIN_WIND_RATE = 0.2;

  let calmFrame = 0;
  let slowedAnimations = [];
  let navigateTimer = 0;
  let navigating = false;

  const noteIdFromHref = (href) => {
    try {
      return new URL(href, location.href).searchParams.get("id") || "";
    } catch {
      return "";
    }
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
      const spread = 1 + 0.22 * eased;
      const blur = 19 + 7 * eased;

      body.style.setProperty("--writing-flow-spread", spread.toFixed(3));
      body.style.setProperty("--writing-flow-blur", `${blur.toFixed(2)}px`);
      body.style.setProperty("--writing-calm-progress", eased.toFixed(3));

      slowedAnimations.forEach(({ animation, rate }) => {
        try {
          setAnimationRate(animation, Math.max(0.08, rate * factor));
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
      star.style.removeProperty("view-transition-name");
    });
    document.querySelectorAll(".star-thread").forEach((thread) => thread.classList.remove("writing-focus-thread"));
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

    const stars = [...document.querySelectorAll("#note-stars .note-star")];
    const ids = [];
    stars.forEach((star, index) => {
      if (!(star instanceof HTMLAnchorElement)) return;
      const id = noteIdFromHref(star.href);
      if (!id) return;
      ids[index] = id;
      star.style.setProperty("view-transition-name", `writing-star-${index}`);
    });

    setIdentitySource();
    saveTransition({ mode: "archive", ids });
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
    if (!id) {
      location.assign(star.href);
      return;
    }

    star.classList.add("writing-focus-source");
    star.style.setProperty("view-transition-name", "writing-focus-star");
    document.querySelectorAll("#star-threads .star-thread")[index]?.classList.add("writing-focus-thread");
    setIdentitySource();
    saveTransition({ mode: "note", id });
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
      link.addEventListener("click", (event) => {
        const modified = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
        if (event.defaultPrevented || event.button !== 0 || modified || reducedMotion.matches) return;
        event.preventDefault();
        beginArchiveTransition(link);
      });
    });

    [...document.querySelectorAll("#note-stars .note-star")].forEach((star, index) => {
      if (!(star instanceof HTMLAnchorElement)) return;
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
  };

  const installArchiveArrival = (payload) => {
    if (body.dataset.page !== "notes" || payload?.mode !== "archive") return false;

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

    rows.forEach((row, index) => row.style.setProperty("--writing-arrival-delay", `${index * 44}ms`));
    body.classList.add("is-arriving-writing-archive");
    setTimeout(() => {
      body.classList.remove("is-arriving-writing-archive");
      clearArrivalNames();
    }, 1700);
    return true;
  };

  const installNoteArrival = (payload) => {
    if (body.dataset.page !== "note" || payload?.mode !== "note") return false;

    const currentId = new URLSearchParams(location.search).get("id") || "";
    if (!currentId || currentId !== payload.id) return false;

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
    }, 2200);
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