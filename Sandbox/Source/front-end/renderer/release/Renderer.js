import { LOG_CORE_WARN, LOG_CORE_ERROR } from "./Log.js";
import { HybridLookup } from "./Utils.js";
import { MaterialGroup } from "./Material.js";
export class BindGroup {
    constructor(groupNumber, bindGroup) {
        this.m_groupNumber = groupNumber;
        this.m_bindGroup = bindGroup;
    }
    GetGroupNumber() { return this.m_groupNumber; }
    GetBindGroup() { return this.m_bindGroup; }
    SetBindGroup(bindGroup) {
        this.m_bindGroup = bindGroup;
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
        bindGroup.GetBindGroup().label = name;
        return this.m_bindGroups.add(name, bindGroup);
    }
    UpdateBindGroup(name, bindGroup) {
        bindGroup.GetBindGroup().label = name;
        return this.m_bindGroups.updateFromKey(name, bindGroup);
    }
    Render(encoder) {
        if (this.m_isActive) {
            this.PreRender();
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
    PreRender = () => { };
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
        return this.m_rawVertexData.length / this.m_floatsPerVertex;
    }
    IndexCount() {
        if (this.m_indices === null)
            return 0;
        return this.m_indices.length;
    }
    VertexStride() {
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
        if (meshes.length === 0) {
            LOG_CORE_WARN(`Trying to call AddMeshes() on the MeshGroup '${this.m_name}' with an empty list of meshes`);
            return;
        }
        let newMeshes = [];
        for (let iii = 0; iii < this.m_meshes.size(); iii++)
            newMeshes.push(this.m_meshes.getFromIndex(iii));
        for (let mesh of meshes)
            newMeshes.push(mesh);
        this.RebuildBuffers(newMeshes);
    }
    RemoveMesh(meshId) {
        if (typeof meshId === "string")
            this.RemoveMeshImpl(this.m_meshes.indexOfKey(meshId));
        else if (typeof meshId === "number")
            this.RemoveMeshImpl(meshId);
    }
    RemoveMeshImpl(meshIndex) {
        let meshes = [];
        for (let iii = 0; iii < this.m_meshes.size(); iii++) {
            let mesh = this.m_meshes.getFromIndex(iii);
            if (iii === meshIndex) {
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
        this.RebuildBuffers(meshes);
    }
    CheckIndexFormat(meshes) {
        if (meshes.length > 0) {
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
        this.CheckIndexFormat(meshes);
        this.m_meshes.clear();
        this.m_meshDescriptors.clear();
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
        let allVertices = new Float32Array(totalVertexBytes);
        let offset = 0;
        for (const mesh of meshes) {
            allVertices.set(mesh.RawVertexData(), offset);
            offset += mesh.TotalVertexByteCount();
        }
        this.m_vertexBuffer = this.m_device.createBuffer({
            label: `${this.m_name} - VertexBuffer`,
            size: allVertices.byteLength,
            usage: GPUBufferUsage.VERTEX,
            mappedAtCreation: true,
        });
        new Float32Array(this.m_vertexBuffer.getMappedRange()).set(allVertices);
        this.m_vertexBuffer.unmap();
        if (totalIndexBytes > 0) {
            if (meshes[0].IndicesAreUint16()) {
                let allIndices = new Uint16Array(totalIndexBytes);
                let indexOffset = 0;
                for (const mesh of meshes) {
                    allIndices.set(mesh.IndicesUint16(), indexOffset);
                    indexOffset += mesh.TotalIndexByteCount();
                }
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
                this.m_indexBuffer = this.m_device.createBuffer({
                    label: `${this.m_name} - IndexBuffer`,
                    size: allIndices.byteLength,
                    usage: GPUBufferUsage.INDEX,
                    mappedAtCreation: true,
                });
                new Uint32Array(this.m_indexBuffer.getMappedRange()).set(allIndices);
                this.m_indexBuffer.unmap();
            }
            this.UpdateRenderItemMeshDescriptors();
        }
        else {
            this.m_indexBuffer = null;
        }
    }
    Render(encoder) {
        if (!this.HasActiveRenderItem())
            return;
        encoder.pushDebugGroup(`Mesh Group: ${this.m_name}`);
        encoder.setVertexBuffer(this.m_vertexBufferSlot, this.m_vertexBuffer);
        if (this.m_indexBuffer !== null)
            encoder.setIndexBuffer(this.m_indexBuffer, this.m_indexFormat);
        for (let iii = 0; iii < this.m_renderItems.size(); iii++)
            this.m_renderItems.getFromIndex(iii).Render(encoder);
        encoder.popDebugGroup();
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
        for (let iii = 0; iii < this.m_renderItems.size(); iii++)
            this.m_renderItems.getFromIndex(iii).UpdateImpl(timeDelta, state, scene);
    }
    GetRenderItemBindGroupLayout() {
        return this.m_renderItemBindGroupLayout;
    }
    GetRenderItemBindGroupLayoutGroupNumber() {
        return this.m_renderItemBindGroupLayoutGroupNumber;
    }
    SetRenderItemBindGroupLayout(layout) {
        this.m_renderItemBindGroupLayout = layout;
    }
    SetRenderItemBindGroupLayoutGroupNumber(groupNumber) {
        this.m_renderItemBindGroupLayoutGroupNumber = groupNumber;
        ;
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
    m_renderItemBindGroupLayout = null;
    m_renderItemBindGroupLayoutGroupNumber = 2;
}
export class RenderPassLayer {
    constructor(name, renderer, pipeline, layerBindGroupLayout = null, layerBindGroupLayoutGroupNumber = 2, renderItemBindGroupLayout = null, renderItemBindGroupLayoutGroupNumber = 2) {
        this.m_name = name;
        this.m_renderer = renderer;
        this.m_renderPipeline = pipeline;
        this.m_bindGroups = [];
        this.m_renderItemBindGroupLayout = renderItemBindGroupLayout;
        this.m_renderItemBindGroupLayoutGroupNumber = renderItemBindGroupLayoutGroupNumber;
        this.m_meshGroups = new HybridLookup();
        this.Update = (timeDelta, renderPassLayer, state, scene) => { };
    }
    Name() { return this.m_name; }
    AddBindGroup(bindGroup) {
        this.m_bindGroups.push(bindGroup);
        return bindGroup;
    }
    AddMeshGroup(meshGroupName) {
        let meshGroup = this.m_renderer.GetMeshGroup(meshGroupName);
        meshGroup.SetRenderItemBindGroupLayout(this.m_renderItemBindGroupLayout);
        meshGroup.SetRenderItemBindGroupLayoutGroupNumber(this.m_renderItemBindGroupLayoutGroupNumber);
        return this.m_meshGroups.add(meshGroup.Name(), meshGroup);
    }
    RemoveMeshGroup(meshGroupName) {
        this.m_meshGroups.removeFromKey(meshGroupName);
    }
    GetMeshGroup(meshGroupName) {
        return this.m_meshGroups.getFromKey(meshGroupName);
    }
    RemoveMesh(meshName, meshGroupName) {
        this.m_meshGroups.getFromKey(meshGroupName).RemoveMesh(meshName);
    }
    GetRenderItemBindGroupLayout() {
        return this.m_renderItemBindGroupLayout;
    }
    GetRenderItemBindGroupLayoutGroupNumber() {
        return this.m_renderItemBindGroupLayoutGroupNumber;
    }
    Render(passEncoder) {
        passEncoder.pushDebugGroup(`Render Pass Layer: ${this.m_name}`);
        passEncoder.setPipeline(this.m_renderPipeline);
        this.m_bindGroups.forEach(bg => { passEncoder.setBindGroup(bg.GetGroupNumber(), bg.GetBindGroup()); });
        for (let iii = 0; iii < this.m_meshGroups.size(); iii++)
            this.m_meshGroups.getFromIndex(iii).Render(passEncoder);
        passEncoder.popDebugGroup();
    }
    UpdateImpl(timeDelta, state, scene) {
        this.Update(timeDelta, this, state, scene);
        for (let iii = 0; iii < this.m_meshGroups.size(); iii++)
            this.m_meshGroups.getFromIndex(iii).Update(timeDelta, state, scene);
    }
    Update;
    m_name;
    m_renderer;
    m_renderPipeline;
    m_bindGroups;
    m_meshGroups;
    m_renderItemBindGroupLayout = null;
    m_renderItemBindGroupLayoutGroupNumber = 2;
}
export class RenderPassDescriptor {
    constructor(descriptor) {
        this.m_renderPassDescriptor = descriptor;
        this.Prepare = (context) => {
            for (let item of this.m_renderPassDescriptor.colorAttachments) {
                if (item)
                    item.view = context.getCurrentTexture().createView();
                break;
            }
        };
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
    constructor(name, descriptor) {
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
    UpdateBindGroup(index, bindGroup) {
        this.m_bindGroups[index] = bindGroup;
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
        this.m_renderPassDescriptor.Prepare(context);
        const passEncoder = encoder.beginRenderPass(this.m_renderPassDescriptor.GetDescriptor());
        passEncoder.label = `RenderPassEncoder: ${this.m_name}`;
        passEncoder.pushDebugGroup(`Render Pass: ${this.m_name}`);
        this.m_bindGroups.forEach(bindGroup => {
            passEncoder.setBindGroup(bindGroup.GetGroupNumber(), bindGroup.GetBindGroup());
        });
        for (let iii = 0; iii < this.m_layers.size(); ++iii)
            this.m_layers.getFromIndex(iii).Render(passEncoder);
        passEncoder.popDebugGroup();
        passEncoder.end();
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
        this.m_meshGroups = new HybridLookup();
        this.m_textures = new HybridLookup();
        this.m_materialGroup = new MaterialGroup("matgrp_main", device, null);
    }
    Render() {
        let commandEncoder = this.m_device.createCommandEncoder({ label: "Renderer command encoder" });
        commandEncoder.pushDebugGroup('Main Renderer Loop');
        for (let iii = 0; iii < this.m_renderPasses.size(); ++iii)
            this.m_renderPasses.getFromIndex(iii).Render(this.m_device, this.m_context, commandEncoder);
        commandEncoder.popDebugGroup();
        this.m_device.queue.submit([commandEncoder.finish()]);
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
    AddMeshGroup(meshGroup) {
        return this.m_meshGroups.add(meshGroup.Name(), meshGroup);
    }
    RemoveMeshGroup(meshGroupName) {
        this.m_meshGroups.getFromKey(meshGroupName).InformRemoval();
        this.m_meshGroups.removeFromKey(meshGroupName);
    }
    GetMeshGroup(nameOrIndex) {
        if (typeof nameOrIndex === "string")
            return this.m_meshGroups.getFromKey(nameOrIndex);
        return this.m_meshGroups.getFromIndex(nameOrIndex);
    }
    CreateRenderItem(renderItemName, meshGroupName, meshName) {
        return this.m_meshGroups.getFromKey(meshGroupName).CreateRenderItem(renderItemName, meshName);
    }
    RemoveRenderItem(renderItemName, meshGroupName) {
        this.m_meshGroups.getFromKey(meshGroupName).RemoveRenderItem(renderItemName);
    }
    async AddTextureFromFile(name, imageFile) {
        let texture;
        const response = await fetch(imageFile);
        const imageBitmap = await createImageBitmap(await response.blob());
        texture = this.m_device.createTexture({
            size: [imageBitmap.width, imageBitmap.height, 1],
            format: 'rgba8unorm',
            usage: GPUTextureUsage.TEXTURE_BINDING |
                GPUTextureUsage.COPY_DST |
                GPUTextureUsage.RENDER_ATTACHMENT,
        });
        this.m_device.queue.copyExternalImageToTexture({ source: imageBitmap }, { texture: texture }, [imageBitmap.width, imageBitmap.height]);
        return this.m_textures.add(name, texture);
    }
    GetTexture(nameOrIndex) {
        if (typeof nameOrIndex === "string")
            return this.m_textures.getFromKey(nameOrIndex);
        return this.m_textures.getFromIndex(nameOrIndex);
    }
    RemoveTexture(nameOrIndex) {
        if (typeof nameOrIndex === "string")
            this.m_textures.removeFromKey(nameOrIndex);
        else
            this.m_textures.removeFromIndex(nameOrIndex);
    }
    AddMaterial(material) {
        let m = this.m_materialGroup.AddMaterial(material);
        this.OnMaterialBufferChanged(this.m_materialGroup);
        return m;
    }
    UpdateMaterial(name, newMaterial) {
        this.m_materialGroup.UpdateMaterial(name, newMaterial);
    }
    RemoveMaterial(materialName) {
        LOG_CORE_ERROR(`Called Renderer::RemoveMaterial() for material name '${materialName}'.`);
        LOG_CORE_ERROR(`This is an error because we do not currently support removing materials because that would require updating the indices for all outstanding GameObjects that reference a material`);
    }
    GetMaterial(nameOrIndex) {
        return this.m_materialGroup.GetMaterial(nameOrIndex);
    }
    GetMaterialsGPUBuffer() {
        return this.m_materialGroup.GetGPUBuffer();
    }
    GetMaterialIndex(name) {
        return this.m_materialGroup.GetMaterialIndex(name);
    }
    m_adapter;
    m_device;
    m_context;
    m_renderPasses;
    m_meshGroups;
    m_textures;
    m_materialGroup;
    OnMaterialBufferChanged = (materialGroup) => { };
    m_canComputeTimestamps;
    m_isComputingTimestamps = false;
}
