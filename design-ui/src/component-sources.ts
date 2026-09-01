const sourceCache = new Map<string, string>();

export async function getComponentSource(path: string) {
  if (sourceCache.has(path)) return sourceCache.get(path) ?? "";
  const response = await fetch(`./design-ui/${path}`, { cache: "force-cache" });
  if (!response.ok) return "";
  const source = await response.text();
  sourceCache.set(path, source);
  return source;
}
