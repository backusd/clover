import { vec3 } from 'wgpu-matrix';
import
{
    LOG_CORE_INFO,
    LOG_CORE_TRACE,
    LOG_CORE_WARN,
    LOG_CORE_ERROR,
    LOG_INFO,
    LOG_TRACE,
    LOG_WARN,
    LOG_ERROR,
} from "./Log.js";
import { Renderer } from "./Renderer.js";
import { Application } from "./Application.js";
import { Timer } from "./Timer.js"

import { HybridLookup } from "./Utils.js"

function fail(msg: string)
{
    // eslint-disable-next-line no-alert
    alert(msg);
}

function GetCanvas(canvasId: string): HTMLCanvasElement
{
    // Get a WebGPU context from the canvas and configure it
    let canvas: HTMLElement | null = document.getElementById(canvasId)
    if (!canvas)
    {
        fail(`There is no html element with id = ${canvasId}`);
        throw new Error(`There is no html element with id = ${canvasId}`);
    }
    if (!(canvas instanceof HTMLCanvasElement))
    {
        fail(`html element with id = ${canvasId} is NOT a canvas element`);
        throw new Error(`html element with id = ${canvasId} is NOT a canvas element`);
    }

    return canvas;
}
async function GetDeviceAndContext(canvas: HTMLCanvasElement)
{
    let gpuAdapter: GPUAdapter | null = await navigator.gpu.requestAdapter();
    if (!gpuAdapter)
    {
        fail('Failed to get GPUAdapter');
        throw new Error("Failed to get GPUAdapter");
    }

    let device: GPUDevice = await gpuAdapter.requestDevice();

    const context: GPUCanvasContext | null = canvas.getContext('webgpu');
    if (!context)
    {
        fail('Failed to get the webgpu context from the canvas');
        throw new Error("Failed to get the webgpu context from the canvas");
    }

    return { device, context };
}

async function main()
{
    try
    {
        // Get the canvas from the id
        let canvas: HTMLCanvasElement = GetCanvas("main-canvas");

        // Asynchronously get the device and context
        let { device, context } = await GetDeviceAndContext(canvas);

        // Create the Renderer
        let renderer: Renderer = new Renderer(device, context);

        // Load the application (input handling, game logic, scene, etc)
        let application: Application = new Application(renderer, canvas);
        await application.InitializeAsync();

        // Begin the render loop
        let timer: Timer = new Timer(true, "main() timer");
        function DoFrame()
        {
            let timeDelta: number = timer.Tick();
            application.Update(timeDelta);

            // Note: The Application does NOT call render directly. Rather it is the responsibility of
            // the application to set up the RenderPasses, which the Renderer will loop over when rendering
            renderer.Render();

        //    requestAnimationFrame(DoFrame);
        }
        requestAnimationFrame(DoFrame);
    }
    catch (err: unknown)
    {
        if (typeof err === "string")
        {
            LOG_CORE_ERROR(`Exception propagated up to main(). Type = 'string'. Message = '${err}'`);
        }
        else if (err instanceof Error)
        {
            LOG_CORE_ERROR(`Exception propagated up to main(). Type = 'Error'.\nName = '${err.name}'\nMessage = '${err.message}'\nCause = '${err.cause}'\nStack = '${err.stack}'`);
        }
        else
        {
            LOG_CORE_ERROR(`Exception propagated up to main(). Type = 'unknown'. Error = '${err}'`);
        }
    }
}

main();