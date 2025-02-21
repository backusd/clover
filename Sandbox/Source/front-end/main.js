import { LOG_CORE_ERROR, LOG_INFO, } from "./Log.js";
import { Renderer } from "./Renderer.js";
import { Application } from "./Application.js";
import { Timer } from "./Timer.js";
import { HybridLookup } from "./Utils.js";
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
            //    requestAnimationFrame(DoFrame);
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
let a = new HybridLookup();
LOG_INFO(`Empty list: ${a.toString()}`);
a.add("first", 1);
a.add("second", 2);
a.add("third", 3);
a.add("forth", 4);
LOG_INFO(`Several items: ${a.toString()}`);
LOG_INFO(`Value at 'second': ${a.getFromKey('second')}`);
LOG_INFO(`Value at index 3: ${a.getFromIndex(3)}`);
LOG_INFO(`Contains key 'forth': ${a.containsKey('forth')}`);
LOG_INFO(`Contains key 'fifth': ${a.containsKey('fifth')}`);
LOG_INFO(`Index of key 'third': ${a.indexOfKey('third')}`);
a.updateFromKey("forth", 44);
a.updateFromIndex(2, 33);
LOG_INFO(`Values after updating: ${a.toString()}`);
a.removeFromKey("first");
LOG_INFO(`Removed key 'first': ${a.toString()}`);
a.removeFromIndex(2);
LOG_INFO(`Removed index 2: ${a.toString()}`);
a.clear();
LOG_INFO(`Cleared: ${a.toString()}`);
a.add("first", 1);
a.add("second", 2);
a.add("third", 3);
a.add("forth", 4);
a.add("fifth", 5);
a.add("sixth", 6);
a.add("seventh", 7);
a.add("eighth", 8);
a.add("ninth", 9);
a.add("tenth", 10);
LOG_INFO(`Added 10 elements: ${a.toString()}`);
let top5 = a.filter((value, index, key) => {
    return value > 5;
});
LOG_INFO(`>5 : ${top5}`);
a.removeIf((value, index, key) => {
    return value === 3 || value === 7 || key === "tenth";
});
LOG_INFO(`Removed 3, 7, 10: ${a.toString()}`);
//# sourceMappingURL=main.js.map