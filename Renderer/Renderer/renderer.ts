import { vec3 } from 'wgpu-matrix';
import {
    LOG_CORE_INFO,
    LOG_CORE_TRACE,
    LOG_CORE_WARN,
    LOG_CORE_ERROR
} from "./Log.js"
import { Camera } from "./Camera.js"
import { HybridLookup } from "./Utils.js"



export class Mesh
{
    public CreateMeshFromRawData(name: string, rawVertexData: Float32Array, floatsPerVertex: number, indices: Uint16Array | Uint32Array | null = null): void
    {
        this.m_name = name;
        this.m_rawVertexData = rawVertexData;
        this.m_indices = indices;
        this.m_floatsPerVertex = floatsPerVertex;

        LOG_CORE_TRACE(`Mesh::CreateMeshFromRawData: name = ${this.m_name} | rawVertexData.length = ${this.m_rawVertexData.length} | floatsPerVertex = ${this.m_floatsPerVertex}`);
    }
    public CreateMeshFromFile(file: string): void
    {
        LOG_CORE_WARN("Mesh::CreateMeshFromFile not yet implemented");
    }

    public RawVertexData(): Float32Array
    {
        return this.m_rawVertexData;
    }
    public HasIndices(): boolean
    {
        return this.m_indices !== null;
    }
    public IndicesAreUint16(): boolean
    {
        return this.m_indices !== null && this.m_indices instanceof Uint16Array;
    }
    public IndicesAreUint32(): boolean
    {
        return this.m_indices !== null && this.m_indices instanceof Uint32Array;
    }
    public IndicesUint16(): Uint16Array
    {
        if (this.m_indices === null)
            throw Error(`Mesh(name = '${this.m_name}') - Invalid call to IndicesUint16 because m_indices is null`);

        if (this.m_indices instanceof Uint32Array)
            throw Error(`Mesh(name = '${this.m_name}') - Invalid call to IndicesUint16 because m_indices is Uint32Array`);

        return this.m_indices;
    }
    public IndicesUint32(): Uint32Array
    {
        if (this.m_indices === null)
            throw Error(`Mesh(name = '${this.m_name}') - Invalid call to IndicesUint32 because m_indices is null`);

        if (this.m_indices instanceof Uint16Array)
            throw Error(`Mesh(name = '${this.m_name}') - Invalid call to IndicesUint32 because m_indices is Uint16Array`);

        return this.m_indices;
    }
    public Name(): string
    {
        return this.m_name;
    }
    public IsIndexCompatible(otherMesh: Mesh): boolean
    {
        if (this.m_indices === null && otherMesh.m_indices === null)
            return true;

        if (this.m_indices instanceof Uint16Array && otherMesh.m_indices instanceof Uint16Array)
            return true;

        if (this.m_indices instanceof Uint32Array && otherMesh.m_indices instanceof Uint32Array)
            return true;

        return false;
    }
    public VertexCount(): number
    {
        // The vertices array holds all the raw data, but one vertex will likely consist of
        // several elements. For example, suppose each vertex looks like
        //     { position: float4, color: float4 }
        // Then each vertex consists of 8 floats.
        // So the formula is numVertices = total_floats / floats_per_vertex
        return this.m_rawVertexData.length / this.m_floatsPerVertex;
    }
    public IndexCount(): number
    {
        if (this.m_indices === null)
            return 0;

        if (this.m_indices instanceof Uint16Array)
            return this.m_indices.length / 2;

        return this.m_indices.length / 4;
    }
    public VertexStride(): number
    {
        // Each float is 4 bytes, and for 'stride' we want the total number of bytes
        return this.m_floatsPerVertex * 4;
    }
    public TotalVertexByteCount(): number
    {
        return this.m_rawVertexData.length;
    }
    public TotalIndexByteCount(): number
    {
        if (this.m_indices === null)
            return 0;

        return this.m_indices.length;
    }

