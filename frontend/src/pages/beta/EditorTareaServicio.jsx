/*
 * Formulario de una tarea de servicio: mantiene su nombre, precio y puntos de checklist.
 * La tarea conserva su categoría. Sus puntos se usan como base al trabajar en terreno; las respuestas de cada hoja se guardan aparte.
 */

import '../alpha/alpha.css';
import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../../api/cliente';
import useRegistro from '../../hooks/useRegistro';
import ErrorCarga from '../../components/ErrorCarga';
import SelectorPaginado from '../../components/SelectorPaginado';
import { evitarCambioConRueda } from '../../utils/importes';

function Formulario({ registro, categoriaInicial, nombreCategoria, regreso }) {
    const navigate = useNavigate();
    const [ficha, setFicha] = useState(registro || { id_categoria_servicio: categoriaInicial || '', nombre_tarea: '', precio_neto: '', activo: true });
    const [error, setError] = useState(null);
    const [guardando, setGuardando] = useState(false);
    const cambiar = (campo, valor) => setFicha(actual => ({ ...actual, [campo]: valor }));
    async function guardar(e) {
        e.preventDefault(); setGuardando(true); setError(null);
        try {
            const { id_categoria_servicio, nombre_tarea, precio_neto, activo } = ficha;
            await api(`/api/tareas-servicio${registro ? `/${registro.id_tarea}` : ''}`, { method: registro ? 'PUT' : 'POST', body: { id_categoria_servicio, nombre_tarea, precio_neto, activo, items:ficha.items || [] } });
            navigate(regreso);
        } catch (err) { setError(err); }
        finally { setGuardando(false); }
    }
    return <form onSubmit={guardar}><fieldset className="alpha-campos" disabled={guardando}>
        {(!categoriaInicial && !registro) && <SelectorPaginado etiqueta="Categoría de servicio" ruta="/api/categorias-servicio" valor={ficha.id_categoria_servicio} seleccionado={registro?.nombre_servicio || nombreCategoria}
            alCambiar={valor => cambiar('id_categoria_servicio', valor)} campoId="id_categoria_servicio" nombre={c => c.nombre_servicio} />}
        <label>Nombre de la tarea * <input required maxLength={150} value={ficha.nombre_tarea} onChange={e => cambiar('nombre_tarea', e.target.value)} /></label>
        <label>Precio neto sugerido (CLP) * <input required type="number" min="0" max="99999999999999" step="1" inputMode="numeric" onWheel={evitarCambioConRueda} value={ficha.precio_neto} onChange={e => cambiar('precio_neto', e.target.value)} /></label>
        <label>Estado <select value={String(ficha.activo)} onChange={e => cambiar('activo', e.target.value === 'true')}><option value="true">Activo</option><option value="false">Inactivo</option></select></label>
        <fieldset className="alpha-ejecutivos"><legend>Checklist predeterminado</legend>
            {(ficha.items || []).map((item,i)=><div key={item.id_item || `nuevo-${i}`}>
                <label>Comprobación {i+1}<input required maxLength={255} value={item.pregunta} onChange={e=>cambiar('items',ficha.items.map((it,j)=>i===j?{...it,pregunta:e.target.value}:it))} /></label>
                <button type="button" onClick={()=>cambiar('items',ficha.items.filter((_,j)=>i!==j))}>Quitar comprobación</button>
            </div>)}
            <button type="button" disabled={(ficha.items || []).length>=100} onClick={()=>cambiar('items',[...(ficha.items || []),{pregunta:''}])}>Agregar comprobación</button>
        </fieldset>
        <button type="submit">{guardando ? 'Guardando…' : 'Guardar'}</button><Link to={regreso}>Cancelar</Link>
    </fieldset>{error && <div role="alert"><p>{error.message}</p>{Object.entries(error.errores || {}).map(([campo, mensaje]) => <p key={campo}>{mensaje}</p>)}</div>}</form>;
}

export default function EditorTareaServicio() {
    const { id } = useParams();
    const [parametros] = useSearchParams();
    const categoria = parametros.get('categoria');
    const nombre = parametros.get('nombre');
    const regreso = `/beta/tareas-servicio${categoria ? `?${new URLSearchParams({categoria,...(nombre ? {nombre} : {})})}` : ''}`;
    const { datos, error, cargando, recargar } = useRegistro(id ? `/api/tareas-servicio/${id}` : null);
    if (cargando) return <p role="status">Cargando tarea…</p>;
    if (error) return <ErrorCarga error={error} noEncontrado="Tarea no encontrada" volver={regreso} reintentar={recargar} />;
    return <section className="alpha"><h1>{id ? 'Editar tarea de servicio' : 'Nueva tarea de servicio'}</h1><p><Link to={regreso}>Volver a tareas</Link></p>
        {(datos?.nombre_servicio || nombre) && <p>Categoría: {datos?.nombre_servicio || nombre}</p>}
        {(!id || datos) && <Formulario key={`${id || 'nuevo'}-${categoria || ''}`} registro={datos} categoriaInicial={categoria} nombreCategoria={nombre} regreso={regreso} />}
    </section>;
}
