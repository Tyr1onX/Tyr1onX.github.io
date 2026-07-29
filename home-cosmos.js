(() => {
  const root = document.documentElement;
  const field = document.querySelector("#cosmos-field");
  const starsLayer = document.querySelector("#note-stars");
  const threads = document.querySelector("#star-threads");
  const decoration = document.querySelector("#decorative-stars");
  const currentYear = document.querySelector("#current-year");
  const timeEl = document.querySelector("#current-time");

  if (!(field instanceof HTMLElement)
    || !(starsLayer instanceof HTMLElement)
    || !(threads instanceof SVGSVGElement)) return;

  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const coarsePointer = matchMedia("(hover: none), (pointer: coarse)").matches;
  const steadyPhysicsInterval = 1000 / (coarsePointer ? 30 : 45);
  const INTRO_NATIVE_REFRESH_MS = 5200;

  let pageVisible = !document.hidden;
  let sceneVisible = true;
  let returnHold = Boolean(root.dataset.returnHomePending);
  let transitionHold = false;
  let initialized = false;
  let initTimer = 0;
  let startupWatchdog = 0;
  let resizeTimer = 0;
  let clockTimer = 0;
  let pendingReturnRelease = false;

  if (currentYear) currentYear.textContent = String(new Date().getFullYear());

  const updateClock = () => {
    if (!(timeEl instanceof HTMLTimeElement)) return;
    const now = new Date();
    timeEl.dateTime = now.toISOString();
    timeEl.textContent = now.toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  const scheduleClock = () => {
    clearTimeout(clockTimer);
    updateClock();
    const delay = 60000 - (Date.now() % 60000) + 40;
    clockTimer = setTimeout(scheduleClock, delay);
  };
  scheduleClock();

  const timestamp = (note) => {
    const direct = Date.parse(note?.datetime || "");
    if (Number.isFinite(direct)) return direct;
    const date = String(note?.date || "").replaceAll(".", "-");
    const fallback = Date.parse(`${date}T${note?.time || "00:00"}:00+08:00`);
    return Number.isFinite(fallback) ? fallback : 0;
  };

  const preparedNotes = Array.isArray(window.TYR1ONX_SORTED_NOTES)
    ? window.TYR1ONX_SORTED_NOTES
    : [...(Array.isArray(window.TYR1ONX_NOTES) ? window.TYR1ONX_NOTES : [])]
      .sort((left, right) => timestamp(right) - timestamp(left));
  const notes = preparedNotes.slice(0, 8);
  const noteUrl = (note) => `./note.html?id=${encodeURIComponent(note.id)}`;
  const BASE_AGE = 20;
  const BASE_YEAR = 2026;
  const DECORATIVE_COUNT = BASE_AGE + Math.max(0, new Date().getFullYear() - BASE_YEAR);

  const windLayer = document.createElement("div");
  windLayer.className = "wind-streams";
  windLayer.setAttribute("aria-hidden", "true");
  windLayer.innerHTML = '<span class="wind-stream"></span><span class="wind-stream"></span><span class="wind-stream"></span>';
  field.prepend(windLayer);

  const layouts = [
    [0.10, 0.24, -0.19], [0.22, 0.39, 0.12], [0.35, 0.22, -0.13], [0.50, 0.31, 0.16],
    [0.66, 0.20, -0.12], [0.82, 0.35, 0.11], [0.18, 0.57, 0.08], [0.76, 0.56, -0.08],
  ];

  function randomGenerator(seed) {
    let value = seed % 2147483647;
    if (value <= 0) value += 2147483646;
    return () => ((value = (value * 16807) % 2147483647) - 1) / 2147483646;
  }

  if (decoration instanceof HTMLElement) {
    const rand = randomGenerator(2025);
    decoration.innerHTML = Array.from({ length: DECORATIVE_COUNT }, (_, index) => {
      const x = (rand() * 100).toFixed(2);
      const y = (rand() * 100).toFixed(2);
      const size = (2.2 + rand() * 3.2).toFixed(2);
      const opacity = (0.40 + rand() * 0.34).toFixed(2);
      const duration = (2.8 + rand() * 5.4).toFixed(2);
      const delay = (-rand() * 7).toFixed(2);
      return `<span class="decorative-star" data-star="${index}" style="left:${x}%;top:${y}%;--star-size:${size}px;--star-opacity:${opacity};--twinkle-duration:${duration}s;--twinkle-delay:${delay}s"></span>`;
    }).join("");
  }

  starsLayer.innerHTML = notes.map((note, index) => {
    const size = 11.5 + (notes.length - index) * 0.9;
    const date = `${note.date}${note.time ? ` · ${note.time}` : ""}`;
    return `
      <a class="note-star" href="${noteUrl(note)}" aria-label="${note.title}，${date}" aria-expanded="false" style="--note-star-size:${size.toFixed(1)}px;--twinkle-duration:${(3.1 + (index % 4) * 0.8).toFixed(1)}s;--twinkle-delay:${(-index * 0.38).toFixed(2)}s">
        <span class="note-star-label"><time datetime="${note.datetime || ""}">${date}</time><span>${note.title}</span></span>
        <span class="note-star-core" aria-hidden="true"></span>
      </a>`;
  }).join("");

  threads.innerHTML = notes.map((_, index) => `<line class="star-thread" data-thread="${index}" />`).join("");

  const elements = [...starsLayer.querySelectorAll(".note-star")];
  const lines = [...threads.querySelectorAll(".star-thread")];
  const decorativeStars = [...document.querySelectorAll(".decorative-star")];
  const starTipOffsets = elements.map((element) => {
    const size = Number.parseFloat(getComputedStyle(element).getPropertyValue("--note-star-size"));
    return Number.isFinite(size) ? size / 2 : 6;
  });

  let bodies = [];
  let frame = 0;
  let last = 0;
  let lastPhysicsPaint = 0;
  let started = performance.now();
  let pausedAt = 0;
  let gustTimer = 0;
  let decorationResetTimer = 0;
  let windScheduleTimer = 0;
  let lastWindSign = 0;
  let activeTouchStar = null;
  let routeFrame = 0;
  let routeSnapshot = null;
  let routePromise = null;
  let releaseActive = false;

  const clamp01 = (value) => Math.min(1, Math.max(0, value));
  const smoothstep = (value) => value * value * (3 - 2 * value);

  function stageHasSize() {
    return field.clientWidth >= 120 && field.clientHeight >= 240;
  }

  function canRunPhysics() {
    return !reduced
      && initialized
      && pageVisible
      && sceneVisible
      && !returnHold
      && !transitionHold;
  }

  function draw(index, body) {
    const element = elements[index];
    const line = lines[index];
    if (!(element instanceof HTMLElement) || !(line instanceof SVGElement)) return;

    element.style.transform = `translate3d(${(body.x - 22).toFixed(2)}px, ${(body.y - 22).toFixed(2)}px, 0)`;
    line.setAttribute("x1", body.ax.toFixed(2));
    line.setAttribute("y1", body.ay.toFixed(2));
    line.setAttribute("x2", body.x.toFixed(2));
    line.setAttribute("y2", (body.y - starTipOffsets[index]).toFixed(2));
  }

  function rebuild({ preservePosition = false, settle = false } = {}) {
    const width = field.clientWidth;
    const height = field.clientHeight;
    if (width < 120 || height < 240) return false;

    const previousBodies = bodies;
    threads.setAttribute("viewBox", `0 0 ${width} ${height}`);

    bodies = notes.map((_, index) => {
      const [anchorRatio, ropeRatio, angle] = layouts[index];
      const ax = width * anchorRatio;
      const ay = -10;
      const length = Math.max(140, height * ropeRatio);
      const restX = ax + Math.sin(angle) * length;
      const restY = ay + Math.cos(angle) * length;
      const previous = previousBodies[index];

      if (preservePosition && previous) {
        const oldWidth = Math.max(1, previous.viewportWidth || width);
        const xRatio = previous.x / oldWidth;
        return {
          ax, ay, length, restX, restY,
          x: Math.max(0, Math.min(width, xRatio * width)),
          y: Math.min(restY + 20, previous.y),
          vx: previous.vx,
          vy: previous.vy,
          born: true,
          delay: 0,
          viewportWidth: width,
        };
      }

      return {
        ax, ay, length, restX, restY,
        x: reduced || settle ? restX : ax + (index % 2 ? 28 : -28),
        y: reduced || settle ? restY : -80 - index * 34,
        vx: reduced || settle ? 0 : (index % 2 ? 18 : -18),
        vy: 0,
        born: reduced || settle,
        delay: settle ? 0 : index * 130,
        viewportWidth: width,
      };
    });

    bodies.forEach((body, index) => {
      elements[index]?.classList.toggle("is-born", reduced || settle || preservePosition);
      draw(index, body);
    });
    return true;
  }

  function closeTouchStar() {
    if (!(activeTouchStar instanceof HTMLElement)) return;
    const index = elements.indexOf(activeTouchStar);
    activeTouchStar.classList.remove("is-touch-active");
    activeTouchStar.setAttribute("aria-expanded", "false");
    lines[index]?.classList.remove("is-active");
    activeTouchStar = null;
  }

  function openTouchStar(element, index) {
    closeTouchStar();
    activeTouchStar = element;
    element.classList.add("is-touch-active");
    element.setAttribute("aria-expanded", "true");
    lines[index]?.classList.add("is-active");
  }

  function ensurePhysicsFrame() {
    if (!canRunPhysics() || frame || !bodies.length) return;
    last = performance.now();
    lastPhysicsPaint = last;
    frame = requestAnimationFrame(animate);
  }

  function triggerWind(force) {
    if (!canRunPhysics()) return;

    document.body.classList.add("windy");
    let sign = Math.random() < 0.5 ? -1 : 1;
    if (sign === lastWindSign && Math.random() < 0.55) sign *= -1;
    lastWindSign = sign;

    field.dataset.windDirection = sign > 0 ? "right" : "left";
    field.style.setProperty("--wind-duration", `${(1.9 + Math.random() * 0.7).toFixed(2)}s`);

    bodies.forEach((body, index) => {
      const depth = 1 - index / Math.max(1, bodies.length - 1);
      body.vx += sign * force * (0.5 + depth * 0.8) * (0.7 + Math.random() * 0.6);
      body.vy -= force * 0.08 * Math.random();
    });

    decorativeStars.forEach((star, index) => {
      const drift = sign * (6 + Math.random() * 9);
      star.style.transform = `translateX(${drift}px) scale(${0.96 + (index % 3) * 0.04})`;
      star.style.transition = `transform ${1.6 + Math.random() * 1.6}s cubic-bezier(.22,1,.36,1)`;
    });

    clearTimeout(decorationResetTimer);
    decorationResetTimer = setTimeout(() => {
      decorativeStars.forEach((star) => { star.style.transform = ""; });
    }, 1800);

    clearTimeout(gustTimer);
    gustTimer = setTimeout(() => {
      document.body.classList.remove("windy");
      delete field.dataset.windDirection;
    }, 2400);

    ensurePhysicsFrame();
  }

  function scheduleWind() {
    clearTimeout(windScheduleTimer);
    if (!canRunPhysics()) return;

    windScheduleTimer = setTimeout(() => {
      triggerWind(30 + Math.random() * 16);
      scheduleWind();
    }, 18000 + Math.random() * 24000);
  }

  function animate(now) {
    if (!canRunPhysics()) {
      frame = 0;
      return;
    }

    const elapsed = now - started;
    const introActive = elapsed < INTRO_NATIVE_REFRESH_MS;

    if (!introActive && now - lastPhysicsPaint < steadyPhysicsInterval) {
      frame = requestAnimationFrame(animate);
      return;
    }

    const dt = Math.min(0.04, Math.max(0.001, (now - last) / 1000));
    last = now;
    lastPhysicsPaint = now;
    let moving = false;

    bodies.forEach((body, index) => {
      if (elapsed < body.delay) {
        moving = true;
        return;
      }

      if (!body.born) {
        body.born = true;
        elements[index]?.classList.add("is-born");
      }

      body.vy += 1040 * dt;
      const drag = Math.exp(-0.34 * dt);
      body.vx *= drag;
      body.vy *= drag;
      body.x += body.vx * dt;
      body.y += body.vy * dt;

      const dx = body.x - body.ax;
      const dy = body.y - body.ay;
      const distance = Math.hypot(dx, dy) || 1;

      if (distance > body.length) {
        const nx = dx / distance;
        const ny = dy / distance;
        body.x = body.ax + nx * body.length;
        body.y = body.ay + ny * body.length;
        const outward = body.vx * nx + body.vy * ny;
        if (outward > 0) {
          body.vx -= outward * nx;
          body.vy -= outward * ny;
        }
      }

      const settle = Math.min(1, Math.max(0, (elapsed - body.delay - 1400) / 3800));
      body.vx += (body.restX - body.x) * 0.18 * settle * dt;
      body.vy += (body.restY - body.y) * 0.18 * settle * dt;
      draw(index, body);

      if (elapsed < body.delay + 7600 || Math.abs(body.vx) + Math.abs(body.vy) > 0.45) moving = true;
    });

    if (!moving) releaseActive = false;
    frame = moving ? requestAnimationFrame(animate) : 0;
  }

  function hasVisibleWritingStar() {
    if (!elements.length) return true;
    const fieldRect = field.getBoundingClientRect();
    return elements.some((element) => {
      const rect = element.getBoundingClientRect();
      return rect.right > fieldRect.left
        && rect.left < fieldRect.right
        && rect.bottom > fieldRect.top
        && rect.top < fieldRect.bottom;
    });
  }

  function revealStarsFallback() {
    if (!initialized || !pageVisible || hasVisibleWritingStar()) return;
    cancelAnimationFrame(frame);
    frame = 0;
    started = performance.now() - 8000;
    if (!rebuild({ settle: true })) return;
    elements.forEach((element) => element.classList.add("is-born"));
  }

  function armStartupWatchdog() {
    clearTimeout(startupWatchdog);
    startupWatchdog = setTimeout(() => {
      if (!hasVisibleWritingStar()) revealStarsFallback();
    }, 2600);
  }

  function pauseMotion() {
    if (!pausedAt) pausedAt = performance.now();
    cancelAnimationFrame(frame);
    frame = 0;
    clearTimeout(windScheduleTimer);
    clearTimeout(gustTimer);
    clearTimeout(decorationResetTimer);
    document.body.classList.remove("windy");
    delete field.dataset.windDirection;
  }

  function resumeMotion() {
    if (!canRunPhysics()) return;
    const now = performance.now();
    if (pausedAt) started += now - pausedAt;
    pausedAt = 0;
    last = now;
    ensurePhysicsFrame();
    scheduleWind();
    armStartupWatchdog();
  }

  function normalizeIndices(indices) {
    if (!Array.isArray(indices)) return bodies.map((_, index) => index);
    return [...new Set(indices)]
      .filter((index) => Number.isInteger(index) && index >= 0 && index < bodies.length);
  }

  function resetRouteRetraction() {
    cancelAnimationFrame(routeFrame);
    routeFrame = 0;

    routeSnapshot?.forEach((item) => {
      const body = bodies[item.index];
      if (!body) return;
      Object.assign(body, item.body);
      item.star.style.opacity = item.starOpacity;
      item.line.style.opacity = item.lineOpacity;
      draw(item.index, body);
    });

    routeSnapshot = null;
    routePromise = null;
    transitionHold = false;
    if (!returnHold) resumeMotion();
  }

  function retractStars({ indices, duration = 440, baseDelay = 0, stagger = 0 } = {}) {
    if (reduced || !initialized) return Promise.resolve();
    if (routePromise) return routePromise;

    const selected = normalizeIndices(indices);
    if (!selected.length) return Promise.resolve();

    closeTouchStar();
    transitionHold = true;
    pauseMotion();

    routeSnapshot = selected.map((index, order) => {
      const body = bodies[index];
      const star = elements[index];
      const line = lines[index];
      if (!body || !(star instanceof HTMLElement) || !(line instanceof SVGLineElement)) return null;
      return {
        index,
        star,
        line,
        startX: body.x,
        startY: body.y,
        targetX: body.ax,
        targetY: body.ay + starTipOffsets[index],
        delay: baseDelay + order * stagger,
        body: { ...body },
        starOpacity: star.style.opacity,
        lineOpacity: line.style.opacity,
      };
    }).filter(Boolean);

    if (!routeSnapshot.length) {
      transitionHold = false;
      return Promise.resolve();
    }

    const startedAt = performance.now();
    routePromise = new Promise((resolve) => {
      const step = (now) => {
        let complete = true;

        routeSnapshot.forEach((item) => {
          const local = clamp01((now - startedAt - item.delay) / duration);
          if (local < 1) complete = false;
          const progress = smoothstep(local);
          const body = bodies[item.index];
          body.x = item.startX + (item.targetX - item.startX) * progress;
          body.y = item.startY + (item.targetY - item.startY) * progress;
          body.vx = 0;
          body.vy = 0;
          draw(item.index, body);

          const fade = local < 0.86 ? 1 : 1 - (local - 0.86) / 0.14;
          const opacity = clamp01(fade).toFixed(3);
          item.star.style.opacity = opacity;
          item.line.style.opacity = opacity;
        });

        if (complete) {
          routeFrame = 0;
          resolve();
        } else {
          routeFrame = requestAnimationFrame(step);
        }
      };
      routeFrame = requestAnimationFrame(step);
    });

    return routePromise;
  }

  function releaseFromTop({ animate = true } = {}) {
    if (!initialized) {
      pendingReturnRelease = true;
      initializeScene();
      return;
    }

    cancelAnimationFrame(routeFrame);
    routeFrame = 0;
    routeSnapshot = null;
    routePromise = null;
    transitionHold = false;
    returnHold = false;
    releaseActive = Boolean(animate && !reduced);

    if (!animate || reduced) {
      started = performance.now() - 8000;
      rebuild({ settle: true });
      releaseActive = false;
      resumeMotion();
      return;
    }

    const now = performance.now();
    started = now;
    pausedAt = 0;
    last = now;
    lastPhysicsPaint = now;

    bodies.forEach((body, index) => {
      body.x = body.ax + (index % 2 ? 28 : -28);
      body.y = -80 - index * 34;
      body.vx = index % 2 ? 18 : -18;
      body.vy = 0;
      body.born = false;
      body.delay = index * 130;
      elements[index]?.classList.remove("is-born");
      elements[index]?.style.removeProperty("opacity");
      elements[index]?.style.removeProperty("translate");
      lines[index]?.style.removeProperty("opacity");
      draw(index, body);
    });

    resumeMotion();
  }

  window.TYR1ONX_COSMOS_MOTION = Object.freeze({
    retract: retractStars,
    resetRetraction: resetRouteRetraction,
    releaseFromTop,
    isReleaseActive: () => releaseActive,
  });

  function initializeScene(attempt = 0) {
    clearTimeout(initTimer);
    if (initialized) return;

    if (!stageHasSize()) {
      if (attempt < 40) initTimer = setTimeout(() => initializeScene(attempt + 1), 50);
      return;
    }

    started = performance.now();
    if (!rebuild({ settle: returnHold })) return;
    initialized = true;

    if (pendingReturnRelease) {
      pendingReturnRelease = false;
      releaseFromTop();
      return;
    }

    if (document.hidden) {
      pageVisible = false;
      pausedAt = performance.now();
      document.body.classList.add("is-page-hidden");
    } else {
      pageVisible = true;
      document.body.classList.remove("is-page-hidden");
      if (!returnHold) resumeMotion();
    }
  }

  function scheduleRebuild() {
    if (!initialized) {
      initializeScene();
      return;
    }

    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (!stageHasSize() || transitionHold) return;
      cancelAnimationFrame(frame);
      frame = 0;
      last = performance.now();
      closeTouchStar();
      rebuild({ preservePosition: !returnHold, settle: returnHold });
      resumeMotion();
      armStartupWatchdog();
    }, 120);
  }

  elements.forEach((element, index) => {
    const line = lines[index];
    const on = () => line?.classList.add("is-active");
    const off = () => {
      if (element !== activeTouchStar) line?.classList.remove("is-active");
    };

    element.addEventListener("mouseenter", on);
    element.addEventListener("mouseleave", off);
    element.addEventListener("focus", on);
    element.addEventListener("blur", off);

    if (coarsePointer) {
      element.addEventListener("click", (event) => {
        if (activeTouchStar === element) {
          closeTouchStar();
          return;
        }
        event.preventDefault();
        openTouchStar(element, index);
      });
    }
  });

  if (coarsePointer) {
    document.addEventListener("pointerdown", (event) => {
      if (!(activeTouchStar instanceof HTMLElement)) return;
      if (event.target instanceof Node && activeTouchStar.contains(event.target)) return;
      closeTouchStar();
    }, { passive: true });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeTouchStar();
    });
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      pageVisible = false;
      document.body.classList.add("is-page-hidden");
      pauseMotion();
    } else {
      pageVisible = true;
      document.body.classList.remove("is-page-hidden");
      updateClock();
      resumeMotion();
    }
  });

  addEventListener("pageshow", (event) => {
    if (routeSnapshot) resetRouteRetraction();
    if (!initialized) {
      initializeScene();
      return;
    }
    if (event.persisted) resumeMotion();
  });

  addEventListener("pagehide", pauseMotion);
  addEventListener("resize", scheduleRebuild, { passive: true });
  addEventListener("tyr1onx:return-home-complete", () => {
    returnHold = false;
    if (releaseActive) return;
    started = performance.now() - 8000;
    bodies.forEach((body) => {
      body.vx = 0;
      body.vy = 0;
      body.born = true;
    });
    resumeMotion();
  });

  if ("IntersectionObserver" in window) {
    const sceneObserver = new IntersectionObserver((entries) => {
      const visible = entries.some((entry) => entry.isIntersecting);
      if (visible === sceneVisible) return;
      sceneVisible = visible;
      if (visible) resumeMotion();
      else pauseMotion();
    }, { rootMargin: "140px" });
    sceneObserver.observe(field);
  }

  if ("ResizeObserver" in window) {
    const resizeObserver = new ResizeObserver(scheduleRebuild);
    resizeObserver.observe(field);
  }

  if (returnHold) initializeScene();
  else requestAnimationFrame(() => requestAnimationFrame(() => initializeScene()));
})();
