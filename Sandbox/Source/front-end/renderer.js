import { vec3 } from 'wgpu-matrix';
import Log from "./Log.js";
function fail(msg) {
    // eslint-disable-next-line no-alert
    alert(msg);
    Log(msg);
}
class Renderer {
    constructor(device, context) {
        this.m_device = device;
        this.m_context = context;
        const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
        const config = {
            device: this.m_device,
            format: presentationFormat
        };
        this.m_context.configure(config);
        const module = this.m_device.createShaderModule({
            label: 'our hardcoded red triangle shaders',
            code: `
      @vertex fn vs(
        @builtin(vertex_index) vertexIndex : u32
      ) -> @builtin(position) vec4f {
        let pos = array(
          vec2f( 0.0,  0.5),  // top center
          vec2f(-0.5, -0.5),  // bottom left
          vec2f( 0.5, -0.5)   // bottom right
        );

        return vec4f(pos[vertexIndex], 0.0, 1.0);
      }

      @fragment fn fs() -> @location(0) vec4f {
        return vec4f(1, 0, 0, 1);
      }
    `,
        });
        this.m_pipeline = device.createRenderPipeline({
            label: 'our hardcoded red triangle pipeline',
            layout: 'auto',
            vertex: {
                module,
            },
            fragment: {
                module,
                targets: [{ format: presentationFormat }],
            },
        });
        this.m_renderPassDescriptor = {
            label: 'our basic canvas renderPass',
            colorAttachments: [
                {
                    // view: <- to be filled out when we render
                    view: context.getCurrentTexture().createView(),
                    clearValue: [0.3, 0.3, 0.3, 1],
                    loadOp: 'clear',
                    storeOp: 'store',
                },
            ],
        };
    }
    Render() {
        // Get the current texture from the canvas context and
        // set it as the texture to render to.
        //renderPassDescriptor.colorAttachments[0].view =
        //    context.getCurrentTexture().createView();
        // make a command encoder to start encoding commands
        const encoder = this.m_device.createCommandEncoder({ label: 'our encoder' });
        // make a render pass encoder to encode render specific commands
        const pass = encoder.beginRenderPass(this.m_renderPassDescriptor);
        pass.setPipeline(this.m_pipeline);
        pass.draw(3); // call our vertex shader 3 times.
        pass.end();
        const commandBuffer = encoder.finish();
        this.m_device.queue.submit([commandBuffer]);
    }
    m_device;
    m_context;
    m_renderPassDescriptor;
    m_pipeline;
}
async function GetDeviceAndContext(canvasId) {
    let gpuAdapter = await navigator.gpu.requestAdapter();
    if (!gpuAdapter) {
        fail('Failed to get GPUAdapter');
        throw 1;
    }
    let device = await gpuAdapter.requestDevice();
    // Get a WebGPU context from the canvas and configure it
    let canvas = document.getElementById(canvasId);
    if (!canvas) {
        fail(`There is no html element with id = ${canvasId}`);
        throw 1;
    }
    if (!(canvas instanceof HTMLCanvasElement)) {
        fail(`html element with id = ${canvasId} is NOT a canvas element`);
        throw 1;
    }
    const context = canvas.getContext('webgpu');
    if (!context) {
        fail('Failed to get the webgpu context from the canvas');
        throw 1;
    }
    return { device, context };
}
async function main() {
    // Asynchronously get the device and context
    let { device, context } = await GetDeviceAndContext("main-canvas");
    // Create the Renderer
    let renderer = new Renderer(device, context);
    // Load the scene
    const v1 = vec3.fromValues(0, 1, 2);
    const v2 = vec3.fromValues(3, 4, 5);
    console.log(vec3.add(v1, v2));
    // Begin the render loop
    function render() {
        renderer.Render();
        requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
}
main();
//# sourceMappingURL=renderer.js.map