import { LOG_CORE_ERROR, } from "./Log.js";
import { Renderer } from "./Renderer.js";
import { Application } from "./Application.js";
import { Timer } from "./Timer.js";
function fail(msg) {
    // eslint-disable-next-line no-alert
    alert(msg);
}
function GetCanvas(canvasId) {
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
    return canvas;
}
async function GetDeviceAndContext(canvas) {
    let gpuAdapter = await navigator.gpu.requestAdapter();
    if (!gpuAdapter) {
        fail('Failed to get GPUAdapter');
        throw new Error("Failed to get GPUAdapter");
    }
    let device = await gpuAdapter.requestDevice();
    const context = canvas.getContext('webgpu');
    if (!context) {
        fail('Failed to get the webgpu context from the canvas');
        throw new Error("Failed to get the webgpu context from the canvas");
    }
    return { device, context };
}
async function main() {
    try {
        // Get the canvas from the id
        let canvas = GetCanvas("main-canvas");
        // Asynchronously get the device and context
        let { device, context } = await GetDeviceAndContext(canvas);
        // Create the Renderer
        let renderer = new Renderer(device, context);
        // Load the application (input handling, game logic, scene, etc)
        let application = new Application(renderer, canvas);
        await application.InitializeAsync();
        // Begin the render loop
        let timer = new Timer(true, "main() timer");
        function DoFrame() {
            let timeDelta = timer.Tick();
            application.Update(timeDelta);
            // Note: The Application does NOT call render directly. Rather it is the responsibility of
            // the application to set up the RenderPasses, which the Renderer will loop over when rendering
            renderer.Render();
            requestAnimationFrame(DoFrame);
        }
        // Set up the ResizeObserver (see: https://webgpufundamentals.org/webgpu/lessons/webgpu-resizing-the-canvas.html)
        const observer = new ResizeObserver(entries => {
            for (const entry of entries) {
                const width = entry.devicePixelContentBoxSize?.[0].inlineSize ||
                    entry.contentBoxSize[0].inlineSize * devicePixelRatio;
                const height = entry.devicePixelContentBoxSize?.[0].blockSize ||
                    entry.contentBoxSize[0].blockSize * devicePixelRatio;
                const canvas = entry.target;
                canvas.width = Math.max(1, Math.min(width, device.limits.maxTextureDimension2D));
                canvas.height = Math.max(1, Math.min(height, device.limits.maxTextureDimension2D));
                // Inform the application of the resize. Depth-stencil textures will need to be resized
                application.OnCanvasResize(canvas.width, canvas.height);
                // re-render
                requestAnimationFrame(DoFrame);
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
//# sourceMappingURL=main.js.map