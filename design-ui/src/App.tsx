import React, {
  Component,
  Suspense,
  lazy,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import { getComponentSource } from "./component-sources";
import {
  categoryLabels,
  fidelityLabels,
  items,
  priorityTags,
  type Category,
  type Fidelity,
  type GalleryItem,
} from "./gallery-data";

type DetailTab = "preview" | "code";

class PreviewBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) return <div className="design-preview-fallback">这个预览暂时无法运行。</div>;
    return this.props.children;
  }
}

function PreviewLoading() {
  return <div className="design-preview-loading"><span />正在载入预览</div>;
}

function DemoSurface({ item, className = "" }: { item: GalleryItem; className?: string }) {
  const Demo = useMemo(() => lazy(item.loadDemo), [item]);
  return (
    <div className={`design-demo-surface ${className}`}>
      <PreviewBoundary>
        <Suspense fallback={<PreviewLoading />}>
          <Demo />
        </Suspense>
      </PreviewBoundary>
    </div>
  );
}

function LazyPreview({ item }: { item: GalleryItem }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (item.heavy || mounted) return;
    const host = hostRef.current;
    if (!host) return;
    if (!("IntersectionObserver" in window)) {
      setMounted(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setMounted(true);
        observer.disconnect();
      },
      { rootMargin: "280px 0px" },
    );
    observer.observe(host);
    return () => observer.disconnect();
  }, [item.heavy, mounted]);

  return (
    <div className="design-card-preview" ref={hostRef}>
      {item.heavy && !mounted ? (
        <button
          className="design-heavy-load"
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setMounted(true);
          }}
        >
          <span>重型预览</span>
          点击加载
        </button>
      ) : mounted ? (
        <DemoSurface item={item} />
      ) : (
        <div className="design-preview-idle"><span>{item.name}</span></div>
      )}
    </div>
  );
}

function FidelityMark({ fidelity, withText = false }: { fidelity: Fidelity; withText?: boolean }) {
  return (
    <span className={`design-fidelity design-fidelity-${fidelity}`} title={fidelityLabels[fidelity]}>
      <i aria-hidden="true" />
      {withText ? fidelityLabels[fidelity] : null}
    </span>
  );
}

