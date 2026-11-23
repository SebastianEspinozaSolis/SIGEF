// Guarda la firma como trazos (puntos del dibujo), sin convertirla en una imagen.
// El prefijo identifica el formato, su versión y la compresión utilizada.
const PREFIJO = 'sig:v1:gzip:';
const MAXIMO = 1024 * 1024; // Límite de 1 MiB para el contenido sin comprimir.

// Convierte los trazos de signature_pad y el tamaño del lienzo en texto para guardar o enviar.
// Recorrido: trazos -> JSON -> bytes UTF-8 -> gzip -> Base64 con prefijo.
// Comprimir reduce el tamaño; Base64 representa los bytes como texto. Ninguno cifra la firma.
export async function codificarFirma(trazos, ancho, alto) {
    // Rechaza firmas vacías y limita la captura a 200 trazos y 10.000 puntos en total.
    if (!trazos.length || trazos.length > 200 || trazos.some(t => !t.points?.length)
        || trazos.reduce((n,t) => n + t.points.length,0) > 10000) throw new Error('La firma está vacía o tiene demasiados trazos.');
    // Conserva las dimensiones originales para poder reconstruir el dibujo después.
    const json = JSON.stringify({version:1,ancho,alto,trazos});
    const contenido = new TextEncoder().encode(json);
    if (contenido.length > MAXIMO) throw new Error('La firma es demasiado grande. Vuelve a capturarla.');
    // Las APIs nativas del navegador comprimen los bytes; se admiten hasta 150 KiB comprimidos.
    const comprimido = new Uint8Array(await new Response(new Blob([contenido]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
    if (comprimido.length > 150 * 1024) throw new Error('La firma es demasiado grande. Vuelve a capturarla.');
    // btoa recibe una cadena de bytes. Se construye en bloques para no pasar demasiados argumentos.
    let binario = '';
    for (let i = 0; i < comprimido.length; i += 8192) binario += String.fromCharCode(...comprimido.subarray(i,i+8192));
    return PREFIJO + btoa(binario);
}

// Recupera { version, ancho, alto, trazos } desde el texto guardado; no dibuja la firma por sí sola.
// Recorrido inverso: quitar prefijo -> Base64 a bytes -> descomprimir gzip -> interpretar JSON.
export async function decodificarFirma(texto) {
    // Comprueba el formato y limita el tamaño del texto antes de intentar descomprimirlo.
    if (typeof texto !== 'string' || !texto.startsWith(PREFIJO) || texto.length > 205000) throw new Error('Formato de firma inválido.');
    const bytes = Uint8Array.from(atob(texto.slice(PREFIJO.length)), c => c.charCodeAt(0));
    const lector = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')).getReader();
    const partes = [];
    let total = 0;
    // Lee por partes para detener la descompresión si supera 1 MiB, aunque el archivo comprimido sea pequeño.
    try {
        for (;;) {
            const {done,value} = await lector.read();
            if (done) break;
            total += value.length;
            if (total > MAXIMO) throw new Error('La firma es demasiado grande.');
            partes.push(value);
        }
    } finally { await lector.cancel(); } // Libera el lector incluso si se produce un error.
    const datos = JSON.parse(await new Blob(partes).text());
    // Valida versión, dimensiones y presencia de trazos antes de devolver los datos a la interfaz.
    if (datos.version !== 1 || !Number.isFinite(datos.ancho) || datos.ancho <= 0 || !Number.isFinite(datos.alto)
        || datos.alto <= 0 || !Array.isArray(datos.trazos) || !datos.trazos.length) throw new Error('Firma inválida.');
    return datos;
}
