export class MeshDescriptor {
    vertexCount = 0;
    startVertex = 0;
    instanceCount = undefined;
    startInstance = undefined;
}
export class MeshGroup {
    constructor(buffer, slot) {
        this.m_vertexBuffer = buffer;
        this.m_vertexBufferSlot = slot;
        this.m_meshDescriptors = [];
    }
    AddMeshDescriptor(descriptor) {
        this.m_meshDescriptors.push(descriptor);
    }
    Render(encoder) {
        encoder.setVertexBuffer(this.m_vertexBufferSlot, this.m_vertexBuffer);
        this.m_meshDescriptors.forEach(mesh => {
            encoder.draw(mesh.vertexCount, mesh.instanceCount, mesh.startVertex, mesh.startInstance);
        });
    }
    m_vertexBuffer;
    m_vertexBufferSlot;
    m_meshDescriptors;
}
export class BindGroup {
    constructor(groupNumber, bindGroup) {
        this.m_groupNumber = groupNumber;
        this.m_bindGroup = bindGroup;
    }
    GetGroupNumber() {
        return this.m_groupNumber;
    }
    GetBindGroup() {
        return this.m_bindGroup;
    }
    m_bindGroup;
    m_groupNumber;
}
export class RenderPassLayer {
    constructor(pipeline) {
        this.m_renderPipeline = pipeline;
        this.m_bindGroups = [];
        this.m_meshGroups = [];
    }
    AddBindGroup(bindGroup) {
        this.m_bindGroups.push(bindGroup);
    }
    AddMeshGroup(meshGroup) {
        this.m_meshGroups.push(meshGroup);
    }
    Render(passEncoder) {
        // Set the pipeline
        passEncoder.setPipeline(this.m_renderPipeline);
        // Set the BindGroups
        this.m_bindGroups.forEach(bindGroup => {
            passEncoder.setBindGroup(bindGroup.GetGroupNumber(), bindGroup.GetBindGroup());
        });
        // Set the mesh group
        // !!! This will make a draw call for each mesh in the group !!!
        this.m_meshGroups.forEach(meshGroup => { meshGroup.Render(passEncoder); });
    }
    m_renderPipeline;
    m_bindGroups;
    m_meshGroups;
}
export class RenderPassDescriptor {
    constructor(descriptor) {
        this.m_renderPassDescriptor = descriptor;
        // The default preparation will be to set the TextureView for the first colorAttachment
        // for the current canvas context
        this.Prepare = (context) => {
            for (let item of this.m_renderPassDescriptor.colorAttachments) {
                if (item)
                    item.view = context.getCurrentTexture().createView();
                break;
            }
        };
    }
    GetDescriptor() {
        return this.m_renderPassDescriptor;
    }
    Prepare;
    m_renderPassDescriptor;
}
export class RenderPass {
    constructor(descriptor) {
        this.m_renderPassDescriptor = descriptor;
        this.m_bindGroups = [];
        this.m_layers = [];
    }
    AddBindGroup(bindGroup) {
        this.m_bindGroups.push(bindGroup);
    }
    AddRenderPassLayer(layer) {
        this.m_layers.push(layer);
    }
    Render(device, context, encoder) {
        // Prepare is a user-defined callback to make any final adjustments to the descriptor
        // before recording render commands. The default case is to set the TextureView for
        // the first colorAttachment for the current canvas context
        this.m_renderPassDescriptor.Prepare(context);
        // Create the encoder for this render pass
        const passEncoder = encoder.beginRenderPass(this.m_renderPassDescriptor.GetDescriptor());
        passEncoder.label = "Basic RenderPassEncoder";
        // Set the BindGroups that will be used for the entire render pass
        this.m_bindGroups.forEach(bindGroup => {
            passEncoder.setBindGroup(bindGroup.GetGroupNumber(), bindGroup.GetBindGroup());
        });
        // Run each layer
        this.m_layers.forEach(layer => { layer.Render(passEncoder); });
        passEncoder.end();
    }
    m_renderPassDescriptor;
    m_bindGroups;
    m_layers;
}
export class Renderer {
    constructor(device, context) {
        this.m_device = device;
        this.m_context = context;
        this.m_context.configure({
            device: this.m_device,
            format: navigator.gpu.getPreferredCanvasFormat()
        });
        this.m_renderPasses = [];
    }
    Render() {
        // Must create a new command encoder for each frame. GPUCommandEncoder is 
        // specifically designed to not be reusable.
        let commandEncoder = this.m_device.createCommandEncoder({ label: "Renderer command encoder" });
        // Run each render pass
        this.m_renderPasses.forEach(pass => { pass.Render(this.m_device, this.m_context, commandEncoder); });
        // Finalize the command encoder and submit it for rendering
        this.m_device.queue.submit([commandEncoder.finish()]);
    }
    AddRenderPass(pass) {
        this.m_renderPasses.push(pass);
    }
    GetDevice() {
        return this.m_device;
    }
    GetContext() {
        return this.m_context;
    }
    m_device;
    m_context;
    m_renderPasses;
}
//# sourceMappingURL=Renderer.js.map