export default function App() {
  const [category, setCategory] = useState<Category | "all">("all");
  const [tag, setTag] = useState("all");
  const [fidelity, setFidelity] = useState<Fidelity | "all">("all");
  const [query, setQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState<GalleryItem | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("preview");
  const [sourceText, setSourceText] = useState("");
  const [sourceLoading, setSourceLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  const categoryCounts = useMemo(() => {
    const result = { all: items.length } as Record<Category | "all", number>;
    (Object.keys(categoryLabels) as Array<Category | "all">).forEach((key) => {
      if (key !== "all") result[key] = items.filter((item) => item.category === key).length;
    });
    return result;
  }, []);

  const filterTags = useMemo(() => {
    const existing = new Set(items.flatMap((item) => item.tags));
    return priorityTags.filter((name) => existing.has(name));
  }, []);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return items.filter((item) => {
      if (category !== "all" && item.category !== category) return false;
      if (tag !== "all" && !item.tags.includes(tag)) return false;
      if (fidelity !== "all" && item.fidelity !== fidelity) return false;
      if (!keyword) return true;
      return [item.name, item.author, item.source, ...item.tags, ...item.dependencies].some((value) => value.toLowerCase().includes(keyword));
    });
  }, [category, fidelity, query, tag]);

  useEffect(() => {
    if (!selectedItem) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.setTimeout(() => closeRef.current?.focus(), 0);
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setSelectedItem(null);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      openerRef.current?.focus?.();
    };
  }, [selectedItem]);

  useEffect(() => {
    setSourceText("");
    setSourceLoading(false);
    setCopied(false);
  }, [selectedItem]);

  useEffect(() => {
    if (!selectedItem || detailTab !== "code" || sourceText || sourceLoading) return;
    void loadSource(selectedItem);
    // loadSource is intentionally driven by the current item/tab only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailTab, selectedItem]);

  async function loadSource(item: GalleryItem) {
    setSourceLoading(true);
    try {
      setSourceText(await getComponentSource(item.source));
    } finally {
      setSourceLoading(false);
    }
  }

  function openItem(item: GalleryItem, opener?: HTMLElement | null) {
    openerRef.current = opener ?? (document.activeElement as HTMLElement | null);
    setSelectedItem(item);
    setDetailTab("preview");
  }

  async function copySelectedSource() {
    if (!selectedItem) return;
    let source = sourceText;
    if (!source) {
      setSourceLoading(true);
      try {
        source = await getComponentSource(selectedItem.source);
        setSourceText(source);
      } finally {
        setSourceLoading(false);
      }
    }
    if (!source) return;
    try {
      await navigator.clipboard.writeText(source);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = source;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  function handleCardKeyDown(event: KeyboardEvent<HTMLElement>, item: GalleryItem) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    openItem(item, event.currentTarget);
  }

  function handleCardClick(event: MouseEvent<HTMLElement>, item: GalleryItem) {
    const target = event.target as HTMLElement;
    if (target.closest("button,a,input")) return;
    openItem(item, event.currentTarget);
  }

  return (
    <div className="design-library-app">
      <section className="design-filter-panel" aria-label="组件筛选">
        <div className="design-category-row" aria-label="按分类筛选">
          {(Object.keys(categoryLabels) as Array<Category | "all">).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={category === key}
              onClick={() => setCategory(key)}
            >
              <span>{categoryLabels[key]}</span>
              <em>{categoryCounts[key]}</em>
            </button>
          ))}
        </div>

        <div className="design-filter-tools">
          <div className="design-tag-filter" aria-label="按标签筛选">
            <span className="design-filter-label">Tag</span>
            <button type="button" aria-pressed={tag === "all"} onClick={() => setTag("all")}>全部</button>
            {filterTags.map((name) => (
              <button key={name} type="button" aria-pressed={tag === name} onClick={() => setTag(name)}>{name}</button>
            ))}
          </div>

          <label className="design-search">
            <span className="sr-only">搜索组件</span>
            <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.25"/><path d="m10.2 10.2 3.05 3.05"/></svg>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索名称、作者或 Tag" />
            {query ? <button type="button" onClick={() => setQuery("")} aria-label="清除搜索">×</button> : null}
          </label>
        </div>

        <div className="design-fidelity-filter" aria-label="按还原程度筛选">
          {(Object.keys(fidelityLabels) as Array<Fidelity | "all">).map((key) => (
            <button key={key} type="button" aria-pressed={fidelity === key} onClick={() => setFidelity(key)}>
              {key === "all" ? null : <FidelityMark fidelity={key} />}
              {fidelityLabels[key]}
            </button>
          ))}
          <span className="design-result-count">{filtered.length} / {items.length}</span>
        </div>
      </section>

      <p className="design-provenance-note">
        初始库存迁自 <a href="https://github.com/Tyr1onX/ui" target="_blank" rel="noreferrer">Tyr1onX/ui ↗</a>；新增库存继续保留第三方作者、21st.dev 链接、上游来源与 fidelity。
        <a href="https://github.com/Tyr1onX/Tyr1onX.github.io/blob/main/design-ui/THIRD_PARTY_COMPONENTS.md" target="_blank" rel="noreferrer">来源说明 ↗</a>
      </p>

      <section className="design-component-grid" aria-label="UI 组件列表">
        {filtered.map((item) => (
          <article
            key={item.id}
            className="design-component-card"
            role="button"
            tabIndex={0}
            aria-label={`查看 ${item.name} 组件详情`}
            onClick={(event) => handleCardClick(event, item)}
            onKeyDown={(event) => handleCardKeyDown(event, item)}
          >
            <LazyPreview item={item} />
            <div className="design-card-body">
              <div className="design-card-title-row">
                <div className="design-card-identity">
                  <h2>{item.name}</h2>
                  <p>@{item.author}</p>
                </div>
                <FidelityMark fidelity={item.fidelity} />
              </div>
              <div className="design-card-tags">{item.tags.map((name) => <span key={name}>{name}</span>)}</div>
              <button className="design-detail-link" type="button" onClick={(event) => openItem(item, event.currentTarget)}>查看详情 <span aria-hidden="true">→</span></button>
            </div>
          </article>
        ))}
      </section>

      {filtered.length === 0 ? <div className="design-empty">没有匹配的组件。</div> : null}

      {selectedItem ? (
        <div className="design-modal-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) setSelectedItem(null); }}>
          <section className="design-modal" role="dialog" aria-modal="true" aria-labelledby="design-modal-title">
            <header className="design-modal-header">
              <div>
                <div className="design-modal-title-line">
                  <h2 id="design-modal-title">{selectedItem.name}</h2>
                  <FidelityMark fidelity={selectedItem.fidelity} withText />
                </div>
                <p>@{selectedItem.author}</p>
              </div>
              <button ref={closeRef} className="design-modal-close" type="button" onClick={() => setSelectedItem(null)} aria-label="关闭详情">×</button>
            </header>

            <div className="design-modal-toolbar">
              <div className="design-modal-tabs" role="tablist" aria-label="预览和源码">
                <button type="button" role="tab" aria-selected={detailTab === "preview"} onClick={() => setDetailTab("preview")}>Preview</button>
                <button type="button" role="tab" aria-selected={detailTab === "code"} onClick={() => setDetailTab("code")}>Code</button>
              </div>
              <div className="design-modal-links">
                <button type="button" onClick={() => void copySelectedSource()} disabled={sourceLoading}>{copied ? "已复制" : sourceLoading ? "读取中…" : "Copy source"}</button>
                <a href={`https://github.com/Tyr1onX/Tyr1onX.github.io/blob/main/design-ui/${selectedItem.source}`} target="_blank" rel="noreferrer">库存源码 ↗</a>
                <a href={selectedItem.original} target="_blank" rel="noreferrer">21st.dev ↗</a>
                {selectedItem.originalSource ? <a href={selectedItem.originalSource} target="_blank" rel="noreferrer">Original source ↗</a> : null}
              </div>
            </div>

            <div className="design-modal-meta">
              <span>{categoryLabels[selectedItem.category]}</span>
              <span>visual: {selectedItem.visualWeight}</span>
              <span>runtime: {selectedItem.runtimeWeight}</span>
              {selectedItem.dependencies.length ? <span>deps: {selectedItem.dependencies.join(", ")}</span> : <span>deps: none</span>}
              {selectedItem.tags.map((name) => <em key={name}>{name}</em>)}
              <code>{selectedItem.source}</code>
            </div>

            {detailTab === "preview" ? (
              <div className="design-modal-preview"><DemoSurface item={selectedItem} className="design-demo-modal" /></div>
            ) : (
              <div className="design-modal-code">
                <div className="design-code-head"><span>{selectedItem.source}</span><button type="button" onClick={() => void copySelectedSource()}>{copied ? "已复制" : "复制"}</button></div>
                <pre><code>{sourceLoading ? "正在读取源码……" : sourceText || "未能载入该组件源码。"}</code></pre>
              </div>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}
