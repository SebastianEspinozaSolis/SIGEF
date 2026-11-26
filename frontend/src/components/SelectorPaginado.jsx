/*
 * Selector compartido para buscar y elegir registros de un catálogo, como clientes o artículos.
 * Consulta por páginas y conserva la selección aunque no aparezca en la página actual; no descarga todo el catálogo.
 */

import useListado from '../hooks/useListado';
import Paginacion from './Paginacion';

// La variante habitual consulta su catálogo y comparte búsqueda y paginación.
export default function SelectorPaginado({ ruta, ...props }) {
    const listado = useListado(ruta);
    return <SelectorListado {...props} listado={listado} />;
}

// Permite reutilizar una consulta que el formulario también necesita recargar.
export function SelectorListado({ listado, etiqueta, valor, seleccionado, opcionActual, alCambiar,
    campoId, nombre, disabled = false, obligatorio = true, busqueda, vacio = 'No hay coincidencias.',
    placeholder = 'Selecciona una opción' }) {
    const { datos, error, cargando, recargar, q, buscar, pagina, setPagina } = listado;
    const registros = datos?.registros || [];
    const fueraDePagina = valor && !registros.some(r => String(r[campoId]) === String(valor));
    const opciones = fueraDePagina && opcionActual ? [opcionActual, ...registros] : registros;
    return <fieldset className="alpha-ejecutivos" disabled={disabled}>
        <legend>{etiqueta}{obligatorio ? ' *' : ''}</legend>
        <div className="alpha-campos">
            <label>{busqueda || `Buscar ${etiqueta.toLowerCase()}`}<input type="search" maxLength={150} value={q} onChange={e => buscar(e.target.value)} /></label>
            <label>{etiqueta}<select required={obligatorio} value={valor ?? ''} disabled={cargando || Boolean(error)}
                onChange={e => alCambiar(e.target.value, opciones.find(r => String(r[campoId]) === e.target.value) || null)}>
                <option value="">{placeholder}</option>
                {fueraDePagina && !opcionActual && <option value={valor}>{seleccionado || `Selección actual #${valor}`}</option>}
                {opciones.map(r => <option key={r[campoId]} value={r[campoId]}>{nombre(r)}</option>)}
            </select></label>
        </div>
        {cargando && <p role="status">Cargando opciones…</p>}
        {error && <p role="alert">{error.message} <button type="button" onClick={recargar}>Reintentar</button></p>}
        {!cargando && !error && datos?.total === 0 && <p>{vacio}</p>}
        <Paginacion pagina={pagina} limite={datos?.limite} total={datos?.total} setPagina={setPagina}
            etiqueta={`Paginación de ${etiqueta.toLowerCase()}`} />
    </fieldset>;
}
