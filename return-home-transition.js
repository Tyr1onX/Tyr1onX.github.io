(() => {
  const body = document.body;
  const root = document.documentElement;
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const returnKey = "tyr1onx:return-home-transition";
  const planetMemoryKey = "tyr1onx:writing-planet-memory";
  const WIND_WAKE_MS = 620;
  const WIND_SETTLE_MS = 700;
  const WRITING_CALM_RATE = 0.24;
  const KEKE_PEAK_RATE = 7;

  function capturePlanetMemory() {
    if (body.dataset.page !== "notes" && body.dataset.page !== "note") return;
    const x = root.style.getPropertyValue("--writing-planet-drift-x").trim();
    const y = root.style.getPropertyValue("--writing-planet-drift-y").trim();
    if (!x && !y) return;

    try {
      sessionStorage.setItem(planetMemoryKey, JSON.stringify({
        x: x || "68px",
        y: y || "-22px",
      }));
    } catch {
      // The return uses the default direction when storage is unavailable.
    }
  }

  capturePlanetMemory();
  if (body.dataset.page !== "home") return;

  let windFrame = 0;
  let returnAnimations = [];
  let arrivalTimer = 0;

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

  const readPayload = () => {
    try {
      const raw = sessionStorage.getItem(returnKey);
      sessionStorage.removeItem(returnKey);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  const setNamedElement = (element, className, transitionName) => {
    if (!(element instanceof HTMLElement)) return;
    element.classList.add(className);
    element.style.setProperty("view-transition-name", transitionName);
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
        // Ignore animations replaced during page-cache restoration.
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

  const findHomeStar = (id) => [...document.querySelectorAll("#note-stars .note-star")].find(
    (star) => star instanceof HTMLAnchorElement && noteIdFromHref(star.href) === id
  );

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
    clearTimeout(arrivalTimer);
    arrivalTimer = 0;
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

    arrivalTimer = setTimeout(clearArrivalState, 1550);
  };

  installHomeArrival();
})();