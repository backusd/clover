import { LOG_ERROR } from "./Log.js";
import { BindGroup } from "./Renderer.js";
import { UniformBufferSingleStaging } from "./Buffer.js";
import { Camera } from "./Camera.js";
import { HybridLookup } from "./Utils.js";
import { mat4, vec3 } from 'wgpu-matrix';
export class InstanceManager {
    constructor(className, bytesPerInstance, renderer, renderItemName, meshGroupName, meshName, numberOfInstancesToAllocateFor = 2, renderItemInitializationCallback = () => { }, onBufferChangedCallback = () => { }) {
        this.m_className = className;
        this.m_bytesPerInstance = bytesPerInstance;
        this.m_renderer = renderer;
        this.m_meshGroupName = meshGroupName;
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
        this.m_renderItem.SetInstanceCount(this.m_instances.length);
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
    RemoveInstance(index) {
        // Remove the instance
        this.m_instances.splice(index, 1);
        // Update all instances that came after it with their new instance number
        for (let iii = index; iii < this.m_instances.length; ++iii)
            this.m_instances[iii].SetInstanceNumber(iii);
        // If no instances remain, delete the render item
        // Otherwise, update the instance count on the render item
        if (this.m_instances.length === 0)
            this.m_renderer.RemoveRenderItem(this.m_renderItem.Name(), this.m_meshGroupName);
        else
            this.m_renderItem.SetInstanceCount(this.m_instances.length);
        return this.m_instances.length;
    }
    m_className;
    m_instances = [];
    m_bytesPerInstance;
    m_renderer;
    m_meshGroupName;
    m_device;
    m_buffer;
    m_bytesInBuffer;
    m_renderItem;
    OnBufferChanged;
}
export class GameObject {
    constructor(name, renderer, scene) {
        this.m_name = name;
        this.m_renderer = renderer;
        this.m_scene = scene;
        this.m_childObjects = new HybridLookup();
    }
    UpdatePhysicsImpl(timeDelta, parentModelMatrix) {
        // Update the object
        this.UpdatePhysics(timeDelta, parentModelMatrix);
        // Update the objects children
        for (let iii = 0; iii < this.m_childObjects.size(); ++iii)
            this.m_childObjects.getFromIndex(iii).UpdatePhysicsImpl(timeDelta, this.m_modelMatrix);
    }
    UpdateGPUImpl() {
        // Update the object's GPU resources
        this.UpdateGPU();
        // Update the objects children GPU resources
        for (let iii = 0; iii < this.m_childObjects.size(); ++iii)
            this.m_childObjects.getFromIndex(iii).UpdateGPUImpl();
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
    m_scene;
    m_childObjects;
    m_position = vec3.create(0, 0, 0);
    m_rotation = vec3.create(0, 0, 0);
    m_scaling = vec3.create(1, 1, 1);
    m_modelMatrix = mat4.identity();
}
export class GameCube extends GameObject {
    constructor(renderer, scene) {
        super("GameCube", renderer, scene);
        let device = this.m_renderer.GetDevice();
        // Create a render item for the cube
        this.m_renderItem = renderer.CreateRenderItem("ri_game-cube", "mg_texture-cube", "mesh_texture-cube");
        // Create the model buffer
        //	this.m_modelMatrixBuffer = this.m_renderer.GetDevice().createBuffer({
        //		label: 'buffer_game-cube-model-matrix',
        //		size: 4 * 16, // sizeof(float) * floats per matrix
        //		usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        //	});
        this.m_modelMatrixBuffer = new UniformBufferSingleStaging(device, Float32Array.BYTES_PER_ELEMENT * 16, "buffer_game-cube-model-matrix");
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
                        buffer: this.m_modelMatrixBuffer.GetGPUBuffer()
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
    Destruct() {
        // When the object is deleted, we simply need to manually remove the RenderItem
        // from the MeshGroup
        this.m_renderer.RemoveRenderItem(this.m_renderItem.Name(), "mg_texture-cube");
    }
    UpdatePhysics(timeDelta, parentModelMatrix) {
        this.m_rotation[1] += timeDelta;
        if (this.m_rotation[1] > 2 * Math.PI)
            this.m_rotation[1] -= 2 * Math.PI;
        this.UpdateModelMatrix(parentModelMatrix);
    }
    async UpdateGPU() {
        //	// Update the GPUBuffer
        //	let device = this.m_renderer.GetDevice();
        //	device.queue.writeBuffer(
        //		this.m_modelMatrixBuffer,
        //		0,
        //		this.m_modelMatrix.buffer,
        //		this.m_modelMatrix.byteOffset,
        //		this.m_modelMatrix.byteLength
        //	);
        await this.m_modelMatrixBuffer.WriteData(this.m_modelMatrix);
    }
    m_renderItem;
    //private m_modelMatrixBuffer: GPUBuffer;
    m_modelMatrixBuffer;
}
export class GameCube2 extends GameObject {
    constructor(renderer, scene) {
        // Need to make sure the name of the GameObject is unique
        super(`GameCube2:${GameCube2.s_instanceNum}`, renderer, scene);
        GameCube2.s_instanceNum++;
        // Make a call to GetInstanceManager() will initialize the instance manager
        // Calling AddInstance() will generate a new instance and return its index into the array of instances
        this.m_instanceNumber = this.GetInstanceManager().AddInstance(this);
    }
    Destruct() {
        // When the object is deleted, we need to inform the InstanceManager to remove the object
        // If this was the last instance, then we need to set the InstanceManager to null
        if (this.GetInstanceManager().RemoveInstance(this.m_instanceNumber) === 0) {
            GameCube2.s_instanceManager = null;
        }
    }
    SetInstanceNumber(num) { this.m_instanceNumber = num; }
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
    UpdatePhysics(timeDelta, parentModelMatrix) {
        this.m_position[0] += timeDelta;
        if (this.m_position[0] > 5) {
            this.m_scene.RemoveGameObjectDelayed(this.m_name);
        }
        else {
            this.UpdateModelMatrix(parentModelMatrix);
        }
    }
    UpdateGPU() {
        this.GetInstanceManager().WriteToBuffer(this.m_instanceNumber, this.m_modelMatrix.buffer, this.m_modelMatrix.byteOffset, this.m_modelMatrix.byteLength);
    }
    m_instanceNumber;
    static s_instanceManager = null;
    static s_instanceNum = 0;
}
export class Scene {
    constructor() {
        this.m_camera = new Camera();
        this.m_gameObjects = new HybridLookup();
    }
    Update(timeDelta) {
        // Update the Camera
        this.m_camera.Update(timeDelta);
        // Update the game objects. First do a physics update, and then write the results to the GPU
        const identity = mat4.identity();
        let numObjects = this.m_gameObjects.size();
        for (let iii = 0; iii < numObjects; ++iii)
            this.m_gameObjects.getFromIndex(iii).UpdatePhysicsImpl(timeDelta, identity);
        // During the update, some objects may have requested a delete, but it is unsafe for
        // them to be deleted during the update. So instead, we add them to a list and delete
        // them here.
        this.m_delayedObjectsToDelete.forEach(val => { this.RemoveGameObject(val); });
        this.m_delayedObjectsToDelete.length = 0;
        // It is possible game objects will have disappeared after doing the physics update,
        // so you need to start from scratch
        numObjects = this.m_gameObjects.size();
        for (let iii = 0; iii < numObjects; ++iii)
            this.m_gameObjects.getFromIndex(iii).UpdateGPUImpl();
    }
    GetCamera() { return this.m_camera; }
    AddGameObject(object) {
        return this.m_gameObjects.add(object.Name(), object);
    }
    RemoveGameObject(name) {
        this.m_gameObjects.getFromKey(name).Destruct();
        this.m_gameObjects.removeFromKey(name);
    }
    RemoveGameObjectDelayed(name) {
        this.m_delayedObjectsToDelete.push(name);
    }
    m_camera;
    m_gameObjects;
    m_delayedObjectsToDelete = [];
}
//# sourceMappingURL=Scene.js.map