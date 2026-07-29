(() => {
  const body = document.body;
  const root = document.documentElement;
  if (body.dataset.page !== "home") return;

  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const returnKey = "tyr1onx:return-home-transition";
  const WIND_WAKE_MS = 620;
  const WIND_SETTLE_MS = 700;
  const WRITING_CALM_RATE = 0.24;
  const KEKE_PEAK_RATE = 7;
  const ARRIVAL_ANIMATION_NAMES = new Set([
    "return-star-drop-from-anchor",
    "return-thread-release",
    "return-orbit-line-in",
    "return-writing-planet-in",
  ]);

  let windFrame = 0;
  let returnAnimations = [];

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

  const arrivalFallbackMs = () => (
    motionMs("--motion-delay-base", 70)
    + motionMs("--motion-release", 620)
    + 7 * motionMs("--motion-stagger-star", 42)
    + motionMs("--motion-micro", 180)
  );

  const waitForArrivalAnimations = async () => {
    await afterStyleCommit();
    const animations = document.getAnimations().filter((animation) => (
      ARRIVAL_ANIMATION_NAMES.has(animation.animationName)
    ));

    if (!animations.length) {
      await sleep(arrivalFallbackMs());
      return;
    }
    await Promise.allSettled(animations.map((animation) => animation.finished));
  };

  const releaseHomePhysics = () => {
    dispatchEvent(new CustomEvent("tyr1onx:return-home-complete"));
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

  const prepareHomeStarDeploy = () => {
    const stars = [...document.querySelectorAll("#note-stars .note-star")];
    const lines = [...document.querySelectorAll("#star-threads .star-thread")];

    stars.forEach((star, index) => {
      if (!(star instanceof HTMLElement)) return;
      const line = lines[index];
      if (!(line instanceof SVGElement)) return;

      const anchorX = Number.parseFloat(line.getAttribute("x1") || "");
      const anchorY = Number.parseFloat(line.getAttribute("y1") || "");
      const tipX = Number.parseFloat(line.getAttribute("x2") || "");
      const tipY = Number.parseFloat(line.getAttribute("y2") || "");
      const starSize = Number.parseFloat(getComputedStyle(star).getPropertyValue("--note-star-size"));
      const halfStar = Number.isFinite(starSize) ? starSize / 2 : 6;

      if (!Number.isFinite(anchorX)
        || !Number.isFinite(anchorY)
        || !Number.isFinite(tipX)
        || !Number.isFinite(tipY)) return;

      const centerY = tipY + halfStar;
      star.style.setProperty("--return-star-drop-x", `${(anchorX - tipX).toFixed(2)}px`);
      star.style.setProperty("--return-star-drop-y", `${(anchorY - centerY).toFixed(2)}px`);
    });
  };

  const collectHomeAnimations = () => {
    returnAnimations = [];
    document.querySelectorAll(".garden-current, .garden-trace").forEach((element) => {
      element.getAnimations().forEach((animation) => {
        returnAnimations.push({ animation, rate: animation.playbackRate || 1 });
      });
    });
  };

  const restoreWindRates = () => {
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
  };

  const clearWindVisuals = () => {
    body.style.removeProperty("--keke-flow-thickness");
    body.style.removeProperty("--writing-flow-spread");
    body.style.removeProperty("--writing-flow-blur");
  };

  const settleKekeWind = () => new Promise((resolve) => {
    restoreWindRates();
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

      if (progress < 1) {
        windFrame = requestAnimationFrame(step);
      } else {
        body.style.setProperty("--keke-flow-thickness", "1");
        restoreWindRates();
        resolve();
      }
    };

    windFrame = requestAnimationFrame(step);
  });

  const awakenWritingWind = () => new Promise((resolve) => {
    restoreWindRates();
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
      const blur = 22.5 - 15.5 * eased;

      body.style.setProperty("--writing-flow-spread", spread.toFixed(3));
      body.style.setProperty("--writing-flow-blur", `${blur.toFixed(2)}px`);
      returnAnimations.forEach(({ animation, rate }) => {
        try {
          setAnimationRate(animation, rate * factor);
        } catch {
          // One missing animation must not block the return.
        }
      });

      if (progress < 1) {
        windFrame = requestAnimationFrame(step);
      } else {
        body.style.setProperty("--writing-flow-spread", "1");
        body.style.setProperty("--writing-flow-blur", "7px");
        restoreWindRates();
        resolve();
      }
    };

    windFrame = requestAnimationFrame(step);
  });

  const clearArrivalState = () => {
    restoreWindRates();

    // Remove selectors before variables so no fallback can recreate an old state.
    delete root.dataset.returnHomePending;
    body.classList.remove(
      "is-returning-keke-home",
      "is-returning-writing-home",
      "is-returning-writing-archive-home",
      "is-returning-writing-note-home"
    );
    clearWindVisuals();

    document.querySelectorAll(".return-site-avatar-target, .return-site-name-target, .return-keke-planet-target").forEach((element) => {
      element.classList.remove("return-site-avatar-target", "return-site-name-target", "return-keke-planet-target");
      element.style.removeProperty("view-transition-name");
    });
    document.querySelectorAll("#note-stars .note-star").forEach((star) => {
      star.style.removeProperty("--return-star-drop-x");
      star.style.removeProperty("--return-star-drop-y");
    });
    root.style.removeProperty("--return-planet-drift-x");
    root.style.removeProperty("--return-planet-drift-y");
    releaseHomePhysics();
  };

  const installHomeArrival = async () => {
    const payload = readPayload();
    if (!payload || reducedMotion.matches) {
      delete root.dataset.returnHomePending;
      clearWindVisuals();
      releaseHomePhysics();
      return;
    }

    root.dataset.returnHomePending = payload.mode;
    setIdentityTarget();
    prepareHomeStarDeploy();

    let windPromise = Promise.resolve();
    if (payload.mode === "keke-return") {
      body.style.setProperty("--keke-flow-thickness", "0.38");
      setNamedElement(document.querySelector(".orbit-project img"), "return-keke-planet-target", "return-keke-planet");
      body.classList.add("is-returning-keke-home");
      windPromise = settleKekeWind();
    } else if (payload.mode === "writing-archive-return" || payload.mode === "writing-note-return") {
      body.style.setProperty("--writing-flow-spread", "1.16");
      body.style.setProperty("--writing-flow-blur", "22.5px");
      root.style.setProperty("--return-planet-drift-x", payload.planet?.x || "68px");
      root.style.setProperty("--return-planet-drift-y", payload.planet?.y || "-22px");
      body.classList.add(
        "is-returning-writing-home",
        payload.mode === "writing-archive-return" ? "is-returning-writing-archive-home" : "is-returning-writing-note-home"
      );
      windPromise = awakenWritingWind();
    }

    await Promise.all([windPromise, waitForArrivalAnimations()]);
    clearArrivalState();
  };

  void installHomeArrival();
})();