    private m_name: string = "";
    private m_rawVertexData: Float32Array = new Float32Array();
    private m_indices: Uint16Array | Uint32Array | null = null;
    private m_floatsPerVertex: number = 0;
}
class MeshDescriptor
{
    public vertexCount: number = 0;
    public startVertex: number = 0;
    public instanceCount: number | undefined = undefined;
    public startInstance: number | undefined = undefined;
}
export class MeshGroup
{
    constructor(name: string, device: GPUDevice, meshes: Mesh[] = [], vertexBufferSlot: number = 0)
    {
        this.m_name = name;
        this.m_device = device;
        this.m_vertexBufferSlot = vertexBufferSlot;
        this.m_meshes = new HybridLookup<Mesh>();
        this.m_meshDescriptors = new HybridLookup<MeshDescriptor>();
        this.m_indexFormat = "uint32";

        LOG_CORE_TRACE(`MeshGroup constructor() - name = ${name} | # meshes = ${meshes.length} | slot = ${vertexBufferSlot}`);

        this.RebuildBuffers(meshes);
    }
    public AddMesh(mesh: Mesh): void
    {
        // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
        // NOTE: Really brute-force approach is used here where we just create a whole new buffer from scratch.
        //       A likely better approach would be to create a new buffer of a larger size, copy the existing
        //       buffer to the new buffer (copy is done on the GPU), and then write our new mesh data to the end
        //       of the new buffer. Definitely more complicated and may run into issues with buffer lifetimes (?),
        //       but has the benefit of not sending a bunch of vertices to the GPU that already exist in a GPU buffer.
        // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

        // Make sure the new mesh is index compatible
        if (this.m_meshes.size() > 0)
        {
            if (!this.m_meshes.get(0).IsIndexCompatible(mesh))
                throw Error(`Mesh '${mesh.Name()}' cannot be added to the MeshGroup '${this.m_name}' because it is not index compatible`);
        }

        // Create an array of all meshes with the new one at the end
        let meshes: Mesh[] = [];
        for (let iii = 0; iii < this.m_meshes.size(); iii++)
            meshes.push(this.m_meshes.get(iii));
        meshes.push(mesh);

        // Rebuild the buffers
        this.RebuildBuffers(meshes);
    }
    public RemoveMesh(meshId: string | number): void
    {
        if (typeof meshId === "string")
            this.RemoveMeshImpl(this.m_meshes.indexOf(meshId));
        else if (typeof meshId === "number")
            this.RemoveMeshImpl(meshId);
    }
    private RemoveMeshImpl(meshIndex: number): void
    {
        // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
        // NOTE: Really brute-force approach is used here where we create a whole new buffer from scratch.
        //       A likely better approach would be to create a new buffer on the GPU of a smaller size and then
        //       perform 2 writes between the buffers: 1 copy for the data that preceded the erased data and 1
        //       copy for the data that comes after the erased data. Not sure if you'd run into buffer lifetime
        //       issues. This has the obvious benefit though of not sending any vertices to the GPU.
        // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

        // Create an array of meshes, but exclude the one we are removing
        let meshes: Mesh[] = [];
        for (let iii = 0; iii < this.m_meshes.size(); iii++)
        {
            if (iii === meshIndex)
                continue;

            meshes.push(this.m_meshes.get(iii));
        }

        // Rebuild the buffers
        this.RebuildBuffers(meshes);
    }
    public Render(encoder: GPURenderPassEncoder): void
    {
        // Vertex Buffer
        encoder.setVertexBuffer(this.m_vertexBufferSlot, this.m_vertexBuffer);

        // Index Buffer
        if (this.m_indexBuffer !== null)
            encoder.setIndexBuffer(this.m_indexBuffer, this.m_indexFormat);

        // Draw call
        for (let iii = 0; iii < this.m_meshDescriptors.size(); iii++)
        {
            let md = this.m_meshDescriptors.get(iii);
            encoder.draw(md.vertexCount, md.instanceCount, md.startVertex, md.startInstance);
        }
    }
    private CheckIndexFormat(meshes: Mesh[]): void
    {
        // Before creating the buffers, we first need to make sure all the meshes use the same index format
        if (meshes.length > 1)
        {
            // Index format will default to "uint32", so if they are actually Uint16, then we need to update the format
            if (meshes[0].IndicesAreUint16())
                this.m_indexFormat = "uint16";

            for (let iii = 1; iii < meshes.length; iii++)
            {
                if (!meshes[0].IsIndexCompatible(meshes[iii]))
                    throw Error(`Meshes '${meshes[0].Name()}' and '${meshes[iii].Name()}' cannot be in the same MeshGroup because their indices are not compatible`);
            }
        }
    }
    private RebuildBuffers(meshes: Mesh[]): void
    {
        LOG_CORE_TRACE(`MeshGroup::RebuildBuffers() - name = ${this.m_name} | # meshes = ${meshes.length}`);

        // Perform validation checks before continuing
        this.CheckIndexFormat(meshes);

        // Clear the containers for meshes and descriptors
        this.m_meshes.clear();
        this.m_meshDescriptors.clear();

        // 1. Add each mesh to the HybridLookup list
        // 2. Create a mesh descriptor for the mesh
        // 3. Update the total count of all vertices
        // 4. Update the total count of all indices
        let totalVertexCount = 0;
        let totalVertexBytes = 0;
        let totalIndexCount = 0;
        let totalIndexBytes = 0;
        for (const mesh of meshes)
        {
            this.m_meshes.add(mesh.Name(), mesh);

            let md = new MeshDescriptor();
            md.vertexCount = mesh.VertexCount();
            md.startVertex = totalVertexCount;
            this.m_meshDescriptors.add(mesh.Name(), md);

            totalVertexCount += mesh.VertexCount();
            totalVertexBytes += mesh.TotalVertexByteCount();

            totalIndexCount += mesh.IndexCount();
            totalIndexBytes += mesh.TotalIndexByteCount();
        }

        LOG_CORE_TRACE(`MeshGroup::RebuildBuffers() - Total vertices = ${totalVertexCount} | Total indices = ${totalIndexCount}`);

        // Create an array to hold all the vertices and then append them all
        let allVertices: Float32Array = new Float32Array(totalVertexBytes);
        let offset = 0;
        for (const mesh of meshes)
        {
            allVertices.set(mesh.RawVertexData(), offset);
            offset += mesh.TotalVertexByteCount();
        }

        // Create the vertex buffer from the mesh data
        this.m_vertexBuffer = this.m_device.createBuffer({
            label: `${this.m_name} - VertexBuffer`,
            size: allVertices.byteLength,
            usage: GPUBufferUsage.VERTEX,
            mappedAtCreation: true,
        });
        new Float32Array(this.m_vertexBuffer.getMappedRange()).set(allVertices);
        this.m_vertexBuffer.unmap();

        // Only create the index buffer if there are indices to load
        if (totalIndexBytes > 0)
        {
            if (meshes[0].IndicesAreUint16())
            {
                let allIndices: Uint16Array = new Uint16Array(totalIndexBytes);
                let indexOffset = 0;
                for (const mesh of meshes)
                {
                    allIndices.set(mesh.IndicesUint16(), indexOffset);
                    indexOffset += mesh.TotalIndexByteCount();
                }

                // Create the index buffer from the index data
                this.m_indexBuffer = this.m_device.createBuffer({
                    label: `${this.m_name} - IndexBuffer`,
                    size: allIndices.byteLength,
                    usage: GPUBufferUsage.INDEX,
                    mappedAtCreation: true,
                });
                new Uint16Array(this.m_indexBuffer.getMappedRange()).set(allIndices);
                this.m_indexBuffer.unmap();
            }
            else
            {
                let allIndices: Uint32Array = new Uint32Array(totalIndexBytes);
                let indexOffset = 0;
                for (const mesh of meshes)
                {
                    allIndices.set(mesh.IndicesUint32(), indexOffset);
                    indexOffset += mesh.TotalIndexByteCount();
                }

                // Create the index buffer from the index data
                this.m_indexBuffer = this.m_device.createBuffer({
                    label: `${this.m_name} - IndexBuffer`,
                    size: allIndices.byteLength,
                    usage: GPUBufferUsage.INDEX,
                    mappedAtCreation: true,
                });
                new Uint32Array(this.m_indexBuffer.getMappedRange()).set(allIndices);
                this.m_indexBuffer.unmap();
            }
        }
        else
        {
            this.m_indexBuffer = null;
        }
    }
    public SetInstanceCount(meshId: number | string, count: number): void
    {
        this.m_meshDescriptors.get(meshId).instanceCount = count;
        this.m_meshDescriptors.get(meshId).startInstance = 0;
    }



