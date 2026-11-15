const CACHE = "r-cultivos-cf70d190f8e3557b";
const BASE = new URL(self.registration.scope);
const archivos = ["data/sistemas_riego.json","assets/index-DHtSh25T.css","assets/index-4pLTU60U.js","index.html"].map((archivo) => new URL(archivo, BASE).href);
const inicio = new URL("index.html", BASE).href;

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      try {
        await cache.addAll(archivos);
      } catch (error) {
        await caches.delete(CACHE);
        throw error;
      }
    }),
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches.keys().then((nombres) =>
      Promise.all(
        nombres
          .filter((nombre) => nombre.startsWith("r-cultivos-") && nombre !== CACHE)
          .map((nombre) => caches.delete(nombre)),
      ),
    ),
  );
});

self.addEventListener("fetch", (evento) => {
  if (evento.request.method !== "GET") return;
  const url = new URL(evento.request.url);
  const esInicio = url.origin === BASE.origin &&
    (url.pathname === BASE.pathname || url.pathname === new URL(inicio).pathname);
  const recurso = esInicio ? inicio : url.href;
  if (!archivos.includes(recurso)) return;
  evento.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const respuesta = await cache.match(recurso);
      return respuesta || fetch(evento.request);
    }),
  );
});
