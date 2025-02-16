import { vec3 } from 'wgpu-matrix';
import {
    LOG_CORE_INFO,
    LOG_CORE_TRACE,
    LOG_CORE_WARN,
    LOG_CORE_ERROR,
    LOG_INFO,
    LOG_TRACE,
    LOG_WARN,
    LOG_ERROR,
    } from "./Log.js"

export class Renderer
{
    constructor(device : GPUDevice, context : GPUCanvasContext)
    {
        this.m_device = device;
        this.m_context = context;

        const presentationFormat: GPUTextureFormat = navigator.gpu.getPreferredCanvasFormat();
        const config: GPUCanvasConfiguration = {
            device: this.m_device,
            format: presentationFormat
        };
        this.m_context.configure(config);

        const module: GPUShaderModule = this.m_device.createShaderModule({
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

    public Render(): void
    {
        // Get the current texture from the canvas context and
        // set it as the texture to render to.
        //renderPassDescriptor.colorAttachments[0].view =
        //    context.getCurrentTexture().createView();

        // make a command encoder to start encoding commands
        const encoder: GPUCommandEncoder = this.m_device.createCommandEncoder({ label: 'our encoder' });

        // make a render pass encoder to encode render specific commands
        const pass: GPURenderPassEncoder = encoder.beginRenderPass(this.m_renderPassDescriptor);
        pass.setPipeline(this.m_pipeline);
        pass.draw(3);  // call our vertex shader 3 times.
        pass.end();

        const commandBuffer: GPUCommandBuffer = encoder.finish();
        this.m_device.queue.submit([commandBuffer]);
    }

    private m_device:  GPUDevice;
    private m_context: GPUCanvasContext;
    private m_renderPassDescriptor: GPURenderPassDescriptor;
    private m_pipeline: GPURenderPipeline;
}