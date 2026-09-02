import React, {
  Component,
  Suspense,
  lazy,
  memo,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type CSSProperties,
  type ReactNode,
} from "react";
import { getComponentSource } from "./component-sources";
import {
  categoryLabels,
  items,
  type Category,
  type GalleryItem,
} from "./gallery-data";

type DetailTab = "preview" | "code";
type DemoModule = { default: ComponentType };
type VisibilityCallback = (visible: boolean) => void;

const PRELOAD_MARGIN = "1500px 0px";
const MEDIUM_PRELOAD_MARGIN = "900px 0px";
const MOUNT_MARGIN = "560px 0px";
const MAX_PRELOAD_CONCURRENCY = 2;
const PRELOAD_BATCH_GAP = 3000;
const demoModuleCache = new Map<string, Promise<DemoModule>>();
const queuedPreloads = new Set<string>();
const preloadQueue: GalleryItem[] = [];
let activePreloads = 0;
let preloadDrainScheduled = false;

function loadDemoModule(item: GalleryItem) {
  const cached = demoModuleCache.get(item.id);
  if (cached) return cached;
  const promise = item.loadDemo();
  demoModuleCache.set(item.id, promise);
  return promise;
}

function schedulePreloadDrain() {
  if (preloadDrainScheduled || !preloadQueue.length || document.hidden) return;
  preloadDrainScheduled = true;
  const run = () => {
    preloadDrainScheduled = false;
    while (activePreloads < MAX_PRELOAD_CONCURRENCY && preloadQueue.length && !document.hidden) {
      const item = preloadQueue.shift();
      if (!item) break;
      queuedPreloads.delete(item.id);
      activePreloads += 1;
      void loadDemoModule(item).finally(() => {
        activePreloads -= 1;
        if (activePreloads === 0 && preloadQueue.length && !document.hidden) {
          globalThis.setTimeout(schedulePreloadDrain, PRELOAD_BATCH_GAP);
        }
      });
    }
  };
  const requestIdle = (window as Window & { requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number }).requestIdleCallback;
  if (requestIdle) requestIdle(run, { timeout: 900 });
  else globalThis.setTimeout(run, 120);
}

function queueDemoPreload(item: GalleryItem) {
  if (item.heavy || demoModuleCache.has(item.id) || queuedPreloads.has(item.id)) return;
  queuedPreloads.add(item.id);
  preloadQueue.push(item);
  schedulePreloadDrain();
}

type ObserverBucket = {
  observer: IntersectionObserver;
  callbacks: Map<Element, VisibilityCallback>;
};
const observerBuckets = new Map<string, ObserverBucket>();

function observeWithMargin(element: Element, rootMargin: string, callback: VisibilityCallback) {
  if (!("IntersectionObserver" in window)) {
    callback(true);
    return () => {};
  }
  let bucket = observerBuckets.get(rootMargin);
  if (!bucket) {
    const callbacks = new Map<Element, VisibilityCallback>();
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => callbacks.get(entry.target)?.(entry.isIntersecting));
    }, { rootMargin });
    bucket = { observer, callbacks };
    observerBuckets.set(rootMargin, bucket);
  }
  bucket.callbacks.set(element, callback);
  bucket.observer.observe(element);
  return () => {
    bucket?.observer.unobserve(element);
    bucket?.callbacks.delete(element);
  };
}

function previewStyle(item: GalleryItem) {
  return {
    "--preview-min-height": `${item.previewHeight ?? 300}px`,
    "--preview-min-width": `${item.previewMinWidth ?? 0}px`,
  } as CSSProperties;
}

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
  const Demo = useMemo(() => lazy(() => loadDemoModule(item)), [item]);
  const style = previewStyle(item);
  return (
    <div className={`design-demo-surface ${className}`} data-preview-tone={item.previewTone ?? "inherit"} style={style}>
      <PreviewBoundary>
        <Suspense fallback={<PreviewLoading />}>
          <Demo />
        </Suspense>
      </PreviewBoundary>
    </div>
  );
}

