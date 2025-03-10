import { LOG_CORE_ERROR, } from "./Log.js";
import { Renderer } from "./Renderer.js";
import { Application } from "./Application.js";
import { Timer } from "./Timer.js";
function fail(msg) {
    alert(msg);
}
function GetCanvas(canvasId) {
    let canvas = document.getElementById(canvasId);
    if (!canvas) {
        fail(`There is no html element with id = ${canvasId}`);
        throw new Error(`There is no html element with id = ${canvasId}`);
    }
    if (!(canvas instanceof HTMLCanvasElement)) {
        fail(`html element with id = ${canvasId} is NOT a canvas element`);
        throw new Error(`html element with id = ${canvasId} is NOT a canvas element`);
    }
    return canvas;
}
async function GetAdapterDeviceAndContext(canvas) {
    let adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
        fail('Failed to get GPUAdapter');
        throw new Error("Failed to get GPUAdapter");
    }
    let features = [];
    if (adapter.features.has('timestamp-query'))
        features.push("timestamp-query");
    let device = await adapter.requestDevice({
        requiredFeatures: features
    });
    const context = canvas.getContext('webgpu');
    if (!context) {
        fail('Failed to get the webgpu context from the canvas');
        throw new Error("Failed to get the webgpu context from the canvas");
    }
    return { adapter, device, context };
}
async function main() {
    try {
        let canvas = GetCanvas("main-canvas");
        let { adapter, device, context } = await GetAdapterDeviceAndContext(canvas);
        device.lost.then((info) => {
            let msg = `Caught Device Lost error. Reason: '${info.reason}'. Message: ${info.message}`;
            LOG_CORE_ERROR(msg);
            throw Error(msg);
        });
        let renderer = new Renderer(adapter, device, context);
        let application = new Application(renderer, canvas);
        await application.InitializeAsync();
        let timer = new Timer(true, "main() timer");
        function DoFrame() {
            let timeDelta = timer.Tick();
            application.Update(timeDelta);
            renderer.Render();
            application.EndFrame();
            requestAnimationFrame(DoFrame);
        }
        const observer = new ResizeObserver(entries => {
            for (const entry of entries) {
                const width = entry.devicePixelContentBoxSize?.[0].inlineSize ||
                    entry.contentBoxSize[0].inlineSize * devicePixelRatio;
                const height = entry.devicePixelContentBoxSize?.[0].blockSize ||
                    entry.contentBoxSize[0].blockSize * devicePixelRatio;
                const canvas = entry.target;
                canvas.width = Math.max(1, Math.min(width, device.limits.maxTextureDimension2D));
                canvas.height = Math.max(1, Math.min(height, device.limits.maxTextureDimension2D));
                application.OnCanvasResize(canvas.width, canvas.height);
            }
        });
        try {
            observer.observe(canvas, { box: 'device-pixel-content-box' });
        }
        catch {
            observer.observe(canvas, { box: 'content-box' });
        }
        requestAnimationFrame(DoFrame);
    }
    catch (err) {
        if (typeof err === "string") {
            LOG_CORE_ERROR(`Exception propagated up to main(). Type = 'string'. Message = '${err}'`);
        }
        else if (err instanceof Error) {
            LOG_CORE_ERROR(`Exception propagated up to main(). Type = 'Error'.\nName = '${err.name}'\nMessage = '${err.message}'\nCause = '${err.cause}'\nStack = '${err.stack}'`);
        }
        else {
            LOG_CORE_ERROR(`Exception propagated up to main(). Type = 'unknown'. Error = '${err}'`);
        }
    }
}
main();
