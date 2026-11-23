import { pesos } from '../../utils/importes';
import '../alpha/alpha.css';
import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../../api/cliente';
import useRegistro from '../../hooks/useRegistro';
import ErrorCarga from '../../components/ErrorCarga';
import SelectorPaginado from '../../components/SelectorPaginado';

function Formulario({ registro, presupuestoInicial }) {
    const navigate = useNavigate();
    const [ficha, setFicha] = useState({ nombre_obra: registro?.nombre_obra || '',
        id_presupuesto: String(registro?.id_presupuesto || presupuestoInicial || ''),
        id_tecnico: String(registro?.id_tecnico || ''), sin_materiales: registro?.sin_materiales || false });
    const [error, setError] = useState(null);
    const [guardando, setGuardando] = useState(false);
    const presupuesto = useRegistro(ficha.id_presupuesto ? `/api/presupuestos/${encodeURIComponent(ficha.id_presupuesto)}` : null);
    const categoriaPresupuesto = presupuesto.datos?.id_categoria_servicio;
    const cambiar = (campo, valor) => setFicha(actual => ({ ...actual, [campo]: valor }));
    async function guardar(e) {
        e.preventDefault(); setGuardando(true); setError(null);
        try {
            const r = await api(`/api/obras${registro ? `/${registro.id_obra}` : ''}`, { method: registro ? 'PUT' : 'POST', body: ficha });
            navigate(`/beta/obras/${r.id_obra}`);
        } catch (err) { setError(err); }
        finally { setGuardando(false); }
    }
    return <form onSubmit={guardar}><fieldset className="alpha-campos" disabled={guardando || Boolean(registro && !['En proceso', 'Suspendida'].includes(registro.estado))}>
        <legend>Datos de la obra</legend>
        <label>Nombre * <input required maxLength={150} value={ficha.nombre_obra} onChange={e => cambiar('nombre_obra', e.target.value)} /></label>
        <SelectorPaginado etiqueta="Presupuesto aprobado" ruta="/api/presupuestos?estado=Aprobado" disabled={Boolean(registro)}
            valor={ficha.id_presupuesto} seleccionado={presupuesto.datos ? `#${presupuesto.datos.id_presupuesto} — ${presupuesto.datos.razon_social}` : undefined}
            alCambiar={v => cambiar('id_presupuesto', v)} campoId="id_presupuesto" nombre={p => `#${p.id_presupuesto} — ${p.razon_social}${p.id_obra ? ' (ya tiene obra)' : ''}`} />
        {presupuesto.cargando && <p role="status">Consultando presupuesto…</p>}
        {presupuesto.error && <p role="alert">{presupuesto.error.message} <button type="button" onClick={presupuesto.recargar}>Reintentar</button></p>}
        {presupuesto.datos && <p>Cliente: {presupuesto.datos.razon_social} — {presupuesto.datos.rut_cliente} · Monto acordado: {pesos(presupuesto.datos.monto_total)} CLP{categoriaPresupuesto && <> · Categoría: {presupuesto.datos.nombre_servicio}</>}</p>}
        {presupuesto.datos && !categoriaPresupuesto && <p role="alert">Asigna una categoría al presupuesto antes de crear o editar su obra.</p>}
        <SelectorPaginado etiqueta="Técnico responsable" ruta="/api/obras/tecnicos" valor={ficha.id_tecnico} seleccionado={registro?.tecnico}
            alCambiar={v => cambiar('id_tecnico', v)} campoId="id_usuario" nombre={t => `${t.nombres} ${t.apellidos}`} />
        <label><input type="checkbox" checked={ficha.sin_materiales} onChange={e => cambiar('sin_materiales', e.target.checked)} /> Obra sin materiales</label>
        <button type="submit" disabled={presupuesto.cargando || Boolean(presupuesto.error) || !categoriaPresupuesto}>{guardando ? 'Guardando…' : 'Guardar obra'}</button>
    </fieldset>
        {error && <div role="alert"><p>{error.message}</p>{Object.entries(error.errores || {}).map(([campo, mensaje]) => <p key={campo}>{mensaje}</p>)}</div>}
    </form>;
}

export default function EditorObra() {
    const { id } = useParams();
    const [busqueda] = useSearchParams();
    const { datos, error, cargando, recargar } = useRegistro(id ? `/api/obras/${id}` : null);
    if (cargando) return <p role="status">Cargando obra…</p>;
    if (error) return <ErrorCarga error={error} noEncontrado="Obra no encontrada" volver="/beta/obras" reintentar={recargar} />;
    return <section className="alpha"><h1>{id ? `Editar obra: ${datos?.nombre_obra}` : 'Nueva obra'}</h1>
        <p><Link to="/beta/obras">Volver a obras</Link> · <Link to="/beta/categorias-servicio">Categorías de servicio</Link></p>
        {(!id || datos) && <Formulario key={id || 'nuevo'} registro={datos} presupuestoInicial={busqueda.get('presupuesto')} />}
    </section>;
}
