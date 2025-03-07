import { LOG_ERROR } from "./Log.js";
import { BindGroup } from "./Renderer.js";
import { UniformBufferPool, InstanceBufferPool } from "./Buffer.js";
import { Camera } from "./Camera.js";
import { HybridLookup } from "./Utils.js";
import { mat4, vec3 } from 'wgpu-matrix';
export class Light {
    // The light data is structured as follows:
    //		vec3f	strength
    //		f32		falloffStart
    //		vec3f   direction
    //		f32		falloffEnd
    //		vec3f	position
    //		f32		spotPower		
    constructor(name) {
        this.m_name = name;
        this.m_data = new ArrayBuffer(Light.sizeInBytes);
        this.m_strengthView = new Float32Array(this.m_data, 0, 3);
        this.m_falloffStartView = new Float32Array(this.m_data, Float32Array.BYTES_PER_ELEMENT * (3), 1);
        this.m_directionView = new Float32Array(this.m_data, Float32Array.BYTES_PER_ELEMENT * (3 + 1), 3);
        this.m_falloffEndView = new Float32Array(this.m_data, Float32Array.BYTES_PER_ELEMENT * (3 + 1 + 3), 1);
        this.m_positionView = new Float32Array(this.m_data, Float32Array.BYTES_PER_ELEMENT * (3 + 1 + 3 + 1), 3);
        this.m_spotPowerView = new Float32Array(this.m_data, Float32Array.BYTES_PER_ELEMENT * (3 + 1 + 3 + 1 + 3), 1);
    }
    Data() {
        return this.m_data;
    }
    Name() {
        return this.m_name;
    }
    m_data;
    m_name;
    m_strengthView;
    m_falloffStartView;
    m_directionView;
    m_falloffEndView;
    m_positionView;
    m_spotPowerView;
    static sizeInBytes = Float32Array.BYTES_PER_ELEMENT * (3 + 1 + 3 + 1 + 3 + 1);
}
export class DirectionalLight extends Light {
    constructor(name) {
        super(name);
    }
    SetDirection(direction) {
        this.m_directionView.set(direction);
    }
    SetStrength(strength) {
        this.m_strengthView.set(strength);
    }
}
export class PointLight extends Light {
    constructor(name) {
        super(name);
    }
    SetPosition(position) {
        this.m_positionView.set(position);
    }
    SetStrength(strength) {
        this.m_strengthView.set(strength);
    }
    SetFalloffStart(start) {
        this.m_falloffStartView[0] = start;
    }
    SetFalloffEnd(end) {
        this.m_falloffEndView[0] = end;
    }
}
export class SpotLight extends Light {
    constructor(name) {
        super(name);
    }
    SetStrength(strength) {
        this.m_strengthView.set(strength);
    }
    SetDirection(direction) {
        this.m_directionView.set(direction);
    }
    SetPosition(position) {
        this.m_positionView.set(position);
    }
    SetFalloffStart(start) {
        this.m_falloffStartView[0] = start;
    }
    SetFalloffEnd(end) {
        this.m_falloffEndView[0] = end;
    }
    SetSpotPower(power) {
        this.m_spotPowerView[0] = power;
    }
}
export class InstanceManager {
    constructor(className, bytesPerInstance, renderer, renderItemName, meshGroupName, meshName, numberOfInstancesToAllocateFor = 2, RenderItemInitializationCallback = () => { }, OnBufferChangedCallback = () => { }) {
        this.m_className = className;
        this.m_renderer = renderer;
        this.m_meshGroupName = meshGroupName;
        this.m_device = renderer.GetDevice();
        this.OnBufferChanged = OnBufferChangedCallback;
        this.m_instanceBuffer = new InstanceBufferPool(this.m_device, bytesPerInstance, numberOfInstancesToAllocateFor, `InstanceBuffer for InstanceManager<${this.m_className}>`);
        // Create the RenderItem.
        // The InstanceBuffer may use a staging buffer and therefore, we must make sure
        // the InstanceBuffer's staging buffer is transitioned to the appropriate state
        // before and after rendering.
        this.m_renderItem = renderer.CreateRenderItem(renderItemName, meshGroupName, meshName);
        this.m_renderItem.PreRender = () => { this.m_instanceBuffer.PreRender(); };
        // This callback is necessary because the InstanceManager only manages the instances of
        // the RenderItem - it knows nothing about what BindGroups the RenderItem should have. Therefore,
        // once the RenderItem is created, we call this callback so  that the derived class can add
        // 1+ BindGroups to the RenderItem
        RenderItemInitializationCallback(renderer, this.m_renderItem, this.m_instanceBuffer.GetGPUBuffer());
    }
    AddInstance(instance) {
        // Add the instance to the list of instances we are tracking
        this.m_instances.push(instance);
        // Update the render item's instance count
        this.m_renderItem.SetInstanceCount(this.m_instances.length);
        // If adding this instance would push the instance buffer beyond capacity,
        // then double the instance buffer's size
        let currentCapacity = this.m_instanceBuffer.CurrentCapacity();
        if (this.m_instances.length >= currentCapacity) {
            this.m_instanceBuffer.SetCapacity(currentCapacity * 2);
            // Because we are creating a brand new GPUBuffer, there will likely be updates
            // needed by the RenderItem to reference this new buffer. However, this may be
            // different for different GameObjects, so it needs to be a user provided callback
            this.OnBufferChanged(this.m_renderer, this.m_renderItem, this.m_instanceBuffer.GetGPUBuffer());
        }
        // Return the index of the instance
        return this.m_instances.length - 1;
    }
    WriteData(instanceNumber, data) {
        this.m_instanceBuffer.WriteData(instanceNumber, data.buffer, data.byteOffset, data.byteLength);
    }
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
    m_renderer;
    m_meshGroupName;
    m_device;
    m_instanceBuffer;
    m_renderItem;
    OnBufferChanged;
}
export class GameObject {
    constructor(name, renderer, scene, materialName = "") {
        this.m_name = name;
        this.m_renderer = renderer;
        this.m_scene = scene;
        this.m_childObjects = new HybridLookup();
        this.m_materialName = materialName;
        this.FetchCurrentMaterialIndex();
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
    FetchCurrentMaterialIndex() {
        if (this.m_materialName.length > 0)
            this.m_materialIndex = this.m_renderer.GetMaterialIndex(this.m_materialName);
    }
    m_name;
    m_renderer;
    m_scene;
    m_childObjects;
    // Data manage usage of materials
    m_materialName = "";
    m_materialIndex = 0;
    m_position = vec3.create(0, 0, 0);
    m_rotation = vec3.create(0, 0, 0);
    m_scaling = vec3.create(1, 1, 1);
    m_modelMatrix = mat4.identity();
}
export class BasicBox extends GameObject {
    constructor(renderer, scene) {
        super("BasicBox", renderer, scene, "mat_test2");
        let device = this.m_renderer.GetDevice();
        // Create a render item for the cube
        this.m_renderItem = renderer.CreateRenderItem("ri_game-cube", "mg_basic-object", "mesh_geosphere");
        // Create the model buffer
        this.m_modelMatrixBuffer = new UniformBufferPool(device, Float32Array.BYTES_PER_ELEMENT * (16 + 4), // 16 for the model matrix (mat4x4) & 1 for the material index
        "buffer_basic-box-model-matrix");
        // Get the BindGroupLayout that the mesh group uses
        let meshGroup = renderer.GetMeshGroup("mg_basic-object");
        let bindGroupLayout = meshGroup.GetRenderItemBindGroupLayout();
        if (bindGroupLayout === null) {
            let msg = "BasicBox::constructor() failed because meshGroup.GetRenderItemBindGroupLayout() returned null";
            LOG_ERROR(msg);
            throw Error(msg);
        }
        let bindGroupLayoutGroupNumber = meshGroup.GetRenderItemBindGroupLayoutGroupNumber();
        //		// Get the GPUTexture
        //		let cubeTexture = renderer.GetTexture("tex_molecule");
        //		// Create the sampler
        //		const sampler = device.createSampler({
        //			magFilter: 'linear',
        //			minFilter: 'linear',
        //		});
        let boxBindGroup = device.createBindGroup({
            layout: bindGroupLayout,
            entries: [
                {
                    binding: 0,
                    resource: {
                        buffer: this.m_modelMatrixBuffer.GetGPUBuffer()
                    }
                },
                //				{
                //					binding: 1,
                //					resource: sampler,
                //				},
                //				{
                //					binding: 2,
                //					resource: cubeTexture.createView(),
                //				},
            ],
        });
        this.m_renderItem.AddBindGroup("bg_basic-box", new BindGroup(bindGroupLayoutGroupNumber, boxBindGroup));
    }
    Destruct() {
        // When the object is deleted, we simply need to manually remove the RenderItem
        // from the MeshGroup
        this.m_renderer.RemoveRenderItem(this.m_renderItem.Name(), "mg_basic-object");
    }
    UpdatePhysics(timeDelta, parentModelMatrix) {
        this.m_rotation[1] += timeDelta;
        if (this.m_rotation[1] > 2 * Math.PI)
            this.m_rotation[1] -= 2 * Math.PI;
        this.UpdateModelMatrix(parentModelMatrix);
    }
    UpdateGPU() {
        let data = new ArrayBuffer(Float32Array.BYTES_PER_ELEMENT * 20);
        let modelMatrixView = new Float32Array(data, 0, 16);
        let materialIndexView = new Uint32Array(data, Float32Array.BYTES_PER_ELEMENT * 16, 1);
        modelMatrixView.set(this.m_modelMatrix);
        materialIndexView.set([this.m_materialIndex]);
        this.m_modelMatrixBuffer.WriteData(data);
    }
    m_renderItem;
    m_modelMatrixBuffer;
}
export class GameCube extends GameObject {
    constructor(renderer, scene) {
        super("GameCube", renderer, scene);
        let device = this.m_renderer.GetDevice();
        // Create a render item for the cube
        this.m_renderItem = renderer.CreateRenderItem("ri_game-cube", "mg_texture-cube", "mesh_texture-cube");
        // Create the model buffer
        this.m_modelMatrixBuffer = new UniformBufferPool(device, Float32Array.BYTES_PER_ELEMENT * 16, "buffer_game-cube-model-matrix");
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
        await this.m_modelMatrixBuffer.WriteData(this.m_modelMatrix.buffer);
    }
    m_renderItem;
    m_modelMatrixBuffer;
}
export class GameCube2 extends GameObject {
    constructor(renderer, scene) {
        // Need to make sure the name of the GameObject is unique
        super(`GameCube2:${GameCube2.s_instanceNum}`, renderer, scene);
        GameCube2.s_instanceNum++;
        // Make a call to GetInstanceManager() will initialize the instance manager if necessary
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
            GameCube2.s_instanceManager = new InstanceManager("GameCube2", Float32Array.BYTES_PER_ELEMENT * 16, this.m_renderer, "ri_game-cube-2", "mg_texture-cube-instancing", "mesh_texture-cube-instancing", 4, (renderer, renderItem, instanceDataBuffer) => {
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
            let msg = "GameCube2::GenerateBindGroup() failed because meshGroup.GetRenderItemBindGroupLayout() returned null";
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
        this.m_position[0] += timeDelta * this.m_velocity[0];
        this.m_position[1] += timeDelta * this.m_velocity[1];
        this.m_position[2] += timeDelta * this.m_velocity[2];
        if (Math.abs(this.m_position[0]) > 10)
            this.m_velocity[0] *= -1;
        if (Math.abs(this.m_position[1]) > 10)
            this.m_velocity[1] *= -1;
        if (Math.abs(this.m_position[2]) > 10)
            this.m_velocity[2] *= -1;
        this.UpdateModelMatrix(parentModelMatrix);
    }
    UpdateGPU() {
        this.GetInstanceManager().WriteData(this.m_instanceNumber, this.m_modelMatrix);
    }
    SetVelocity(v) { this.m_velocity = v; }
    m_instanceNumber;
    m_velocity = vec3.create(0, 0, 0);
    static s_instanceManager = null;
    static s_instanceNum = 0;
}
export class Scene {
    constructor() {
        this.m_camera = new Camera();
        this.m_gameObjects = new HybridLookup();
        this.m_directionalLights = new HybridLookup();
        this.m_pointLights = new HybridLookup();
        this.m_spotLights = new HybridLookup();
        this.OnLightsBufferNeedsRebuilding = (directionalLights, pointLights, spotLights) => { };
        this.OnLightChanged = (index, light) => { };
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
    AddDirectionalLight(name, direction, strength) {
        let light = new DirectionalLight(name);
        light.SetDirection(direction);
        light.SetStrength(strength);
        let l = this.m_directionalLights.add(name, light);
        this.OnLightsBufferNeedsRebuilding(this.m_directionalLights, this.m_pointLights, this.m_spotLights);
        return l;
    }
    AddPointLight(name, position, strength, falloffStart, falloffEnd) {
        let light = new PointLight(name);
        light.SetPosition(position);
        light.SetStrength(strength);
        light.SetFalloffStart(falloffStart);
        light.SetFalloffEnd(falloffEnd);
        let l = this.m_pointLights.add(name, light);
        this.OnLightsBufferNeedsRebuilding(this.m_directionalLights, this.m_pointLights, this.m_spotLights);
        return l;
    }
    AddSpotLight(name, position, direction, strength, falloffStart, falloffEnd, spotPower) {
        let light = new SpotLight(name);
        light.SetPosition(position);
        light.SetDirection(direction);
        light.SetStrength(strength);
        light.SetFalloffStart(falloffStart);
        light.SetFalloffEnd(falloffEnd);
        light.SetSpotPower(spotPower);
        let l = this.m_spotLights.add(name, light);
        this.OnLightsBufferNeedsRebuilding(this.m_directionalLights, this.m_pointLights, this.m_spotLights);
        return l;
    }
    NumberOfDirectionalLights() { return this.m_directionalLights.size(); }
    NumberOfPointLights() { return this.m_pointLights.size(); }
    NumberOfSpotLights() { return this.m_spotLights.size(); }
    RemoveDirectionalLight(name) {
        this.m_directionalLights.removeFromKey(name);
        this.OnLightsBufferNeedsRebuilding(this.m_directionalLights, this.m_pointLights, this.m_spotLights);
    }
    RemovePointLight(name) {
        this.m_pointLights.removeFromKey(name);
        this.OnLightsBufferNeedsRebuilding(this.m_directionalLights, this.m_pointLights, this.m_spotLights);
    }
    RemoveSpotLight(name) {
        this.m_spotLights.removeFromKey(name);
        this.OnLightsBufferNeedsRebuilding(this.m_directionalLights, this.m_pointLights, this.m_spotLights);
    }
    NotifyDirectionalLightChanged(name) {
        let index = this.m_directionalLights.indexOfKey(name);
        let light = this.m_directionalLights.getFromKey(name);
        this.OnLightChanged(index, light);
    }
    NotifyPointLightChanged(name) {
        let index = this.m_directionalLights.size() + this.m_directionalLights.indexOfKey(name);
        let light = this.m_directionalLights.getFromKey(name);
        this.OnLightChanged(index, light);
    }
    NotifySpotLightChanged(name) {
        let index = this.m_directionalLights.size() + this.m_pointLights.size() + this.m_directionalLights.indexOfKey(name);
        let light = this.m_directionalLights.getFromKey(name);
        this.OnLightChanged(index, light);
    }
    m_camera;
    m_gameObjects;
    // Keep separate lists of all lights because they need to be sorted when we
    // upload them to the GPUBuffer. The ordering will go direction lights, point
    // lights, then spot lights
    m_directionalLights;
    m_pointLights;
    m_spotLights;
    // OnLightsBufferNeedsRebuilding is called anytime the entire GPUBuffer of lights should be re-built
    OnLightsBufferNeedsRebuilding;
    // OnLightChanged is called anytime the position (or any other data) for a light is changed - no need to rebuild buffers
    OnLightChanged;
    m_delayedObjectsToDelete = [];
}
//# sourceMappingURL=Scene.js.map