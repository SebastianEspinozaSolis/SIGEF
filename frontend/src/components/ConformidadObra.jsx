/*
 * Consulta y muestra en el ERP la firma de conformidad guardada para una obra.
 * Recupera los trazos comprimidos o la imagen anterior y los presenta sin permitir editar la firma.
 */

import { useEffect, useState } from 'react';
import SignaturePad from 'signature_pad';
import useRegistro from '../hooks/useRegistro';
import { decodificarFirma } from '../utils/firmas';

function FirmaGuardada({ texto }) {
    const [resultado, setResultado] = useState(null);
    useEffect(() => {
        let vigente = true;
        // Se dibuja en un lienzo auxiliar; la imagen visible no permite editar la firma.
        async function dibujar() {
            if (texto.startsWith('data:image/png;base64,')) return texto;
            const datos = await decodificarFirma(texto);
            const canvas = document.createElement('canvas');
            const escala = Math.min(1, 900 / datos.ancho, 400 / datos.alto);
            canvas.width = Math.max(1, Math.round(datos.ancho * escala));
            canvas.height = Math.max(1, Math.round(datos.alto * escala));
            const pad = new SignaturePad(canvas);
            pad.off();
            pad.fromData(datos.trazos.map(t => ({ ...t, points: t.points.map(p => ({ ...p, x: p.x * escala, y: p.y * escala })) })));
            return canvas.toDataURL('image/png');
        }
        dibujar().then(imagen => { if (vigente) setResultado({ imagen }); })
            .catch(() => { if (vigente) setResultado({ error: true }); });
        return () => { vigente = false; };
    }, [texto]);
    if (!resultado) return <p role="status">Preparando firma…</p>;
    if (resultado.error) return <p role="alert">No se pudo mostrar la firma de conformidad registrada.</p>;
    return <img src={resultado.imagen} alt="Firma de conformidad del cliente con el trabajo realizado" style={{ maxWidth: '100%', height: 'auto', background: '#fff', border: '1px solid #64748b' }} />;
}

export default function ConformidadObra({ id }) {
    const { datos, error, cargando, recargar } = useRegistro(`/api/obras/${id}/firma`);
    return <section aria-label="Conformidad del cliente">
        <h2>Conformidad del cliente</h2>
        {cargando ? <p role="status">Cargando conformidad…</p>
            : error ? <p role="alert">No se pudo cargar la firma. <button type="button" onClick={recargar}>Reintentar</button></p>
                : datos?.firma_conformidad ? <FirmaGuardada key={datos.firma_conformidad} texto={datos.firma_conformidad} />
                    : <p>Sin firma de conformidad registrada.</p>}
    </section>;
}
