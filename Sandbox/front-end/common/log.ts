function GetDateString(): string
{
	const date = new Date();
	return `${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}.${date.getMilliseconds()}`;
}

export function LOG_CORE_TRACE(msg: string) : void
{
	console.log(`${GetDateString()} [TRACE] CORE - ${msg}`);
}
export function LOG_CORE_INFO(msg: string) : void
{
	console.info(`${GetDateString()} [INFO ] CORE - ${msg}`);
}
export function LOG_CORE_WARN(msg: string): void
{
	console.warn(`${GetDateString()} [WARN ] CORE - ${msg}`);
}
export function LOG_CORE_ERROR(msg: string): void
{
	console.error(`${GetDateString()} [ERROR] CORE - ${msg}`);
}


export function LOG_TRACE(msg: string): void
{
	console.log(`${GetDateString()} [TRACE] ${msg}`);
}
export function LOG_INFO(msg: string): void
{
	console.info(`${GetDateString()} [INFO ] ${msg}`);
}
export function LOG_WARN(msg: string): void
{
	console.warn(`${GetDateString()} [WARN ] ${msg}`);
}
export function LOG_ERROR(msg: string): void
{
	console.error(`${GetDateString()} [ERROR] ${msg}`);
}