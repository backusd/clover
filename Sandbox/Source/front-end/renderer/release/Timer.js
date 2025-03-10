import { LOG_CORE_ERROR } from "./Log.js";
export class Timer {
    constructor(startImmediately = false, name = "(no name)") {
        this.m_started = false;
        this.m_startTime = 0;
        this.m_mostRecentTime = 0;
        this.m_timerName = name;
        if (startImmediately)
            this.Start();
    }
    Start() {
        if (this.m_started) {
            LOG_CORE_ERROR(`Timer '${this.m_timerName}' has Start() called, but the timer has already been started`);
            return;
        }
        this.m_started = true;
        this.m_startTime = this.GetCurrentTimeInSeconds();
        this.m_mostRecentTime = this.m_startTime;
    }
    Tick() {
        let now = this.GetCurrentTimeInSeconds();
        let delta = now - this.m_mostRecentTime;
        this.m_mostRecentTime = now;
        return delta;
    }
    TotalTime() {
        return this.GetCurrentTimeInSeconds() - this.m_startTime;
    }
    GetCurrentTimeInSeconds() {
        return performance.now() * 0.001;
    }
    m_started;
    m_startTime;
    m_mostRecentTime;
    m_timerName;
}
