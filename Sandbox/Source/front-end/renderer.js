import { LOG_CORE_TRACE, LOG_CORE_WARN } from "./Log.js";
import { HybridLookup } from "./Utils.js";
export class Mesh {
    CreateMeshFromRawData(name, rawVertexData, floatsPerVertex, indices = null) {
        this.m_name = name;
        this.m_rawVertexData = rawVertexData;
        this.m_indices = indices;
        this.m_floatsPerVertex = floatsPerVertex;
        LOG_CORE_TRACE(`Mesh::CreateMeshFromRawData: name = ${this.m_name} | rawVertexData.length = ${this.m_rawVertexData.length} | floatsPerVertex = ${this.m_floatsPerVertex}`);
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
        if (this.m_indices instanceof Uint16Array)
            return this.m_indices.length / 2;
        return this.m_indices.length / 4;
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
class MeshDescriptor {
    vertexCount = 0;
    startVertex = 0;
    instanceCount = undefined;
    startInstance = undefined;
}
export class MeshGroup {
    constructor(name, device, meshes = [], vertexBufferSlot = 0) {
        this.m_name = name;
        this.m_device = device;
        this.m_vertexBufferSlot = vertexBufferSlot;
        this.m_meshes = new HybridLookup();
        this.m_meshDescriptors = new HybridLookup();
        this.m_indexFormat = "uint32";
        LOG_CORE_TRACE(`MeshGroup constructor() - name = ${name} | # meshes = ${meshes.length} | slot = ${vertexBufferSlot}`);
        this.RebuildBuffers(meshes);
    }
    AddMesh(mesh) {
        this.AddMeshes([mesh]);
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
        // Make sure the new mesh is index compatible
        if (this.m_meshes.size() > 0) {
            for (const mesh of meshes) {
                if (!this.m_meshes.get(0).IsIndexCompatible(mesh))
                    throw Error(`Mesh '${mesh.Name()}' cannot be added to the MeshGroup '${this.m_name}' because it is not index compatible`);
            }
        }
        // Create an array of all meshes with the new ones at the end
        let newMeshes = [];
        for (let iii = 0; iii < this.m_meshes.size(); iii++)
            newMeshes.push(this.m_meshes.get(iii));
        for (let mesh of meshes)
            newMeshes.push(mesh);
        // Rebuild the buffers
        this.RebuildBuffers(meshes);
    }
    RemoveMesh(meshId) {
        if (typeof meshId === "string")
            this.RemoveMeshImpl(this.m_meshes.indexOf(meshId));
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
            if (iii === meshIndex)
                continue;
            meshes.push(this.m_meshes.get(iii));
        }
        // Rebuild the buffers
        this.RebuildBuffers(meshes);
    }
    Render(encoder) {
        // Vertex Buffer
        encoder.setVertexBuffer(this.m_vertexBufferSlot, this.m_vertexBuffer);
        // Index Buffer
        if (this.m_indexBuffer !== null)
            encoder.setIndexBuffer(this.m_indexBuffer, this.m_indexFormat);
        // Draw call
        for (let iii = 0; iii < this.m_meshDescriptors.size(); iii++) {
            let md = this.m_meshDescriptors.get(iii);
            encoder.draw(md.vertexCount, md.instanceCount, md.startVertex, md.startInstance);
        }
    }
    CheckIndexFormat(meshes) {
        // Before creating the buffers, we first need to make sure all the meshes use the same index format
        if (meshes.length > 1) {
            // Index format will default to "uint32", so if they are actually Uint16, then we need to update the format
            if (meshes[0].IndicesAreUint16())
                this.m_indexFormat = "uint16";
            for (let iii = 1; iii < meshes.length; iii++) {
                if (!meshes[0].IsIndexCompatible(meshes[iii]))
                    throw Error(`Meshes '${meshes[0].Name()}' and '${meshes[iii].Name()}' cannot be in the same MeshGroup because their indices are not compatible`);
            }
        }
    }
    RebuildBuffers(meshes) {
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
        for (const mesh of meshes) {
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
        }
        else {
            this.m_indexBuffer = null;
        }
    }
    SetInstanceCount(meshId, count) {
        this.m_meshDescriptors.get(meshId).instanceCount = count;
        this.m_meshDescriptors.get(meshId).startInstance = 0;
    }
    m_name;
    m_device;
    m_meshes;
    m_meshDescriptors;
    m_vertexBuffer;
    m_indexBuffer = null;
    m_indexFormat;
    m_vertexBufferSlot;
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