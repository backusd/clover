function GetDateString() {
    const date = new Date();
    return `${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}.${date.getMilliseconds()}`;
}
export function LOG_CORE_TRACE(msg) {
    const date = new Date();
    console.log(`${GetDateString()} [TRACE] CORE - ${msg}`);
}
export function LOG_CORE_INFO(msg) {
    const date = new Date();
    console.info(`${GetDateString()} [INFO ] CORE - ${msg}`);
}
export function LOG_CORE_WARN(msg) {
    const date = new Date();
    console.warn(`${GetDateString()} [WARN ] CORE - ${msg}`);
}
export function LOG_CORE_ERROR(msg) {
    const date = new Date();
    console.error(`${GetDateString()} [ERROR] CORE - ${msg}`);
}
export function LOG_TRACE(msg) {
    const date = new Date();
    console.log(`${GetDateString()} [TRACE] ${msg}`);
}
export function LOG_INFO(msg) {
    const date = new Date();
    console.info(`${GetDateString()} [INFO ] ${msg}`);
}
export function LOG_WARN(msg) {
    const date = new Date();
    console.warn(`${GetDateString()} [WARN ] ${msg}`);
}
export function LOG_ERROR(msg) {
    const date = new Date();
    console.error(`${GetDateString()} [ERROR] ${msg}`);
}
//# sourceMappingURL=Log.js.map