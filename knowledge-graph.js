(() => {
  const graph = window.TYR1ONX_KNOWLEDGE_GRAPH;
  const stage = document.querySelector("#knowledge-stage");
  const plane = document.querySelector("#knowledge-plane");
  const nodesLayer = document.querySelector("#knowledge-nodes");
  const edgesLayer = document.querySelector("#knowledge-edges");

  if (!graph || !(stage instanceof HTMLElement) || !(plane instanceof HTMLElement)
    || !(nodesLayer instanceof HTMLElement) || !(edgesLayer instanceof SVGElement)) return;

  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const coarsePointer = matchMedia("(hover: none), (pointer: coarse)").matches;
  const nodeMap = new Map(graph.nodes.map((node) => [node.id, node]));
  const adjacency = new Map(graph.nodes.map((node) => [node.id, new Set()]));

  graph.edges.forEach(([left, right]) => {
    adjacency.get(left)?.add(right);
    adjacency.get(right)?.add(left);
  });

  edgesLayer.setAttribute("viewBox", "0 0 1000 700");
  edgesLayer.setAttribute("preserveAspectRatio", "none");
  edgesLayer.innerHTML = graph.edges.map(([leftId, rightId], index) => {
    const left = nodeMap.get(leftId);
    const right = nodeMap.get(rightId);
    if (!left || !right) return "";
    return `<line class="knowledge-edge" data-edge="${index}" data-left="${leftId}" data-right="${rightId}" x1="${left.x * 10}" y1="${left.y * 7}" x2="${right.x * 10}" y2="${right.y * 7}" />`;
  }).join("");

  nodesLayer.innerHTML = graph.nodes.map((node) => {
    const size = 5.8 + node.importance * 8.4;
    const title = `${node.label}`;
    return `
      <button
        class="knowledge-node"
        type="button"
        data-node="${node.id}"
        aria-label="${title}"
        aria-pressed="false"
        style="--x:${node.x}%;--y:${node.y}%;--node-size:${size.toFixed(1)}px;--mastery:${node.mastery};--practice:${node.practice};--importance:${node.importance}"
      >
        <span class="knowledge-node-core" aria-hidden="true"></span>
        <span class="knowledge-node-label">${node.label}</span>
      </button>`;
  }).join("");

  const nodeElements = [...nodesLayer.querySelectorAll(".knowledge-node")];
  const edgeElements = [...edgesLayer.querySelectorAll(".knowledge-edge")];
  let pinned = null;

  function clearState() {
    nodeElements.forEach((element) => {
      element.classList.remove("is-active", "is-related", "is-dimmed");
      element.setAttribute("aria-pressed", "false");
    });
    edgeElements.forEach((edge) => edge.classList.remove("is-related", "is-dimmed"));
  }

  function activate(id, { pin = false } = {}) {
    clearState();
    const related = adjacency.get(id) || new Set();

    nodeElements.forEach((element) => {
      const nodeId = element.dataset.node;
      if (nodeId === id) {
        element.classList.add("is-active");
        element.setAttribute("aria-pressed", pin ? "true" : "false");
      } else if (related.has(nodeId)) {
        element.classList.add("is-related");
      } else {
        element.classList.add("is-dimmed");
      }
    });

    edgeElements.forEach((edge) => {
      const touches = edge.dataset.left === id || edge.dataset.right === id;
      edge.classList.add(touches ? "is-related" : "is-dimmed");
    });
  }

  nodeElements.forEach((element) => {
    const id = element.dataset.node;

    element.addEventListener("mouseenter", () => {
      if (!pinned) activate(id);
    });

    element.addEventListener("focus", () => {
      if (!pinned) activate(id);
    });

    element.addEventListener("click", (event) => {
      event.stopPropagation();
      if (pinned === id) {
        pinned = null;
        clearState();
        return;
      }
      pinned = id;
      activate(id, { pin: true });
    });
  });

  nodesLayer.addEventListener("mouseleave", () => {
    if (!pinned) clearState();
  });

  stage.addEventListener("click", () => {
    pinned = null;
    clearState();
  });

  if (!reduced && !coarsePointer) {
    stage.addEventListener("pointermove", (event) => {
      const rect = stage.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width - 0.5) * -8;
      const y = ((event.clientY - rect.top) / rect.height - 0.5) * -6;
      plane.style.setProperty("--graph-x", `${x.toFixed(2)}px`);
      plane.style.setProperty("--graph-y", `${y.toFixed(2)}px`);
    }, { passive: true });

    stage.addEventListener("pointerleave", () => {
      plane.style.setProperty("--graph-x", "0px");
      plane.style.setProperty("--graph-y", "0px");
    });
  }
})();
