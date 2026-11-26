/*
 * Listado de facturas emitidas a clientes para consultar sus datos y abrir su detalle.
 * La creación utiliza una obra finalizada; los pagos y correcciones se consultan desde el flujo de facturación.
 */

import {Link} from 'react-router-dom';
import useListado from '../../hooks/useListado';
import Paginacion from '../../components/Paginacion';
import '../alpha/alpha.css';

export default function FacturasCliente(){
    const {datos,error,cargando,recargar,q,buscar,pagina,setPagina}=useListado('/api/facturas-cliente');
    return <section className="alpha"><h1>Facturas de clientes</h1>
        <p><Link to="/">Menú principal</Link> · <Link to="/beta/facturas-clientes/nuevo">Nueva factura</Link></p>
        <h2>Registros</h2><label>Buscar folio, cliente u obra<input type="search" value={q} onChange={e=>buscar(e.target.value)} /></label>
        {cargando && <p role="status">Cargando…</p>}{error && <p role="alert">{error.message} <button onClick={recargar}>Reintentar</button></p>}
        {datos && <><p>{datos.total} registros encontrados</p><div className="alpha-tabla"><table><caption>Facturas y notas de crédito registradas</caption>
            <thead><tr><th>Tipo</th><th>Folio</th><th>Cliente</th><th>Obra</th><th>Acciones</th></tr></thead>
            <tbody>{datos.registros.map(d=><tr key={d.id_documento}><td>{d.tipo_documento==='factura'?'Factura':'Nota de crédito'}</td><td>{d.folio}</td><td>{d.razon_social}</td><td>{d.nombre_obra}</td><td><Link to={`/beta/facturas-clientes/${d.id_documento}`}>Ver comprobante</Link></td></tr>)}</tbody>
        </table></div>{!datos.total && <p>No hay documentos registrados.</p>}<Paginacion pagina={pagina} limite={datos.limite} total={datos.total} setPagina={setPagina} /></>}
    </section>;
}
