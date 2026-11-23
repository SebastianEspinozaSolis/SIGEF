import { pesos, evitarCambioConRueda } from '../../utils/importes';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { api } from '../../api/cliente';
import { useAuth } from '../../context/AuthContext';
import { ROLES } from '../../roles';
import './alpha.css';

const vacio = { codigo_interno: '', codigo_barras: '', nombre: '', id_categoria: '',
    unidad_medida: '', ubicacion_bodega: '', bodega_sector: '', descripcion: '', precio_lista: '', stock_minimo: '0', activo: true };
const camposTexto = [
    ['codigo_interno', 'Código interno', 40, true], ['codigo_barras', 'Código de barras', 60, true],
    ['nombre', 'Nombre', 150, true],
    ['ubicacion_bodega', 'Ubicación en bodega', 80, true],
    ['bodega_sector', 'Número de bodega o sector', 80, true],
];

// Los códigos se validan también en el backend; las cantidades usan esta unidad.
const unidades = [['UN', 'Unidad'], ['M', 'Metro'], ['M2', 'Metro cuadrado'],
    ['M3', 'Metro cúbico'], ['KG', 'Kilogramo'], ['L', 'Litro']];

async function cargarCategorias() {
    const primera = await api('/api/categorias?limite=100');
    // Carga el catálogo completo para que ninguna categoría quede fuera del selector.
    const paginas = Math.ceil(primera.total / 100);
    const siguientes = await Promise.all(Array.from({ length: Math.max(0, paginas - 1) },
        (_, i) => api(`/api/categorias?limite=100&pagina=${i + 2}`)));
    return [...primera.registros, ...siguientes.flatMap((pagina) => pagina.registros)];
}

