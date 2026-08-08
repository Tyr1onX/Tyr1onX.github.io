window.TYR1ONX_KNOWLEDGE_GRAPH = {
  meta: {
    version: "0.1",
    source: "Tyr1onX/Learning",
    updated: "2026-08-08",
    note: "Mastery and practice are intentionally separate. Project usage does not raise mastery by itself.",
  },
  nodes: [
    { id: "dns", label: "DNS", x: 34, y: 18, importance: 0.58, mastery: 0.68, practice: 0.12, kind: "concept" },
    { id: "tcp", label: "TCP", x: 46, y: 15, importance: 0.64, mastery: 0.68, practice: 0.12, kind: "concept" },
    { id: "tls", label: "TLS", x: 58, y: 20, importance: 0.58, mastery: 0.64, practice: 0.12, kind: "concept" },
    { id: "http", label: "HTTP", x: 49, y: 31, importance: 0.92, mastery: 0.72, practice: 0.55, kind: "concept" },
    { id: "cors", label: "CORS", x: 62, y: 36, importance: 0.54, mastery: 0.72, practice: 0.48, kind: "concept" },
    { id: "cache", label: "Cache", x: 73, y: 27, importance: 0.50, mastery: 0.68, practice: 0.34, kind: "concept" },
    { id: "auth", label: "Auth", x: 69, y: 45, importance: 0.50, mastery: 0.65, practice: 0.30, kind: "concept" },

    { id: "html", label: "HTML", x: 18, y: 38, importance: 0.62, mastery: 0.18, practice: 0.92, kind: "technology" },
    { id: "css", label: "CSS", x: 15, y: 52, importance: 0.66, mastery: 0.18, practice: 0.94, kind: "technology" },
    { id: "browser", label: "Browser", x: 31, y: 50, importance: 0.78, mastery: 0.34, practice: 0.82, kind: "concept" },
    { id: "dom", label: "DOM", x: 29, y: 39, importance: 0.48, mastery: 0.30, practice: 0.82, kind: "concept" },
    { id: "javascript", label: "JavaScript", x: 41, y: 47, importance: 0.90, mastery: 0.22, practice: 0.90, kind: "technology" },
    { id: "typescript", label: "TypeScript", x: 43, y: 60, importance: 0.82, mastery: 0.27, practice: 0.98, kind: "technology" },

    { id: "tauri", label: "Tauri", x: 31, y: 69, importance: 0.72, mastery: 0.55, practice: 1.00, kind: "technology" },
    { id: "rust", label: "Rust", x: 17, y: 74, importance: 0.62, mastery: 0.16, practice: 0.82, kind: "technology" },
    { id: "linux", label: "Linux", x: 29, y: 86, importance: 0.56, mastery: 0.28, practice: 0.40, kind: "technology" },

    { id: "git", label: "Git", x: 49, y: 78, importance: 0.72, mastery: 0.22, practice: 1.00, kind: "technology" },
    { id: "ci", label: "CI", x: 61, y: 84, importance: 0.46, mastery: 0.38, practice: 0.96, kind: "engineering" },
    { id: "testing", label: "Testing", x: 69, y: 72, importance: 0.54, mastery: 0.42, practice: 0.94, kind: "engineering" },
    { id: "ai-coding", label: "AI Coding", x: 62, y: 61, importance: 0.74, mastery: 0.62, practice: 1.00, kind: "engineering" },

    { id: "python", label: "Python", x: 79, y: 60, importance: 0.58, mastery: 0.18, practice: 0.62, kind: "technology" },
    { id: "llm", label: "LLM", x: 82, y: 42, importance: 0.76, mastery: 0.58, practice: 0.82, kind: "concept" },
    { id: "rag", label: "RAG", x: 91, y: 32, importance: 0.48, mastery: 0.58, practice: 0.26, kind: "concept" },
    { id: "agent", label: "Agent", x: 92, y: 48, importance: 0.54, mastery: 0.56, practice: 0.72, kind: "concept" },
    { id: "mcp", label: "MCP", x: 86, y: 55, importance: 0.54, mastery: 0.60, practice: 0.78, kind: "concept" },

    { id: "sql", label: "SQL", x: 82, y: 76, importance: 0.56, mastery: 0.46, practice: 0.42, kind: "technology" },
    { id: "mysql", label: "MySQL", x: 91, y: 84, importance: 0.46, mastery: 0.45, practice: 0.42, kind: "technology" },

    { id: "dfs", label: "DFS", x: 10, y: 21, importance: 0.34, mastery: 0.24, practice: 0.18, kind: "concept" },
    { id: "bfs", label: "BFS", x: 16, y: 14, importance: 0.34, mastery: 0.24, practice: 0.18, kind: "concept" }
  ],
  edges: [
    ["dns", "tcp"], ["tcp", "tls"], ["tls", "http"], ["dns", "http"],
    ["http", "cors"], ["http", "cache"], ["http", "auth"], ["http", "browser"],
    ["html", "dom"], ["html", "browser"], ["css", "browser"], ["dom", "browser"],
    ["dom", "javascript"], ["browser", "javascript"], ["javascript", "typescript"],
    ["typescript", "tauri"], ["tauri", "rust"], ["tauri", "browser"], ["rust", "linux"],
    ["typescript", "git"], ["rust", "git"], ["git", "ci"], ["ci", "testing"],
    ["testing", "ai-coding"], ["git", "ai-coding"], ["typescript", "ai-coding"],
    ["ai-coding", "llm"], ["python", "llm"], ["llm", "rag"], ["llm", "agent"],
    ["agent", "mcp"], ["mcp", "ai-coding"], ["python", "sql"], ["sql", "mysql"],
    ["dfs", "bfs"], ["dfs", "javascript"], ["bfs", "javascript"]
  ]
};
