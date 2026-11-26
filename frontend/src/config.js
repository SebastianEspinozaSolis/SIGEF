/*
 * Configuración del frontend: indica dónde está el backend.
 * Las llamadas de la aplicación reutilizan esta dirección para funcionar en desarrollo o al publicar.
 */

// Centraliza la URL del backend para poder cambiarla facilmente en un solo lugar
export const API_URL = import.meta.env.VITE_API_URL || '';