export default function Articulos({ soloFormulario = false, registroInicial = null }) {
    const location = useLocation();
    const navigate = useNavigate();
    const { usuario } = useAuth();
    const mostrarFormulario = soloFormulario;
    const tituloFormulario = useRef(null);
    const [form, setForm] = useState(() => registroInicial ? Object.fromEntries(Object.keys(vacio).map((campo) => [campo, registroInicial[campo] ?? vacio[campo]])) : vacio);
    const editando = registroInicial?.id_articulo ?? null;
    const [categorias, setCategorias] = useState([]);
    const [errorCategorias, setErrorCategorias] = useState('');
    const [filtros, setFiltros] = useState(location.state?.filtros || { q: '', id_categoria: '', activo: '', critico: '' });
    const [pagina, setPagina] = useState(location.state?.pagina || 1);
    const [datos, setDatos] = useState({ registros: [], total: 0 });
    const [version, setVersion] = useState(0);
    const [cargando, setCargando] = useState(true);
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState('');
    const [errorListado, setErrorListado] = useState('');
    const [errores, setErrores] = useState({});
    const [ok] = useState(location.state?.mensaje || '');

    // Lleva al formulario al crear o editar desde una fila del listado.
    useEffect(() => {
        if (mostrarFormulario) tituloFormulario.current?.focus();
    }, [mostrarFormulario, editando]);

    useEffect(() => {
        let vigente = true;
        cargarCategorias().then((lista) => { if (vigente) setCategorias(lista); })
            .catch((err) => { if (vigente) setErrorCategorias(err.message); });
        return () => { vigente = false; };
    }, []);

    useEffect(() => {
        if (soloFormulario) return;
        let vigente = true;
        const temporizador = setTimeout(() => {
            setCargando(true); setErrorListado('');
            api(`/api/articulos?${new URLSearchParams({ ...filtros, pagina })}`)
                .then((resultado) => { if (vigente) setDatos(resultado); })
                .catch((err) => { if (vigente) setErrorListado(err.message); })
                .finally(() => { if (vigente) setCargando(false); });
        }, 250);
        return () => { vigente = false; clearTimeout(temporizador); };
    }, [filtros, pagina, version, soloFormulario]);

    function cambiar(e) {
        const { name, value, type, checked } = e.target;
        setForm((anterior) => ({ ...anterior, [name]: type === 'checkbox' ? checked : value }));
    }
    function filtrar(campo, valor) {
        setFiltros((anteriores) => ({ ...anteriores, [campo]: valor }));
        setPagina(1); setCargando(true);
    }
    function volver(mensaje) {
        navigate('/alpha/articulos', { state: { ...(location.state?.retorno || {}), ...(mensaje && { mensaje }) } });
    }
    async function guardar(e) {
        e.preventDefault();
        setGuardando(true); setError(''); setErrores({});
        try {
            await api(`/api/articulos${editando === null ? '' : `/${editando}`}`, {
                method: editando === null ? 'POST' : 'PUT', body: { ...form, id_categoria: Number(form.id_categoria) },
            });
            volver(editando === null ? 'Artículo creado' : 'Artículo actualizado');
        } catch (err) { setError(err.message); setErrores(err.errores || {}); }
        finally { setGuardando(false); }
    }
    function editar(articulo) {
        navigate(`/alpha/articulos/${articulo.id_articulo}/editar`, { state: { retorno: { filtros, pagina } } });
    }

    return <section className="alpha">
        {soloFormulario ? <button type="button" disabled={guardando} onClick={() => volver()}>Volver al catálogo</button>
            : <Link to="/">Volver al inicio</Link>}<h1>{soloFormulario ? 'Ficha del artículo' : 'Catálogo de artículos'}</h1>
        {!soloFormulario && <>
        <p>Consulta las existencias y abre los movimientos de cada artículo para ver sus movimientos.</p>
        <nav aria-label="Opciones de artículos">
            <button disabled={guardando} onClick={() => navigate('/alpha/articulos/nuevo', { state: { retorno: { filtros, pagina } } })}>Crear artículo</button>
            {[ROLES.ADMIN, ROLES.BODEGA].includes(usuario.rol) && <Link to="/alpha/categorias">Categorías</Link>}
        </nav>
        </>}
        {errorCategorias && <p role="alert">No se pudieron cargar las categorías: {errorCategorias}. Recarga la página para reintentar.</p>}
        {!errorCategorias && categorias.length === 0 && <p>Debe existir una categoría antes de registrar artículos.</p>}
        {mostrarFormulario && <>
        <h2 ref={tituloFormulario} tabIndex={-1}>{editando === null ? 'Nuevo artículo' : 'Editar artículo'}</h2>
        <p>Los campos con * son obligatorios.</p>
        <form onSubmit={guardar}>
            <fieldset disabled={guardando} className="alpha-campos">
                {camposTexto.map(([campo, etiqueta, maximo, requerido]) => <label key={campo}>
                    {etiqueta}{requerido ? ' *' : ' (opcional)'}
                    <input name={campo} value={form[campo]} maxLength={maximo} required={requerido} onChange={cambiar}
                        aria-invalid={Boolean(errores[campo])} aria-describedby={errores[campo] ? `error-${campo}` : undefined} />
                    {errores[campo] && <small id={`error-${campo}`}>{errores[campo]}</small>}
                </label>)}
                <label>Unidad de medida *
                    <select name="unidad_medida" value={form.unidad_medida} required onChange={cambiar}
                        aria-invalid={Boolean(errores.unidad_medida)}>
                        <option value="">Selecciona una unidad</option>
                        {form.unidad_medida && !unidades.some(([codigo]) => codigo === form.unidad_medida)
                            && <option value={form.unidad_medida} disabled>{form.unidad_medida} — selecciona una unidad válida</option>}
                        {unidades.map(([codigo, nombre]) => <option key={codigo} value={codigo}>{nombre} ({codigo})</option>)}
                    </select>
                    {errores.unidad_medida && <small>{errores.unidad_medida}</small>}
                </label>
                <label>Categoría *
                    <select name="id_categoria" value={form.id_categoria} required onChange={cambiar}>
                        <option value="">Selecciona una categoría</option>
                        {categorias.map((categoria) => <option key={categoria.id_categoria} value={categoria.id_categoria}>{categoria.nombre_categoria}</option>)}
                    </select>{errores.id_categoria && <small>{errores.id_categoria}</small>}
                </label>
                <label>Descripción (opcional)<textarea name="descripcion" maxLength={5000} value={form.descripcion} onChange={cambiar} />
                    {errores.descripcion && <small>{errores.descripcion}</small>}
                </label>
                <label>Precio de lista (CLP) *<input name="precio_lista" type="number" min="0" max="99999999999999" step="1" inputMode="numeric" onWheel={evitarCambioConRueda} required value={form.precio_lista} onChange={cambiar} />
                    {errores.precio_lista && <small>{errores.precio_lista}</small>}
                </label>
                <label>Stock mínimo *<input name="stock_minimo" type="number" min="0" max={form.unidad_medida === 'UN' ? '999999999' : '999999999.999'} step={form.unidad_medida === 'UN' ? '1' : '0.001'}
                    value={form.stock_minimo} required onChange={cambiar} />
                    {errores.stock_minimo && <small>{errores.stock_minimo}</small>}
                </label>
                <label><span>Estado</span><span><input name="activo" type="checkbox" checked={form.activo} onChange={cambiar} /> Activo</span>
                    {errores.activo && <small>{errores.activo}</small>}
                </label>
                <div><button disabled={categorias.length === 0 || Boolean(errorCategorias)} type="submit">{guardando ? 'Guardando…' : 'Guardar'}</button>
                    <button type="button" onClick={() => volver()}>Cancelar</button></div>
            </fieldset>
        </form>
        </>}
        {error && <p role="alert">{error}</p>}{ok && <p role="status">{ok}</p>}
        {!soloFormulario && <>
        <h2>Existencias y búsqueda</h2>
        <div className="alpha-filtros">
            <label>Nombre, código interno o barras<input type="search" list="sugerencias-articulos" maxLength={150}
                value={filtros.q} onChange={(e) => filtrar('q', e.target.value)} />
                <datalist id="sugerencias-articulos">{datos.registros.map((articulo) =>
                    <option key={articulo.id_articulo} value={articulo.codigo_interno}>{articulo.nombre}</option>)}</datalist>
            </label>
            <label>Categoría<select value={filtros.id_categoria} onChange={(e) => filtrar('id_categoria', e.target.value)}>
                <option value="">Todas</option>{categorias.map((categoria) => <option key={categoria.id_categoria} value={categoria.id_categoria}>{categoria.nombre_categoria}</option>)}
            </select></label>
            <label>Estado<select value={filtros.activo} onChange={(e) => filtrar('activo', e.target.value)}>
                <option value="">Todos</option><option value="true">Activos</option><option value="false">Inactivos</option>
            </select></label>
            <label>Existencias<select value={filtros.critico} onChange={(e) => filtrar('critico', e.target.value)}>
                <option value="">Todas</option><option value="true">En mínimo o bajo mínimo</option>
            </select></label>
        </div>
        {errorListado && <p role="alert">No se pudo cargar el listado: {errorListado}
            <button onClick={() => setVersion((valor) => valor + 1)}>Reintentar</button></p>}
        {cargando ? <p role="status">Cargando…</p> : !errorListado && <>
            <p>{datos.total} artículos encontrados. Disponible = actual − comprometido.</p>
            <div className="alpha-tabla"><table>
                <thead><tr>{['Código', 'Barras', 'Artículo', 'Categoría', 'Unidad', 'Ubicación', 'Bodega o sector', 'Descripción', 'Actual', 'Comprometido', 'Disponible', 'Mínimo', 'Costo PMP (CLP)', 'Último costo de compra (CLP)', 'Precio de lista (CLP)', 'Actualización precio de lista', 'Estado', 'Alerta', 'Acciones'].map((titulo) => <th key={titulo}>{titulo}</th>)}</tr></thead>
                <tbody>{datos.registros.map((articulo) => <tr key={articulo.id_articulo}>
                    <td>{articulo.codigo_interno}</td><td>{articulo.codigo_barras || '—'}</td><td>{articulo.nombre}</td>
                    <td>{articulo.nombre_categoria || 'Sin categoría'}</td><td>{unidades.find(([codigo]) => codigo === articulo.unidad_medida)?.[1] || articulo.unidad_medida}</td><td>{articulo.ubicacion_bodega || '—'}</td>
                    <td>{articulo.bodega_sector}</td><td>{articulo.descripcion || '—'}</td>
                    <td>{articulo.stock_actual}</td><td>{articulo.stock_comprometido}</td><td>{articulo.stock_disponible}</td><td>{articulo.stock_minimo}</td>
                    <td>{pesos(articulo.precio_pmp)}</td><td>{articulo.ultimo_costo_compra == null ? 'Sin compras registradas' : pesos(articulo.ultimo_costo_compra)}</td>
                    <td>{pesos(articulo.precio_lista)}</td><td>{articulo.fecha_actualizacion_precio ? new Date(articulo.fecha_actualizacion_precio).toLocaleString('es-CL') : '—'}</td><td>{articulo.activo ? 'Activo' : 'Inactivo'}</td>
                    <td>{articulo.stock_critico ? <span className="alpha-critico">Stock en mínimo o inferior</span> : '—'}</td>
                    <td><button disabled={guardando} onClick={() => editar(articulo)}>Editar</button>
                        <button type="button" disabled={guardando || !articulo.activo} title={!articulo.activo ? 'Artículo inactivo' : undefined} onClick={() => navigate(`/alpha/articulos/${articulo.id_articulo}/movimientos`)}>Movimientos</button></td>
                </tr>)}</tbody>
            </table></div>
            {datos.registros.length === 0 && <p>No hay artículos para estos filtros.</p>}
            <nav aria-label="Paginación"><button disabled={pagina <= 1} onClick={() => { setCargando(true); setPagina((valor) => valor - 1); }}>Anterior</button>
                <span>Página {pagina}</span><button disabled={pagina * datos.limite >= datos.total} onClick={() => { setCargando(true); setPagina((valor) => valor + 1); }}>Siguiente</button>
            </nav>
        </>}
        </>}
    </section>;
}
