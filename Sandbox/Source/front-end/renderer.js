export class Renderer {
    constructor(device, context) {
        this.m_device = device;
        this.m_context = context;
        const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
        const config = {
            device: this.m_device,
            format: presentationFormat
        };
        this.m_context.configure(config);
        /*
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

        this.m_pipeline = this.m_device.createRenderPipeline({
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
                    view: this.m_context.getCurrentTexture().createView(),
                    clearValue: [0.3, 0.3, 0.3, 1],
                    loadOp: 'clear',
                    storeOp: 'store',
                },
            ],
        };
        */
    }
    Render(camera) {
        //this.RenderTriangleExample();
    }
    RenderTriangleExample() {
        // Get the current texture from the canvas context and
        // set it as the texture to render to.
        //renderPassDescriptor.colorAttachments[0].view =
        //    context.getCurrentTexture().createView();
        // make a command encoder to start encoding commands
        //       const encoder: GPUCommandEncoder = this.m_device.createCommandEncoder({ label: 'our encoder' });
        //
        //       // make a render pass encoder to encode render specific commands
        //       const pass: GPURenderPassEncoder = encoder.beginRenderPass(this.m_renderPassDescriptor);
        //       pass.setPipeline(this.m_pipeline);
        //       pass.draw(3);  // call our vertex shader 3 times.
        //       pass.end();
        //
        //       const commandBuffer: GPUCommandBuffer = encoder.finish();
        //       this.m_device.queue.submit([commandBuffer]);
    }
    GetDevice() {
        return this.m_device;
    }
    GetContext() {
        return this.m_context;
    }
    m_device;
    m_context;
}
//# sourceMappingURL=Renderer.js.map