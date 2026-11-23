import { pesos } from '../../utils/importes';
import Paginacion from '../../components/Paginacion';
import '../alpha/alpha.css';
import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import useListado from '../../hooks/useListado';

export default function Presupuestos() {
    const navigate = useNavigate();
    const [estado, setEstado] = useState('');
    const { datos, error, cargando, recargar, q, buscar, pagina, setPagina } = useListado(`/api/presupuestos?estado=${encodeURIComponent(estado)}`);
    return <section className="alpha">
        <h1>Presupuestos</h1>
        <p><Link to="/beta/categorias-servicio">Categorías de servicio y tareas</Link></p>
        <p><Link to="/">Menú principal</Link> · <Link to="/beta/presupuestos/nuevo">Nuevo presupuesto</Link> · <Link to="/beta/obras">Obras</Link></p>
        <h2>Registros</h2>
        <div className="alpha-filtros"><label>Buscar cliente o presupuesto <input type="search" value={q} onChange={e => buscar(e.target.value)} /></label>
        <label>Estado <select value={estado} onChange={e => { setEstado(e.target.value); setPagina(1); }}>
            <option value="">Todos</option>{['Pendiente', 'Aprobado', 'Rechazado'].map(e => <option key={e}>{e}</option>)}
        </select></label></div>
        {error && <p role="alert">{error.message} <button onClick={recargar}>Reintentar</button></p>}
        {cargando && <p role="status">Cargando…</p>}
        {datos && <><p>{datos.total} registros encontrados</p><div className="alpha-tabla"><table><caption>Presupuestos registrados</caption><thead><tr><th>Número</th><th>Cliente</th><th>Monto total (CLP)</th><th>Estado</th><th>Acciones</th></tr></thead>
            <tbody>{datos.registros.map(p => <tr key={p.id_presupuesto}>
                <td>{p.id_presupuesto}</td><td>{p.razon_social}</td><td>{pesos(p.monto_total)}</td><td>{p.estado}</td>
                <td><button type="button" onClick={() => navigate(`/beta/presupuestos/${p.id_presupuesto}`)}>{p.estado === 'Pendiente' ? 'Ver / editar' : 'Ver'}</button>
                    {p.id_obra && <> · <button type="button" onClick={() => navigate(`/beta/obras/${p.id_obra}`)}>Ver obra</button></>}</td>
            </tr>)}</tbody></table></div>
            {!datos.total && <p>No hay presupuestos.</p>}
            <Paginacion pagina={pagina} limite={datos.limite} total={datos.total} setPagina={setPagina} etiqueta="Paginación" />
        </>}
    </section>;
}
