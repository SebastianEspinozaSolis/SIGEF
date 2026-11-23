// Genera la caché con los recursos reales de Vite, sin precargar las pantallas del ERP.
export default function gammaPwa() {
    return {
        name: 'gamma-pwa',
        generateBundle(_opciones, bundle) {
            const archivos = new Set(['/gamma/', '/gamma-icon.svg', '/gamma.webmanifest']);
            const visitar = archivo => {
                if (!archivo || archivos.has(`/${archivo}`)) return;
                archivos.add(`/${archivo}`);
                const chunk = bundle[archivo];
                if (chunk?.type !== 'chunk') return;
                chunk.imports.forEach(visitar);
                chunk.viteMetadata?.importedCss?.forEach(visitar);
                chunk.viteMetadata?.importedAssets?.forEach(visitar);
            };
            for (const chunk of Object.values(bundle)) {
                if (chunk.type === 'chunk' && (chunk.isEntry || chunk.facadeModuleId?.replaceAll('\\', '/').endsWith('/pages/gamma/PortalGamma.jsx'))) visitar(chunk.fileName);
            }
            const recursos = JSON.stringify([...archivos]);
            const version = [...archivos].join('|');
            let hash = 0;
            for (const caracter of version) hash = (Math.imul(31, hash) + caracter.charCodeAt(0)) | 0;
            this.emitFile({ type: 'asset', fileName: 'gamma-sw.js', source: `
const CACHE = 'sigef-gamma-${hash >>> 0}';
const RECURSOS = ${recursos};
self.addEventListener('install', evento => evento.waitUntil(caches.open(CACHE).then(cache => cache.addAll(RECURSOS))));
self.addEventListener('activate', evento => evento.waitUntil((async () => {
  for (const clave of await caches.keys()) if (clave.startsWith('sigef-gamma-') && clave !== CACHE) await caches.delete(clave);
  await self.clients.claim();
})()));
self.addEventListener('fetch', evento => {
  const url = new URL(evento.request.url);
  if (evento.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  const terreno = url.pathname === '/gamma' || url.pathname.startsWith('/gamma/');
  if (evento.request.mode === 'navigate' && terreno) {
    evento.respondWith(fetch(evento.request).catch(() => caches.open(CACHE).then(cache => cache.match('/gamma/'))));
  } else if (RECURSOS.includes(url.pathname)) {
    evento.respondWith(caches.open(CACHE).then(async cache => (await cache.match(evento.request)) || fetch(evento.request)));
  }
});` });
        },
    };
}
