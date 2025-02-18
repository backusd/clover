import { vec3 } from 'wgpu-matrix';
import {
    LOG_CORE_INFO,
    LOG_CORE_TRACE,
    LOG_CORE_WARN,
    LOG_CORE_ERROR
} from "./Log.js"
import { Camera } from "./Camera.js"


export class MeshDescriptor
{
    public vertexCount: number = 0;
    public startVertex: number = 0;
    public instanceCount: number | undefined = undefined;
    public startInstance: number | undefined = undefined;
}
export class MeshGroup
{
    constructor(buffer: GPUBuffer, slot: number)
    {
        this.m_vertexBuffer = buffer;
        this.m_vertexBufferSlot = slot;
        this.m_meshDescriptors = [];
    }
    public AddMeshDescriptor(descriptor: MeshDescriptor): void
    {
        this.m_meshDescriptors.push(descriptor);
    }
    public Render(encoder: GPURenderPassEncoder): void
    {
        encoder.setVertexBuffer(this.m_vertexBufferSlot, this.m_vertexBuffer);
        this.m_meshDescriptors.forEach(mesh =>
        {
            encoder.draw(mesh.vertexCount, mesh.instanceCount, mesh.startVertex, mesh.startInstance);
        });
    }

    private m_vertexBuffer: GPUBuffer;
    private m_vertexBufferSlot: number;
    private m_meshDescriptors: MeshDescriptor[];
}
export class BindGroup
{
    constructor(index: number, bindGroup: GPUBindGroup)
    {
        this.m_index = index;
        this.m_bindGroup = bindGroup;
    }
    public GetIndex(): number
    {
        return this.m_index;
    }
    public GetBindGroup(): GPUBindGroup
    {
        return this.m_bindGroup;
    }

    private m_bindGroup: GPUBindGroup;
    private m_index: number;
}
export class RenderPassDescriptor
{
    constructor(descriptor: GPURenderPassDescriptor)
    {
        this.m_renderPassDescriptor = descriptor;

        // The default preparation will be to set the TextureView for the first colorAttachment
        // for the current canvas context
        this.Prepare = (context: GPUCanvasContext) =>
        {
            for (let item of this.m_renderPassDescriptor.colorAttachments)
            {
                if (item)
                    item.view = context.getCurrentTexture().createView();
                break;
            }
        };
    }
    public GetDescriptor(): GPURenderPassDescriptor
    {
        return this.m_renderPassDescriptor;
    }

    public Prepare: (context: GPUCanvasContext) => void;
    private m_renderPassDescriptor: GPURenderPassDescriptor;     
}
export class RenderPass
{
    constructor(descriptor: RenderPassDescriptor, pipeline: GPURenderPipeline)
    {
        this.m_renderPassDescriptor = descriptor;
        this.m_renderPipeline = pipeline;
        this.m_bindGroups = [];
        this.m_meshGroups = [];
    }
    public AddBindGroup(bindGroup: BindGroup): void
    {
        this.m_bindGroups.push(bindGroup);
    }
    public AddMeshGroup(meshGroup: MeshGroup): void
    {
        this.m_meshGroups.push(meshGroup);
    }
    public Render(device: GPUDevice, context: GPUCanvasContext, encoder: GPUCommandEncoder): void
    {
        // Prepare is a user-defined callback to make any final adjustments to the descriptor
        // before recording render commands. The default case is to set the TextureView for
        // the first colorAttachment for the current canvas context
        this.m_renderPassDescriptor.Prepare(context);

        // Create the encoder for this render pass
        const passEncoder = encoder.beginRenderPass(this.m_renderPassDescriptor.GetDescriptor());
        passEncoder.label = "Basic RenderPassEncoder";

        // Set the pipeline
        passEncoder.setPipeline(this.m_renderPipeline);

        // Set the BindGroups
        this.m_bindGroups.forEach(bindGroup =>
        {
            passEncoder.setBindGroup(bindGroup.GetIndex(), bindGroup.GetBindGroup());
        });

        // Set the mesh group
        // !!! This will make a draw call for each mesh in the group !!!
        this.m_meshGroups.forEach(meshGroup => { meshGroup.Render(passEncoder); });

        passEncoder.end();
    }

    private m_renderPassDescriptor: RenderPassDescriptor;
    private m_renderPipeline: GPURenderPipeline;
    private m_bindGroups: BindGroup[];
    private m_meshGroups: MeshGroup[];
}
export class Renderer
{
    constructor(device : GPUDevice, context : GPUCanvasContext)
    {
        this.m_device = device;
        this.m_context = context;

        this.m_context.configure({
            device: this.m_device,
            format: navigator.gpu.getPreferredCanvasFormat()
        });

        this.m_renderPasses = [];
    }
    public Render(): void
    {
        // Must create a new command encoder for each frame. GPUCommandEncoder is 
        // specifically designed to not be reusable.
        let commandEncoder = this.m_device.createCommandEncoder({ label: "Renderer command encoder" });

        // Run each render pass
        this.m_renderPasses.forEach(
            pass => { pass.Render(this.m_device, this.m_context, commandEncoder); }
        );

        // Finalize the command encoder and submit it for rendering
        this.m_device.queue.submit([commandEncoder.finish()]);
    }
    public AddRenderPass(pass: RenderPass): void
    {
        this.m_renderPasses.push(pass);
    }
    public GetDevice(): GPUDevice
    {
        return this.m_device;
    }
    public GetContext(): GPUCanvasContext
    {
        return this.m_context;
    }

    private m_device:  GPUDevice;
    private m_context: GPUCanvasContext;
    private m_renderPasses: RenderPass[];
}