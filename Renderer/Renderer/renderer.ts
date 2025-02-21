import { vec3 } from 'wgpu-matrix';
import {
    LOG_CORE_INFO,
    LOG_CORE_TRACE,
    LOG_CORE_WARN,
    LOG_CORE_ERROR,
    LOG_TRACE
} from "./Log.js"
import { Camera } from "./Camera.js"
import { HybridLookup } from "./Utils.js"


export class MeshDescriptor
{
    public vertexCount: number = 0;
    public startVertex: number = 0;
    public indexCount: number | undefined = undefined;
    public startIndex: number | undefined = undefined;
}
export class RenderItem
{
    constructor(name: string, meshName: string, meshDescriptor: MeshDescriptor)
    {
        this.m_name = name;
        this.m_meshName = meshName;
        this.m_meshDescriptor = meshDescriptor;
    }
    public IsActive(): boolean { return this.m_isActive; }
    public Name(): string { return this.m_name; }
    public GetMeshName(): string { return this.m_meshName; }
    public GetInstanceCount(): number { return this.m_instanceCount; }
    public GetStartInstance(): number { return this.m_startInstance; }
    public SetInstanceCount(count: number): void { this.m_instanceCount = count; }
    public SetStartInstance(start: number): void { this.m_startInstance = start; }
    public SetMeshDescriptor(descriptor: MeshDescriptor): void { this.m_meshDescriptor = descriptor; }
    public IncrementInstanceCount(increment: number = 1): void { this.m_instanceCount += increment; }
    public DecrementInstanceCount(decrement: number = 1): void { this.m_instanceCount = Math.max(0, this.m_instanceCount - decrement); }
    public Render(encoder: GPURenderPassEncoder): void
    {
        LOG_TRACE(`RenderItem: '${this.m_name}' | instances: ${this.m_instanceCount}`);

        if (this.m_isActive)
        {
            if (this.m_meshDescriptor.indexCount === undefined)
            {
                encoder.draw(this.m_meshDescriptor.vertexCount, this.m_instanceCount, this.m_meshDescriptor.startVertex, this.m_startInstance);
            }
            else
            {
                encoder.drawIndexed(this.m_meshDescriptor.indexCount, this.m_instanceCount, this.m_meshDescriptor.startIndex, this.m_meshDescriptor.startVertex, this.m_startInstance);
            }
        }
    }

