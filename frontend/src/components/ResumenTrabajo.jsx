// Compartido por el cierre de terreno y la consulta de obra del ERP.
export default function ResumenTrabajo({ hojas = [], fechaCierre }) {
    const minutos=valor=>Math.round(Number(valor || 0)*60);
    const tiempo=valor=>`${Math.floor(valor/60)} h ${valor%60} min`;
    const total=hojas.reduce((s,h)=>s+minutos(h.horas_trabajadas),0);
    return <section aria-label="Resumen del trabajo">
        <h2>Resumen del trabajo</h2>
        <p>Hojas completadas: {hojas.filter(h=>h.estado==='Completada').length} de {hojas.length}</p>
        <p><strong>Tiempo total registrado: {tiempo(total)}</strong></p>
        {fechaCierre && <p>Finalización: {new Date(fechaCierre).toLocaleString('es-CL', { timeZone: 'America/Santiago' })}</p>}
        {hojas.map(h=><article key={h.id_detalle_presupuesto}>
            <h3>{h.descripcion}</h3>
            <p>{h.estado} · {tiempo(minutos(h.horas_trabajadas))}</p>
            {h.materiales?.length ? <><p>Materiales utilizados:</p><ul>{h.materiales.map((m,i)=><li key={m.id_articulo ?? m.id_movimiento_asignacion ?? i}>
                {m.nombre} — {Number(m.cantidad).toLocaleString('es-CL',{maximumFractionDigits:3})} {m.unidad_medida}
            </li>)}</ul></> : <p>Sin consumo de materiales registrado.</p>}
        </article>)}
        {!hojas.length && <p>No hay tareas registradas para esta obra.</p>}
    </section>;
}
