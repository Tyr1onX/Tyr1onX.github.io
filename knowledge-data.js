(() => {
  const SNAPSHOT = Object.freeze({
    repository: "Tyr1onX/Learning",
    commit: "2bae92f7e858db5117a6ce938e294e993409ade5",
    updated: "2026-08-27",
  });

  const STATUS = Object.freeze({
    understood: {
      label: "understood",
      note: "主干已能独立解释",
    },
    learning: {
      label: "learning",
      note: "第一轮学习中，需间隔回忆确认",
    },
    "review-needed": {
      label: "review-needed",
      note: "已接触或理解现象，需复习稳定表达",
    },
    "not-started": {
      label: "not-started",
      note: "已进入路线，但尚未系统学习",
    },
    "interview-ready": {
      label: "interview-ready",
      note: "间隔后仍能独立回答并处理追问",
    },
  });

  const SOURCES = Object.freeze({
    current: {
      title: "Learning · 02-Current/current-focus.md · 2026-08-27",
    },
    status: {
      title: "Learning · 05-Progress/learning-status.md",
    },
    web01: {
      title: "Learning · 03-Knowledge/Web/01-url-dns-tcp-tls-http.md",
    },
    web02: {
      title: "Learning · 03-Knowledge/Web/02-cors-auth-security.md",
    },
    web03: {
      title: "Learning · 03-Knowledge/Web/03-cache-cdn-http-versions.md",
    },
    web04: {
      title: "Learning · 03-Knowledge/Web/04-browser-rendering.md",
    },
    jsSession: {
      title: "Learning · 05-Progress/Sessions/2026-08-27-js-variables-types.md",
    },
    day1: {
      title: "Learning · 05-Progress/Sessions/2026-08-27-bytedance-day-1.md",
    },
    dailyRoadmap: {
      title: "Learning · 01-Roadmap/bytedance-fullstack-daily-plan.md · 2026-08-27",
    },
    roadmap: {
      title: "Learning · 01-Roadmap/learning-roadmap.md",
    },
  });

  const galaxies = [
    { id: "network", name: "Network / HTTP", x: 250, y: 250, mass: 0.92, dominance: 0.90 },
    { id: "security", name: "Security / Auth", x: 610, y: 205, mass: 0.76, dominance: 0.72 },
    { id: "protocol", name: "Cache / Protocol", x: 980, y: 280, mass: 0.82, dominance: 0.78 },
    { id: "browser", name: "Browser Rendering", x: 955, y: 625, mass: 0.88, dominance: 0.84 },
    { id: "javascript", name: "JavaScript / DOM", x: 505, y: 650, mass: 0.86, dominance: 0.86 },
    { id: "algorithm", name: "Algorithms", x: 1180, y: 720, mass: 0.68, dominance: 0.64 },
    { id: "engineering", name: "Full-stack / Engineering", x: 245, y: 735, mass: 0.62, dominance: 0.58 },
  ];

  const galaxyById = Object.fromEntries(galaxies.map((galaxy) => [galaxy.id, galaxy]));

  const rawNodes = [
    // Network / HTTP — 03-Knowledge + 2026-08-27 current-focus keep this trunk at understood.
    { id: "url-addressing", name: "URL / Domain / IP / Port", g: "network", status: "understood", layer: "primary", kind: "core", size: 0.94, source: "web01", extraSources: ["current"], summary: "能把 URL 拆成 scheme、host、port、path、query、fragment，并区分域名、IP 与端口各自解决的问题。" },
    { id: "dns", name: "DNS hierarchy / TTL / records", g: "network", status: "understood", layer: "primary", kind: "normal", size: 0.82, source: "web01", extraSources: ["current"], summary: "能解释 Resolver → Root → TLD → Authoritative 的委派链路，以及 A / AAAA / CNAME 与 DNS TTL。" },
    { id: "tcp-handshake", name: "TCP 三次握手", g: "network", status: "understood", layer: "primary", kind: "normal", size: 0.80, source: "web01", extraSources: ["current"], summary: "能解释 SYN、SYN+ACK、ACK 的建连意义，并说明为什么两次不足以确认双向链路。" },
    { id: "tcp-reliability", name: "TCP 可靠传输", g: "network", status: "understood", layer: "primary", kind: "normal", size: 0.78, source: "web01", extraSources: ["current"], summary: "已纠正“握手或心跳等于可靠性”的误区；可靠性来自序列号、ACK、重传、校验、流控与拥塞控制等机制。" },
    { id: "tls", name: "TLS / Certificate / CA", g: "network", status: "understood", layer: "primary", kind: "normal", size: 0.80, source: "web01", extraSources: ["current"], summary: "能区分 TCP 的可靠传输与 TLS 的保密性、完整性、身份认证，并理解证书链与现代会话密钥协商的主干。" },
    { id: "http-methods", name: "HTTP Method / Idempotency", g: "network", status: "understood", layer: "primary", kind: "normal", size: 0.72, source: "web01", extraSources: ["current"], summary: "能说明 GET / POST / PUT / PATCH / DELETE 的常见语义，并从最终资源状态理解幂等性。" },
    { id: "http-status", name: "HTTP Status / 401 / 403", g: "network", status: "understood", layer: "primary", kind: "normal", size: 0.70, source: "web01", extraSources: ["current"], summary: "能解释常见状态码，并准确区分 Authentication 与 Authorization 对应的 401 / 403 语境。" },
    { id: "sni-host", name: "SNI / Host", g: "network", status: "understood", layer: "secondary", kind: "soft", size: 0.52, source: "web01", summary: "理解同一 IP 承载多个站点时，SNI 在 TLS 层帮助选择证书 / 站点，Host 在 HTTP 层参与路由。" },

    // Security / Auth.
    { id: "same-origin-cors", name: "Same-Origin / CORS", g: "security", status: "understood", layer: "primary", kind: "core", size: 0.92, source: "web02", extraSources: ["current"], summary: "能用 scheme + host + port 判断 Origin，并解释 CORS 控制跨 Origin JavaScript 是否能读取响应。" },
    { id: "preflight", name: "Preflight / OPTIONS", g: "security", status: "understood", layer: "primary", kind: "normal", size: 0.72, source: "web02", extraSources: ["current"], summary: "能判断常见非 safelist 请求为何先发 OPTIONS，并理解预检通过后真正响应仍需满足 CORS。" },
    { id: "cookie-session", name: "Cookie / Session", g: "security", status: "understood", layer: "primary", kind: "normal", size: 0.80, source: "web02", extraSources: ["current"], summary: "理解 Cookie 携带状态信息、Session 常在服务端保存登录状态，浏览器通常只持有 session id。" },
    { id: "jwt-token", name: "JWT / Access / Refresh Token", g: "security", status: "understood", layer: "primary", kind: "normal", size: 0.82, source: "web02", extraSources: ["current"], summary: "已纠正 JWT≠加密；理解签名防篡改但不防合法 Token 被盗，以及 Access / Refresh Token 的生命周期分工。" },
    { id: "authn-authz", name: "Authentication / Authorization", g: "security", status: "understood", layer: "secondary", kind: "normal", size: 0.56, source: "web02", summary: "能用“你是谁 / 你能做什么”区分身份认证与权限授权。" },
    { id: "xss-csrf", name: "XSS / CSRF", g: "security", status: "understood", layer: "primary", kind: "normal", size: 0.78, source: "web02", extraSources: ["current"], summary: "能区分“恶意脚本进入可信站点上下文”和“借用用户已登录身份发请求”，并理解 HttpOnly、SameSite、CSRF Token 等边界。" },
    { id: "samesite-credential", name: "SameSite / Credentialed CORS", g: "security", status: "understood", layer: "secondary", kind: "soft", size: 0.50, source: "web02", summary: "理解 Same-Origin 与 Same-Site 不是同一概念，并知道跨 Origin 携带 Cookie 需要前后端与 Cookie 属性共同满足条件。" },

    // Cache / HTTP versions.
    { id: "cache-model", name: "Strong / Conditional Cache", g: "protocol", status: "understood", layer: "primary", kind: "core", size: 0.90, source: "web03", extraSources: ["current"], summary: "能区分强缓存直接使用与协商缓存向服务器验证，并理解缓存过期不等于必须重新下载完整资源。" },
    { id: "etag-304", name: "ETag / 304", g: "protocol", status: "understood", layer: "primary", kind: "normal", size: 0.70, source: "web03", summary: "理解 ETag / If-None-Match 的资源版本验证，以及 304 省带宽但仍发生网络往返。" },
    { id: "cache-control", name: "no-cache / no-store", g: "protocol", status: "understood", layer: "secondary", kind: "soft", size: 0.52, source: "web03", summary: "已纠正反直觉含义：no-store 不存储；no-cache 可以存，但再次使用前必须重新验证。" },
    { id: "content-hash", name: "Content Hash", g: "protocol", status: "understood", layer: "primary", kind: "normal", size: 0.68, source: "web03", summary: "理解内容变化生成新 URL，从而绕开旧资源的长期强缓存。" },
    { id: "cdn", name: "CDN / Hit / Miss / Origin / TTL", g: "protocol", status: "understood", layer: "primary", kind: "normal", size: 0.80, source: "web03", extraSources: ["current"], summary: "能说明边缘节点、Cache Hit / Miss、回源、TTL 与 Purge / Invalidation 的基本关系。" },
    { id: "http11", name: "HTTP/1.1 Keep-Alive", g: "protocol", status: "understood", layer: "secondary", kind: "normal", size: 0.54, source: "web03", summary: "理解多个 HTTP 请求复用 TCP 连接的目的，以及浏览器常通过多条连接提升 HTTP/1.1 并发。" },
    { id: "http2", name: "HTTP/2 Multiplexing / HOL", g: "protocol", status: "understood", layer: "primary", kind: "normal", size: 0.76, source: "web03", extraSources: ["current"], summary: "理解一条 TCP 上多 Stream / Frame 的多路复用，并能解释 TCP 连接级有序字节流造成的队头阻塞。" },
    { id: "http3", name: "HTTP/3 / QUIC / UDP", g: "protocol", status: "understood", layer: "primary", kind: "normal", size: 0.80, source: "web03", extraSources: ["current"], summary: "能解释 QUIC 在 UDP 之上自己提供可靠传输、多 Stream、拥塞控制与 TLS 1.3，而不是简单说“UDP 比 TCP 快”。" },
    { id: "quic-migration", name: "QUIC Connection Migration", g: "protocol", status: "understood", layer: "secondary", kind: "soft", size: 0.52, source: "web03", summary: "理解 QUIC 使用 Connection ID，使逻辑连接不完全依赖传统 TCP 四元组。" },

    // Browser rendering.
    { id: "render-pipeline", name: "DOM / CSSOM / Render Pipeline", g: "browser", status: "understood", layer: "primary", kind: "core", size: 0.94, source: "web04", extraSources: ["current"], summary: "能从 HTML / CSS 解析连续解释 DOM、CSSOM、Layout、Paint、Composite 到屏幕显示。" },
    { id: "visibility-model", name: "display / visibility / opacity", g: "browser", status: "understood", layer: "primary", kind: "normal", size: 0.74, source: "web04", summary: "能区分三者是否参与布局、是否占空间、是否视觉可见以及默认事件行为。" },
    { id: "transform-transition", name: "transform / opacity / transition", g: "browser", status: "understood", layer: "primary", kind: "normal", size: 0.72, source: "web04", summary: "理解 transform / opacity 常能避开布局路径，transition 用于可插值属性的连续过渡。" },
    { id: "script-loading", name: "script / async / defer", g: "browser", status: "understood", layer: "primary", kind: "normal", size: 0.78, source: "web04", extraSources: ["current"], summary: "能解释普通脚本为何可能阻塞 HTML Parser，以及 async 的完成顺序与 defer 的声明顺序。" },
    { id: "document-events", name: "DOMContentLoaded / load", g: "browser", status: "understood", layer: "secondary", kind: "normal", size: 0.56, source: "web04", summary: "能判断 DOM 已完成但大资源仍下载时两个事件的触发差异，并知道 defer 在 DOMContentLoaded 前完成。" },
    { id: "css-blocking", name: "CSS render blocking / JS indirect wait", g: "browser", status: "understood", layer: "secondary", kind: "soft", size: 0.54, source: "web04", summary: "理解 CSS 通常不直接阻塞 DOM 构建，但会影响关键渲染，并可能通过脚本形成 HTML→JS→CSS 的间接等待链。" },
    { id: "reflow-repaint", name: "Reflow / Repaint", g: "browser", status: "review-needed", layer: "primary", kind: "soft", size: 0.64, source: "web04", extraSources: ["current"], evidence: "2026-08-27 current-focus：现象已理解，但正式术语仍需要间隔复习，因此不把术语熟练度写成 understood。", summary: "布局与重绘现象已理解；当前主要需要通过间隔回忆稳定术语与触发条件。" },
    { id: "forced-layout", name: "Forced Synchronous Layout", g: "browser", status: "review-needed", layer: "secondary", kind: "soft", size: 0.50, source: "web04", extraSources: ["current"], evidence: "Learning 明确记录：写布局后立即读取真实几何值的现象已理解，术语与 DOM API 需要后续复习。", summary: "理解“先写布局、立刻读 offsetWidth 等真实几何值”可能迫使浏览器同步完成 Layout。" },
    { id: "layout-thrashing", name: "Layout Thrashing", g: "browser", status: "review-needed", layer: "secondary", kind: "soft", size: 0.50, source: "web04", extraSources: ["current"], evidence: "Learning 明确记录：频繁读写导致反复 Layout 的机制已理解，但术语不易主动想起。", summary: "理解频繁交替布局写入与几何读取会造成反复同步 Layout；当前重点是术语与代码模式的复习。" },

    // JavaScript / DOM — latest 2026-08-27 session explicitly keeps the new topic at learning.
    { id: "js-binding", name: "let / const / binding / value", g: "javascript", status: "learning", layer: "primary", kind: "core", size: 0.94, source: "jsSession", extraSources: ["current", "day1"], evidence: "2026-08-27 会话明确：本主题完成第一轮理解与口头验证，标记为 learning，暂不升级为 understood。", summary: "已能解释重新赋值、变量 / binding 与值的关系，以及 let 与 const 的基本约束。" },
    { id: "js-dynamic-types", name: "Dynamic Types / Primitive Values", g: "javascript", status: "learning", layer: "primary", kind: "normal", size: 0.76, source: "jsSession", extraSources: ["current"], summary: "当前准确表述是“值有类型，变量可以先后绑定不同类型的值”，已覆盖 number / string / boolean。" },
    { id: "js-null-undefined", name: "undefined / null / typeof", g: "javascript", status: "learning", layer: "primary", kind: "normal", size: 0.72, source: "jsSession", extraSources: ["current"], summary: "已能解释 let x; 中 x 已声明但值为 undefined，并知道 typeof null === 'object' 是历史兼容问题。" },
    { id: "js-equality", name: "== / ===", g: "javascript", status: "learning", layer: "secondary", kind: "normal", size: 0.54, source: "jsSession", summary: "理解 == 会发生隐式类型转换，日常默认优先严格相等 ===。" },
    { id: "js-const-object", name: "const 与对象属性修改", g: "javascript", status: "learning", layer: "secondary", kind: "normal", size: 0.54, source: "jsSession", summary: "理解 const 限制变量重新绑定，不代表对象内部属性不可修改。" },
    { id: "dom-query", name: "document / querySelector / Element", g: "javascript", status: "learning", layer: "secondary", kind: "soft", size: 0.50, source: "status", summary: "已有最低必要直觉：Document 不等于具体 Element，selector 字符串由 querySelector 等方法解释；仍需在后续 DOM 阶段巩固。" },
    { id: "js-objects-arrays", name: "对象 / 数组 / 属性访问", g: "javascript", status: "not-started", layer: "secondary", kind: "trace", size: 0.42, source: "current", evidence: "2026-08-27 current-focus 将“对象 / 数组的基本模型 → 属性访问”列为下一学习断点。", summary: "这是下一次 JavaScript 学习入口；当前不提前标记已掌握。" },
    { id: "js-functions", name: "函数", g: "javascript", status: "not-started", layer: "secondary", kind: "trace", size: 0.40, source: "current", summary: "位于对象 / 引用之后的近期学习路线，尚未系统补。" },
    { id: "js-scope", name: "Scope / Closure / this / Prototype", g: "javascript", status: "not-started", layer: "secondary", kind: "trace", size: 0.40, source: "current", extraSources: ["status"], summary: "路线已明确，但 Learning 当前仍记录为尚未系统学习。" },
    { id: "dom-event", name: "DOM / Event", g: "javascript", status: "not-started", layer: "secondary", kind: "trace", size: 0.40, source: "current", summary: "在语言基础之后进入完整 DOM / Event 阶段；不因已有少量 DOM API 接触而提前算完成。" },
    { id: "js-async", name: "Promise / async-await / Event Loop", g: "javascript", status: "not-started", layer: "secondary", kind: "trace", size: 0.42, source: "current", extraSources: ["status"], summary: "明确排在 DOM / Event 之后，尚未系统学习。" },
    { id: "fetch-api", name: "fetch / JSON / API", g: "javascript", status: "not-started", layer: "secondary", kind: "trace", size: 0.42, source: "current", summary: "计划由 fetch() 自然切入后端与完整前后端交互，当前尚未到此断点。" },

    // Algorithms — current session + status table.
    { id: "group-anagrams", name: "LeetCode 49 · 字母异位词分组", g: "algorithm", status: "learning", layer: "primary", kind: "core", size: 0.92, source: "day1", extraSources: ["current"], evidence: "2026-08-27 第一轮完成；已进入 D+1 / D+3 / D+7 / D+21 间隔复习池。", summary: "已独立形成“排序后的字符串作为 unordered_map 键 → 收集 pair.second”的思路；时间 O(n·k log k)，空间 O(n·k)。" },
    { id: "algo-complexity", name: "Complexity", g: "algorithm", status: "review-needed", layer: "primary", kind: "normal", size: 0.68, source: "status", extraSources: ["day1"], summary: "概念已有基础，LeetCode 49 能自行推出复杂度，但 Learning 仍将系统化复杂度标为需要复习。" },
    { id: "hash-grouping", name: "Hash / Sort Grouping", g: "algorithm", status: "learning", layer: "primary", kind: "normal", size: 0.66, source: "day1", summary: "刚通过字母异位词分组完成一次“规范化 key + 哈希分组”实践，仍需通过后续题目形成稳定模式识别。" },
    { id: "cpp-containers", name: "C++ nested vector / unordered_map", g: "algorithm", status: "review-needed", layer: "secondary", kind: "soft", size: 0.48, source: "day1", evidence: "2026-08-27 会话暴露：vector<vector<string>> 与 vector<string, vector<string>> 曾混淆，嵌套 vector 类型仍需实践稳定。", summary: "已纠正返回类型、pair.first / pair.second 与 std::sort 原地排序等实现点，但容器类型表达仍需复习。" },
    { id: "dfs-bfs", name: "DFS / BFS", g: "algorithm", status: "review-needed", layer: "secondary", kind: "soft", size: 0.46, source: "status", extraSources: ["roadmap"], summary: "见过常见写法，但 Learning 明确记录为需要真正理解和复习。" },
    { id: "dp-diff", name: "DP / LCS / Diff", g: "algorithm", status: "not-started", layer: "secondary", kind: "trace", size: 0.42, source: "status", extraSources: ["roadmap"], summary: "真实面试暴露为明显短板；路线计划先理解 LCS / Diff，再继续 Myers Diff。" },
    { id: "algo-patterns", name: "Array / String / Hash / Tree / Graph", g: "algorithm", status: "not-started", layer: "secondary", kind: "trace", size: 0.38, source: "roadmap", summary: "Roadmap 中的数据结构与题型模板主线；当前不按题量制造熟练度，只作为后续空间中的弱星。" },

    // Full-stack / engineering roadmap — only Learning evidence, no project/PR/resume data.
    { id: "typescript", name: "TypeScript", g: "engineering", status: "not-started", layer: "secondary", kind: "trace", size: 0.42, source: "current", extraSources: ["dailyRoadmap"], summary: "排在 fetch / JSON / API 之后，当前尚未进入系统学习。" },
    { id: "react", name: "React", g: "engineering", status: "not-started", layer: "secondary", kind: "trace", size: 0.44, source: "current", extraSources: ["dailyRoadmap", "status"], summary: "当前规则明确“不提前跳到 React”；框架概念基础薄弱，等待前置链路完成。" },
    { id: "node-backend", name: "Node.js Backend / Route / Request / Response", g: "engineering", status: "not-started", layer: "secondary", kind: "trace", size: 0.44, source: "current", extraSources: ["status", "roadmap"], summary: "计划由 fetch / API 自然切入后端；服务、路由、请求响应尚未系统补。" },
    { id: "database", name: "SQL / Database / Index / Transaction", g: "engineering", status: "not-started", layer: "secondary", kind: "trace", size: 0.44, source: "current", extraSources: ["status", "roadmap"], summary: "有基础使用经验，但 Learning 的系统学习状态仍是 not-started。" },
    { id: "linux-stack", name: "Linux / Docker / Deployment / CI", g: "engineering", status: "not-started", layer: "secondary", kind: "trace", size: 0.44, source: "current", extraSources: ["dailyRoadmap"], summary: "当前全栈主线的后段；系统化学习尚未到达此处。" },
    { id: "git-ci", name: "Git / PR / CI / Testing", g: "engineering", status: "review-needed", layer: "primary", kind: "soft", size: 0.62, source: "status", extraSources: ["roadmap"], summary: "Learning 记录为项目经验较多但理论表达需整理；这里仅使用 Learning 的状态，不引入任何项目或 PR 数据。" },
    { id: "architecture", name: "Maintainability / Architecture", g: "engineering", status: "review-needed", layer: "primary", kind: "soft", size: 0.60, source: "status", extraSources: ["roadmap"], summary: "已有实际迭代经验，但需要把模块边界、依赖方向、错误处理、测试分层等形成可表达的判断框架。" },
    { id: "ai-coding", name: "AI Coding · Requirement / Review / Validation", g: "engineering", status: "understood", layer: "primary", kind: "normal", size: 0.72, source: "status", extraSources: ["roadmap"], summary: "Learning 当前把需求澄清、代码审查与验证列为相对优势，状态为 understood；仍要求与每个基础模块融合。" },
  ];

  function hash01(value) {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0) / 4294967295;
  }

  function sourceModel(sourceId) {
    return {
      id: sourceId,
      title: SOURCES[sourceId]?.title || sourceId,
    };
  }

  const nodes = rawNodes.map((node) => {
    const galaxy = galaxyById[node.g];
    const angle = hash01(`${SNAPSHOT.commit}|${node.id}|angle`) * Math.PI * 2;
    const radius = 34 + hash01(`${SNAPSHOT.commit}|${node.id}|radius`) * (node.layer === "primary" ? 86 : 118);
    const status = STATUS[node.status];
    const sourceIds = [...new Set([node.source, ...(node.extraSources || [])])];

    return {
      ...node,
      x: galaxy.x + Math.cos(angle) * radius,
      y: galaxy.y + Math.sin(angle) * radius * 0.72,
      en: `${status.label} · ${status.note}`,
      summary: `状态：${status.label}。${node.summary}`,
      evidence: [
        {
          id: `e-${node.id}`,
          observation: node.evidence || `${SOURCES[node.source]?.title || node.source} 支撑这颗知识星；状态沿用 Learning 的离散状态，不转换成 0.x 熟练度。`,
          source_ids: sourceIds,
        },
      ],
      sources: sourceIds.map(sourceModel),
    };
  });

  const relationPairs = [
    ["url-addressing", "dns"], ["dns", "tcp-handshake"], ["tcp-handshake", "tcp-reliability"], ["tcp-handshake", "tls"], ["tls", "http-methods"], ["http-methods", "http-status"], ["tls", "sni-host"], ["sni-host", "http-methods"],
    ["http-methods", "same-origin-cors"], ["same-origin-cors", "preflight"], ["same-origin-cors", "samesite-credential"], ["samesite-credential", "cookie-session"], ["cookie-session", "jwt-token"], ["jwt-token", "authn-authz"], ["cookie-session", "xss-csrf"], ["same-origin-cors", "xss-csrf"],
    ["http-methods", "cache-model"], ["cache-model", "etag-304"], ["cache-model", "cache-control"], ["cache-model", "content-hash"], ["cache-model", "cdn"], ["http-methods", "http11"], ["http11", "http2"], ["http2", "http3"], ["http3", "quic-migration"], ["tcp-reliability", "http2"],
    ["http-methods", "render-pipeline"], ["render-pipeline", "visibility-model"], ["render-pipeline", "transform-transition"], ["render-pipeline", "script-loading"], ["script-loading", "document-events"], ["script-loading", "css-blocking"], ["render-pipeline", "reflow-repaint"], ["reflow-repaint", "forced-layout"], ["forced-layout", "layout-thrashing"], ["transform-transition", "reflow-repaint"],
    ["render-pipeline", "dom-query"], ["dom-query", "js-binding"], ["js-binding", "js-dynamic-types"], ["js-binding", "js-null-undefined"], ["js-dynamic-types", "js-equality"], ["js-binding", "js-const-object"], ["js-binding", "js-objects-arrays"], ["js-objects-arrays", "js-functions"], ["js-functions", "js-scope"], ["js-scope", "dom-event"], ["dom-event", "js-async"], ["js-async", "fetch-api"],
    ["algo-complexity", "group-anagrams"], ["group-anagrams", "hash-grouping"], ["group-anagrams", "cpp-containers"], ["algo-complexity", "dfs-bfs"], ["dfs-bfs", "dp-diff"], ["dfs-bfs", "algo-patterns"],
    ["fetch-api", "typescript"], ["typescript", "react"], ["fetch-api", "node-backend"], ["node-backend", "database"], ["node-backend", "linux-stack"], ["linux-stack", "git-ci"], ["git-ci", "architecture"], ["architecture", "ai-coding"], ["algo-complexity", "architecture"],
  ];

  const relations = relationPairs.map(([source, target], index) => {
    const sourceNode = nodes.find((node) => node.id === source);
    const targetNode = nodes.find((node) => node.id === target);
    const crossGalaxy = sourceNode?.g !== targetNode?.g;
    return {
      id: `r-${index + 1}`,
      source,
      target,
      distance: crossGalaxy ? 128 : 82,
      strength: crossGalaxy ? 0.08 : 0.18,
    };
  });

  window.__LEARNING_SNAPSHOT__ = SNAPSHOT;
  window.__KC_SCENE__ = {
    version: "kc.scene.v1",
    seed: `learning:${SNAPSHOT.commit}:knowledge-page:v1`,
    subject: {
      id: "Tyr1onX-learning",
      label: "Tyr1onX",
      language: "zh-CN",
      scope: `Learning only · ${SNAPSHOT.updated}`,
    },
    viewport: {
      width: 1400,
      height: 920,
    },
    identity: {
      family: "monogram",
      label: "Tyr1onX",
      title: "Tyr1onX · Learning",
      subtitle: "知识状态来自 Learning · 2026-08-27",
      source: "Tyr1onX/Learning",
      monogram: "TY",
      x: 700,
      y: 455,
      presence: {
        mode: "brief_intro",
        subtitle: "只展示 Learning 中可追溯的知识与学习路线",
      },
    },
    composition: {
      archetype: "sparse_archipelago",
      asymmetry: 0.62,
      openness: 0.72,
      dominant_axis: "diagonal",
    },
    field: {
      density: "medium",
      dust_family: "cold_filament",
      temperature_bias: "cool_neutral",
    },
    stars: {
      family: "subtle_point",
      temperature_variation: "medium",
    },
    motion: {
      temperament: "balanced",
    },
    galaxies,
    nodes,
    relations,
    anchors: [],
    metadata: {
      source_repository: SNAPSHOT.repository,
      source_commit: SNAPSHOT.commit,
      source_updated: SNAPSHOT.updated,
      status_policy: "Learning discrete states only; no numeric mastery score",
    },
  };
})();
