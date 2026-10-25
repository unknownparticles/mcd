/* 麦门今日签 · Service Worker
   目标：装到桌面后秒开、断网也能抽签（签文与卡面全在本地算），API 与第三方请求一律不缓存。
   策略：
   - 导航请求：网络优先，失败回落缓存的 index.html（离线壳）
   - 同源静态资源：缓存优先 + 后台更新（bo 卡面 50 张按需缓存）
   - /api/* 与跨域（菜单图、二维码、DeepSeek）：直连，不拦截、不缓存
*/
const VERSION = "mcd-sign-v3";
const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./assets/qimen.js",
  "./assets/share/bg.svg",
  "./assets/share/arches.svg",
  "./assets/share/seal.svg",
  "./assets/share/lantern.svg",
  "./assets/share/fries.svg",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png",
  "./apple-touch-icon.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(VERSION)
      .then((c) => c.addAll(SHELL).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (e) => {
  if (e.data === "skip-waiting") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== location.origin) return;                  // 第三方直连
  if (url.pathname.includes("/api/")) return;                  // 接口绝不缓存

  // 页面导航：网络优先（保证发版后能拿到新版），断网回落到离线壳
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put("./index.html", copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match("./index.html").then((r) => r || caches.match("./")))
    );
    return;
  }

  // 静态资源：缓存优先 + 后台刷新
  event.respondWith(
    caches.match(req).then((hit) => {
      const fetching = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => hit);
      return hit || fetching;
    })
  );
});
