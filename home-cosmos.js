(() => {
  const field = document.querySelector("#cosmos-field");
  const starsLayer = document.querySelector("#note-stars");
  const threads = document.querySelector("#star-threads");
  const decoration = document.querySelector("#decorative-stars");
  const timeEl = document.querySelector("#current-time");

  if (!(field instanceof HTMLElement)
    || !(starsLayer instanceof HTMLElement)
    || !(threads instanceof SVGSVGElement)) return;

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

  const layouts = [
    [10, 24], [22, 39], [35, 22], [50, 31],
    [66, 20], [82, 35], [18, 57], [76, 56],
  ];

  const noteKind = (note) => (note?.kind === "work" ? "work" : "essay");
  const noteKindLabel = (note) => (noteKind(note) === "work" ? "工作与技术" : "随笔");
  const noteUrl = (note) => `./note.html?id=${encodeURIComponent(note.id)}`;

  starsLayer.innerHTML = notes.map((note, index) => {
    const [x, y] = layouts[index];
    const date = `${note.date}${note.time ? ` · ${note.time}` : ""}`;
    const size = 11.5 + (notes.length - index) * 0.9;
    const strength = Math.max(0.76, 1 - index * 0.035).toFixed(2);
    const kind = noteKind(note);
    return `
      <a class="note-star note-kind-${kind}" href="${noteUrl(note)}"
        aria-label="${note.title}，${date}，${noteKindLabel(note)}"
        aria-expanded="false"
        style="left:${x}%;top:${y}%;--note-star-size:${size.toFixed(1)}px;--note-strength:${strength};--twinkle-duration:${(6.4 + (index % 4) * 0.9).toFixed(1)}s;--twinkle-delay:${(-index * 0.5).toFixed(1)}s">
        <span class="note-star-label"><time datetime="${note.datetime || ""}">${date}</time><span>${note.title}</span></span>
        <span class="note-star-core" aria-hidden="true"></span>
      </a>`;
  }).join("");

  threads.innerHTML = notes.map((note, index) => (
    `<line class="star-thread note-kind-${noteKind(note)}" data-thread="${index}" />`
  )).join("");

  const noteStars = [...starsLayer.querySelectorAll(".note-star")];
  const lines = [...threads.querySelectorAll(".star-thread")];

  const drawThreads = () => {
    const width = field.clientWidth;
    const height = field.clientHeight;
    if (width < 1 || height < 1) return;
    threads.setAttribute("viewBox", `0 0 ${width} ${height}`);

    noteStars.forEach((star, index) => {
      const line = lines[index];
      if (!(star instanceof HTMLElement) || !(line instanceof SVGLineElement)) return;
      const [xPercent, yPercent] = layouts[index];
      const x = width * xPercent / 100;
      const y = height * yPercent / 100;
      const size = Number.parseFloat(getComputedStyle(star).getPropertyValue("--note-star-size")) || 12;
      line.setAttribute("x1", x.toFixed(1));
      line.setAttribute("y1", "0");
      line.setAttribute("x2", x.toFixed(1));
      line.setAttribute("y2", Math.max(0, y - size / 2).toFixed(1));
    });
  };

  let resizeFrame = 0;
  const scheduleDraw = () => {
    if (resizeFrame) return;
    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = 0;
      drawThreads();
    });
  };

  if (decoration instanceof HTMLElement) {
    const positions = [
      [5, 13, 2.4, .48], [13, 72, 3.1, .55], [19, 15, 2.2, .42], [27, 66, 2.8, .58],
      [33, 9, 3.4, .5], [41, 76, 2.3, .46], [48, 14, 2.6, .56], [57, 69, 3.2, .44],
      [63, 11, 2.1, .52], [71, 76, 2.9, .49], [79, 15, 3.3, .54], [88, 68, 2.4, .47],
      [93, 28, 2.8, .5], [7, 46, 2.2, .43],
    ];
    decoration.innerHTML = positions.map(([x, y, size, opacity]) => (
      `<span class="decorative-star" style="left:${x}%;top:${y}%;--star-size:${size}px;--star-opacity:${opacity}"></span>`
    )).join("");
  }

  let activeTouchStar = null;
  const closeTouchStar = () => {
    if (!(activeTouchStar instanceof HTMLElement)) return;
    const index = noteStars.indexOf(activeTouchStar);
    activeTouchStar.classList.remove("is-touch-active");
    activeTouchStar.setAttribute("aria-expanded", "false");
    lines[index]?.classList.remove("is-active");
    activeTouchStar = null;
  };

  noteStars.forEach((star, index) => {
    star.addEventListener("pointerenter", () => lines[index]?.classList.add("is-active"), { passive: true });
    star.addEventListener("pointerleave", () => lines[index]?.classList.remove("is-active"), { passive: true });
    star.addEventListener("focus", () => lines[index]?.classList.add("is-active"), { passive: true });
    star.addEventListener("blur", () => lines[index]?.classList.remove("is-active"), { passive: true });
    star.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse") return;
      if (activeTouchStar === star) {
        closeTouchStar();
        return;
      }
      closeTouchStar();
      activeTouchStar = star;
      star.classList.add("is-touch-active");
      star.setAttribute("aria-expanded", "true");
      lines[index]?.classList.add("is-active");
    }, { passive: true });
  });

  document.addEventListener("pointerdown", (event) => {
    if (!(event.target instanceof Element) || !event.target.closest(".note-star")) closeTouchStar();
  }, { passive: true });

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

  let clockTimer = 0;
  const scheduleClock = () => {
    clearTimeout(clockTimer);
    updateClock();
    clockTimer = setTimeout(scheduleClock, 60000 - (Date.now() % 60000) + 40);
  };

  addEventListener("resize", scheduleDraw, { passive: true });
  if ("ResizeObserver" in window) new ResizeObserver(scheduleDraw).observe(field);

  drawThreads();
  scheduleClock();
})();
