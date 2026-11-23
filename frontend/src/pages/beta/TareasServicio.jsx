import '../alpha/alpha.css';
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import useListado from '../../hooks/useListado';
import Paginacion from '../../components/Paginacion';
import { pesos } from '../../utils/importes';

export default function TareasServicio() {
    const navigate = useNavigate();
    const [parametros] = useSearchParams();
    const categoria = parametros.get('categoria');
    const nombre = parametros.get('nombre');
    const contexto = categoria ? `?${new URLSearchParams({categoria,...(nombre ? {nombre} : {})})}` : '';
    const filtros = new URLSearchParams();
    if (categoria) filtros.set('id_categoria_servicio',categoria);
    const [activo, setActivo] = useState('');
    if (activo) filtros.set('activo',activo);
    const { datos, error, cargando, recargar, q, buscar, pagina, setPagina } = useListado(`/api/tareas-servicio?${filtros}`);
    return <section className="alpha"><h1>Tareas de servicio{categoria && nombre ? `: ${nombre}` : ''}</h1>
        <p><Link to="/">Menú principal</Link> · <Link to="/beta/presupuestos">Presupuestos</Link> · <Link to="/beta/categorias-servicio">Categorías de servicio</Link></p>
        <h2>Registros</h2><div className="alpha-filtros">
            <label>Buscar tarea <input type="search" maxLength={150} value={q} onChange={e => buscar(e.target.value)} /></label>
            <button type="button" style={{ alignSelf: 'flex-end' }} onClick={() => navigate(`/beta/tareas-servicio/nuevo${contexto}`)}>Nueva tarea</button>
            <label>Estado <select value={activo} onChange={e => { setActivo(e.target.value); setPagina(1); }}><option value="">Todos</option><option value="true">Activo</option><option value="false">Inactivo</option></select></label>
        </div>
        {error && <p role="alert">{error.message} <button onClick={recargar}>Reintentar</button></p>}
        {cargando && <p role="status">Cargando tareas…</p>}
        {datos && <><p>{datos.total} registros encontrados</p><div className="alpha-tabla"><table><caption>Catálogo de tareas</caption><thead><tr><th>Tarea</th><th>Precio neto (CLP)</th><th>Estado</th><th>Acciones</th></tr></thead>
            <tbody>{datos.registros.map(t => <tr key={t.id_tarea}><td>{t.nombre_tarea}</td><td>{pesos(t.precio_neto)}</td><td>{t.activo ? 'Activo' : 'Inactivo'}</td><td><button onClick={() => navigate(`/beta/tareas-servicio/${t.id_tarea}/editar${contexto}`)}>Editar</button></td></tr>)}</tbody>
        </table></div>{!datos.total && <p>No hay tareas registradas.</p>}
            <Paginacion pagina={pagina} limite={datos.limite} total={datos.total} setPagina={setPagina} />
        </>}
    </section>;
}
