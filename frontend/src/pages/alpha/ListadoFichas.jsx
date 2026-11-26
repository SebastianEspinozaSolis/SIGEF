/*
 * Listado compartido para consultar clientes, proveedores o categorías de artículos.
 * El tipo de ficha determina las columnas y los enlaces de creación o edición; mantiene búsqueda y páginas.
 */

import { useEffect, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { api } from '../../api/cliente';
import { fichas, areasCliente, camposBanco } from './configuracionFichas';
import './alpha.css';

export default function ListadoFichas({ tipo }) {
    const location = useLocation();
    const [parametros, setParametros] = useSearchParams();
    const busqueda = parametros.get('q') || '';
    const paginaEntrada = Number(parametros.get('pagina') || 1);
    const pagina = Number.isSafeInteger(paginaEntrada) && paginaEntrada > 0 ? paginaEntrada : 1;
    const { titulo, id, campos } = fichas[tipo];
    const base = `/alpha/${tipo}`;
    const [datos, setDatos] = useState({ registros: [], total: 0 });
    const [cargando, setCargando] = useState(true);
    const [errorListado, setErrorListado] = useState('');
    const [version, setVersion] = useState(0);
    function cambiarConsulta(q, pagina) {
        setCargando(true);
        setParametros({ q, pagina: String(pagina) }, { replace: true });
    }
    useEffect(() => {
        let vigente = true;
        const temporizador = setTimeout(() => {
            api(`/api/${tipo}?${new URLSearchParams({ q: busqueda, pagina })}`)
                .then((r) => { if (vigente) { setDatos(r); setErrorListado(''); } })
                .catch((err) => { if (vigente) setErrorListado(err.message); })
                .finally(() => { if (vigente) setCargando(false); });
        }, 250);
        return () => { vigente = false; clearTimeout(temporizador); };
    }, [tipo, busqueda, pagina, version]);
    return <section className="alpha">
        <Link to="/">Volver al inicio</Link>
        <h1>{titulo}</h1>
        {location.state?.mensaje && <p role="status">{location.state.mensaje}</p>}
        <Link to={`${base}/nuevo${location.search}`}>{tipo === 'proveedores' ? 'Nuevo proveedor' : 'Nuevo cliente'}</Link>
            <h2>Registros</h2>
            <label>Buscar {tipo === 'categorias' ? 'por nombre' : 'por RUT o razón social'}
                <input type="search" maxLength={150} value={busqueda}
                    onChange={(e) => { cambiarConsulta(e.target.value, 1); }} />
            </label>
            {errorListado && <p role="alert">No se pudo cargar el listado: {errorListado}
                <button onClick={() => setVersion((valor) => valor + 1)}>Reintentar</button></p>}
            {cargando ? <p role="status">Cargando…</p> : !errorListado && <>
                <p>{datos.total} registros encontrados</p>
                <div className="alpha-tabla"><table>
                    <thead><tr>{campos.map(([campo, etiqueta]) => <th key={campo}>{etiqueta}</th>)}{tipo === 'proveedores' && <th>Ejecutivos comerciales</th>}
                        {tipo === 'proveedores' && <th>Cuentas bancarias</th>}
                        {tipo === 'clientes' && areasCliente.map(([lista, tituloArea]) => <th key={lista}>{tituloArea}</th>)}<th>Acciones</th></tr></thead>
                    <tbody>{datos.registros.map((registro) => <tr key={registro[id]}>
                        {campos.map(([campo]) => <td key={campo}>{registro[campo === 'id_region' ? 'region' : campo === 'id_comuna' ? 'comuna' : campo] || '—'}</td>)}
                        {tipo === 'proveedores' && <td>{registro.ejecutivos?.length ? <ul>
                            {registro.ejecutivos.map((e) => <li key={e.id_ejecutivo}>{e.nombre} — {e.rut} — {e.cargo} — {e.email} — {e.telefono}</li>)}
                        </ul> : 'Sin ejecutivos'}</td>}
                        {tipo === 'proveedores' && <td>{registro.cuentas_bancarias?.length ? <ul>{registro.cuentas_bancarias.map((cuenta) =>
                            <li key={cuenta.id_datos_bancarios}><strong>{cuenta.activo ? 'Activa' : 'Inactiva'}</strong>
                                <dl>{camposBanco.map(([campo, etiqueta]) => <div key={campo}><dt>{etiqueta}</dt><dd>{cuenta[campo]}</dd></div>)}</dl>
                            </li>)}</ul> : 'Sin cuentas bancarias'}</td>}
                        {tipo === 'clientes' && areasCliente.map(([lista]) => <td key={lista}>{registro[lista]?.length ? <ul>
                            {registro[lista].map((c) => <li key={c.id_contacto}>{c.nombre} — {c.rut} — {c.cargo} — {c.email} — {c.telefono}</li>)}
                        </ul> : 'Sin contactos'}</td>)}
                        <td><Link to={`${base}/${registro[id]}/editar${location.search}`}>Editar</Link>{tipo === 'proveedores' && <> <Link to={`/alpha/proveedores/${registro[id]}/documentos/nuevo`}>Crear documento</Link> <Link to={`/alpha/proveedores/${registro[id]}/documentos`}>Documentos</Link></>}</td>
                    </tr>)}</tbody>
                </table></div>
                {datos.registros.length === 0 && <p>No hay registros para esta búsqueda.</p>}
                <nav aria-label="Paginación">
                    <button disabled={pagina <= 1} onClick={() => { cambiarConsulta(busqueda, pagina - 1); }}>Anterior</button>
                    <span>Página {pagina}</span>
                    <button disabled={pagina * datos.limite >= datos.total} onClick={() => { cambiarConsulta(busqueda, pagina + 1); }}>Siguiente</button>
                </nav>
            </>}
    </section>;
}
