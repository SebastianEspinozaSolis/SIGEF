/*
 * Gráfico de barras compartido para los indicadores del resumen, dibujado con Recharts.
 * Recibe los datos y su formato; también ofrece una tabla para consultar los valores exactos.
 */

import { useId } from 'react';
import { Bar, BarChart, CartesianGrid, Rectangle, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const eje = new Intl.NumberFormat('es-CL', { notation: 'compact', maximumFractionDigits: 1 });

// Number se usa solo para dibujar; el detalle conserva el valor exacto del backend.
export default function GraficoBarras({ titulo, datos, etiqueta, valor, formato = String, enteros = true, formatoEje }) {
    const id = useId();
    const filas = datos.map(d => ({ nombre: etiqueta(d), numero: Number(valor(d)) || 0, exacto: valor(d) }));
    const hayActividad = filas.some(d => d.numero !== 0);
    return <figure className="resumen-grafico" aria-labelledby={id}>
        <figcaption id={id}>{titulo}</figcaption>
        {!filas.length ? <p>No hay registros para mostrar.</p> : <>
            {!hayActividad ? <p className="resumen-grafico-vacio">No hay actividad en este período.</p> :
                <div className="resumen-grafico-lienzo" style={{ height: Math.max(240, filas.length * 42 + 40) }}>
                    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                        <BarChart data={filas} layout="vertical" accessibilityLayer margin={{ top: 8, right: 24, bottom: 8, left: 0 }}>
                            <CartesianGrid horizontal={false} stroke="#dce5ef" strokeDasharray="3 3" />
                            <XAxis type="number" tickFormatter={formatoEje || (n => eje.format(n))} allowDecimals={!enteros}
                                tick={{ fill: '#536579', fontSize: 12 }} axisLine={false} tickLine={false} />
                            <YAxis type="category" dataKey="nombre" width={118} interval={0}
                                tickFormatter={nombre => nombre.length > 20 ? `${nombre.slice(0, 19)}…` : nombre}
                                tick={{ fill: '#33465c', fontSize: 12 }} axisLine={false} tickLine={false} />
                            <Tooltip cursor={{ fill: '#edf3f9' }} isAnimationActive={false}
                                formatter={(_numero, _nombre, item) => [formato(item.payload.exacto), 'Valor']}
                                contentStyle={{ borderRadius: 8, border: '1px solid #dce5ef', boxShadow: '0 4px 16px #21334718' }} />
                            <ReferenceLine x={0} stroke="#8394a7" />
                            <Bar dataKey="numero" name="Valor" maxBarSize={26} isAnimationActive={false}
                                shape={props => <Rectangle {...props} fill={props.payload.numero < 0 ? '#b53a41' : '#2b6ca3'}
                                    radius={props.payload.numero < 0 ? [5, 0, 0, 5] : [0, 5, 5, 0]} />} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>}
            <details className="resumen-grafico-datos">
                <summary>Ver datos del gráfico</summary>
                <table><caption>{titulo}</caption><thead><tr><th scope="col">Concepto</th><th scope="col">Valor</th></tr></thead>
                    <tbody>{filas.map(fila => <tr key={fila.nombre}><th scope="row">{fila.nombre}</th><td>{formato(fila.exacto)}</td></tr>)}</tbody>
                </table>
            </details>
        </>}
    </figure>;
}
