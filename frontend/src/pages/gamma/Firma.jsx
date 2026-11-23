import { useEffect, useId, useRef, useState } from 'react';
import SignaturePad from 'signature_pad';
import { codificarFirma, decodificarFirma } from '../../utils/firmas';

export default function Firma({ value = '', onChange, onEstadoChange, label = 'Firma', disabled = false }) {
    const canvas = useRef(null);
    const control = useRef(null);
    const callbacks = useRef({ onChange, onEstadoChange, disabled });
    const [estado, setEstado] = useState({ procesando: false, error: '' });
    const id = useId();
    useEffect(() => { callbacks.current = { onChange, onEstadoChange, disabled }; }, [onChange, onEstadoChange, disabled]);

    useEffect(() => {
        const elemento = canvas.current;
        const pad = new SignaturePad(elemento, { penColor: '#172b42', minWidth: 0.5, maxWidth: 2.5 });
        const c = { pad, ancho: 600, alto: 200, version: 0, ultimo: '', anterior: '', restaurando: false };
        control.current = c;
        c.avisar = (procesando, error = '') => {
            const nuevo = { procesando, error };
            setEstado(nuevo);
            callbacks.current.onEstadoChange?.(nuevo);
        };
        // La imagen anterior solo se dibuja si no fue limpiada o reemplazada mientras cargaba.
        c.pintarAnterior = texto => new Promise((resolve, reject) => {
            const version = c.version;
            const imagen = new Image();
            imagen.onload = () => {
                if (control.current === c && c.version === version && c.anterior === texto) {
                    elemento.getContext('2d').drawImage(imagen,0,0,c.ancho,c.alto);
                }
                resolve();
            };
            imagen.onerror = () => reject(new Error('No se pudo recuperar la firma anterior.'));
            imagen.src = texto;
        });
        const redimensionar = () => {
            const rect = elemento.getBoundingClientRect();
            if (!rect.width || !rect.height) return;
            const trazos = pad.toData();
            const sx = rect.width / c.ancho, sy = rect.height / c.alto;
            const ratio = Math.max(window.devicePixelRatio || 1, 1);
            elemento.width = Math.round(rect.width * ratio);
            elemento.height = Math.round(rect.height * ratio);
            elemento.getContext('2d').scale(ratio,ratio);
            c.ancho = rect.width; c.alto = rect.height;
            pad.clear();
            if (c.anterior) {
                const version = c.version;
                c.pintarAnterior(c.anterior).catch(() => { if (control.current === c && version === c.version) c.avisar(false,'No se pudo recuperar la firma anterior.'); });
            }
            else if (trazos.length) pad.fromData(trazos.map(t => ({ ...t, points: t.points.map(p => ({ ...p, x: p.x * sx, y: p.y * sy })) })));
        };
        redimensionar();
        const comenzar = () => { c.version++; c.avisar(true); };
        const terminar = async () => {
            const version = ++c.version;
            try {
                const texto = await codificarFirma(structuredClone(pad.toData()),c.ancho,c.alto);
                if (control.current !== c || version !== c.version) return;
                c.ultimo = texto;
                callbacks.current.onChange(texto);
                c.avisar(false);
            } catch (error) { if (control.current === c && version === c.version) c.avisar(false,error.message); }
        };
        pad.addEventListener('beginStroke',comenzar);
        pad.addEventListener('endStroke',terminar);
        const observador = new ResizeObserver(redimensionar);
        observador.observe(elemento);
        return () => {
            control.current = null;
            c.version++;
            observador.disconnect();
            pad.off();
            pad.removeEventListener('beginStroke',comenzar);
            pad.removeEventListener('endStroke',terminar);
        };
    }, []);

    useEffect(() => {
        const c = control.current;
        if (value === c.ultimo) return;
        const version = ++c.version;
        c.restaurando = true;
        c.pad.off();
        c.pad.clear();
        c.anterior = '';
        c.avisar(true);
        const restaurar = async () => {
            if (value.startsWith('data:image/png;base64,')) {
                c.anterior = value;
                await c.pintarAnterior(value);
            } else if (value) {
                const datos = await decodificarFirma(value);
                if (control.current !== c || version !== c.version) return;
                c.pad.fromData(datos.trazos.map(t => ({ ...t, points: t.points.map(p => ({ ...p, x: p.x * c.ancho / datos.ancho, y: p.y * c.alto / datos.alto })) })));
            }
            if (control.current !== c || version !== c.version) return;
            c.ultimo = value;
            c.restaurando = false;
            if (!callbacks.current.disabled && !c.anterior) c.pad.on();
            c.avisar(false);
        };
        restaurar().catch(error => {
            if (control.current === c && version === c.version) { c.restaurando = false; c.avisar(false,error.message); }
        });
    }, [value]);

    useEffect(() => {
        const c = control.current;
        if (disabled || c.restaurando || c.anterior) c.pad.off();
        else c.pad.on();
    }, [disabled]);

    function limpiar() {
        const c = control.current;
        c.version++; c.anterior = ''; c.ultimo = ''; c.restaurando = false;
        c.pad.clear();
        if (!disabled) c.pad.on();
        callbacks.current.onChange('');
        c.avisar(false);
    }
    return <div className="gamma-firma">
        <span id={id}>{label}</span>
        <p id={`${id}-ayuda`}>Dibuja con el dedo, lápiz o ratón. Puedes limpiar y volver a firmar.</p>
        <canvas ref={canvas} width="600" height="200" role="img" aria-labelledby={id} aria-describedby={`${id}-ayuda`} />
        <button type="button" disabled={disabled || (!value && !estado.error)} onClick={limpiar}>Limpiar firma</button>
        <span className="gamma-ayuda" role="status">{estado.procesando ? 'Guardando firma…' : value ? 'Firma capturada.' : 'Sin firma.'}</span>
        {value.startsWith('data:image/png;base64,') && <p>Firma anterior recuperada. Para reemplazarla, limpia y vuelve a firmar.</p>}
        {estado.error && <p role="alert">{estado.error}</p>}
    </div>;
}
