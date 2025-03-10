import { LOG_WARN } from "./Log.js";
export class TimingUI {
    constructor(countsLength, renderer) {
        let elem = document.getElementById("frame-timing-info");
        if (elem === null) {
            this.m_uiElement = null;
            this.m_fpsTimeDeltas = [];
            this.m_jsTimeDeltas = [];
            this.m_gpuPassTimeDeltas = new Map();
            LOG_WARN("TimingUI::constructor(): Could not find element with Id 'frame-timing-info'");
        }
        else {
            this.m_uiElement = elem;
            this.m_fpsTimeDeltas = new Array(countsLength);
            this.m_jsTimeDeltas = new Array(countsLength);
            this.m_gpuPassTimeDeltas = new Map();
            let numRenderPasses = renderer.NumberOfRenderPasses();
            for (let iii = 0; iii < numRenderPasses; ++iii) {
                this.m_gpuPassTimeDeltas.set(renderer.GetRenderPass(iii).Name(), new Array(countsLength));
            }
        }
    }
    Update(timeDelta) {
        if (this.m_uiElement === null)
            return;
        this.m_jsStart = performance.now();
        this.m_fpsTimeDeltas[this.m_frameIndex] = timeDelta;
    }
    EndFrame(renderer) {
        if (this.m_uiElement === null)
            return;
        let jsDelta = performance.now() - this.m_jsStart;
        this.m_jsTimeDeltas[this.m_frameIndex] = jsDelta;
        let numRenderPasses = renderer.NumberOfRenderPasses();
        for (let iii = 0; iii < numRenderPasses; ++iii) {
            let renderPass = renderer.GetRenderPass(iii);
            let gpuDeltas;
            let gpuDeltasOrUndefined = this.m_gpuPassTimeDeltas.get(renderPass.Name());
            if (gpuDeltasOrUndefined === undefined) {
                gpuDeltas = new Array(this.m_jsTimeDeltas.length);
                this.m_gpuPassTimeDeltas.set(renderer.GetRenderPass(iii).Name(), gpuDeltas);
            }
            else {
                gpuDeltas = gpuDeltasOrUndefined;
            }
            gpuDeltas[this.m_frameIndex] = renderPass.GetLastGPUTimeMeasurement();
        }
        this.m_gpuPassTimeDeltas.forEach((value, key) => {
            if (!renderer.HasRenderPass(key))
                this.m_gpuPassTimeDeltas.delete(key);
        });
        this.m_frameIndex++;
        if (this.m_frameIndex >= this.m_jsTimeDeltas.length) {
            this.m_frameIndex = 0;
            let fpsAvg = this.m_fpsTimeDeltas.reduce((a, b) => a + b) / this.m_fpsTimeDeltas.length;
            let jsAvgDelta = this.m_jsTimeDeltas.reduce((a, b) => a + b) / this.m_jsTimeDeltas.length;
            this.m_uiElement.textContent = `fps: ${(1 / fpsAvg).toFixed(1)}\njs: ${jsAvgDelta.toFixed(1)}ms`;
            this.m_gpuPassTimeDeltas.forEach((values, name) => {
                let avgDelta = values.reduce((a, b) => a + b) / values.length;
                if (this.m_uiElement != null)
                    this.m_uiElement.textContent += `\n${name}: ${(avgDelta / 1000).toFixed(1)}us`;
            });
        }
    }
    m_jsStart = 0;
    m_fpsTimeDeltas;
    m_jsTimeDeltas;
    m_gpuPassTimeDeltas;
    m_frameIndex = 0;
    m_uiElement;
}
