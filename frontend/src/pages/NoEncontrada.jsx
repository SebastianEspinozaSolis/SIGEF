/*
 * Pantalla para una dirección que no corresponde a ninguna ruta del sistema.
 * Permite recuperar la navegación; los errores al cargar un registro se muestran dentro de su propia pantalla.
 */

import { Link } from 'react-router-dom';

export default function NoEncontrada() {
    return <section>
        <h1>Página no encontrada</h1>
        <p>La dirección que abriste no corresponde a una página del sistema.</p>
        <Link to="/">Volver al inicio</Link>
    </section>;
}
