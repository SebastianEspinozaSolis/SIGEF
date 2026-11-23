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
