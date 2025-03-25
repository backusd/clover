function GetDateString() {
    const date = new Date();
    return `${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}.${date.getMilliseconds()}`;
}
export function LOG_CORE_TRACE(msg) {
    console.log(`${GetDateString()} [TRACE] CORE - ${msg}`);
}
export function LOG_CORE_INFO(msg) {
    console.info(`${GetDateString()} [INFO ] CORE - ${msg}`);
}
export function LOG_CORE_WARN(msg) {
    console.warn(`${GetDateString()} [WARN ] CORE - ${msg}`);
}
export function LOG_CORE_ERROR(msg) {
    console.error(`${GetDateString()} [ERROR] CORE - ${msg}`);
}
export function LOG_TRACE(msg) {
    console.log(`${GetDateString()} [TRACE] ${msg}`);
}
export function LOG_INFO(msg) {
    console.info(`${GetDateString()} [INFO ] ${msg}`);
}
export function LOG_WARN(msg) {
    console.warn(`${GetDateString()} [WARN ] ${msg}`);
}
export function LOG_ERROR(msg) {
    console.error(`${GetDateString()} [ERROR] ${msg}`);
}
//# sourceMappingURL=log.js.map