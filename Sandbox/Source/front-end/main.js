import { LOG_CORE_ERROR, } from "./Log.js";
import { Renderer } from "./Renderer.js";
import { Application } from "./Application.js";
function fail(msg) {
    // eslint-disable-next-line no-alert
    alert(msg);
}
async function GetDeviceAndContext(canvasId) {
    let gpuAdapter = await navigator.gpu.requestAdapter();
    if (!gpuAdapter) {
        fail('Failed to get GPUAdapter');
        throw new Error("Failed to get GPUAdapter");
    }
    let device = await gpuAdapter.requestDevice();
    // Get a WebGPU context from the canvas and configure it
    let canvas = document.getElementById(canvasId);
    if (!canvas) {
        fail(`There is no html element with id = ${canvasId}`);
        throw new Error(`There is no html element with id = ${canvasId}`);
    }
    if (!(canvas instanceof HTMLCanvasElement)) {
        fail(`html element with id = ${canvasId} is NOT a canvas element`);
        throw new Error(`html element with id = ${canvasId} is NOT a canvas element`);
    }
    const context = canvas.getContext('webgpu');
    if (!context) {
        fail('Failed to get the webgpu context from the canvas');
        throw new Error("Failed to get the webgpu context from the canvas");
    }
    return { device, context };
}
async function main() {
    try {
        // Asynchronously get the device and context
        let { device, context } = await GetDeviceAndContext("main-canvas");
        // Create the Renderer
        let renderer = new Renderer(device, context);
        // Load the application (input handling, game logic, scene, etc)
        let application = new Application(renderer);
        await application.InitializeAsync();
        // Begin the render loop
        function render() {
            application.Update();
            application.Render();
            renderer.Render();
            requestAnimationFrame(render);
        }
        requestAnimationFrame(render);
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
//# sourceMappingURL=main.js.map