const LazyPreview = memo(function LazyPreview({ item, pageVisible }: { item: GalleryItem; pageVisible: boolean }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [nearViewport, setNearViewport] = useState(false);
  const [activated, setActivated] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    return observeWithMargin(host, MOUNT_MARGIN, setNearViewport);
  }, [item.id]);

  useEffect(() => {
    if (item.heavy || !pageVisible) return;
    const host = hostRef.current;
    if (!host) return;
    const preloadMargin = item.runtimeWeight === "light" ? PRELOAD_MARGIN : MEDIUM_PRELOAD_MARGIN;
    return observeWithMargin(host, preloadMargin, (near) => {
      if (near) queueDemoPreload(item);
    });
  }, [item, pageVisible]);

  const shouldMount = pageVisible && nearViewport && (!item.heavy || activated);
  const showHeavyButton = item.heavy && !activated;

  return (
    <div
      className="design-card-preview"
      ref={hostRef}
      style={previewStyle(item)}
      data-preview-mounted={shouldMount ? "true" : "false"}
      data-preview-activated={activated ? "true" : "false"}
    >
      {showHeavyButton ? (
        <button
          className="design-heavy-load"
          type="button"
          onClick={() => {
            setActivated(true);
            setNearViewport(true);
            void loadDemoModule(item);
          }}
        >
          <span>重型预览</span>
          点击加载
        </button>
      ) : shouldMount ? (
        <DemoSurface item={item} />
      ) : (
        <div className="design-preview-idle"><span>{item.name}</span></div>
      )}
    </div>
  );
});

export default function App() {
  const [category, setCategory] = useState<Category | "all">("all");
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [pageVisible, setPageVisible] = useState(() => !document.hidden);
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

  const filtered = useMemo(() => {
    const keyword = deferredQuery.trim().toLowerCase();
    return items.filter((item) => {
      if (category !== "all" && item.category !== category) return false;
      if (!keyword) return true;
      return [item.name, item.author, item.source, ...item.tags, ...item.dependencies].some((value) => value.toLowerCase().includes(keyword));
    });
  }, [category, deferredQuery]);

  useEffect(() => {
    const syncVisibility = () => {
      const visible = !document.hidden;
      setPageVisible(visible);
      if (visible) schedulePreloadDrain();
    };
    document.addEventListener("visibilitychange", syncVisibility);
    return () => document.removeEventListener("visibilitychange", syncVisibility);
  }, []);

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
          <label className="design-search">
            <span className="sr-only">搜索组件</span>
            <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.25"/><path d="m10.2 10.2 3.05 3.05"/></svg>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索组件或作者" />
            {query ? <button type="button" onClick={() => setQuery("")} aria-label="清除搜索">×</button> : null}
          </label>
        </div>
      </section>

      <section className="design-component-grid" aria-label="UI 组件列表">
        {filtered.map((item) => (
          <article
            key={item.id}
            className="design-component-card"
            data-component={item.id}
            data-wide={item.previewWide ? "true" : "false"}
          >
            <div className="design-card-body">
              <div className="design-card-title-row">
                <div className="design-card-identity">
                  <h2>{item.name}</h2>
                  <p>@{item.author}</p>
                </div>
              </div>
              <button className="design-detail-link" type="button" onClick={(event) => openItem(item, event.currentTarget)}>查看详情 <span aria-hidden="true">→</span></button>
            </div>
            <LazyPreview item={item} pageVisible={pageVisible} />
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
                <a href={selectedItem.original} target="_blank" rel="noreferrer">{selectedItem.originalLabel ?? (selectedItem.original.includes("21st.dev") ? "21st.dev" : "原始演示")} ↗</a>
                {selectedItem.originalSource ? <a href={selectedItem.originalSource} target="_blank" rel="noreferrer">上游源码 ↗</a> : null}
              </div>
            </div>

            <div className="design-modal-meta">
              <span>{categoryLabels[selectedItem.category]}</span>
              {selectedItem.dependencies.length ? <span>依赖：{selectedItem.dependencies.join(", ")}</span> : <span>无额外依赖</span>}
              {selectedItem.license ? <span>{selectedItem.license}</span> : null}
              <code>{selectedItem.source}</code>
            </div>

            {detailTab === "preview" ? (
              <div className="design-modal-preview">{pageVisible ? <DemoSurface item={selectedItem} className="design-demo-modal" /> : <div className="design-preview-idle"><span>预览已暂停</span></div>}</div>
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
