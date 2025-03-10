import { LOG_CORE_INFO, LOG_CORE_TRACE, LOG_CORE_WARN, LOG_CORE_ERROR } from "./Log.js"


export class Timer
{
	constructor(startImmediately: boolean = false, name: string = "(no name)")
	{
		this.m_started = false;
		this.m_startTime = 0;
		this.m_mostRecentTime = 0;
		this.m_timerName = name;

		if (startImmediately)
			this.Start();
	}
	public Start(): void
	{
		if (this.m_started)
		{
			LOG_CORE_ERROR(`Timer '${this.m_timerName}' has Start() called, but the timer has already been started`);
			return;
		}

		this.m_started = true;

		this.m_startTime = this.GetCurrentTimeInSeconds();
		this.m_mostRecentTime = this.m_startTime;
	}
	public Tick(): number
	{
		let now = this.GetCurrentTimeInSeconds();
		let delta = now - this.m_mostRecentTime;
		this.m_mostRecentTime = now;
		return delta;
	}
	public TotalTime(): number
	{
		return this.GetCurrentTimeInSeconds() - this.m_startTime;
	}
	private GetCurrentTimeInSeconds(): DOMHighResTimeStamp
	{
		// now() returns in total number of milliseconds, but we want the units to be seconds
		return performance.now() * 0.001;
	}

	private m_started: boolean;
	private m_startTime: DOMHighResTimeStamp;
	private m_mostRecentTime: DOMHighResTimeStamp;
	private m_timerName: string;
}