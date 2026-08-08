(() => {
  const graph = window.TYR1ONX_KNOWLEDGE_GRAPH;
  const stage = document.querySelector("#knowledge-stage");
  const plane = document.querySelector("#knowledge-plane");
  const galaxiesLayer = document.querySelector("#knowledge-galaxies");
  const nodesLayer = document.querySelector("#knowledge-nodes");
  const edgesLayer = document.querySelector("#knowledge-edges");

  if (!graph || !(stage instanceof HTMLElement) || !(plane instanceof HTMLElement)
    || !(galaxiesLayer instanceof HTMLElement) || !(nodesLayer instanceof HTMLElement)
    || !(edgesLayer instanceof SVGElement)) return;

  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const coarsePointer = matchMedia("(hover: none), (pointer: coarse)").matches;
  const nodeMap = new Map(graph.nodes.map((node) => [node.id, node]));
  const adjacency = new Map(graph.nodes.map((node) => [node.id, new Set()]));
  const edgeKey = (left, right) => [left, right].sort().join("|");
  const primaryCrossEdges = new Set((graph.primaryCrossEdges || []).map(([left, right]) => edgeKey(left, right)));

  graph.edges.forEach(([left, right]) => {
    adjacency.get(left)?.add(right);
    adjacency.get(right)?.add(left);
  });

  galaxiesLayer.innerHTML = graph.galaxies.map((galaxy) => `
    <div
      class="knowledge-galaxy"
      data-galaxy="${galaxy.id}"
      style="--gx:${galaxy.x}%;--gy:${galaxy.y}%;--gw:${galaxy.width}%;--gh:${galaxy.height}%;--galaxy-strength:${galaxy.strength};--galaxy-rgb:${galaxy.tone || "145 158 170"}"
    >
      <span class="knowledge-galaxy-label">${galaxy.label}</span>
    </div>`).join("");

  edgesLayer.setAttribute("viewBox", "0 0 1000 700");
  edgesLayer.setAttribute("preserveAspectRatio", "none");
  edgesLayer.innerHTML = graph.edges.map(([leftId, rightId], index) => {
    const left = nodeMap.get(leftId);
    const right = nodeMap.get(rightId);
    if (!left || !right) return "";
    const cross = left.galaxy !== right.galaxy;
    const primary = cross && primaryCrossEdges.has(edgeKey(leftId, rightId));
    const crossClass = cross
      ? ` is-cross-galaxy ${primary ? "is-cross-primary" : "is-cross-secondary"}`
      : "";
    return `<line class="knowledge-edge${crossClass}" data-edge="${index}" data-left="${leftId}" data-right="${rightId}" data-left-galaxy="${left.galaxy}" data-right-galaxy="${right.galaxy}" x1="${left.x * 10}" y1="${left.y * 7}" x2="${right.x * 10}" y2="${right.y * 7}" />`;
  }).join("");

  nodesLayer.innerHTML = graph.nodes.map((node) => {
    const tierBoost = node.tier === "core" ? 3.6 : node.tier === "major" ? 1.8 : 0;
    const size = 4.8 + node.importance * 7.4 + tierBoost;
    return `
      <button
        class="knowledge-node"
        type="button"
        data-node="${node.id}"
        data-galaxy="${node.galaxy}"
        data-tier="${node.tier}"
        aria-label="${node.label}"
        style="--x:${node.x}%;--y:${node.y}%;--node-size:${size.toFixed(1)}px;--mastery:${node.mastery};--practice:${node.practice};--importance:${node.importance}"
      >
        <span class="knowledge-node-core" aria-hidden="true"></span>
        <span class="knowledge-node-label">${node.label}</span>
      </button>`;
  }).join("");

  const galaxyElements = [...galaxiesLayer.querySelectorAll(".knowledge-galaxy")];
  const nodeElements = [...nodesLayer.querySelectorAll(".knowledge-node")];
  const edgeElements = [...edgesLayer.querySelectorAll(".knowledge-edge")];

  function clearState() {
    galaxyElements.forEach((element) => element.classList.remove("is-active", "is-connected", "is-subdued"));
    nodeElements.forEach((element) => {
      element.classList.remove("is-active", "is-related", "is-same-galaxy", "is-soft-dim");
    });
    edgeElements.forEach((edge) => {
      edge.classList.remove("is-related", "is-context", "is-soft-dim");
    });
  }

  function activate(id) {
    clearState();
    const selected = nodeMap.get(id);
    if (!selected) return;

    const related = adjacency.get(id) || new Set();
    const galaxyId = selected.galaxy;
    const relatedGalaxies = new Set();

    related.forEach((relatedId) => {
      const relatedNode = nodeMap.get(relatedId);
      if (relatedNode?.galaxy && relatedNode.galaxy !== galaxyId) relatedGalaxies.add(relatedNode.galaxy);
    });

    galaxyElements.forEach((element) => {
      const elementGalaxy = element.dataset.galaxy;
      if (elementGalaxy === galaxyId) element.classList.add("is-active");
      else if (relatedGalaxies.has(elementGalaxy)) element.classList.add("is-connected");
      else element.classList.add("is-subdued");
    });

    nodeElements.forEach((element) => {
      const nodeId = element.dataset.node;
      if (nodeId === id) {
        element.classList.add("is-active");
      } else if (related.has(nodeId)) {
        element.classList.add("is-related");
      } else if (element.dataset.galaxy === galaxyId) {
        element.classList.add("is-same-galaxy");
      } else {
        element.classList.add("is-soft-dim");
      }
    });

    edgeElements.forEach((edge) => {
      const touches = edge.dataset.left === id || edge.dataset.right === id;
      const withinGalaxy = edge.dataset.leftGalaxy === galaxyId && edge.dataset.rightGalaxy === galaxyId;
      if (touches) edge.classList.add("is-related");
      else if (withinGalaxy) edge.classList.add("is-context");
      else edge.classList.add("is-soft-dim");
    });
  }

  nodeElements.forEach((element) => {
    const id = element.dataset.node;
    element.addEventListener("mouseenter", () => activate(id));
    element.addEventListener("mouseleave", clearState);
    element.addEventListener("focus", () => activate(id));
    element.addEventListener("blur", clearState);
  });

  if (!reduced && !coarsePointer) {
    stage.addEventListener("pointermove", (event) => {
      const rect = stage.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width - 0.5) * -4;
      const y = ((event.clientY - rect.top) / rect.height - 0.5) * -3;
      plane.style.setProperty("--graph-x", `${x.toFixed(2)}px`);
      plane.style.setProperty("--graph-y", `${y.toFixed(2)}px`);
    }, { passive: true });

    stage.addEventListener("pointerleave", () => {
      clearState();
      plane.style.setProperty("--graph-x", "0px");
      plane.style.setProperty("--graph-y", "0px");
    });
  }
})();
