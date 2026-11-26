/*
 * Preparación de Gamma como aplicación instalable y con acceso sin conexión.
 * En producción enlaza el manifiesto y registra el servicio de caché; esto no sincroniza por sí solo los formularios con el backend.
 */

export function prepararPwaGamma() {
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
    const enlace = document.createElement('link');
    enlace.rel = 'manifest';
    enlace.href = '/gamma.webmanifest';
    document.head.append(enlace);
    navigator.serviceWorker.register('/gamma-sw.js', { scope: '/' }).catch(error => {
        console.warn('No se pudo preparar el acceso sin conexión de terreno:', error.message);
    });
    return () => enlace.remove();
}
