window.TYR1ONX_KNOWLEDGE_GRAPH = {
  meta: {
    version: "0.3.1",
    source: "Tyr1onX/Learning",
    updated: "2026-08-08",
    note: "The overview only shows the strongest current cognitive links. Mastery and practice remain separate, hidden cross-galaxy links can still surface on interaction, and overview galaxy regions do not overlap.",
  },
  primaryCrossEdges: [
    ["http", "browser"],
    ["typescript", "tauri"],
    ["ai-coding", "llm"],
    ["python", "sql"]
  ],
  galaxies: [
    { id: "algorithms", label: "Algorithms", x: 13, y: 18, width: 16, height: 16, strength: 0.42, tone: "148 153 157" },
    { id: "web-request", label: "Web Request", x: 49, y: 21, width: 32, height: 24, strength: 0.90, tone: "188 154 99" },
    { id: "browser", label: "Browser", x: 25, y: 50, width: 30, height: 26, strength: 0.92, tone: "174 177 166" },
    { id: "app-system", label: "App & System", x: 25, y: 80, width: 24, height: 20, strength: 0.76, tone: "128 151 167" },
    { id: "engineering", label: "Engineering", x: 55, y: 80, width: 24, height: 20, strength: 0.82, tone: "139 156 171" },
    { id: "ai", label: "AI", x: 82, y: 48, width: 28, height: 30, strength: 0.90, tone: "132 165 176" },
    { id: "data", label: "Data", x: 84, y: 82, width: 20, height: 16, strength: 0.64, tone: "111 148 164" },
  ],
  nodes: [
    { id: "dfs", label: "DFS", x: 10, y: 21, galaxy: "algorithms", tier: "satellite", importance: 0.30, mastery: 0.24, practice: 0.18, kind: "concept" },
    { id: "bfs", label: "BFS", x: 16, y: 14, galaxy: "algorithms", tier: "satellite", importance: 0.30, mastery: 0.24, practice: 0.18, kind: "concept" },

    { id: "http", label: "HTTP", x: 49, y: 23, galaxy: "web-request", tier: "core", importance: 1.00, mastery: 0.72, practice: 0.55, kind: "concept" },
    { id: "dns", label: "DNS", x: 37, y: 17, galaxy: "web-request", tier: "major", importance: 0.56, mastery: 0.68, practice: 0.12, kind: "concept" },
    { id: "tcp", label: "TCP", x: 46, y: 12, galaxy: "web-request", tier: "major", importance: 0.64, mastery: 0.68, practice: 0.12, kind: "concept" },
    { id: "tls", label: "TLS", x: 56, y: 16, galaxy: "web-request", tier: "major", importance: 0.58, mastery: 0.64, practice: 0.12, kind: "concept" },
    { id: "cors", label: "CORS", x: 60, y: 24, galaxy: "web-request", tier: "satellite", importance: 0.46, mastery: 0.72, practice: 0.48, kind: "concept" },
    { id: "cache", label: "Cache", x: 56, y: 31, galaxy: "web-request", tier: "satellite", importance: 0.44, mastery: 0.68, practice: 0.34, kind: "concept" },
    { id: "auth", label: "Auth", x: 43, y: 31, galaxy: "web-request", tier: "satellite", importance: 0.46, mastery: 0.65, practice: 0.30, kind: "concept" },

    { id: "browser", label: "Browser", x: 26, y: 49, galaxy: "browser", tier: "core", importance: 0.94, mastery: 0.34, practice: 0.82, kind: "concept" },
    { id: "javascript", label: "JavaScript", x: 36, y: 50, galaxy: "browser", tier: "core", importance: 0.96, mastery: 0.22, practice: 0.90, kind: "technology" },
    { id: "html", label: "HTML", x: 15, y: 42, galaxy: "browser", tier: "major", importance: 0.60, mastery: 0.18, practice: 0.92, kind: "technology" },
    { id: "css", label: "CSS", x: 15, y: 57, galaxy: "browser", tier: "major", importance: 0.62, mastery: 0.18, practice: 0.94, kind: "technology" },
    { id: "dom", label: "DOM", x: 24, y: 39, galaxy: "browser", tier: "satellite", importance: 0.44, mastery: 0.30, practice: 0.82, kind: "concept" },
    { id: "typescript", label: "TypeScript", x: 35, y: 59, galaxy: "browser", tier: "major", importance: 0.76, mastery: 0.27, practice: 0.98, kind: "technology" },

    { id: "tauri", label: "Tauri", x: 29, y: 73, galaxy: "app-system", tier: "core", importance: 0.90, mastery: 0.55, practice: 1.00, kind: "technology" },
    { id: "rust", label: "Rust", x: 18, y: 79, galaxy: "app-system", tier: "major", importance: 0.60, mastery: 0.16, practice: 0.82, kind: "technology" },
    { id: "linux", label: "Linux", x: 25, y: 87, galaxy: "app-system", tier: "satellite", importance: 0.48, mastery: 0.28, practice: 0.40, kind: "technology" },

    { id: "git", label: "Git", x: 49, y: 79, galaxy: "engineering", tier: "core", importance: 0.88, mastery: 0.22, practice: 1.00, kind: "technology" },
    { id: "ai-coding", label: "AI Coding", x: 59, y: 72, galaxy: "engineering", tier: "core", importance: 0.92, mastery: 0.62, practice: 1.00, kind: "engineering" },
    { id: "ci", label: "CI", x: 58, y: 87, galaxy: "engineering", tier: "satellite", importance: 0.42, mastery: 0.38, practice: 0.96, kind: "engineering" },
    { id: "testing", label: "Testing", x: 64, y: 80, galaxy: "engineering", tier: "major", importance: 0.52, mastery: 0.42, practice: 0.94, kind: "engineering" },

    { id: "llm", label: "LLM", x: 80, y: 43, galaxy: "ai", tier: "core", importance: 0.94, mastery: 0.58, practice: 0.82, kind: "concept" },
    { id: "agent", label: "Agent", x: 91, y: 49, galaxy: "ai", tier: "major", importance: 0.56, mastery: 0.56, practice: 0.72, kind: "concept" },
    { id: "mcp", label: "MCP", x: 85, y: 58, galaxy: "ai", tier: "major", importance: 0.58, mastery: 0.60, practice: 0.78, kind: "concept" },
    { id: "rag", label: "RAG", x: 90, y: 36, galaxy: "ai", tier: "satellite", importance: 0.46, mastery: 0.58, practice: 0.26, kind: "concept" },
    { id: "python", label: "Python", x: 75, y: 58, galaxy: "ai", tier: "satellite", importance: 0.50, mastery: 0.18, practice: 0.62, kind: "technology" },

    { id: "sql", label: "SQL", x: 81, y: 77, galaxy: "data", tier: "core", importance: 0.72, mastery: 0.46, practice: 0.42, kind: "technology" },
    { id: "mysql", label: "MySQL", x: 90, y: 86, galaxy: "data", tier: "major", importance: 0.48, mastery: 0.45, practice: 0.42, kind: "technology" },
  ],
  edges: [
    ["dns", "tcp"], ["tcp", "tls"], ["tls", "http"], ["dns", "http"],
    ["http", "cors"], ["http", "cache"], ["http", "auth"],

    ["html", "dom"], ["html", "browser"], ["css", "browser"], ["dom", "browser"],
    ["dom", "javascript"], ["browser", "javascript"], ["javascript", "typescript"],

    ["tauri", "rust"], ["rust", "linux"],
    ["git", "ci"], ["ci", "testing"], ["testing", "ai-coding"], ["git", "ai-coding"],
    ["llm", "rag"], ["llm", "agent"], ["agent", "mcp"], ["python", "llm"],
    ["sql", "mysql"],
    ["dfs", "bfs"],

    ["http", "browser"], ["typescript", "tauri"], ["tauri", "browser"],
    ["typescript", "ai-coding"], ["mcp", "ai-coding"], ["ai-coding", "llm"],
    ["python", "sql"], ["dfs", "javascript"], ["bfs", "javascript"]
  ]
};
