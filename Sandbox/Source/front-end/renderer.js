import { LOG_CORE_WARN, LOG_CORE_ERROR } from "./Log.js";
import { HybridLookup } from "./Utils.js";
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
export class MeshDescriptor {
    vertexCount = 0;
    startVertex = 0;
    indexCount = undefined;
    startIndex = undefined;
}
export class RenderItem {
    constructor(name, meshName, meshDescriptor) {
        this.m_name = name;
        this.m_meshName = meshName;
        this.m_meshDescriptor = meshDescriptor;
        this.m_bindGroups = new HybridLookup();
        this.Update = (timeDelta, renderitem, state, scene) => { };
    }
    IsActive() { return this.m_isActive; }
    Name() { return this.m_name; }
    GetMeshName() { return this.m_meshName; }
    GetInstanceCount() { return this.m_instanceCount; }
    GetStartInstance() { return this.m_startInstance; }
    SetInstanceCount(count) { this.m_instanceCount = count; }
    SetStartInstance(start) { this.m_startInstance = start; }
    SetMeshDescriptor(descriptor) { this.m_meshDescriptor = descriptor; }
    IncrementInstanceCount(increment = 1) { this.m_instanceCount += increment; }
    DecrementInstanceCount(decrement = 1) { this.m_instanceCount = Math.max(0, this.m_instanceCount - decrement); }
    AddBindGroup(name, bindGroup) {
        return this.m_bindGroups.add(name, bindGroup);
    }
    Render(encoder) {
        if (this.m_isActive) {
            // Set all RenderItem specific bind groups
            // These should likely used the convention @group(2)
            for (let iii = 0; iii < this.m_bindGroups.size(); ++iii) {
                let bg = this.m_bindGroups.getFromIndex(iii);
                encoder.setBindGroup(bg.GetGroupNumber(), bg.GetBindGroup());
            }
            if (this.m_meshDescriptor.indexCount === undefined) {
                encoder.draw(this.m_meshDescriptor.vertexCount, this.m_instanceCount, this.m_meshDescriptor.startVertex, this.m_startInstance);
            }
            else {
                encoder.drawIndexed(this.m_meshDescriptor.indexCount, this.m_instanceCount, this.m_meshDescriptor.startIndex, this.m_meshDescriptor.startVertex, this.m_startInstance);
            }
        }
    }
    UpdateImpl(timeDelta, state, scene) {
        this.Update(timeDelta, this, state, scene);
    }
    Update;
    m_name;
    m_meshName;
    m_meshDescriptor;
    m_instanceCount = 1;
    m_startInstance = 0;
    m_isActive = true;
    m_bindGroups;
}
export class Mesh {
    CreateMeshFromRawData(name, rawVertexData, floatsPerVertex, indices = null) {
        this.m_name = name;
        this.m_rawVertexData = rawVertexData;
        this.m_indices = indices;
        this.m_floatsPerVertex = floatsPerVertex;
    }
    CreateMeshFromFile(file) {
        LOG_CORE_WARN("Mesh::CreateMeshFromFile not yet implemented");
    }
    RawVertexData() {
        return this.m_rawVertexData;
    }
    HasIndices() {
        return this.m_indices !== null;
    }
    IndicesAreUint16() {
        return this.m_indices !== null && this.m_indices instanceof Uint16Array;
    }
    IndicesAreUint32() {
        return this.m_indices !== null && this.m_indices instanceof Uint32Array;
    }
    IndicesUint16() {
        if (this.m_indices === null)
            throw Error(`Mesh(name = '${this.m_name}') - Invalid call to IndicesUint16 because m_indices is null`);
        if (this.m_indices instanceof Uint32Array)
            throw Error(`Mesh(name = '${this.m_name}') - Invalid call to IndicesUint16 because m_indices is Uint32Array`);
        return this.m_indices;
    }
    IndicesUint32() {
        if (this.m_indices === null)
            throw Error(`Mesh(name = '${this.m_name}') - Invalid call to IndicesUint32 because m_indices is null`);
        if (this.m_indices instanceof Uint16Array)
            throw Error(`Mesh(name = '${this.m_name}') - Invalid call to IndicesUint32 because m_indices is Uint16Array`);
        return this.m_indices;
    }
    Name() {
        return this.m_name;
    }
    IsIndexCompatible(otherMesh) {
        if (this.m_indices === null && otherMesh.m_indices === null)
            return true;
        if (this.m_indices instanceof Uint16Array && otherMesh.m_indices instanceof Uint16Array)
            return true;
        if (this.m_indices instanceof Uint32Array && otherMesh.m_indices instanceof Uint32Array)
            return true;
        return false;
    }
    VertexCount() {
        // The vertices array holds all the raw data, but one vertex will likely consist of
        // several elements. For example, suppose each vertex looks like
        //     { position: float4, color: float4 }
        // Then each vertex consists of 8 floats.
        // So the formula is numVertices = total_floats / floats_per_vertex
        return this.m_rawVertexData.length / this.m_floatsPerVertex;
    }
    IndexCount() {
        if (this.m_indices === null)
            return 0;
        return this.m_indices.length;
    }
    VertexStride() {
        // Each float is 4 bytes, and for 'stride' we want the total number of bytes
        return this.m_floatsPerVertex * 4;
    }
    TotalVertexByteCount() {
        return this.m_rawVertexData.length;
    }
    TotalIndexByteCount() {
        if (this.m_indices === null)
            return 0;
        return this.m_indices.length;
    }
    m_name = "";
    m_rawVertexData = new Float32Array();
    m_indices = null;
    m_floatsPerVertex = 0;
}
export class MeshGroup {
    constructor(name, device, meshes = [], vertexBufferSlot = 0) {
        this.m_name = name;
        this.m_device = device;
        this.m_vertexBufferSlot = vertexBufferSlot;
        this.m_meshes = new HybridLookup();
        this.m_meshDescriptors = new HybridLookup();
        this.m_renderItems = new HybridLookup();
        this.m_indexFormat = "uint32";
        this.RebuildBuffers(meshes);
    }
    Name() { return this.m_name; }
    AddMesh(mesh) {
        this.AddMeshes([mesh]);
        return mesh;
    }
    AddMeshes(meshes) {
        // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
        // NOTE: Really brute-force approach is used here where we just create a whole new buffer from scratch.
        //       A likely better approach would be to create a new buffer of a larger size, copy the existing
        //       buffer to the new buffer (copy is done on the GPU), and then write our new mesh data to the end
        //       of the new buffer. Definitely more complicated and may run into issues with buffer lifetimes (?),
        //       but has the benefit of not sending a bunch of vertices to the GPU that already exist in a GPU buffer.
        // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
        if (meshes.length === 0) {
            LOG_CORE_WARN(`Trying to call AddMeshes() on the MeshGroup '${this.m_name}' with an empty list of meshes`);
            return;
        }
        // Create an array of all meshes with the new ones at the end
        let newMeshes = [];
        for (let iii = 0; iii < this.m_meshes.size(); iii++)
            newMeshes.push(this.m_meshes.getFromIndex(iii));
        for (let mesh of meshes)
            newMeshes.push(mesh);
        // Rebuild the buffers
        this.RebuildBuffers(newMeshes);
    }
    RemoveMesh(meshId) {
        if (typeof meshId === "string")
            this.RemoveMeshImpl(this.m_meshes.indexOfKey(meshId));
        else if (typeof meshId === "number")
            this.RemoveMeshImpl(meshId);
    }
    RemoveMeshImpl(meshIndex) {
        // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
        // NOTE: Really brute-force approach is used here where we create a whole new buffer from scratch.
        //       A likely better approach would be to create a new buffer on the GPU of a smaller size and then
        //       perform 2 writes between the buffers: 1 copy for the data that preceded the erased data and 1
        //       copy for the data that comes after the erased data. Not sure if you'd run into buffer lifetime
        //       issues. This has the obvious benefit though of not sending any vertices to the GPU.
        // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
        // Create an array of meshes, but exclude the one we are removing
        let meshes = [];
        for (let iii = 0; iii < this.m_meshes.size(); iii++) {
            let mesh = this.m_meshes.getFromIndex(iii);
            if (iii === meshIndex) {
                // Before removing the mesh, we must make sure there are no RenderItems still referencing the mesh
                // If so, we must delete them (and we also log an error)
                let pred = (renderItem, index, key) => {
                    return renderItem.GetMeshName() === mesh.Name();
                };
                let renderItems = this.m_renderItems.filter(pred);
                if (renderItems.length > 0) {
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
    CheckIndexFormat(meshes) {
        // Before creating the buffers, we first need to make sure all the meshes use the same index format
        if (meshes.length > 0) {
            // Index format will default to "uint32", so if they are actually Uint16, then we need to update the format
            if (meshes[0].IndicesAreUint16())
                this.m_indexFormat = "uint16";
            if (meshes.length > 1) {
                for (let iii = 1; iii < meshes.length; iii++) {
                    if (!meshes[0].IsIndexCompatible(meshes[iii]))
                        throw Error(`Meshes '${meshes[0].Name()}' and '${meshes[iii].Name()}' cannot be in the same MeshGroup because their indices are not compatible`);
                }
            }
        }
    }
    RebuildBuffers(meshes) {
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
        for (const mesh of meshes) {
            this.m_meshes.add(mesh.Name(), mesh);
            let md = new MeshDescriptor();
            md.vertexCount = mesh.VertexCount();
            md.startVertex = totalVertexCount;
            if (mesh.HasIndices()) {
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
        let allVertices = new Float32Array(totalVertexBytes);
        let offset = 0;
        for (const mesh of meshes) {
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
        if (totalIndexBytes > 0) {
            if (meshes[0].IndicesAreUint16()) {
                let allIndices = new Uint16Array(totalIndexBytes);
                let indexOffset = 0;
                for (const mesh of meshes) {
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
            else {
                let allIndices = new Uint32Array(totalIndexBytes);
                let indexOffset = 0;
                for (const mesh of meshes) {
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
        else {
            this.m_indexBuffer = null;
        }
    }
    Render(encoder) {
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
    HasActiveRenderItem() {
        for (let iii = 0; iii < this.m_renderItems.size(); iii++) {
            if (this.m_renderItems.getFromIndex(iii).IsActive())
                return true;
        }
        return false;
    }
    UpdateRenderItemMeshDescriptors() {
        for (let iii = 0; iii < this.m_renderItems.size(); ++iii) {
            let renderItem = this.m_renderItems.getFromIndex(iii);
            renderItem.SetMeshDescriptor(this.m_meshDescriptors.getFromKey(renderItem.GetMeshName()));
        }
    }
    CreateRenderItem(renderItemName, meshName) {
        return this.m_renderItems.add(renderItemName, new RenderItem(renderItemName, meshName, this.m_meshDescriptors.getFromKey(meshName)));
    }
    RemoveRenderItem(renderItemName) {
        this.m_renderItems.removeFromKey(renderItemName);
    }
    InformRemoval() {
        if (this.m_renderItems.size() > 0) {
            LOG_CORE_ERROR(`MeshGroup('${this.m_name}'): This entire mesh group is being removed, but there are still outstanding RenderItems`);
            LOG_CORE_ERROR(`    The following RenderItems will be removed as well:`);
            for (let iii = 0; iii < this.m_renderItems.size(); ++iii)
                LOG_CORE_ERROR(`        ${this.m_renderItems.getFromIndex(iii).Name()}`);
        }
    }
    Update(timeDelta, state, scene) {
        // Mesh groups don't need to do anything during Update, so this is just a pass
        // through to update all render items
        for (let iii = 0; iii < this.m_renderItems.size(); iii++)
            this.m_renderItems.getFromIndex(iii).UpdateImpl(timeDelta, state, scene);
    }
    m_name;
    m_device;
    m_meshes;
    m_meshDescriptors;
    m_vertexBuffer;
    m_indexBuffer = null;
    m_indexFormat;
    m_vertexBufferSlot;
    m_renderItems;
}
export class RenderPassLayer {
    constructor(name, pipeline, renderItemBindGroupLayout = null, renderItemBindGroupLayoutGroupNumber = 2) {
        this.m_name = name;
        this.m_renderPipeline = pipeline;
        this.m_renderItemBindGroupLayout = renderItemBindGroupLayout;
        this.m_renderItemBindGroupLayoutGroupNumber = renderItemBindGroupLayoutGroupNumber;
        this.m_bindGroups = [];
        this.m_meshGroups = new HybridLookup();
        this.Update = (timeDelta, renderPassLayer, state, scene) => { };
    }
    Name() { return this.m_name; }
    AddBindGroup(bindGroup) {
        this.m_bindGroups.push(bindGroup);
        return bindGroup;
    }
    AddMeshGroup(meshGroup) {
        this.m_meshGroups.add(meshGroup.Name(), meshGroup);
        return meshGroup;
    }
    RemoveMeshGroup(meshGroupName) {
        // Inform the mesh group that it is about to be removed, because
        // we want to issue warnings if there are any outstanding RenderItems
        this.m_meshGroups.getFromKey(meshGroupName).InformRemoval();
        this.m_meshGroups.removeFromKey(meshGroupName);
    }
    GetMeshGroup(meshGroupName) {
        return this.m_meshGroups.getFromKey(meshGroupName);
    }
    RemoveMesh(meshName, meshGroupName) {
        this.m_meshGroups.getFromKey(meshGroupName).RemoveMesh(meshName);
    }
    CreateRenderItem(renderItemName, meshGroupName, meshName) {
        return this.m_meshGroups.getFromKey(meshGroupName).CreateRenderItem(renderItemName, meshName);
    }
    RemoveRenderItem(renderItemName, meshGroupName) {
        this.m_meshGroups.getFromKey(meshGroupName).RemoveRenderItem(renderItemName);
    }
    GetRenderItemBindGroupLayout() {
        return this.m_renderItemBindGroupLayout;
    }
    GetRenderItemBindGroupLayoutGroupNumber() {
        return this.m_renderItemBindGroupLayoutGroupNumber;
    }
    Render(passEncoder) {
        // Set the pipeline
        passEncoder.setPipeline(this.m_renderPipeline);
        // Set the BindGroups
        this.m_bindGroups.forEach(bindGroup => {
            passEncoder.setBindGroup(bindGroup.GetGroupNumber(), bindGroup.GetBindGroup());
        });
        // Set the mesh group
        // !!! This will make a draw call for each RenderItem in each MeshGroup !!!
        for (let iii = 0; iii < this.m_meshGroups.size(); iii++)
            this.m_meshGroups.getFromIndex(iii).Render(passEncoder);
    }
    UpdateImpl(timeDelta, state, scene) {
        // Call the user supplied Update function and then update the mesh groups
        this.Update(timeDelta, this, state, scene);
        for (let iii = 0; iii < this.m_meshGroups.size(); iii++)
            this.m_meshGroups.getFromIndex(iii).Update(timeDelta, state, scene);
    }
    Update;
    m_name;
    m_renderPipeline;
    m_bindGroups;
    m_meshGroups;
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
    m_renderItemBindGroupLayout = null;
    m_renderItemBindGroupLayoutGroupNumber = 2;
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
        // The default OnCanvasResize behavior will be to just update all depth-stencil textures
        this.OnCanvasResize = (device, width, height) => {
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
    GetDescriptor() {
        return this.m_renderPassDescriptor;
    }
    Prepare;
    OnCanvasResize;
    m_renderPassDescriptor;
}
export class RenderPass {
    constructor(name, device, descriptor) {
        this.m_name = name;
        this.m_renderPassDescriptor = descriptor;
        this.m_bindGroups = [];
        this.m_layers = new HybridLookup();
        this.m_buffers = new HybridLookup();
        this.Update = (timeDelta, renderPass, state, scene) => { };
    }
    Name() { return this.m_name; }
    AddBindGroup(bindGroup) {
        this.m_bindGroups.push(bindGroup);
        return bindGroup;
    }
    AddRenderPassLayer(layer) {
        return this.m_layers.add(layer.Name(), layer);
    }
    GetRenderPassLayer(nameOrIndex) {
        if (typeof nameOrIndex === "string")
            return this.m_layers.getFromKey(nameOrIndex);
        return this.m_layers.getFromIndex(nameOrIndex);
    }
    Render(device, context, encoder) {
        // Prepare is a user-defined callback to make any final adjustments to the descriptor
        // before recording render commands. The default case is to set the TextureView for
        // the first colorAttachment for the current canvas context
        this.m_renderPassDescriptor.Prepare(context);
        // Create the encoder for this render pass
        const passEncoder = encoder.beginRenderPass(this.m_renderPassDescriptor.GetDescriptor());
        passEncoder.label = `RenderPassEncoder: ${this.m_name}`;
        // Set the BindGroups that will be used for the entire render pass
        this.m_bindGroups.forEach(bindGroup => {
            passEncoder.setBindGroup(bindGroup.GetGroupNumber(), bindGroup.GetBindGroup());
        });
        // Run each layer
        for (let iii = 0; iii < this.m_layers.size(); ++iii)
            this.m_layers.getFromIndex(iii).Render(passEncoder);
        passEncoder.end();
        // If we are computing timestamps, now is the time we resolve the query
        if (this.m_isComputingGPUTimestamp) {
            if (this.m_querySet === null || this.m_resolveBuffer === null)
                return;
            encoder.resolveQuerySet(this.m_querySet, 0, this.m_querySet.count, this.m_resolveBuffer, 0);
            if (this.m_resultBuffer === null)
                return;
            if (this.m_resultBuffer.mapState === 'unmapped')
                encoder.copyBufferToBuffer(this.m_resolveBuffer, 0, this.m_resultBuffer, 0, this.m_resultBuffer.size);
        }
    }
    OnCanvasResize(device, width, height) {
        this.m_renderPassDescriptor.OnCanvasResize(device, width, height);
    }
    EnableGPUTiming(device) {
        if (!this.m_isComputingGPUTimestamp) {
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
            let desc = this.m_renderPassDescriptor.GetDescriptor();
            desc.timestampWrites = {
                querySet: this.m_querySet,
                beginningOfPassWriteIndex: 0,
                endOfPassWriteIndex: 1,
            };
        }
    }
    EndOfRender() {
        if (this.m_isComputingGPUTimestamp) {
            if (this.m_resultBuffer === null)
                return;
            if (this.m_resultBuffer.mapState === 'unmapped') {
                this.m_resultBuffer.mapAsync(GPUMapMode.READ).then(() => {
                    if (this.m_resultBuffer === null)
                        return;
                    const times = new BigInt64Array(this.m_resultBuffer.getMappedRange());
                    this.m_lastGPUTime = Number(times[1] - times[0]);
                    this.m_resultBuffer.unmap();
                });
            }
        }
    }
    GetLastGPUTimeMeasurement() { return this.m_lastGPUTime; }
    AddBuffer(name, buffer) {
        return this.m_buffers.add(name, buffer);
    }
    GetBuffer(name) {
        return this.m_buffers.getFromKey(name);
    }
    UpdateImpl(timeDelta, state, scene) {
        // Call the user supplied Update function and then update the layers
        this.Update(timeDelta, this, state, scene);
        for (let iii = 0; iii < this.m_layers.size(); ++iii)
            this.m_layers.getFromIndex(iii).UpdateImpl(timeDelta, state, scene);
    }
    Update;
    m_name;
    m_renderPassDescriptor;
    m_bindGroups;
    m_layers;
    m_buffers;
    // GPU Timing data
    m_isComputingGPUTimestamp = false;
    m_querySet = null;
    m_resolveBuffer = null;
    m_resultBuffer = null;
    m_lastGPUTime = 0;
}
export class Renderer {
    constructor(adapter, device, context) {
        this.m_adapter = adapter;
        this.m_device = device;
        this.m_context = context;
        this.m_context.configure({
            device: this.m_device,
            format: navigator.gpu.getPreferredCanvasFormat()
        });
        this.m_renderPasses = new HybridLookup();
        this.m_canComputeTimestamps = this.m_adapter.features.has('timestamp-query');
    }
    Render() {
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
    Update(timeDelta, state, scene) {
        for (let iii = 0; iii < this.m_renderPasses.size(); ++iii) {
            let rp = this.m_renderPasses.getFromIndex(iii);
            rp.UpdateImpl(timeDelta, state, scene);
        }
    }
    AddRenderPass(pass) {
        this.m_renderPasses.add(pass.Name(), pass);
        if (this.m_isComputingTimestamps)
            pass.EnableGPUTiming(this.m_device);
        return pass;
    }
    GetRenderPass(nameOrIndex) {
        if (typeof nameOrIndex === "string")
            return this.m_renderPasses.getFromKey(nameOrIndex);
        return this.m_renderPasses.getFromIndex(nameOrIndex);
    }
    NumberOfRenderPasses() { return this.m_renderPasses.size(); }
    HasRenderPass(key) { return this.m_renderPasses.containsKey(key); }
    GetAdapter() { return this.m_adapter; }
    GetDevice() { return this.m_device; }
    GetContext() { return this.m_context; }
    OnCanvasResize(width, height) {
        for (let iii = 0; iii < this.m_renderPasses.size(); ++iii)
            this.m_renderPasses.getFromIndex(iii).OnCanvasResize(this.m_device, width, height);
    }
    CanComputeGPUTimestamps() {
        return this.m_canComputeTimestamps;
    }
    EnableGPUTiming() {
        if (!this.m_canComputeTimestamps) {
            LOG_CORE_WARN("Renderer: Unable to enable GPU timing. Your device's adpater does not support the feature 'timestamp-query'");
            return;
        }
        this.m_isComputingTimestamps = true;
        for (let iii = 0; iii < this.m_renderPasses.size(); ++iii)
            this.m_renderPasses.getFromIndex(iii).EnableGPUTiming(this.m_device);
    }
    m_adapter;
    m_device;
    m_context;
    m_renderPasses;
    // GPU Timing state
    m_canComputeTimestamps;
    m_isComputingTimestamps = false;
}
//# sourceMappingURL=Renderer.js.map