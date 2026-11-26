/*
 * Categorías de servicio: agrupa servicios como Mantención, Emergencia o Proyecto eléctrico.
 * Permite crear, editar y buscar categorías. «Ver tareas» abre las tareas y precios de esa categoría, que después se utilizan en los presupuestos.
 */

import Paginacion from '../../components/Paginacion';
import '../alpha/alpha.css';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../api/cliente';
import useListado from '../../hooks/useListado';

export default function CategoriasServicio() {
    const navigate = useNavigate();
    const { datos, error, cargando, recargar, q, buscar, pagina, setPagina } = useListado('/api/categorias-servicio');
    const [ficha, setFicha] = useState({ nombre_servicio: '' });
    const [fallo, setFallo] = useState(null);
    const [guardando, setGuardando] = useState(false);
    async function guardar(e) {
        e.preventDefault(); setGuardando(true); setFallo(null);
        try {
            await api(`/api/categorias-servicio${ficha.id_categoria_servicio ? `/${ficha.id_categoria_servicio}` : ''}`, { method: ficha.id_categoria_servicio ? 'PUT' : 'POST', body: { nombre_servicio: ficha.nombre_servicio } });
            setFicha({ nombre_servicio: '' }); recargar();
        } catch (err) { setFallo(err); }
        finally { setGuardando(false); }
    }
    return <section className="alpha"><h1>Categorías de servicio</h1><Link to="/beta/obras">Volver a obras</Link>
        <form onSubmit={guardar}><fieldset className="alpha-campos" disabled={guardando}>
            <legend>{ficha.id_categoria_servicio ? 'Editar categoría' : 'Nueva categoría'}</legend>
            <label>Nombre * <input required maxLength={80} value={ficha.nombre_servicio} onChange={e => setFicha({ ...ficha, nombre_servicio: e.target.value })} /></label>
            <button type="submit">Guardar</button> <button type="button" onClick={() => setFicha({ nombre_servicio: '' })}>Cancelar</button>
        </fieldset></form>
        {fallo && <p role="alert">{fallo.message} {Object.values(fallo.errores || {}).join('. ')}</p>}
        <h2>Registros</h2>
        <div className="alpha-filtros"><label>Buscar por nombre <input type="search" maxLength={150} value={q} onChange={e => buscar(e.target.value)} /></label></div>
        {error && <p role="alert">{error.message} <button onClick={recargar}>Reintentar</button></p>}
        {cargando && <p role="status">Cargando…</p>}
        {datos && <><p>{datos.total} registros encontrados</p>
            <div className="alpha-tabla"><table>
                <thead><tr><th>Nombre</th><th>Acciones</th></tr></thead>
                <tbody>{datos.registros.map(c => <tr key={c.id_categoria_servicio}>
                    <td>{c.nombre_servicio}</td><td><button disabled={guardando} onClick={() => setFicha(c)}>Editar</button> <button type="button" onClick={() => navigate(`/beta/tareas-servicio?${new URLSearchParams({categoria:c.id_categoria_servicio,nombre:c.nombre_servicio})}`)}>Ver tareas</button></td>
                </tr>)}</tbody>
            </table></div>
        </>}
        {datos?.total === 0 && <p>No hay categorías de servicio. Crea una para registrar obras.</p>}
        <Paginacion pagina={pagina} limite={datos?.limite} total={datos?.total} setPagina={setPagina} etiqueta="Paginación" />
    </section>;
}
