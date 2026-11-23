const { gunzipSync } = require('node:zlib');
const ErrorHttp = require('./ErrorHttp');
const PREFIJO = 'sig:v1:gzip:';

function validarFirma(valor, opcional = false) {
    if (opcional && (valor == null || valor === '')) return null;
    const fallar = () => { throw new ErrorHttp(400, 'La firma está dañada o supera el tamaño permitido. Vuelve a capturarla.'); };
    if (typeof valor !== 'string' || valor.length > 205000) return fallar();
    try {
        // Compatibilidad con firmas anteriores: no altera operaciones que ya tenían un UUID.
        const anterior = valor.startsWith('data:image/png;base64,');
        if (!anterior && !valor.startsWith(PREFIJO)) return fallar();
        const texto = valor.slice(anterior ? 22 : PREFIJO.length);
        if (!/^[A-Za-z0-9+/]+={0,2}$/.test(texto)) return fallar();
        const contenido = Buffer.from(texto, 'base64');
        if (contenido.length > 150 * 1024 || contenido.toString('base64') !== texto) return fallar();
        if (anterior) {
            if (contenido.length < 24 || contenido.subarray(0,8).toString('hex') !== '89504e470d0a1a0a') return fallar();
            return valor;
        }
        // El límite también se aplica al descomprimir, antes de interpretar el JSON.
        const d = JSON.parse(gunzipSync(contenido, { maxOutputLength: 1024 * 1024 }).toString('utf8'));
        const objeto = x => x && typeof x === 'object' && !Array.isArray(x);
        const numero = (x, min, max) => typeof x === 'number' && Number.isFinite(x) && x >= min && x <= max;
        const claves = (x, nombres) => objeto(x) && Object.keys(x).every(k => nombres.includes(k));
        if (!claves(d,['version','ancho','alto','trazos']) || d.version !== 1 || !numero(d.ancho,1,4096) || !numero(d.alto,1,4096)
            || !Array.isArray(d.trazos) || !d.trazos.length || d.trazos.length > 200) return fallar();
        let puntos = 0;
        for (const trazo of d.trazos) {
            if (!claves(trazo,['penColor','dotSize','minWidth','maxWidth','velocityFilterWeight','compositeOperation','points'])
                || trazo.penColor !== '#172b42' || trazo.compositeOperation !== 'source-over'
                || !numero(trazo.dotSize,0,100) || !numero(trazo.minWidth,0,100) || !numero(trazo.maxWidth,trazo.minWidth,100)
                || !numero(trazo.velocityFilterWeight,0,1) || !Array.isArray(trazo.points) || !trazo.points.length) return fallar();
            puntos += trazo.points.length;
            if (puntos > 10000) return fallar();
            for (const p of trazo.points) {
                if (!claves(p,['x','y','time','pressure']) || !numero(p.x,-4096,8192) || !numero(p.y,-4096,8192)
                    || !numero(p.time,0,Number.MAX_SAFE_INTEGER) || !numero(p.pressure,0,1)) return fallar();
            }
        }
        return valor;
    } catch { return fallar(); }
}
module.exports = { validarFirma };
