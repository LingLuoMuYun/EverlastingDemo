// 简易内存缓存（仅服务端使用；小站可不用，文章多时可启用）
const cache = new Map<string, { data: unknown; timestamp: number }>();
const TTL = 60 * 1000;

export function getCached<T>(key: string, fetcher: () => T): T {
  // 开发环境下路由模块各自实例化，模块级 Map 不共享会导致写入后读到旧数据，
  // 因此 dev 直接读磁盘；生产（只读部署）保留 TTL 缓存
  if (process.env.NODE_ENV !== "production") return fetcher();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.timestamp < TTL) return hit.data as T;
  const data = fetcher();
  cache.set(key, { data, timestamp: Date.now() });
  return data;
}

/** 编辑器写入后必须调用，避免"保存了前台看不到" */
export function clearCache(key?: string) {
  if (key) {
    cache.delete(key);
  } else {
    cache.clear();
  }
}
