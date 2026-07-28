(() => {
  const field = document.querySelector("#cosmos-field");
  if (!(field instanceof HTMLElement)) return;

  const timestamp = (note) => {
    const direct = Date.parse(note?.datetime || "");
    if (Number.isFinite(direct)) return direct;

    const date = String(note?.date || "").replaceAll(".", "-");
    const fallback = Date.parse(`${date}T${note?.time || "00:00"}:00+08:00`);
    return Number.isFinite(fallback) ? fallback : 0;
  };

  const notes = [...(Array.isArray(window.TYR1ONX_NOTES) ? window.TYR1ONX_NOTES : [])]
    .sort((left, right) => timestamp(right) - timestamp(left))
    .slice(0, 8);

  const noteKind = (note) => (note?.kind === "work" ? "work" : "essay");
  const noteKindLabel = (note) => (noteKind(note) === "work" ? "工作与技术" : "随笔");

  const windLayer = field.querySelector(".wind-streams");
  if (windLayer instanceof HTMLElement && !windLayer.querySelector(".garden-current")) {
    windLayer.insertAdjacentHTML(
      "beforeend",
      [
        '<span class="garden-current garden-current-a"></span>',
        '<span class="garden-current garden-current-b"></span>',
        '<span class="garden-current garden-current-c"></span>',
      ].join("")
    );
  }

  if (!field.querySelector(".garden-traces")) {
    const traceLayer = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    traceLayer.classList.add("garden-traces");
    traceLayer.setAttribute("viewBox", "0 0 1200 800");
    traceLayer.setAttribute("preserveAspectRatio", "none");
    traceLayer.setAttribute("aria-hidden", "true");
    traceLayer.innerHTML = `
      <path class="garden-trace" d="M-70 170 C150 46 322 220 510 126 S890 42 1270 188" />
      <path class="garden-trace" d="M-55 628 C168 492 318 718 540 606 S918 494 1265 654" />
      <path class="garden-trace" d="M88 -55 C176 142 18 286 128 466 S300 686 216 862" />
      <path class="garden-trace" d="M1112 -60 C1012 148 1186 292 1070 482 S918 704 1006 858" />
      <path class="garden-trace" d="M246 30 C374 116 326 236 438 318 S598 444 532 602" />
      <path class="garden-trace" d="M950 52 C824 126 876 244 754 332 S612 472 676 632" />
    `;
    field.prepend(traceLayer);
  }

  const starElements = [...field.querySelectorAll(".note-star")];
  const threadElements = [...field.querySelectorAll(".star-thread")];

  starElements.forEach((element, index) => {
    const note = notes[index];
    if (!note) return;

    const kind = noteKind(note);
    const kindClass = `note-kind-${kind}`;
    element.classList.add(kindClass);
    element.dataset.noteKind = kind;
    element.style.setProperty("--note-strength", Math.max(0.76, 1 - index * 0.035).toFixed(2));

    const date = String(note.date || "");
    const time = element.querySelector(".note-star-label time");
    if (time instanceof HTMLTimeElement) time.textContent = date;

    element.setAttribute("aria-label", `${note.title}，${date}，${noteKindLabel(note)}`);
    threadElements[index]?.classList.add(kindClass);
  });
})();
