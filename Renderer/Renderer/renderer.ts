import { vec3 } from 'wgpu-matrix';
import {
    LOG_CORE_INFO,
    LOG_CORE_TRACE,
    LOG_CORE_WARN,
    LOG_CORE_ERROR
} from "./Log.js"
import { Camera } from "./Camera.js"
import { HybridLookup } from "./Utils.js"
import { RenderState } from "./RenderState.js"
import { Scene } from "./Scene.js"



export class BindGroup
{
    constructor(groupNumber: number, bindGroup: GPUBindGroup)
    {
        this.m_groupNumber = groupNumber;
        this.m_bindGroup = bindGroup;
    }
    public GetGroupNumber(): number { return this.m_groupNumber; }
    public GetBindGroup(): GPUBindGroup { return this.m_bindGroup; }

    private m_bindGroup: GPUBindGroup;
    private m_groupNumber: number;
}
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
        this.m_bindGroups = new HybridLookup<BindGroup>();
        this.Update = (timeDelta: number, renderitem: RenderItem, state: RenderState, scene: Scene) => { };
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
    public AddBindGroup(name: string, bindGroup: BindGroup): BindGroup
    {
        bindGroup.GetBindGroup().label = name;
        return this.m_bindGroups.add(name, bindGroup);
    }
    public UpdateBindGroup(name: string, bindGroup: BindGroup): BindGroup
    {
        bindGroup.GetBindGroup().label = name;
        return this.m_bindGroups.updateFromKey(name, bindGroup);
    }
    public Render(encoder: GPURenderPassEncoder): void
    {
        if (this.m_isActive)
        {
            // Set all RenderItem specific bind groups
            // These should likely used the convention @group(2)
            for (let iii = 0; iii < this.m_bindGroups.size(); ++iii)
            {
                let bg = this.m_bindGroups.getFromIndex(iii);
                encoder.setBindGroup(bg.GetGroupNumber(), bg.GetBindGroup());
            }

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
    public UpdateImpl(timeDelta: number, state: RenderState, scene: Scene): void
    {
        this.Update(timeDelta, this, state, scene);
    }
    public Update: (timeDelta: number, renderitem: RenderItem, state: RenderState, scene: Scene) => void;

    private m_name: string;
    private m_meshName: string;
    private m_meshDescriptor: MeshDescriptor;
    private m_instanceCount: number = 1;
    private m_startInstance: number = 0;
    private m_isActive: boolean = true;
    private m_bindGroups: HybridLookup<BindGroup>;
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
    public Update(timeDelta: number, state: RenderState, scene: Scene): void
    {
        // Mesh groups don't need to do anything during Update, so this is just a pass
        // through to update all render items
        for (let iii = 0; iii < this.m_renderItems.size(); iii++)
            this.m_renderItems.getFromIndex(iii).UpdateImpl(timeDelta, state, scene);
    }




    public GetRenderItemBindGroupLayout(): GPUBindGroupLayout | null
    {
        return this.m_renderItemBindGroupLayout;
    }
    public GetRenderItemBindGroupLayoutGroupNumber(): number
    {
        return this.m_renderItemBindGroupLayoutGroupNumber;
    }
    public SetRenderItemBindGroupLayout(layout: GPUBindGroupLayout | null): void
    {
        this.m_renderItemBindGroupLayout = layout;
    }
    public SetRenderItemBindGroupLayoutGroupNumber(groupNumber: number): void
    {
        this.m_renderItemBindGroupLayoutGroupNumber = groupNumber;;
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

    // Each RenderPassLayer is responsible for keeping track of the GPUBindGroupLayout
    // that each RenderItem should use. However, when instantiating a new game object, the
    // object is not going to know which layer(s) it will belong to (and will likely belong
    // to several layers). Instead, the GameObject will know which Mesh/MeshGroup it represents.
    // Therefore, when a MeshGroup is added to a RenderPassLayer, the layer will tell the 
    // MeshGroup what the BindGroupLayout so that it can be looked up by each GameObject.
    private m_renderItemBindGroupLayout: GPUBindGroupLayout | null = null;
    private m_renderItemBindGroupLayoutGroupNumber: number = 2;
}
export class RenderPassLayer
{
    constructor(name: string, renderer: Renderer, pipeline: GPURenderPipeline, renderItemBindGroupLayout: GPUBindGroupLayout | null = null, renderItemBindGroupLayoutGroupNumber: number = 2)
    {
        this.m_name = name;
        this.m_renderer = renderer;
        this.m_renderPipeline = pipeline;
        this.m_renderItemBindGroupLayout = renderItemBindGroupLayout;
        this.m_renderItemBindGroupLayoutGroupNumber = renderItemBindGroupLayoutGroupNumber;
        this.m_bindGroups = [];
        this.m_meshGroups = new HybridLookup<MeshGroup>();
        this.Update = (timeDelta: number, renderPassLayer: RenderPassLayer, state: RenderState, scene: Scene) => { };
    }
    public Name(): string { return this.m_name; }
    public AddBindGroup(bindGroup: BindGroup): BindGroup
    {
        this.m_bindGroups.push(bindGroup);
        return bindGroup;
    }
    public AddMeshGroup(meshGroupName: string): MeshGroup
    {
        let meshGroup = this.m_renderer.GetMeshGroup(meshGroupName);

        // Inform the meshgroup about what the expected render item BindGroupLayout is
        meshGroup.SetRenderItemBindGroupLayout(this.m_renderItemBindGroupLayout);
        meshGroup.SetRenderItemBindGroupLayoutGroupNumber(this.m_renderItemBindGroupLayoutGroupNumber);

        return this.m_meshGroups.add(meshGroup.Name(), meshGroup);
    }
    public RemoveMeshGroup(meshGroupName: string): void
    {
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
    public GetRenderItemBindGroupLayout(): GPUBindGroupLayout | null
    {
        return this.m_renderItemBindGroupLayout;
    }
    public GetRenderItemBindGroupLayoutGroupNumber(): number
    {
        return this.m_renderItemBindGroupLayoutGroupNumber;
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
    public UpdateImpl(timeDelta: number, state: RenderState, scene: Scene): void
    {
        // Call the user supplied Update function and then update the mesh groups
        this.Update(timeDelta, this, state, scene);

        for (let iii = 0; iii < this.m_meshGroups.size(); iii++)
            this.m_meshGroups.getFromIndex(iii).Update(timeDelta, state, scene);
    }
    public Update: (timeDelta: number, renderPassLayer: RenderPassLayer, state: RenderState, scene: Scene) => void;


    private m_name: string;
    private m_renderer: Renderer;
    private m_renderPipeline: GPURenderPipeline;
    private m_bindGroups: BindGroup[];
    private m_meshGroups: HybridLookup<MeshGroup>;

    // The fundamental idea behind a RenderPassLayer is that we create a new layer for every
    // shader program. So each layer is tied to exactly one shader program. We must specify
    // the bind group layout for the shader and we are currently using the following convention:
    //      @group(0) - things that are bound in each render pass
    //      @group(1) - things that are bound in each render layer
    //      @group(2) - things that are bound by each render item
    // The bind group layout for each of these must be fully specified at the point of layer
    // construction. However, at a future point in time, render items will need to create the 
    // bind groups that they will use and therefore, need to be able to lookup the layout they
    // must use.
    private m_renderItemBindGroupLayout: GPUBindGroupLayout | null = null;
    private m_renderItemBindGroupLayoutGroupNumber: number = 2;
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

        // The default OnCanvasResize behavior will be to just update all depth-stencil textures
        this.OnCanvasResize = (device: GPUDevice, width: number, height: number) =>
        {
            let depthStencilAttachment = this.m_renderPassDescriptor.depthStencilAttachment;

            if (depthStencilAttachment === undefined)
                return;

            const depthTexture = device.createTexture({
                size: [width, height],
                format: 'depth24plus',
                usage: GPUTextureUsage.RENDER_ATTACHMENT,
            });

            depthStencilAttachment.view = depthTexture.createView();
        };
    }
    public GetDescriptor(): GPURenderPassDescriptor
    {
        return this.m_renderPassDescriptor;
    }

    public Prepare: (context: GPUCanvasContext) => void;
    public OnCanvasResize: (device: GPUDevice, width: number, height: number) => void;
    private m_renderPassDescriptor: GPURenderPassDescriptor;     
}
export class RenderPass
{
    constructor(name: string, descriptor: RenderPassDescriptor)
    {
        this.m_name = name;
        this.m_renderPassDescriptor = descriptor;
        this.m_bindGroups = [];
        this.m_layers = new HybridLookup<RenderPassLayer>();
        this.m_buffers = new HybridLookup<GPUBuffer>();
        this.Update = (timeDelta: number, renderPass: RenderPass, state: RenderState, scene: Scene) => { };
    }
    public Name(): string { return this.m_name; }
    public AddBindGroup(bindGroup: BindGroup): BindGroup
    {
        this.m_bindGroups.push(bindGroup);
        return bindGroup;
    }
    public AddRenderPassLayer(layer: RenderPassLayer): RenderPassLayer
    {
        return this.m_layers.add(layer.Name(), layer);
    }
    public GetRenderPassLayer(nameOrIndex: string | number): RenderPassLayer
    {
        if (typeof nameOrIndex === "string")
            return this.m_layers.getFromKey(nameOrIndex);

        return this.m_layers.getFromIndex(nameOrIndex);
    }
    public Render(device: GPUDevice, context: GPUCanvasContext, encoder: GPUCommandEncoder): void
    {
        // Prepare is a user-defined callback to make any final adjustments to the descriptor
        // before recording render commands. The default case is to set the TextureView for
        // the first colorAttachment for the current canvas context
        this.m_renderPassDescriptor.Prepare(context);

        // Create the encoder for this render pass
        const passEncoder = encoder.beginRenderPass(this.m_renderPassDescriptor.GetDescriptor());
        passEncoder.label = `RenderPassEncoder: ${this.m_name}`;

        // Set the BindGroups that will be used for the entire render pass
        this.m_bindGroups.forEach(bindGroup =>
        {
            passEncoder.setBindGroup(bindGroup.GetGroupNumber(), bindGroup.GetBindGroup());
        });

        // Run each layer
        for (let iii = 0; iii < this.m_layers.size(); ++iii)
            this.m_layers.getFromIndex(iii).Render(passEncoder);

        passEncoder.end();

        // If we are computing timestamps, now is the time we resolve the query
        if (this.m_isComputingGPUTimestamp)
        {
            if (this.m_querySet === null || this.m_resolveBuffer === null)
                return;

            encoder.resolveQuerySet(this.m_querySet, 0, this.m_querySet.count, this.m_resolveBuffer, 0);

            if (this.m_resultBuffer === null)
                return;

            if (this.m_resultBuffer.mapState === 'unmapped')
                encoder.copyBufferToBuffer(this.m_resolveBuffer, 0, this.m_resultBuffer, 0, this.m_resultBuffer.size);
        }
    }
    public OnCanvasResize(device: GPUDevice, width: number, height: number)
    {
        this.m_renderPassDescriptor.OnCanvasResize(device, width, height);
    }
    public EnableGPUTiming(device: GPUDevice): void
    {
        if (!this.m_isComputingGPUTimestamp)
        {
            this.m_isComputingGPUTimestamp = true;

            // Initialize the data necessary to time render passes
            this.m_querySet = device.createQuerySet({
                type: 'timestamp',
                count: 2,
            });

            this.m_resolveBuffer = device.createBuffer({
                size: this.m_querySet.count * 8,
                usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC,
            });

            this.m_resultBuffer = device.createBuffer({
                size: this.m_resolveBuffer.size,
                usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
            });

            // Update the render pass descriptor
            let desc: GPURenderPassDescriptor = this.m_renderPassDescriptor.GetDescriptor();
            desc.timestampWrites = {
                querySet: this.m_querySet,
                beginningOfPassWriteIndex: 0,
                endOfPassWriteIndex: 1,
            };
        }
    }
    public EndOfRender(): void
    {
        if (this.m_isComputingGPUTimestamp)
        {
            if (this.m_resultBuffer === null)
                return;

            if (this.m_resultBuffer.mapState === 'unmapped')
            {
                this.m_resultBuffer.mapAsync(GPUMapMode.READ).then(() =>
                {
                    if (this.m_resultBuffer === null)
                        return;

                    const times = new BigInt64Array(this.m_resultBuffer.getMappedRange());
                    this.m_lastGPUTime = Number(times[1] - times[0]);
                    this.m_resultBuffer.unmap();
                });
            }
        }
    }
    public GetLastGPUTimeMeasurement(): number { return this.m_lastGPUTime; }
    public AddBuffer(name: string, buffer: GPUBuffer): GPUBuffer
    {
        return this.m_buffers.add(name, buffer);
    }
    public GetBuffer(name: string): GPUBuffer
    {
        return this.m_buffers.getFromKey(name);
    }
    public UpdateImpl(timeDelta: number, state: RenderState, scene: Scene)
    {
        // Call the user supplied Update function and then update the layers
        this.Update(timeDelta, this, state, scene);

        for (let iii = 0; iii < this.m_layers.size(); ++iii)
            this.m_layers.getFromIndex(iii).UpdateImpl(timeDelta, state, scene);
    }
    public Update: (timeDelta: number, renderPass: RenderPass, state: RenderState, scene: Scene) => void;

    private m_name: string;
    private m_renderPassDescriptor: RenderPassDescriptor;
    private m_bindGroups: BindGroup[];
    private m_layers: HybridLookup<RenderPassLayer>;
    private m_buffers: HybridLookup<GPUBuffer>;

    // GPU Timing data
    private m_isComputingGPUTimestamp: boolean = false;
    private m_querySet: GPUQuerySet | null = null;
    private m_resolveBuffer: GPUBuffer | null = null;
    private m_resultBuffer: GPUBuffer | null = null;
    private m_lastGPUTime: number = 0;
}
export class Renderer
{
    constructor(adapter: GPUAdapter, device : GPUDevice, context : GPUCanvasContext)
    {
        this.m_adapter = adapter;
        this.m_device = device;
        this.m_context = context;

        this.m_context.configure({
            device: this.m_device,
            format: navigator.gpu.getPreferredCanvasFormat()
        });

        this.m_renderPasses = new HybridLookup<RenderPass>();
        this.m_canComputeTimestamps = this.m_adapter.features.has('timestamp-query');

        this.m_meshGroups = new HybridLookup<MeshGroup>();
        this.m_textures = new HybridLookup<GPUTexture>();
    }
    public Render(): void
    {
        // Must create a new command encoder for each frame. GPUCommandEncoder is 
        // specifically designed to not be reusable.
        let commandEncoder = this.m_device.createCommandEncoder({ label: "Renderer command encoder" });

        // Run each render pass
        for (let iii = 0; iii < this.m_renderPasses.size(); ++iii)
            this.m_renderPasses.getFromIndex(iii).Render(this.m_device, this.m_context, commandEncoder);

        // Finalize the command encoder and submit it for rendering
        this.m_device.queue.submit([commandEncoder.finish()]);

        // Inform each render pass that the render commands have been submitted
        // The main reason for doing this right now is to collect GPU render times for each pass
        for (let iii = 0; iii < this.m_renderPasses.size(); ++iii)
            this.m_renderPasses.getFromIndex(iii).EndOfRender();
    }
    public Update(timeDelta: number, state: RenderState, scene: Scene): void
    {
        for (let iii = 0; iii < this.m_renderPasses.size(); ++iii)
        {
            let rp = this.m_renderPasses.getFromIndex(iii);
            rp.UpdateImpl(timeDelta, state, scene);
        }
    }
    public AddRenderPass(pass: RenderPass): RenderPass
    {
        this.m_renderPasses.add(pass.Name(), pass);

        if (this.m_isComputingTimestamps)
            pass.EnableGPUTiming(this.m_device);

        return pass;
    }
    public GetRenderPass(nameOrIndex: string | number): RenderPass
    {
        if (typeof nameOrIndex === "string")
            return this.m_renderPasses.getFromKey(nameOrIndex);

        return this.m_renderPasses.getFromIndex(nameOrIndex);
    }
    public NumberOfRenderPasses(): number { return this.m_renderPasses.size(); }
    public HasRenderPass(key: string): boolean { return this.m_renderPasses.containsKey(key); }
    public GetAdapter(): GPUAdapter { return this.m_adapter; }
    public GetDevice(): GPUDevice { return this.m_device; }
    public GetContext(): GPUCanvasContext { return this.m_context; }
    public OnCanvasResize(width: number, height: number) : void
    {
        for (let iii = 0; iii < this.m_renderPasses.size(); ++iii)
            this.m_renderPasses.getFromIndex(iii).OnCanvasResize(this.m_device, width, height);
    }
    public CanComputeGPUTimestamps(): boolean
    {
        return this.m_canComputeTimestamps;
    }
    public EnableGPUTiming(): void
    {
        if (!this.m_canComputeTimestamps)
        {
            LOG_CORE_WARN("Renderer: Unable to enable GPU timing. Your device's adpater does not support the feature 'timestamp-query'");
            return;
        }

        this.m_isComputingTimestamps = true;
        for (let iii = 0; iii < this.m_renderPasses.size(); ++iii)
            this.m_renderPasses.getFromIndex(iii).EnableGPUTiming(this.m_device);
    }

    public AddMeshGroup(meshGroup: MeshGroup): MeshGroup
    {
        return this.m_meshGroups.add(meshGroup.Name(), meshGroup);
    }
    public RemoveMeshGroup(meshGroupName: string): void
    {
        // Inform the mesh group that it is about to be removed, because
        // we want to issue warnings if there are any outstanding RenderItems
        this.m_meshGroups.getFromKey(meshGroupName).InformRemoval();
        this.m_meshGroups.removeFromKey(meshGroupName);
    }
    public GetMeshGroup(nameOrIndex: string | number): MeshGroup
    {
        if (typeof nameOrIndex === "string")
            return this.m_meshGroups.getFromKey(nameOrIndex);

        return this.m_meshGroups.getFromIndex(nameOrIndex);
    }
    public CreateRenderItem(renderItemName: string, meshGroupName: string, meshName: string): RenderItem
    {
        return this.m_meshGroups.getFromKey(meshGroupName).CreateRenderItem(renderItemName, meshName);
    }
    public RemoveRenderItem(renderItemName: string, meshGroupName: string): void
    {
        this.m_meshGroups.getFromKey(meshGroupName).RemoveRenderItem(renderItemName);
    }

    public async AddTextureFromFile(name: string, imageFile: string): Promise<GPUTexture>
    {
        // Fetch the image and upload it into a GPUTexture.
        let texture: GPUTexture;
        const response = await fetch(imageFile);
        const imageBitmap = await createImageBitmap(await response.blob());

        texture = this.m_device.createTexture({
            size: [imageBitmap.width, imageBitmap.height, 1],
            format: 'rgba8unorm',
            usage:
                GPUTextureUsage.TEXTURE_BINDING |
                GPUTextureUsage.COPY_DST |
                GPUTextureUsage.RENDER_ATTACHMENT,
        });
        this.m_device.queue.copyExternalImageToTexture(
            { source: imageBitmap },
            { texture: texture },
            [imageBitmap.width, imageBitmap.height]
        );     

        return this.m_textures.add(name, texture);
    }
    public GetTexture(nameOrIndex: string | number): GPUTexture
    {
        if (typeof nameOrIndex === "string")
            return this.m_textures.getFromKey(nameOrIndex);

        return this.m_textures.getFromIndex(nameOrIndex);
    }
    public RemoveTexture(nameOrIndex: string | number): void
    {
        if (typeof nameOrIndex === "string")
            this.m_textures.removeFromKey(nameOrIndex);
        else
            this.m_textures.removeFromIndex(nameOrIndex);
    }


    private m_adapter: GPUAdapter;
    private m_device:  GPUDevice;
    private m_context: GPUCanvasContext;
    private m_renderPasses: HybridLookup<RenderPass>;

    // The renderer holds all mesh groups so that they may be referenced across multiple passes
    private m_meshGroups: HybridLookup<MeshGroup>;

    // The renderer holds all textures so that they can be loaded at program launch
    // and referenced later by 1+ render items
    private m_textures: HybridLookup<GPUTexture>;

    // GPU Timing state
    private m_canComputeTimestamps: boolean;
    private m_isComputingTimestamps: boolean = false;
}