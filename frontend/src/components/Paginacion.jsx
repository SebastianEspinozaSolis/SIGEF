/*
 * Controles para recorrer las páginas de un listado.
 * La pantalla entrega la página actual y recibe la página elegida; este componente no consulta ni guarda registros.
 */

export default function Paginacion({ pagina, limite, total, setPagina, etiqueta = 'Paginación' }) {
    return <nav aria-label={etiqueta}>
        <button type="button" disabled={pagina <= 1} onClick={() => setPagina(pagina - 1)}>Anterior</button>
        <span>Página {pagina}</span>
        <button type="button" disabled={total == null || pagina * limite >= total} onClick={() => setPagina(pagina + 1)}>Siguiente</button>
    </nav>;
}