    private m_name: string;
    private m_device: GPUDevice;
    private m_meshes: HybridLookup<Mesh>;
    private m_meshDescriptors: HybridLookup<MeshDescriptor>;    
    private m_vertexBuffer!: GPUBuffer;
    private m_indexBuffer: GPUBuffer | null = null;
    private m_indexFormat: "uint16" | "uint32";
    private m_vertexBufferSlot: number;
}
export class BindGroup
{
    constructor(groupNumber: number, bindGroup: GPUBindGroup)
    {
        this.m_groupNumber = groupNumber;
        this.m_bindGroup = bindGroup;
    }
    public GetGroupNumber(): number
    {
        return this.m_groupNumber;
    }
    public GetBindGroup(): GPUBindGroup
    {
        return this.m_bindGroup;
    }

    private m_bindGroup: GPUBindGroup;
    private m_groupNumber: number;
}
export class RenderPassLayer
{
    constructor(pipeline: GPURenderPipeline)
    {
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
    public Render(passEncoder: GPURenderPassEncoder): void
    {
        // Set the pipeline
        passEncoder.setPipeline(this.m_renderPipeline);

        // Set the BindGroups
        this.m_bindGroups.forEach(bindGroup =>
        {
            passEncoder.setBindGroup(bindGroup.GetGroupNumber(), bindGroup.GetBindGroup());
        });

        // Set the mesh group
        // !!! This will make a draw call for each mesh in the group !!!
        this.m_meshGroups.forEach(meshGroup => { meshGroup.Render(passEncoder); });
    }
    private m_renderPipeline: GPURenderPipeline;
    private m_bindGroups: BindGroup[];
    private m_meshGroups: MeshGroup[];
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
    constructor(descriptor: RenderPassDescriptor)
    {
        this.m_renderPassDescriptor = descriptor;
        this.m_bindGroups = [];
        this.m_layers = [];
    }
    public AddBindGroup(bindGroup: BindGroup): void
    {
        this.m_bindGroups.push(bindGroup);
    }
    public AddRenderPassLayer(layer: RenderPassLayer): void
    {
        this.m_layers.push(layer);
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

        // Set the BindGroups that will be used for the entire render pass
        this.m_bindGroups.forEach(bindGroup =>
        {
            passEncoder.setBindGroup(bindGroup.GetGroupNumber(), bindGroup.GetBindGroup());
        });

        // Run each layer
        this.m_layers.forEach(layer => { layer.Render(passEncoder); })

        passEncoder.end();
    }

    private m_renderPassDescriptor: RenderPassDescriptor;
    private m_bindGroups: BindGroup[];
    private m_layers: RenderPassLayer[];
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