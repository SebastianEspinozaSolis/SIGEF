import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../api/cliente';
import ErrorCarga from '../../components/ErrorCarga';
import './alpha.css';

import { tiposDocumento } from './configuracionFichas';
export default function DocumentosProveedor() {
    const { proveedor } = useParams();
    const [resultado, setResultado] = useState(null);
    const [pagina, setPagina] = useState(1);
    const [version, setVersion] = useState(0);
    const clave = `${proveedor}-${pagina}-${version}`;
    useEffect(() => {
        let vigente = true;
        Promise.all([api(`/api/proveedores/${proveedor}`), api(`/api/documentos-proveedor/${proveedor}?pagina=${pagina}`)])
            .then(([ficha, datos]) => { if (vigente) setResultado({ clave, ficha, datos }); })
            .catch((err) => { if (vigente) setResultado({ clave, error: err }); });
        return () => { vigente = false; };
    }, [proveedor, pagina, version, clave]);
    return <section className="alpha">
        <Link to="/alpha/proveedores">Volver a proveedores</Link><h1>Documentos del proveedor</h1>
        {resultado?.clave !== clave ? <p role="status">Cargando…</p> : resultado.error ? <ErrorCarga error={resultado.error} noEncontrado="Proveedor no encontrado."
            volver="/alpha/proveedores" etiqueta="Volver a proveedores" reintentar={() => setVersion((v) => v + 1)} /> : <>
            <Link to={`/alpha/proveedores/${proveedor}/documentos/nuevo`}>Crear documento</Link>
            <h2>{resultado.ficha.razon_social} — {resultado.ficha.rut_proveedor}</h2>
            <table><thead><tr><th>Fecha de registro</th><th>Tipo</th><th>Número</th><th>Total</th><th>Acciones</th></tr></thead>
                <tbody>{resultado.datos.registros.map((d) => <tr key={d.id_documento}>
                    <td>{new Date(d.fecha_ingreso).toLocaleString('es-CL', { timeZone: 'America/Santiago' })}</td><td>{tiposDocumento.find(([valor]) => valor === d.tipo_documento)?.[1] || d.tipo_documento}</td>
                    <td>{d.folio}</td><td>{d.total}</td>
                    <td><Link to={`/alpha/proveedores/${proveedor}/documentos/${d.id_documento}/comprobante`}>Ver comprobante</Link>{' · '}
                        <Link to={`/alpha/proveedores/${proveedor}/documentos/${d.id_documento}/editar`}>Editar documento</Link></td>
                </tr>)}</tbody></table>
            {!resultado.datos.registros.length && <p>No hay documentos registrados.</p>}
            <nav aria-label="Páginas de documentos"><button disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>Anterior</button>
                <span>Página {pagina}</span><button disabled={pagina * resultado.datos.limite >= resultado.datos.total} onClick={() => setPagina((p) => p + 1)}>Siguiente</button></nav>
        </>}
    </section>;
}
