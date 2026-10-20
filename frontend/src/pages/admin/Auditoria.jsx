import { useEffect, useState } from 'react';
import { api } from '../../api/cliente';

const filtrosVacios = { id_usuario: '', accion: '' };
const limite = 20;

// Muestra los valores guardados sin interpretar su contenido como HTML
function Valores({ datos }) {
    if (datos == null) return <span>Sin datos</span>;
    if (typeof datos !== 'object') return <span>{String(datos)}</span>;
    if (Object.keys(datos).length === 0) return <span>Sin datos</span>;
    return (
        <dl>
            {Object.entries(datos).map(([campo, valor]) => (
                <div key={campo}>
                    <dt>{campo.replaceAll('_', ' ')}</dt>
                    <dd>{valor == null ? 'Sin valor' : typeof valor === 'object'
                        ? JSON.stringify(valor) : String(valor)}</dd>
                </div>
            ))}
        </dl>
    );
}

export default function Auditoria() {
    const [registros, setRegistros] = useState([]);
    const [usuarios, setUsuarios] = useState([]);
    const [form, setForm] = useState(filtrosVacios);
    const [consulta, setConsulta] = useState({ pagina: 1, ...filtrosVacios });
    const [total, setTotal] = useState(0);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState('');
    const [errorUsuarios, setErrorUsuarios] = useState('');

    // Carga responsables para poder filtrar por nombre en vez de escribir un id
    useEffect(() => {
        let vigente = true;
        api('/api/usuarios')
            .then((datos) => { if (vigente) setUsuarios(datos); })
            .catch(() => { if (vigente) setErrorUsuarios('No se pudo cargar el filtro de responsables.'); });
        return () => { vigente = false; };
    }, []);

    // Consulta otra pagina o aplica filtros. Ignora respuestas de consultas anteriores
    useEffect(() => {
        let vigente = true;
        setCargando(true);
        setError('');
        const parametros = new URLSearchParams({ pagina: consulta.pagina, limite });
        if (consulta.id_usuario) parametros.set('id_usuario', consulta.id_usuario);
        if (consulta.accion) parametros.set('accion', consulta.accion);

        api(`/api/auditoria?${parametros}`)
            .then((datos) => {
                if (!vigente) return;
                setRegistros(datos.registros);
                setTotal(datos.total);
            })
            .catch((err) => { if (vigente) setError(err.message); })
            .finally(() => { if (vigente) setCargando(false); });

        return () => { vigente = false; };
    }, [consulta]);

    function filtrar(e) {
        e.preventDefault();
        setConsulta({ ...form, accion: form.accion.trim(), pagina: 1 });
    }

    function limpiar() {
        setForm(filtrosVacios);
        setConsulta({ ...filtrosVacios, pagina: 1 });
    }

    const paginas = Math.max(1, Math.ceil(total / limite));

    return (
        <section>
            <h2>Auditoría</h2>
            <p>Consulta las acciones registradas en el sistema, desde las más recientes.</p>

            <form onSubmit={filtrar}>
                <label>Responsable
                    <select value={form.id_usuario}
                        onChange={(e) => setForm({ ...form, id_usuario: e.target.value })}>
                        <option value="">Todos</option>
                        {usuarios.map((u) => (
                            <option key={u.id_usuario} value={u.id_usuario}>
                                {u.nombres} {u.apellidos} ({u.email})
                            </option>
                        ))}
                    </select>
                </label>
                <label>Acción exacta
                    <input value={form.accion} maxLength={20}
                        onChange={(e) => setForm({ ...form, accion: e.target.value })} />
                </label>
                <button type="submit" disabled={cargando}>Filtrar</button>
                <button type="button" onClick={limpiar} disabled={cargando}>Limpiar filtros</button>
                <button type="button" onClick={() => setConsulta({ ...consulta })}
                    disabled={cargando}>Actualizar</button>
            </form>

            {errorUsuarios && <p role="status">{errorUsuarios}</p>}
            {error && <p role="alert">{error}</p>}
            {cargando && <p role="status">Cargando registros...</p>}

            {!cargando && !error && (
                <>
                    <p>{total} registros encontrados.</p>
                    {registros.length === 0 ? <p>No hay registros para mostrar.</p> : (
                        <table>
                            <caption>Historial de acciones</caption>
                            <thead>
                                <tr>
                                    <th scope="col">Fecha y hora</th>
                                    <th scope="col">Responsable</th>
                                    <th scope="col">Acción</th>
                                    <th scope="col">Tabla afectada</th>
                                    <th scope="col">Registro afectado</th>
                                    <th scope="col">Detalle del cambio</th>
                                </tr>
                            </thead>
                            <tbody>
                                {registros.map((r) => (
                                    <tr key={r.id_auditoria}>
                                        <td>{r.fecha_hora ? new Date(r.fecha_hora).toLocaleString('es-CL') : 'Sin fecha'}</td>
                                        <td>{[r.nombres, r.apellidos].filter(Boolean).join(' ') || 'Usuario no disponible'}</td>
                                        <td>{r.accion}</td>
                                        <td>{r.tabla_afectada}</td>
                                        <td>{r.id_registro_afectado ?? 'Sin registro asociado'}</td>
                                        <td>
                                            <details>
                                                <summary>Ver detalle</summary>
                                                <h3>Antes</h3>
                                                <Valores datos={r.valores_anteriores} />
                                                <h3>Después</h3>
                                                <Valores datos={r.valores_nuevos} />
                                            </details>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                    <nav aria-label="Páginas de auditoría">
                        <button type="button" disabled={consulta.pagina <= 1}
                            onClick={() => setConsulta({ ...consulta, pagina: consulta.pagina - 1 })}>Anterior</button>
                        <span> Página {consulta.pagina} de {paginas} </span>
                        <button type="button" disabled={consulta.pagina >= paginas}
                            onClick={() => setConsulta({ ...consulta, pagina: consulta.pagina + 1 })}>Siguiente</button>
                    </nav>
                </>
            )}
        </section>
    );
}