    private m_name: string;
    private m_meshName: string;
    private m_meshDescriptor: MeshDescriptor;
    private m_instanceCount: number = 1;
    private m_startInstance: number = 0;
    private m_isActive: boolean = true;
}
export class Mesh
{
    public CreateMeshFromRawData(name: string, rawVertexData: Float32Array, floatsPerVertex: number, indices: Uint16Array | Uint32Array | null = null): void
    {
        this.m_name = name;
        this.m_rawVertexData = rawVertexData;
        this.m_indices = indices;
        this.m_floatsPerVertex = floatsPerVertex;
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

        return this.m_indices.length;
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
export class MeshGroup
{
    constructor(name: string, device: GPUDevice, meshes: Mesh[] = [], vertexBufferSlot: number = 0)
    {
        this.m_name = name;
        this.m_device = device;
        this.m_vertexBufferSlot = vertexBufferSlot;
        this.m_meshes = new HybridLookup<Mesh>();
        this.m_meshDescriptors = new HybridLookup<MeshDescriptor>();
        this.m_renderItems = new HybridLookup<RenderItem>();
        this.m_indexFormat = "uint32";

        this.RebuildBuffers(meshes);
    }
    public Name(): string { return this.m_name; }
    public AddMesh(mesh: Mesh): Mesh
    {
        this.AddMeshes([mesh]);
        return mesh;
    }
    public AddMeshes(meshes: Mesh[]): void
    {
        // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
        // NOTE: Really brute-force approach is used here where we just create a whole new buffer from scratch.
        //       A likely better approach would be to create a new buffer of a larger size, copy the existing
        //       buffer to the new buffer (copy is done on the GPU), and then write our new mesh data to the end
        //       of the new buffer. Definitely more complicated and may run into issues with buffer lifetimes (?),
        //       but has the benefit of not sending a bunch of vertices to the GPU that already exist in a GPU buffer.
        // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

        if (meshes.length === 0)
        {
            LOG_CORE_WARN(`Trying to call AddMeshes() on the MeshGroup '${this.m_name}' with an empty list of meshes`);
            return;
        }

        // Create an array of all meshes with the new ones at the end
        let newMeshes: Mesh[] = [];
        for (let iii = 0; iii < this.m_meshes.size(); iii++)
            newMeshes.push(this.m_meshes.getFromIndex(iii));

        for (let mesh of meshes)
            newMeshes.push(mesh);

        // Rebuild the buffers
        this.RebuildBuffers(newMeshes);
    }
    public RemoveMesh(meshId: string | number): void
    {
        if (typeof meshId === "string")
            this.RemoveMeshImpl(this.m_meshes.indexOfKey(meshId));
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
            let mesh = this.m_meshes.getFromIndex(iii);

            if (iii === meshIndex)
            {
                // Before removing the mesh, we must make sure there are no RenderItems still referencing the mesh
                // If so, we must delete them (and we also log an error)
                let pred = (renderItem: RenderItem, index: number, key: string): boolean =>
                {
                    return renderItem.GetMeshName() === mesh.Name();
                };

                let renderItems: RenderItem[] = this.m_renderItems.filter(pred);
                if (renderItems.length > 0)
                {
                    LOG_CORE_ERROR(`MeshGroup('${this.m_name}'): Removing mesh '${mesh.Name()}', but there are still RenderItems that reference this mesh.`);
                    LOG_CORE_ERROR(`    The following RenderItems will be removed as well:`);
                    renderItems.forEach(ri => { LOG_CORE_ERROR(`        ${ri.Name()}`); });
                    this.m_renderItems.removeIf(pred);
                }

                continue;
            }

            meshes.push(mesh);
        }

        // Rebuild the buffers
        this.RebuildBuffers(meshes);
    }
    private CheckIndexFormat(meshes: Mesh[]): void
    {
        // Before creating the buffers, we first need to make sure all the meshes use the same index format
        if (meshes.length > 0)
        {
            // Index format will default to "uint32", so if they are actually Uint16, then we need to update the format
            if (meshes[0].IndicesAreUint16())
                this.m_indexFormat = "uint16";

            if (meshes.length > 1)
            {
                for (let iii = 1; iii < meshes.length; iii++)
                {
                    if (!meshes[0].IsIndexCompatible(meshes[iii]))
                        throw Error(`Meshes '${meshes[0].Name()}' and '${meshes[iii].Name()}' cannot be in the same MeshGroup because their indices are not compatible`);
                }
            }
        }
    }
    private RebuildBuffers(meshes: Mesh[]): void
    {
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
            if (mesh.HasIndices())
            {
                md.indexCount = mesh.IndexCount();
                md.startIndex = totalIndexCount;
            }
            this.m_meshDescriptors.add(mesh.Name(), md);

            totalVertexCount += mesh.VertexCount();
            totalVertexBytes += mesh.TotalVertexByteCount();

            totalIndexCount += mesh.IndexCount();
            totalIndexBytes += mesh.TotalIndexByteCount();
        }

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

            // Finally, update each RenderItem so that it references the correct mesh descriptor
            this.UpdateRenderItemMeshDescriptors();
        }
        else
        {
            this.m_indexBuffer = null;
        }
    }
    public Render(encoder: GPURenderPassEncoder): void
    {
        if (!this.HasActiveRenderItem())
            return;

        // Vertex Buffer
        encoder.setVertexBuffer(this.m_vertexBufferSlot, this.m_vertexBuffer);

        // Index Buffer
        if (this.m_indexBuffer !== null)
            encoder.setIndexBuffer(this.m_indexBuffer, this.m_indexFormat);

        // Draw each RenderItem
        for (let iii = 0; iii < this.m_renderItems.size(); iii++)
            this.m_renderItems.getFromIndex(iii).Render(encoder);
    }
    private HasActiveRenderItem(): boolean
    {
        for (let iii = 0; iii < this.m_renderItems.size(); iii++)
        {
            if (this.m_renderItems.getFromIndex(iii).IsActive())
                return true;
        }
        return false;
    }
    private UpdateRenderItemMeshDescriptors(): void
    {
        for (let iii = 0; iii < this.m_renderItems.size(); ++iii)
        {
            let renderItem = this.m_renderItems.getFromIndex(iii);
            renderItem.SetMeshDescriptor(this.m_meshDescriptors.getFromKey(renderItem.GetMeshName()));
        }
    }
    public CreateRenderItem(renderItemName: string, meshName: string): RenderItem
    {
        return this.m_renderItems.add(renderItemName, new RenderItem(renderItemName, meshName, this.m_meshDescriptors.getFromKey(meshName)));
    }
    public RemoveRenderItem(renderItemName: string): void
    {
        this.m_renderItems.removeFromKey(renderItemName);
    }
    public InformRemoval(): void
    {
        if (this.m_renderItems.size() > 0)
        {
            LOG_CORE_ERROR(`MeshGroup('${this.m_name}'): This entire mesh group is being removed, but there are still outstanding RenderItems`);
            LOG_CORE_ERROR(`    The following RenderItems will be removed as well:`);
            for (let iii = 0; iii < this.m_renderItems.size(); ++iii)
                LOG_CORE_ERROR(`        ${this.m_renderItems.getFromIndex(iii).Name()}`);
        }
    }

    private m_name: string;
    private m_device: GPUDevice;
    private m_meshes: HybridLookup<Mesh>;
    private m_meshDescriptors: HybridLookup<MeshDescriptor>;    
    private m_vertexBuffer!: GPUBuffer;
    private m_indexBuffer: GPUBuffer | null = null;
    private m_indexFormat: "uint16" | "uint32";
    private m_vertexBufferSlot: number;
    private m_renderItems: HybridLookup<RenderItem>;
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
    constructor(name: string, pipeline: GPURenderPipeline)
    {
        this.m_name = name;
        this.m_renderPipeline = pipeline;
        this.m_bindGroups = [];
        this.m_meshGroups = new HybridLookup<MeshGroup>();
    }
    public Name(): string { return this.m_name; }
    public AddBindGroup(bindGroup: BindGroup): BindGroup
    {
        this.m_bindGroups.push(bindGroup);
        return bindGroup;
    }
    public AddMeshGroup(meshGroup: MeshGroup): MeshGroup
    {
        this.m_meshGroups.add(meshGroup.Name(), meshGroup);
        return meshGroup;
    }
    public RemoveMeshGroup(meshGroupName: string): void
    {
        // Inform the mesh group that it is about to be removed, because
        // we want to issue warnings if there are any outstanding RenderItems
        this.m_meshGroups.getFromKey(meshGroupName).InformRemoval();
        this.m_meshGroups.removeFromKey(meshGroupName);
    }
    public GetMeshGroup(meshGroupName: string): MeshGroup
    {
        return this.m_meshGroups.getFromKey(meshGroupName);
    }
    public RemoveMesh(meshName: string, meshGroupName: string): void
    {
        this.m_meshGroups.getFromKey(meshGroupName).RemoveMesh(meshName);
    }
    public CreateRenderItem(renderItemName: string, meshGroupName: string, meshName: string): RenderItem
    {
        return this.m_meshGroups.getFromKey(meshGroupName).CreateRenderItem(renderItemName, meshName);
    }
    public RemoveRenderItem(renderItemName: string, meshGroupName: string): void
    {
        this.m_meshGroups.getFromKey(meshGroupName).RemoveRenderItem(renderItemName);
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
        // !!! This will make a draw call for each RenderItem in each MeshGroup !!!
        for (let iii = 0; iii < this.m_meshGroups.size(); iii++)
            this.m_meshGroups.getFromIndex(iii).Render(passEncoder);
    }

    private m_name: string;
    private m_renderPipeline: GPURenderPipeline;
    private m_bindGroups: BindGroup[];
    private m_meshGroups: HybridLookup<MeshGroup>;
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
    public AddBindGroup(bindGroup: BindGroup): BindGroup
    {
        this.m_bindGroups.push(bindGroup);
        return bindGroup;
    }
    public AddRenderPassLayer(layer: RenderPassLayer): RenderPassLayer
    {
        this.m_layers.push(layer);
        return layer;
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
    public AddRenderPass(pass: RenderPass): RenderPass
    {
        this.m_renderPasses.push(pass);
        return pass;
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