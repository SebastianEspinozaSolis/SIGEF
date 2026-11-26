/*
 * Listado de obras para consultar su estado y abrir su seguimiento.
 * Desde aquí se accede a nuevas obras y al detalle de las existentes, manteniendo búsqueda y páginas.
 */

import Paginacion from '../../components/Paginacion';
import '../alpha/alpha.css';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useListado from '../../hooks/useListado';

export default function Obras() {
    const navigate = useNavigate();
    const [estado, setEstado] = useState('');
    const { datos, error, cargando, recargar, q, buscar, pagina, setPagina } = useListado(`/api/obras?estado=${encodeURIComponent(estado)}`);
    return <section className="alpha"><h1>Obras</h1>
        <p><Link to="/">Menú principal</Link> · <Link to="/beta/obras/nuevo">Nueva obra</Link> · <Link to="/beta/presupuestos">Presupuestos</Link> · <Link to="/beta/categorias-servicio">Categorías de servicio</Link></p>
        <h2>Registros</h2>
        <div className="alpha-filtros"><label>Buscar obra o cliente <input type="search" value={q} onChange={e => buscar(e.target.value)} /></label>
        <label>Estado <select value={estado} onChange={e => { setEstado(e.target.value); setPagina(1); }}><option value="">Todos</option>
            {['En proceso', 'Suspendida', 'Cancelada', 'Finalizada'].map(e => <option key={e}>{e}</option>)}
        </select></label></div>
        {error && <p role="alert">{error.message} <button onClick={recargar}>Reintentar</button></p>}
        {cargando && <p role="status">Cargando…</p>}
        {datos && <><p>{datos.total} registros encontrados</p><div className="alpha-tabla"><table><caption>Obras registradas</caption><thead><tr><th>Nombre</th><th>Cliente</th><th>Servicio</th><th>Técnico</th><th>Estado</th><th>Acciones</th></tr></thead>
            <tbody>{datos.registros.map(o => <tr key={o.id_obra}><td>{o.nombre_obra}</td><td>{o.razon_social}</td><td>{o.nombre_servicio}</td><td>{o.tecnico}</td><td>{o.estado}{o.estado==='En proceso' && o.tareas_completadas && <p><strong>Tareas completadas: revisar y finalizar</strong></p>}</td>
                <td><button type="button" onClick={() => navigate(`/beta/obras/${o.id_obra}`)}>Ver obra</button>{['En proceso', 'Suspendida'].includes(o.estado) && <> · <button type="button" onClick={() => navigate(`/beta/obras/${o.id_obra}/editar`)}>Editar</button></>}</td>
            </tr>)}</tbody></table></div>
            {!datos.total && <p>No hay obras.</p>}
            <Paginacion pagina={pagina} limite={datos.limite} total={datos.total} setPagina={setPagina} etiqueta="Paginación" />
        </>}
    </section>;
}
