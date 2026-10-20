// Centraliza y evita repetir la creación de errores HTTP con estado y mensaje
// Error esperado: permite que el servicio indique el estado y mensaje sin usar res
class ErrorHttp extends Error {
    constructor(status, mensaje, errores) {
        super(mensaje);
        this.status = status;
        this.errores = errores;
    }
}

module.exports = ErrorHttp;
