import { LOG_CORE_ERROR } from "./Log.js";
import { BindGroup } from "./Renderer.js";
import { InstanceBufferPool } from "./Buffer.js";
import { mat4, vec3, vec4 } from 'wgpu-matrix';
import { HybridLookup } from "./Utils.js";
import { Camera } from "./Camera.js";
import { Material } from "./Material.js";
export class ModelData {
    constructor() {
        this.m_data = new ArrayBuffer(ModelData.sizeInBytes);
        this.m_modelMatrixView = new Float32Array(this.m_data, 0, 16);
        this.m_materialIndexView = new Uint32Array(this.m_data, Float32Array.BYTES_PER_ELEMENT * 16, 1);
    }
    SetModelMatrix(viewProj) {
        this.m_modelMatrixView.set(viewProj);
    }
    SetMaterialIndex(index) {
        this.m_materialIndexView[0] = index;
    }
    GetModelMatrix() {
        return this.m_modelMatrixView;
    }
    GetMaterialIndex() {
        return this.m_materialIndexView[0];
    }
    Data() {
        return this.m_data;
    }
    m_data;
    m_modelMatrixView;
    m_materialIndexView;
    static sizeInBytes = Float32Array.BYTES_PER_ELEMENT * (16 + 4);
}
class InstanceManager {
    constructor(renderItemName, renderer, meshGroup, meshName, bytesPerInstance, numberOfInstancesToAllocateFor, RenderItemInitializationCallback = () => { }, OnBufferChangedCallback = () => { }) {
        this.m_instances = [];
        this.m_renderer = renderer;
        this.m_meshGroup = meshGroup;
        this.OnBufferChanged = OnBufferChangedCallback;
        this.m_instanceBuffer = new InstanceBufferPool(this.m_renderer.GetDevice(), bytesPerInstance, numberOfInstancesToAllocateFor, `InstanceBuffer for render item '${renderItemName}'`);
        this.m_renderItem = this.m_meshGroup.CreateRenderItem(renderItemName, meshName);
        this.m_renderItem.PreRender = () => { this.m_instanceBuffer.PreRender(); };
        RenderItemInitializationCallback(this.m_renderItem, this.m_instanceBuffer.GetGPUBuffer());
    }
    AddInstance(instance) {
        this.m_instances.push(instance);
        this.m_renderItem.SetInstanceCount(this.m_instances.length);
        let currentCapacity = this.m_instanceBuffer.CurrentCapacity();
        if (this.m_instances.length >= currentCapacity) {
            this.m_instanceBuffer.SetCapacity(currentCapacity * 2);
            this.OnBufferChanged(this.m_renderItem, this.m_instanceBuffer.GetGPUBuffer());
        }
        return this.m_instances.length - 1;
    }
    WriteData(instanceNumber, data, byteOffset, numBytesToWrite) {
        this.m_instanceBuffer.WriteData(instanceNumber, data, byteOffset, numBytesToWrite);
    }
    RemoveInstance(index) {
        this.m_instances.splice(index, 1);
        for (let iii = index; iii < this.m_instances.length; ++iii)
            this.m_instances[iii].SetInstanceNumber(iii);
        if (this.m_instances.length === 0)
            this.m_meshGroup.RemoveRenderItem(this.m_renderItem.Name());
        else
            this.m_renderItem.SetInstanceCount(this.m_instances.length);
        return this.m_instances.length;
    }
    m_instances;
    m_renderer;
    m_meshGroup;
    m_renderItem;
    m_instanceBuffer;
    OnBufferChanged;
}
export class SceneObject {
    constructor(derivedClassName, renderer, scene, meshGroup, meshName, materialName) {
        this.m_derivedClassName = derivedClassName;
        this.m_renderer = renderer;
        this.m_scene = scene;
        this.m_childObjects = [];
        this.m_modelData = new ModelData();
        this.m_meshGroup = meshGroup;
        this.m_materialName = materialName;
        this.FetchCurrentMaterialIndex();
        let count = SceneObject.s_allTimeInstanceNumbers.get(derivedClassName);
        if (count === undefined)
            count = 0;
        SceneObject.s_allTimeInstanceNumbers.set(derivedClassName, count + 1);
        this.m_allTimeInstanceNumber = count;
        let im = SceneObject.s_instanceManagers.get(derivedClassName);
        if (im === undefined) {
            this.m_instanceManager = new InstanceManager(`${this.m_derivedClassName}_${this.m_allTimeInstanceNumber}`, this.m_renderer, this.m_meshGroup, meshName, ModelData.sizeInBytes, 1, (renderItem, buffer) => { this.OnRenderItemInitialized(renderItem, buffer); }, (renderItem, buffer) => { this.OnRenderItemBufferChanged(renderItem, buffer); });
            SceneObject.s_instanceManagers.set(derivedClassName, this.m_instanceManager);
        }
        else {
            this.m_instanceManager = im;
        }
        this.m_currentInstanceNumber = this.m_instanceManager.AddInstance(this);
    }
    Destruct() {
        if (this.m_instanceManager.RemoveInstance(this.m_currentInstanceNumber) === 0) {
            SceneObject.s_instanceManagers.delete(this.m_derivedClassName);
        }
    }
    Name() { return `${this.m_derivedClassName}_${this.m_allTimeInstanceNumber}`; }
    OnRenderItemInitialized(renderItem, buffer) {
        renderItem.AddBindGroup(`bg_${this.m_derivedClassName}`, this.GenerateBindGroup(buffer));
    }
    OnRenderItemBufferChanged(renderItem, buffer) {
        renderItem.UpdateBindGroup(`bg_${this.m_derivedClassName}`, this.GenerateBindGroup(buffer));
    }
    SetInstanceNumber(index) { this.m_currentInstanceNumber = index; }
    FetchCurrentMaterialIndex() {
        this.m_modelData.SetMaterialIndex(this.m_renderer.GetMaterialIndex(this.m_materialName));
    }
    UpdatePhysicsImpl(timeDelta, parentModelMatrix, parentMatrixIsDirty) {
        this.UpdatePhysics(timeDelta, parentModelMatrix, parentMatrixIsDirty);
        let dirty = this.m_modelMatrixIsDirty || parentMatrixIsDirty;
        if (dirty)
            this.UpdateModelMatrix(parentModelMatrix);
        this.m_childObjects.forEach(child => {
            child.UpdatePhysicsImpl(timeDelta, this.m_modelData.GetModelMatrix(), dirty);
        });
    }
    UpdateModelMatrix(parentModelMatrix) {
        this.m_modelMatrixIsDirty = true;
        let model = mat4.translation(this.m_position);
        let rotationX = mat4.rotationX(this.m_rotation[0]);
        let rotationY = mat4.rotationY(this.m_rotation[1]);
        let rotationZ = mat4.rotationZ(this.m_rotation[2]);
        let scaling = mat4.scaling(this.m_scaling);
        mat4.multiply(model, rotationX, model);
        mat4.multiply(model, rotationY, model);
        mat4.multiply(model, rotationZ, model);
        mat4.multiply(model, scaling, model);
        this.m_modelData.SetModelMatrix(mat4.multiply(parentModelMatrix, model));
    }
    UpdateGPU() {
        if (this.m_modelMatrixIsDirty) {
            this.m_modelMatrixIsDirty = false;
            let data = this.m_modelData.Data();
            this.m_instanceManager.WriteData(this.m_currentInstanceNumber, data, 0, data.byteLength);
        }
        this.m_childObjects.forEach(child => { child.UpdateGPU(); });
    }
    AddChild(object) {
        this.m_childObjects.push(object);
        return object;
    }
    SetPosition(position) {
        this.m_position = position;
        this.m_modelMatrixIsDirty = true;
    }
    SetRotation(rotation) {
        this.m_rotation = rotation;
        this.m_modelMatrixIsDirty = true;
    }
    SetScaling(scaling) {
        this.m_scaling = scaling;
        this.m_modelMatrixIsDirty = true;
    }
    static s_allTimeInstanceNumbers = new Map();
    static s_instanceManagers = new Map();
    m_derivedClassName;
    m_allTimeInstanceNumber;
    m_renderer;
    m_scene;
    m_childObjects;
    m_position = vec3.create(0, 0, 0);
    m_rotation = vec3.create(0, 0, 0);
    m_scaling = vec3.create(1, 1, 1);
    m_modelMatrixIsDirty = true;
    m_modelData;
    m_currentInstanceNumber;
    m_instanceManager;
    m_materialName = "";
    m_meshGroup;
}
export class GameObject extends SceneObject {
    constructor(derivedClassName, renderer, scene, meshName, materialName) {
        let meshGroup = renderer.GetMeshGroup("mg_game-object");
        super(derivedClassName, renderer, scene, meshGroup, meshName, materialName);
    }
    GenerateBindGroup(buffer) {
        let device = this.m_renderer.GetDevice();
        let bindGroupLayout = this.m_meshGroup.GetRenderItemBindGroupLayout();
        if (bindGroupLayout === null) {
            let msg = `GameObject::GenerateBindGroup() failed for 'bg_${this.m_derivedClassName}' because m_meshGroup.GetRenderItemBindGroupLayout() returned null`;
            LOG_CORE_ERROR(msg);
            throw Error(msg);
        }
        let bindGroupLayoutGroupNumber = this.m_meshGroup.GetRenderItemBindGroupLayoutGroupNumber();
        let cubeBindGroup = device.createBindGroup({
            layout: bindGroupLayout,
            entries: [
                {
                    binding: 0,
                    resource: {
                        buffer: buffer
                    }
                },
            ],
        });
        return new BindGroup(bindGroupLayoutGroupNumber, cubeBindGroup);
    }
}
export class Sphere extends GameObject {
    constructor(renderer, scene) {
        super("Sphere", renderer, scene, "mesh_sphere", "mat_test1");
    }
    UpdatePhysics(timeDelta, parentModelMatrix, parentMatrixIsDirty) {
        this.m_position[0] += timeDelta;
        if (this.m_position[0] > 5)
            this.m_position[0] = -5;
        this.m_modelMatrixIsDirty = true;
    }
}
export class Light extends SceneObject {
    static s_allTimeInstanceNumber = 0;
    constructor(derivedClassName, renderer, scene, meshName) {
        let materialName = `light_material=${derivedClassName}_${Light.s_allTimeInstanceNumber}`;
        let material = new Material(materialName, vec4.create(1.0, 1.0, 1.0, 1.0), vec3.create(0.01, 0.01, 0.01), 0.75);
        renderer.AddMaterial(material);
        Light.s_allTimeInstanceNumber++;
        let meshGroup = renderer.GetMeshGroup("mg_lights");
        super(derivedClassName, renderer, scene, meshGroup, meshName, materialName);
        this.m_material = material;
        this.m_materialName = materialName;
        this.m_data = new ArrayBuffer(Light.sizeInBytes);
        this.m_strengthView = new Float32Array(this.m_data, 0, 3);
        this.m_falloffStartView = new Float32Array(this.m_data, Float32Array.BYTES_PER_ELEMENT * (3), 1);
        this.m_directionView = new Float32Array(this.m_data, Float32Array.BYTES_PER_ELEMENT * (3 + 1), 3);
        this.m_falloffEndView = new Float32Array(this.m_data, Float32Array.BYTES_PER_ELEMENT * (3 + 1 + 3), 1);
        this.m_positionView = new Float32Array(this.m_data, Float32Array.BYTES_PER_ELEMENT * (3 + 1 + 3 + 1), 3);
        this.m_spotPowerView = new Float32Array(this.m_data, Float32Array.BYTES_PER_ELEMENT * (3 + 1 + 3 + 1 + 3), 1);
    }
    GenerateBindGroup(buffer) {
        let device = this.m_renderer.GetDevice();
        let bindGroupLayout = this.m_meshGroup.GetRenderItemBindGroupLayout();
        if (bindGroupLayout === null) {
            let msg = `Light::GenerateBindGroup() failed for 'bg_${this.m_derivedClassName}' because m_meshGroup.GetRenderItemBindGroupLayout() returned null`;
            LOG_CORE_ERROR(msg);
            throw Error(msg);
        }
        let bindGroupLayoutGroupNumber = this.m_meshGroup.GetRenderItemBindGroupLayoutGroupNumber();
        let cubeBindGroup = device.createBindGroup({
            layout: bindGroupLayout,
            entries: [
                {
                    binding: 0,
                    resource: {
                        buffer: buffer
                    }
                }
            ],
        });
        return new BindGroup(bindGroupLayoutGroupNumber, cubeBindGroup);
    }
    Data() {
        return this.m_data;
    }
    m_data;
    m_strengthView;
    m_falloffStartView;
    m_directionView;
    m_falloffEndView;
    m_positionView;
    m_spotPowerView;
    m_materialName;
    m_material;
    static sizeInBytes = Float32Array.BYTES_PER_ELEMENT * (3 + 1 + 3 + 1 + 3 + 1);
}
export class DirectionalLight extends Light {
    constructor(renderer, scene) {
        super("DirectionalLight", renderer, scene, "mesh_box");
    }
    UpdatePhysics(timeDelta, parentModelMatrix, parentMatrixIsDirty) {
    }
    SetDirection(direction) {
        this.m_directionView.set(direction);
    }
    SetStrength(strength) {
        this.m_strengthView.set(strength);
    }
}
export class PointLight extends Light {
    constructor(renderer, scene) {
        super("PointLight", renderer, scene, "mesh_sphere");
    }
    UpdatePhysics(timeDelta, parentModelMatrix, parentMatrixIsDirty) {
    }
    SetPosition(position) {
        super.SetPosition(position);
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
    constructor(renderer, scene) {
        super("SpotLight", renderer, scene, "mesh_cylinder");
    }
    UpdatePhysics(timeDelta, parentModelMatrix, parentMatrixIsDirty) {
    }
    SetStrength(strength) {
        this.m_strengthView.set(strength);
    }
    SetDirection(direction) {
        this.m_directionView.set(direction);
    }
    SetPosition(position) {
        super.SetPosition(position);
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
export class Scene {
    constructor(renderer) {
        this.m_renderer = renderer;
        this.m_camera = new Camera();
        this.m_sceneObjects = new HybridLookup();
        this.m_directionalLights = new HybridLookup();
        this.m_pointLights = new HybridLookup();
        this.m_spotLights = new HybridLookup();
        this.OnLightsBufferNeedsRebuilding = (directionalLights, pointLights, spotLights) => { };
        this.OnLightChanged = (index, light) => { };
    }
    Update(timeDelta) {
        this.m_camera.Update(timeDelta);
        const identity = mat4.identity();
        let numObjects = this.m_sceneObjects.size();
        for (let iii = 0; iii < numObjects; ++iii)
            this.m_sceneObjects.getFromIndex(iii).UpdatePhysicsImpl(timeDelta, identity, false);
        this.m_delayedObjectsToDelete.forEach(val => { this.RemoveSceneObject(val); });
        this.m_delayedObjectsToDelete.length = 0;
        numObjects = this.m_sceneObjects.size();
        for (let iii = 0; iii < numObjects; ++iii)
            this.m_sceneObjects.getFromIndex(iii).UpdateGPU();
    }
    GetCamera() { return this.m_camera; }
    AddSceneObject(object) {
        return this.m_sceneObjects.add(object.Name(), object);
    }
    RemoveSceneObject(name) {
        this.m_sceneObjects.getFromKey(name).Destruct();
        this.m_sceneObjects.removeFromKey(name);
    }
    RemoveGameObjectDelayed(name) {
        this.m_delayedObjectsToDelete.push(name);
    }
    AddDirectionalLight(name, direction, strength) {
        let light = new DirectionalLight(this.m_renderer, this);
        light.SetDirection(direction);
        light.SetStrength(strength);
        light.SetPosition(vec3.scale(vec3.normalize(direction), -10));
        let l = this.m_directionalLights.add(name, light);
        this.OnLightsBufferNeedsRebuilding(this.m_directionalLights, this.m_pointLights, this.m_spotLights);
        this.AddSceneObject(l);
        return l;
    }
    AddPointLight(name, position, strength, falloffStart, falloffEnd) {
        let light = new PointLight(this.m_renderer, this);
        light.SetPosition(position);
        light.SetStrength(strength);
        light.SetFalloffStart(falloffStart);
        light.SetFalloffEnd(falloffEnd);
        let l = this.m_pointLights.add(name, light);
        this.OnLightsBufferNeedsRebuilding(this.m_directionalLights, this.m_pointLights, this.m_spotLights);
        this.AddSceneObject(l);
        return l;
    }
    AddSpotLight(name, position, direction, strength, falloffStart, falloffEnd, spotPower) {
        let light = new SpotLight(this.m_renderer, this);
        light.SetPosition(position);
        light.SetDirection(direction);
        light.SetStrength(strength);
        light.SetFalloffStart(falloffStart);
        light.SetFalloffEnd(falloffEnd);
        light.SetSpotPower(spotPower);
        let l = this.m_spotLights.add(name, light);
        this.OnLightsBufferNeedsRebuilding(this.m_directionalLights, this.m_pointLights, this.m_spotLights);
        this.AddSceneObject(l);
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
    m_renderer;
    m_camera;
    m_sceneObjects;
    m_directionalLights;
    m_pointLights;
    m_spotLights;
    OnLightsBufferNeedsRebuilding;
    OnLightChanged;
    m_delayedObjectsToDelete = [];
}
