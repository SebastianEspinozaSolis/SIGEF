import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { api } from '../../api/cliente';
import { useAuth } from '../../context/AuthContext';
import { ROLES } from '../../roles';
import './alpha.css';

// Las tres fichas comparten formulario y listado, pero conservan sus campos propios.
import { fichas, camposEjecutivo, areasCliente, camposBanco } from './configuracionFichas';

export default function Fichas({ tipo, registroInicial = null, soloFormulario = false }) {
    const navigate = useNavigate();
    const location = useLocation();
    const modificado = useRef(false);
    const regreso = `/alpha/${tipo}${location.search}`;
    const { usuario } = useAuth();
    const configuracion = fichas[tipo];
    const { titulo, id, campos } = configuracion;
    const vacio = () => Object.fromEntries(campos.map(([campo]) => [campo, '']));
    const [form, setForm] = useState(() => registroInicial ? Object.fromEntries(campos.map(([campo]) => [campo, registroInicial[campo] ?? ''])) : vacio());
    const [ejecutivos, setEjecutivos] = useState(() => (registroInicial?.ejecutivos || []).map((e) => ({ ...e, clave: `guardado-${e.id_ejecutivo}` })));
    const [cuentasBancarias, setCuentasBancarias] = useState(() => (registroInicial?.cuentas_bancarias || []).map((c) => ({ ...c, clave: `cuenta-${c.id_datos_bancarios}` })));
    const [contactosCliente, setContactosCliente] = useState(() => Object.fromEntries(areasCliente.map(([lista]) => [lista, (registroInicial?.[lista] || []).map((c) => ({ ...c, clave: `${lista}-${c.id_contacto}` }))])));
    const siguienteEjecutivo = useRef(0);
    const [editando, setEditando] = useState(registroInicial?.[id] ?? null);
    const [busqueda, setBusqueda] = useState('');
    const [pagina, setPagina] = useState(1);
    const [datos, setDatos] = useState({ registros: [], total: 0 });
    const [version, setVersion] = useState(0);
    const [cargando, setCargando] = useState(true);
    const [guardando, setGuardando] = useState(false);
    const [errorListado, setErrorListado] = useState('');
    const [error, setError] = useState('');
    const [errores, setErrores] = useState({});
    const [ok, setOk] = useState('');
    const [regiones, setRegiones] = useState([]);
    const [errorRegiones, setErrorRegiones] = useState('');
    const [versionRegiones, setVersionRegiones] = useState(0);

    const [comunas, setComunas] = useState({ region: '', lista: [] });
    const [errorComunas, setErrorComunas] = useState('');
    const [versionComunas, setVersionComunas] = useState(0);
    const regionSeleccionada = String(form.id_region || '');
    // Asociar la respuesta a su región impide mostrar comunas de una solicitud anterior.
    const comunasVisibles = comunas.region === regionSeleccionada ? comunas.lista : [];
    const ubicacionValida = regiones.some((r) => String(r.id_region) === regionSeleccionada)
        && comunasVisibles.some((c) => String(c.id_comuna) === String(form.id_comuna));

    useEffect(() => {
        if (tipo === 'categorias' || !regionSeleccionada) return;
        let vigente = true;
        api(`/api/${tipo}/comunas?${new URLSearchParams({ id_region: regionSeleccionada })}`)
            .then((lista) => { if (vigente) { setComunas({ region: regionSeleccionada, lista }); setErrorComunas(''); } })
            .catch((err) => { if (vigente) setErrorComunas(err.message); });
        return () => { vigente = false; };
    }, [tipo, regionSeleccionada, versionComunas]);

    useEffect(() => {
        if (tipo !== 'clientes' && tipo !== 'proveedores') return;
        let vigente = true;
        api(`/api/${tipo}/regiones`).then((lista) => {
            if (vigente) { setRegiones(lista); setErrorRegiones(''); }
        }).catch((err) => { if (vigente) setErrorRegiones(err.message); });
        return () => { vigente = false; };
    }, [tipo, versionRegiones]);

    useEffect(() => {
        if (tipo !== 'categorias' || soloFormulario) return;
        let vigente = true;
        // Espera breve para buscar al escribir y descarta respuestas antiguas.
        const temporizador = setTimeout(() => {
            setCargando(true);
            setErrorListado('');
            api(`/api/${tipo}?${new URLSearchParams({ q: busqueda, pagina })}`)
                .then((resultado) => { if (vigente) setDatos(resultado); })
                .catch((err) => { if (vigente) setErrorListado(err.message); })
                .finally(() => { if (vigente) setCargando(false); });
        }, 250);
        return () => { vigente = false; clearTimeout(temporizador); };
    }, [tipo, busqueda, pagina, version, soloFormulario]);

    useEffect(() => {
        function advertir(e) { if (modificado.current) { e.preventDefault(); e.returnValue = ''; } }
        if (soloFormulario) window.addEventListener('beforeunload', advertir);
        return () => window.removeEventListener('beforeunload', advertir);
    }, [soloFormulario]);

    function volver() {
        if (guardando) return;
        if (modificado.current && !window.confirm('Hay cambios sin guardar. ¿Quieres descartarlos?')) return;
        modificado.current = false;
        navigate(regreso);
    }

    function limpiar() {
        setComunas({ region: '', lista: [] }); setErrorComunas('');
        setForm(vacio()); setEditando(null); setErrores({}); setError('');
        setEjecutivos([]);
        setCuentasBancarias([]);
        setContactosCliente({ contactos_proyecto: [], contactos_finanzas: [] });
    }

    async function guardar(e) {
        e.preventDefault();
        if (tipo !== 'categorias' && !ubicacionValida) { setError('Selecciona una región y una comuna válidas'); return; }
        const ficha = Object.fromEntries(Object.entries(form).filter(([campo]) => campo !== 'id_region'));
        setGuardando(true); setError(''); setErrores({}); setOk('');
        try {
            await api(`/api/${tipo}${editando === null ? '' : `/${editando}`}`, {
                method: editando === null ? 'POST' : 'PUT', body: tipo === 'proveedores'
                    ? { ...ficha, cuentas_bancarias: cuentasBancarias.map((c) => ({
                        ...(c.id_datos_bancarios !== undefined && { id_datos_bancarios: c.id_datos_bancarios }),
                        ...Object.fromEntries(camposBanco.map(([campo]) => [campo, c[campo]])), activo: c.activo,
                    })), ejecutivos: ejecutivos.map((e) => ({
                        ...(e.id_ejecutivo !== undefined && { id_ejecutivo: e.id_ejecutivo }),
                        nombre: e.nombre, rut: e.rut, cargo: e.cargo, email: e.email, telefono: e.telefono,
                    })) } : tipo === 'clientes' ? { ...ficha, ...Object.fromEntries(areasCliente.map(([lista]) =>
                        [lista, contactosCliente[lista].map((c) => ({
                            ...(c.id_contacto !== undefined && { id_contacto: c.id_contacto }),
                            nombre: c.nombre, rut: c.rut, cargo: c.cargo, email: c.email, telefono: c.telefono,
                        }))])) } : ficha,
            });
            if (soloFormulario) {
                modificado.current = false;
                navigate(regreso, { state: { mensaje: editando === null ? 'Registro creado' : 'Registro actualizado' } });
                return;
            }
            setOk(editando === null ? 'Registro creado' : 'Registro actualizado');
            limpiar();
            setVersion((valor) => valor + 1);
        } catch (err) {
            setError(err.message); setErrores(err.errores || {});
        } finally { setGuardando(false); }
    }

    function editar(registro) {
        setComunas({ region: '', lista: [] }); setErrorComunas(''); setVersionComunas((v) => v + 1);
        setEditando(registro[id]);
        setForm(Object.fromEntries(campos.map(([campo]) => [campo, registro[campo] ?? ''])));
        setEjecutivos((registro.ejecutivos || []).map((e) => ({ ...e, clave: `guardado-${e.id_ejecutivo}` })));
        setCuentasBancarias((registro.cuentas_bancarias || []).map((c) => ({ ...c, clave: `cuenta-${c.id_datos_bancarios}` })));
        setContactosCliente(Object.fromEntries(areasCliente.map(([lista]) => [lista,
            (registro[lista] || []).map((c) => ({ ...c, clave: `${lista}-${c.id_contacto}` }))])));
        setErrores({}); setError(''); setOk('');
    }

    function agregarEjecutivo() {
        modificado.current = true;
        siguienteEjecutivo.current += 1;
        const ejecutivo = { clave: `nuevo-${siguienteEjecutivo.current}`, nombre: '', rut: '', cargo: '', email: '', telefono: '' };
        setEjecutivos((anteriores) => [...anteriores, ejecutivo]);
        setErrores({});
    }

    function agregarCuenta() {
        modificado.current = true;
        siguienteEjecutivo.current += 1;
        setCuentasBancarias((anteriores) => [...anteriores, {
            clave: `cuenta-nueva-${siguienteEjecutivo.current}`,
            ...Object.fromEntries(camposBanco.map(([campo]) => [campo, ''])), activo: true,
        }]);
        setErrores({});
    }

    function cambiarCuenta(clave, campo, valor) {
        setCuentasBancarias((anteriores) => anteriores.map((c) => c.clave === clave ? { ...c, [campo]: valor } : c));
    }

    function cambiarEjecutivo(clave, campo, valor) {
        setEjecutivos((anteriores) => anteriores.map((e) => e.clave === clave ? { ...e, [campo]: valor } : e));
    }

    function agregarContacto(lista) {
        modificado.current = true;
        siguienteEjecutivo.current += 1;
        const contacto = { clave: `nuevo-contacto-${siguienteEjecutivo.current}`, nombre: '', rut: '', cargo: '', email: '', telefono: '' };
        setContactosCliente((anteriores) => ({ ...anteriores, [lista]: [...anteriores[lista], contacto] }));
        setErrores({});
    }

    function cambiarContacto(lista, clave, campo, valor) {
        setContactosCliente((anteriores) => ({ ...anteriores,
            [lista]: anteriores[lista].map((c) => c.clave === clave ? { ...c, [campo]: valor } : c) }));
    }

    return (
        <section className="alpha">
            <div>{soloFormulario ? <button type="button" disabled={guardando} onClick={volver}>Volver al listado</button> : <Link to="/">Volver al inicio</Link>}</div>
            {tipo === 'categorias' && usuario.rol === ROLES.BODEGA && <p><Link to="/alpha/articulos">Volver a artículos</Link></p>}
            <h1>{titulo}</h1>
            <p>Los campos con * son obligatorios.</p>
            {errorRegiones && <p role="alert">No se pudo cargar el listado de regiones: {errorRegiones}
                <button type="button" onClick={() => setVersionRegiones((valor) => valor + 1)}>Reintentar</button></p>}
            {errorComunas && regionSeleccionada && <p role="alert">No se pudo cargar el listado de comunas: {errorComunas}
                <button type="button" onClick={() => setVersionComunas((valor) => valor + 1)}>Reintentar</button></p>}
            <h2>{editando === null ? 'Nuevo registro' : 'Editar registro'}</h2>
            <form onSubmit={guardar} onChangeCapture={() => { modificado.current = true; }}>
                <fieldset disabled={guardando} className="alpha-campos">
                    {campos.map(([campo, etiqueta, maximo, requerido]) => (
                        <label key={campo}>
                            {etiqueta}{requerido ? ' *' : ' (opcional)'}
                            {campo === 'id_region' ? <select name={campo} value={form.id_region} required disabled={!regiones.length}
                                onChange={(e) => { setForm((anterior) => ({ ...anterior, id_region: e.target.value, id_comuna: '' }));
                                    setComunas({ region: '', lista: [] }); setErrorComunas(''); }}>
                                <option value="">Selecciona una región</option>
                                {regiones.map((r) => <option key={r.id_region} value={r.id_region}>{r.nombre}</option>)}
                            </select> : campo === 'id_comuna' ? <select name={campo} value={form.id_comuna} required
                                disabled={!comunasVisibles.length || Boolean(errorComunas)}
                                aria-invalid={Boolean(errores.id_comuna)} aria-describedby={errores.id_comuna ? 'error-id_comuna' : undefined}
                                onChange={(e) => setForm((anterior) => ({ ...anterior, id_comuna: e.target.value }))}>
                                <option value="">{!regionSeleccionada ? 'Primero selecciona una región' : 'Selecciona una comuna'}</option>
                                {comunasVisibles.map((c) => <option key={c.id_comuna} value={c.id_comuna}>{c.nombre}</option>)}
                            </select> : <input name={campo} type={campo === 'email_pagos' ? 'email' : 'text'} value={form[campo]} maxLength={maximo} required={requerido}
                                aria-invalid={Boolean(errores[campo])} aria-describedby={errores[campo] ? `error-${campo}` : undefined}
                                onChange={(e) => setForm((anterior) => ({ ...anterior, [campo]: e.target.value }))} />}
                            {errores[campo] && <small id={`error-${campo}`}>{errores[campo]}</small>}
                        </label>
                    ))}
                    {tipo === 'proveedores' && <div className="alpha-ejecutivos">
                        <h3>Cuentas bancarias</h3>
                        {!cuentasBancarias.length && <p>Sin cuentas bancarias.</p>}
                        {errores.cuentas_bancarias && <p role="alert">{errores.cuentas_bancarias}</p>}
                        {/* Son sugerencias; se permite escribir un tipo diferente. */}
                        <datalist id="sugerencias-tipo-cuenta">
                            <option value="Cuenta Corriente" />
                            <option value="Cuenta Vista" />
                            <option value="Cuenta Ahorro" />
                        </datalist>
                        {cuentasBancarias.map((cuenta, indice) => <fieldset key={cuenta.clave}>
                            <legend>Cuenta {indice + 1} — {cuenta.activo ? 'Activa' : 'Inactiva'}</legend>
                            <div className="alpha-campos">{camposBanco.map(([campo, etiqueta, maximo]) => {
                                const claveError = `cuentas_bancarias.${indice}.${campo}`;
                                return <label key={campo}>{etiqueta} *
                                    <input type={campo === 'email_pagos' ? 'email' : 'text'} value={cuenta[campo]} required maxLength={maximo}
                                        list={campo === 'tipo_cuenta' ? 'sugerencias-tipo-cuenta' : undefined}
                                        aria-invalid={Boolean(errores[claveError])}
                                        aria-describedby={errores[claveError] ? `error-${cuenta.clave}-${campo}` : undefined}
                                        onChange={(e) => cambiarCuenta(cuenta.clave, campo, e.target.value)} />
                                    {campo === 'tipo_cuenta' && <small>Puedes elegir una sugerencia o escribir otro tipo de cuenta.</small>}
                                    {errores[claveError] && <small id={`error-${cuenta.clave}-${campo}`}>{errores[claveError]}</small>}
                                </label>;
                            })}</div>
                            <label><span><input type="checkbox" checked={cuenta.activo}
                                onChange={(e) => cambiarCuenta(cuenta.clave, 'activo', e.target.checked)} /> Cuenta activa</span></label>
                            {errores[`cuentas_bancarias.${indice}.activo`] && <small>{errores[`cuentas_bancarias.${indice}.activo`]}</small>}
                            {cuenta.id_datos_bancarios === undefined && <button type="button" onClick={() => {
                                modificado.current = true;
                                setCuentasBancarias((anteriores) => anteriores.filter((c) => c.clave !== cuenta.clave));
                                setErrores({});
                            }}>Quitar cuenta nueva</button>}
                        </fieldset>)}
                        <button type="button" disabled={cuentasBancarias.length >= 50} onClick={agregarCuenta}>Agregar cuenta bancaria</button>
                    </div>}
                    {tipo === 'clientes' && areasCliente.map(([lista, tituloArea]) => <div className="alpha-ejecutivos" key={lista}>
                        <h3>{tituloArea}</h3>
                        <p>Puedes registrar varios contactos. Cada contacto agregado debe tener todos sus datos.</p>
                        {errores[lista] && <p role="alert">{errores[lista]}</p>}
                        {contactosCliente[lista].map((contacto, indice) => <fieldset key={contacto.clave}>
                            <legend>Contacto {indice + 1}</legend>
                            <div className="alpha-campos">{camposEjecutivo.map(([campo, etiqueta, maximo]) => {
                                const claveError = `${lista}.${indice}.${campo}`;
                                return <label key={campo}>{etiqueta} *
                                    <input type={campo === 'email' ? 'email' : campo === 'telefono' ? 'tel' : 'text'}
                                        placeholder={campo === 'telefono' ? '+56 9 1234 5678' : undefined}
                                        value={contacto[campo]} maxLength={maximo} required aria-invalid={Boolean(errores[claveError])}
                                        aria-describedby={errores[claveError] ? `error-${contacto.clave}-${campo}` : undefined}
                                        onChange={(e) => cambiarContacto(lista, contacto.clave, campo, e.target.value)} />
                                    {errores[claveError] && <small id={`error-${contacto.clave}-${campo}`}>{errores[claveError]}</small>}
                                </label>;
                            })}</div>
                            <button type="button" onClick={() => {
                                if (contacto.id_contacto !== undefined && !window.confirm('¿Quitar este contacto? Se retirará del cliente al guardar la ficha.')) return;
                                modificado.current = true;
                                setContactosCliente((anteriores) => ({ ...anteriores, [lista]: anteriores[lista].filter((c) => c.clave !== contacto.clave) }));
                                setErrores({});
                            }}>Quitar contacto</button>
                        </fieldset>)}
                        <button type="button" disabled={contactosCliente[lista].length >= 3} onClick={() => agregarContacto(lista)}>Agregar contacto</button>
                    </div>)}
                    {tipo === 'proveedores' && <div className="alpha-ejecutivos">
                        <h3>Ejecutivos comerciales</h3>
                        <p>Puedes agregarlos ahora o después. Cada ejecutivo agregado debe tener todos sus datos.</p>
                        {errores.ejecutivos && <p role="alert">{errores.ejecutivos}</p>}
                        {ejecutivos.map((ejecutivo, indice) => <fieldset key={ejecutivo.clave}>
                            <legend>Ejecutivo {indice + 1}</legend>
                            <div className="alpha-campos">
                                {camposEjecutivo.map(([campo, etiqueta, maximo]) => {
                                    const claveError = `ejecutivos.${indice}.${campo}`;
                                    return <label key={campo}>{etiqueta} *
                                        <input type={campo === 'email' ? 'email' : campo === 'telefono' ? 'tel' : 'text'}
                                        placeholder={campo === 'telefono' ? '+56 9 1234 5678' : undefined}
                                            value={ejecutivo[campo]} maxLength={maximo} required aria-invalid={Boolean(errores[claveError])}
                                            aria-describedby={errores[claveError] ? `error-${ejecutivo.clave}-${campo}` : undefined}
                                            onChange={(e) => cambiarEjecutivo(ejecutivo.clave, campo, e.target.value)} />
                                        {errores[claveError] && <small id={`error-${ejecutivo.clave}-${campo}`}>{errores[claveError]}</small>}
                                    </label>;
                                })}
                            </div>
                            <button type="button" onClick={() => {
                                if (ejecutivo.id_ejecutivo !== undefined && !window.confirm('¿Quitar este ejecutivo? Se retirará del proveedor al guardar la ficha.')) return;
                                modificado.current = true;
                                setEjecutivos((anteriores) => anteriores.filter((e) => e.clave !== ejecutivo.clave)); setErrores({});
                            }}>Quitar ejecutivo</button>
                        </fieldset>)}
                        <button type="button" disabled={ejecutivos.length >= 50} onClick={agregarEjecutivo}>Agregar ejecutivo comercial</button>
                    </div>}
                    <div><button type="submit" disabled={tipo !== 'categorias' && (!ubicacionValida || Boolean(errorRegiones) || Boolean(errorComunas))}>{guardando ? 'Guardando…' : 'Guardar'}</button>
                        {soloFormulario ? <button type="button" onClick={volver}>Cancelar</button> : editando !== null && <button type="button" onClick={limpiar}>Cancelar edición</button>}</div>
                </fieldset>
            </form>
            {error && <p role="alert">{error}</p>}
            {ok && <p role="status">{ok}</p>}
            {tipo === 'categorias' && !soloFormulario && <>
            <h2>Registros</h2>
            <label>Buscar por nombre
                <input type="search" maxLength={150} value={busqueda}
                    onChange={(e) => { setBusqueda(e.target.value); setPagina(1); setCargando(true); }} />
            </label>
            {errorListado && <p role="alert">No se pudo cargar el listado: {errorListado}
                <button onClick={() => setVersion((valor) => valor + 1)}>Reintentar</button></p>}
            {cargando ? <p role="status">Cargando…</p> : !errorListado && <>
                <p>{datos.total} registros encontrados</p>
                <div className="alpha-tabla"><table>
                    <thead><tr>{campos.map(([campo, etiqueta]) => <th key={campo}>{etiqueta}</th>)}<th>Acciones</th></tr></thead>
                    <tbody>{datos.registros.map((registro) => <tr key={registro[id]}>
                        {campos.map(([campo]) => <td key={campo}>{registro[campo] || '—'}</td>)}
                        <td><button disabled={guardando} onClick={() => editar(registro)}>Editar</button></td>
                    </tr>)}</tbody>
                </table></div>
                {datos.registros.length === 0 && <p>No hay registros para esta búsqueda.</p>}
                <nav aria-label="Paginación">
                    <button disabled={pagina <= 1} onClick={() => { setCargando(true); setPagina((valor) => valor - 1); }}>Anterior</button>
                    <span>Página {pagina}</span>
                    <button disabled={pagina * datos.limite >= datos.total} onClick={() => { setCargando(true); setPagina((valor) => valor + 1); }}>Siguiente</button>
                </nav>
            </>}
            </>}
        </section>
    );
}
