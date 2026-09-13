// ============================================================
// sw.js — service worker mínimo: solo existe para que el sitio sea
// instalable como app (ícono en el escritorio/celular, se abre sin
// barra de navegador) y para que la "cáscara" de la app (html/css/js
// propios + íconos) siga disponible un instante sin conexión.
//
// A propósito NO cachea nada de Firestore/Firebase Auth: los pedidos
// tienen que verse siempre actualizados, así que cualquier pedido de
// datos va directo a la red. Si en algún momento se suman archivos
// nuevos al sitio, conviene subir CACHE_VERSION para que los
// dispositivos que ya instalaron la app bajen la versión nueva.
// ============================================================

const CACHE_VERSION = "v1";
const CACHE_NAME = `mqb-shell-${CACHE_VERSION}`;

const ARCHIVOS_CASCARA = [
  "/",
  "/index.html",
  "/central.html",
  "/sucursal.html",
  "/estilos.css",
  "/ui.js",
  "/avisos.js",
  "/firebase-config.js",
  "/manifest.json",
  "/192.png",
  "/512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // addAll aborta todo si un solo archivo falla, así que se agregan
      // de a uno y se ignora el que no se pudo (por ejemplo, en un
      // entorno de pruebas donde falte algún ícono).
      Promise.all(
        ARCHIVOS_CASCARA.map((archivo) =>
          cache.add(archivo).catch(() => {})
        )
      )
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((nombres) =>
      Promise.all(
        nombres
          .filter((nombre) => nombre !== CACHE_NAME)
          .map((nombre) => caches.delete(nombre))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Solo GET, y solo mismo origen: todo lo de Firebase (Auth/Firestore,
  // gstatic) y el script de Tailwind por CDN se dejan pasar directo a la
  // red, sin tocar. Es la app propia (html/css/js/íconos) la única que
  // pasa por esta estrategia de caché.
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) {
    return;
  }

  // Network-first: siempre intenta traer la versión más nueva; si no hay
  // conexión, cae a lo último que quedó guardado. Así un pedido de
  // sucursal nunca se queda mirando una versión vieja de la página por
  // culpa de la caché, pero la app igual abre (aunque sea con datos
  // desactualizados) si el dispositivo se queda sin señal.
  event.respondWith(
    fetch(request)
      .then((respuesta) => {
        const copia = respuesta.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copia));
        return respuesta;
      })
      .catch(() => caches.match(request).then((r) => r || caches.match("/index.html")))
  );
});