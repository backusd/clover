import { LOG_ERROR } from "./Log.js";
import { BindGroup } from "./Renderer.js";
import { Camera } from "./Camera.js";
import { HybridLookup } from "./Utils.js";
import { mat4, vec3 } from 'wgpu-matrix';
export class InstanceManager {
    constructor(className, bytesPerInstance, renderer, renderItemName, meshGroupName, meshName, numberOfInstancesToAllocateFor = 2, renderItemInitializationCallback = () => { }, onBufferChangedCallback = () => { }) {
        this.m_className = className;
        this.m_bytesPerInstance = bytesPerInstance;
        this.m_renderer = renderer;
        this.m_device = renderer.GetDevice();
        this.m_renderItem = renderer.CreateRenderItem(renderItemName, meshGroupName, meshName);
        this.OnBufferChanged = onBufferChangedCallback;
        this.m_bytesInBuffer = bytesPerInstance * numberOfInstancesToAllocateFor;
        this.m_buffer = this.m_device.createBuffer({
            label: `Buffer for InstanceManager<${this.m_className}>`,
            size: this.m_bytesInBuffer,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });
        renderItemInitializationCallback(renderer, this.m_renderItem, this.m_buffer);
    }
    AddInstance(instance) {
        // Add the instance to the list of instances we are tracking
        this.m_instances.push(instance);
        // Update the render item's instance count
        this.m_renderItem.IncrementInstanceCount(1);
        // Increase the buffer capacity if necessary
        if (this.m_instances.length * this.m_bytesPerInstance > this.m_bytesInBuffer)
            this.IncreaseBufferCapacity(this.m_bytesInBuffer * 2);
        // Return the index of the instance
        return this.m_instances.length - 1;
    }
    IncreaseBufferCapacity(bytes) {
        this.m_bytesInBuffer = bytes;
        this.m_buffer = this.m_device.createBuffer({
            label: `Buffer for InstanceManager<${this.m_className}>`,
            size: this.m_bytesInBuffer,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });
        // Because we are creating a brand new GPUBuffer, there will likely be updates
        // needed by the RenderItem to reference this new buffer. However, this may be
        // different for different GameObjects, so it needs to be a user provided callback
        this.OnBufferChanged(this.m_renderer, this.m_renderItem, this.m_buffer);
    }
    WriteToBuffer(instanceNumber, data, dataOffset, size) {
        this.m_device.queue.writeBuffer(this.m_buffer, // buffer to write to
        instanceNumber * this.m_bytesPerInstance, // byte offset in the buffer
        data, // data to write into buffer
        dataOffset, // Offset in the data to start from
        size // Total number of bytes to write
        );
    }
    GetInstanceDataBuffer() { return this.m_buffer; }
    m_className;
    m_instances = [];
    m_bytesPerInstance;
    m_renderer;
    m_device;
    m_buffer;
    m_bytesInBuffer;
    m_renderItem;
    OnBufferChanged;
}
export class GameObject {
    constructor(name, renderer) {
        this.m_name = name;
        this.m_renderer = renderer;
        this.m_childObjects = new HybridLookup();
    }
    UpdateImpl(timeDelta, parentModelMatrix) {
        this.Update(timeDelta, parentModelMatrix);
        this.UpdateChildren(timeDelta, this.m_modelMatrix);
    }
    Name() { return this.m_name; }
    UpdateModelMatrix(parentModelMatrix) {
        let model = mat4.translation(this.m_position);
        let rotationX = mat4.rotationX(this.m_rotation[0]);
        let rotationY = mat4.rotationY(this.m_rotation[1]);
        let rotationZ = mat4.rotationZ(this.m_rotation[2]);
        let scaling = mat4.scaling(this.m_scaling);
        mat4.multiply(model, rotationX, model);
        mat4.multiply(model, rotationY, model);
        mat4.multiply(model, rotationZ, model);
        mat4.multiply(model, scaling, model);
        mat4.multiply(parentModelMatrix, model, this.m_modelMatrix);
    }
    UpdateChildren(timeDelta, parentModelMatrix) {
        for (let iii = 0; iii < this.m_childObjects.size(); ++iii)
            this.m_childObjects.getFromIndex(iii).Update(timeDelta, parentModelMatrix);
    }
    AddChild(object) {
        return this.m_childObjects.add(object.Name(), object);
    }
    SetPosition(position) {
        this.m_position = position;
    }
    SetRotation(rotation) {
        this.m_rotation = rotation;
    }
    SetScaling(scaling) {
        this.m_scaling = scaling;
    }
    m_name;
    m_renderer;
    m_childObjects;
    m_position = vec3.create(0, 0, 0);
    m_rotation = vec3.create(0, 0, 0);
    m_scaling = vec3.create(1, 1, 1);
    m_modelMatrix = mat4.identity();
}
export class GameCube extends GameObject {
    constructor(name, renderer) {
        super(name, renderer);
        let device = this.m_renderer.GetDevice();
        // Create a render item for the cube
        this.m_renderItem = renderer.CreateRenderItem("ri_game-cube", "mg_texture-cube", "mesh_texture-cube");
        // Create the model buffer
        this.m_modelMatrixBuffer = this.m_renderer.GetDevice().createBuffer({
            label: 'buffer_game-cube-model-matrix',
            size: 4 * 16, // sizeof(float) * floats per matrix
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        // Get the BindGroupLayout that the mesh group uses
        let meshGroup = renderer.GetMeshGroup("mg_texture-cube");
        let bindGroupLayout = meshGroup.GetRenderItemBindGroupLayout();
        if (bindGroupLayout === null) {
            let msg = "GameCube::InitializeAsync() failed because meshGroup.GetRenderItemBindGroupLayout() returned null";
            LOG_ERROR(msg);
            throw Error(msg);
        }
        let bindGroupLayoutGroupNumber = meshGroup.GetRenderItemBindGroupLayoutGroupNumber();
        // Get the GPUTexture
        let cubeTexture = renderer.GetTexture("tex_molecule");
        // Create the sampler
        const sampler = device.createSampler({
            magFilter: 'linear',
            minFilter: 'linear',
        });
        let cubeBindGroup = device.createBindGroup({
            layout: bindGroupLayout,
            entries: [
                {
                    binding: 0,
                    resource: {
                        buffer: this.m_modelMatrixBuffer,
                    }
                },
                {
                    binding: 1,
                    resource: sampler,
                },
                {
                    binding: 2,
                    resource: cubeTexture.createView(),
                },
            ],
        });
        this.m_renderItem.AddBindGroup("bg_game-cube", new BindGroup(bindGroupLayoutGroupNumber, cubeBindGroup));
    }
    Update(timeDelta, parentModelMatrix) {
        this.m_rotation[1] += timeDelta;
        if (this.m_rotation[1] > 2 * Math.PI)
            this.m_rotation[1] -= 2 * Math.PI;
        this.UpdateModelMatrix(parentModelMatrix);
        // Update the GPUBuffer
        let device = this.m_renderer.GetDevice();
        device.queue.writeBuffer(this.m_modelMatrixBuffer, 0, this.m_modelMatrix.buffer, this.m_modelMatrix.byteOffset, this.m_modelMatrix.byteLength);
    }
    m_renderItem;
    m_modelMatrixBuffer;
}
export class GameCube2 extends GameObject {
    constructor(name, renderer) {
        super(name, renderer);
        // Make a call to GetInstanceManager() will initialize the instance manager
        // Calling AddInstance() will generate a new instance and return its index into the array of instances
        this.m_instanceNumber = this.GetInstanceManager().AddInstance(this);
        // Update the name so that we get a unique name between instances
        this.m_name = `${this.m_name}:${this.m_instanceNumber}`;
    }
    static InitializeGameCube2RenderItem(renderer, renderItem, instanceDataBuffer) {
        renderItem.AddBindGroup("bg_game-cube-2", GameCube2.GenerateBindGroup(renderer, instanceDataBuffer));
    }
    static OnInstanceBufferChanged(renderer, renderItem, buffer) {
        renderItem.UpdateBindGroup("bg_game-cube-2", GameCube2.GenerateBindGroup(renderer, buffer));
    }
    static GenerateBindGroup(renderer, buffer) {
        let device = renderer.GetDevice();
        // Get the BindGroupLayout that the mesh group uses
        let meshGroup = renderer.GetMeshGroup("mg_texture-cube-instancing");
        let bindGroupLayout = meshGroup.GetRenderItemBindGroupLayout();
        if (bindGroupLayout === null) {
            let msg = "GameCube2::InitializeAsync() failed because meshGroup.GetRenderItemBindGroupLayout() returned null";
            LOG_ERROR(msg);
            throw Error(msg);
        }
        let bindGroupLayoutGroupNumber = meshGroup.GetRenderItemBindGroupLayoutGroupNumber();
        // Get the GPUTexture
        let cubeTexture = renderer.GetTexture("tex_molecule");
        // Create the sampler
        const sampler = device.createSampler({
            magFilter: 'linear',
            minFilter: 'linear',
        });
        // Create the BindGroup
        let cubeBindGroup = device.createBindGroup({
            layout: bindGroupLayout,
            entries: [
                {
                    binding: 0,
                    resource: {
                        buffer: buffer
                    }
                },
                {
                    binding: 1,
                    resource: sampler,
                },
                {
                    binding: 2,
                    resource: cubeTexture.createView(),
                },
            ],
        });
        return new BindGroup(bindGroupLayoutGroupNumber, cubeBindGroup);
    }
    Update(timeDelta, parentModelMatrix) {
        this.m_position[0] += timeDelta * 2;
        this.UpdateModelMatrix(parentModelMatrix);
        this.GetInstanceManager().WriteToBuffer(this.m_instanceNumber, this.m_modelMatrix.buffer, this.m_modelMatrix.byteOffset, this.m_modelMatrix.byteLength);
    }
    GetInstanceManager() {
        if (GameCube2.s_instanceManager === null) {
            GameCube2.s_instanceManager = new InstanceManager("GameCube2", 4 * 16, this.m_renderer, "ri_game-cube-2", "mg_texture-cube-instancing", "mesh_texture-cube-instancing", 4, (renderer, renderItem, instanceDataBuffer) => {
                GameCube2.InitializeGameCube2RenderItem(renderer, renderItem, instanceDataBuffer);
            }, (renderer, renderItem, instanceDataBuffer) => {
                GameCube2.OnInstanceBufferChanged(renderer, renderItem, instanceDataBuffer);
            });
        }
        return GameCube2.s_instanceManager;
    }
    m_instanceNumber;
    static s_instanceManager = null;
}
export class Scene {
    constructor() {
        this.m_camera = new Camera();
        this.m_gameObjects = new HybridLookup();
    }
    Update(timeDelta) {
        // Update the Camera
        this.m_camera.Update(timeDelta);
        // Update the game objects
        let identity = mat4.identity();
        let numObjects = this.m_gameObjects.size();
        for (let iii = 0; iii < numObjects; ++iii)
            this.m_gameObjects.getFromIndex(iii).UpdateImpl(timeDelta, identity);
    }
    GetCamera() { return this.m_camera; }
    AddGameObject(object) {
        return this.m_gameObjects.add(object.Name(), object);
    }
    m_camera;
    m_gameObjects;
}
//# sourceMappingURL=Scene.js.map