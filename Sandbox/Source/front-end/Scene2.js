import { LOG_CORE_ERROR } from "./Log.js";
import { BindGroup } from "./Renderer.js";
import { InstanceBufferPool } from "./Buffer.js";
import { mat4, vec3 } from 'wgpu-matrix';
import { HybridLookup } from "./Utils.js";
import { Camera } from "./Camera.js";
class ModelData {
    // The model data for each object is structured as follows:
    //		mat4x4f modelMatrix
    //		u32		materialIndex
    //		f32		_padding_
    //		f32		_padding_
    //		f32		_padding_
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
export class Light {
    // The light data is structured as follows:
    //		vec3f	strength
    //		f32		falloffStart
    //		vec3f   direction
    //		f32		falloffEnd
    //		vec3f	position
    //		f32		spotPower		
    //	constructor(name: string, renderer: Renderer, scene: Scene)
    constructor(name) {
        //		// Each Light will own its own material, see create it first
        //		let materialName = `mat_light=${name}`;
        //		let material = new Material(materialName, vec4.create(1.0, 1.0, 1.0, 1.0), vec3.create(0.01, 0.01, 0.01), 0.75);
        //		renderer.AddMaterial(material)
        //
        //		// Calling the base class constructor must come second because it needs to be able to look up the material
        //		super(name, renderer, scene, materialName);
        //
        //		this.m_material = material;
        //		this.m_materialName = materialName;
        this.m_data = new ArrayBuffer(Light.sizeInBytes);
        this.m_strengthView = new Float32Array(this.m_data, 0, 3);
        this.m_falloffStartView = new Float32Array(this.m_data, Float32Array.BYTES_PER_ELEMENT * (3), 1);
        this.m_directionView = new Float32Array(this.m_data, Float32Array.BYTES_PER_ELEMENT * (3 + 1), 3);
        this.m_falloffEndView = new Float32Array(this.m_data, Float32Array.BYTES_PER_ELEMENT * (3 + 1 + 3), 1);
        this.m_positionView = new Float32Array(this.m_data, Float32Array.BYTES_PER_ELEMENT * (3 + 1 + 3 + 1), 3);
        this.m_spotPowerView = new Float32Array(this.m_data, Float32Array.BYTES_PER_ELEMENT * (3 + 1 + 3 + 1 + 3), 1);
        //		let device = this.m_renderer.GetDevice();
        //
        //		// Create a render item for the cube
        //		this.m_renderItem = renderer.CreateRenderItem("ri_game-cube", "mg_basic-object", "mesh_geosphere");
        //
        //		// Create the model buffer
        //		this.m_modelMatrixBuffer = new UniformBufferPool(device,
        //			Float32Array.BYTES_PER_ELEMENT * (16 + 4),	// 16 for the model matrix (mat4x4) & 1 for the material index
        //			"buffer_basic-box-model-matrix");
        //
        //		// Get the BindGroupLayout that the mesh group uses
        //		let meshGroup = renderer.GetMeshGroup("mg_basic-object");
        //		let bindGroupLayout = meshGroup.GetRenderItemBindGroupLayout();
        //		if (bindGroupLayout === null)
        //		{
        //			let msg = "BasicBox::constructor() failed because meshGroup.GetRenderItemBindGroupLayout() returned null";
        //			LOG_ERROR(msg);
        //			throw Error(msg);
        //		}
        //		let bindGroupLayoutGroupNumber = meshGroup.GetRenderItemBindGroupLayoutGroupNumber();
        //
        //		//		// Get the GPUTexture
        //		//		let cubeTexture = renderer.GetTexture("tex_molecule");
        //
        //		//		// Create the sampler
        //		//		const sampler = device.createSampler({
        //		//			magFilter: 'linear',
        //		//			minFilter: 'linear',
        //		//		});
        //
        //
        //		let boxBindGroup = device.createBindGroup({
        //			layout: bindGroupLayout,
        //			entries: [
        //				{
        //					binding: 0,
        //					resource: {
        //						buffer: this.m_modelMatrixBuffer.GetGPUBuffer()
        //					}
        //				},
        //				//				{
        //				//					binding: 1,
        //				//					resource: sampler,
        //				//				},
        //				//				{
        //				//					binding: 2,
        //				//					resource: cubeTexture.createView(),
        //				//				},
        //			],
        //		});
        //
        //		this.m_renderItem.AddBindGroup("bg_basic-box", new BindGroup(bindGroupLayoutGroupNumber, boxBindGroup));
    }
    //	public Destruct(): void { }
    //	public UpdatePhysics(timeDelta: number, parentModelMatrix: Mat4): void
    //	{
    //
    //	}
    //	public UpdateGPU(): void
    //	{
    //
    //	}
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
    //	protected m_materialName: string;
    //	protected m_material: Material;
    //
    //	private m_renderItem: RenderItem;
    //	private m_modelMatrixBuffer: UniformBufferPool;
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
class InstanceManager {
    constructor(renderItemName, renderer, meshGroup, meshName, bytesPerInstance, numberOfInstancesToAllocateFor, RenderItemInitializationCallback = () => { }, OnBufferChangedCallback = () => { }) {
        this.m_instances = [];
        this.m_renderer = renderer;
        this.m_meshGroup = meshGroup;
        this.OnBufferChanged = OnBufferChangedCallback;
        // Create the instance buffer.
        this.m_instanceBuffer = new InstanceBufferPool(this.m_renderer.GetDevice(), bytesPerInstance, numberOfInstancesToAllocateFor, `InstanceBuffer for render item '${renderItemName}'`);
        // Create the RenderItem.
        // The InstanceBuffer may use a staging buffer and therefore, we must make sure
        // the InstanceBuffer's staging buffer is transitioned to the appropriate state
        // before and after rendering.
        this.m_renderItem = this.m_meshGroup.CreateRenderItem(renderItemName, meshName);
        this.m_renderItem.PreRender = () => { this.m_instanceBuffer.PreRender(); };
        // This callback is necessary because the InstanceManager only manages the instances of
        // the RenderItem - it knows nothing about what BindGroups the RenderItem should have. Therefore,
        // once the RenderItem is created, we call this callback so that the derived class can add
        // 1+ BindGroups to the RenderItem
        RenderItemInitializationCallback(this.m_renderItem, this.m_instanceBuffer.GetGPUBuffer());
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
            // different depending on the class that uses the InstanceManager, so it needs to 
            // be a user provided callback
            this.OnBufferChanged(this.m_renderItem, this.m_instanceBuffer.GetGPUBuffer());
        }
        // Return the index of the instance
        return this.m_instances.length - 1;
    }
    WriteData(instanceNumber, data, byteOffset, numBytesToWrite) {
        this.m_instanceBuffer.WriteData(instanceNumber, data, byteOffset, numBytesToWrite);
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
// Base class for all 3D physical objects in the scene
export class GameObject {
    constructor(derivedClassName, renderer, scene, meshName, materialName) {
        this.m_derivedClassName = derivedClassName;
        this.m_renderer = renderer;
        this.m_scene = scene;
        this.m_childObjects = [];
        this.m_modelData = new ModelData();
        this.m_materialName = materialName;
        this.FetchCurrentMaterialIndex();
        // The mesh group is defaulted to the basic game object mesh group. If we add support for deducing which layer
        // an object belongs to, then we would need to deduce which mesh group to use as well
        this.m_meshGroup = this.m_renderer.GetMeshGroup("mg_game-object");
        // Keep track of total instances of the derived class
        let count = GameObject.s_allTimeInstanceNumbers.get(derivedClassName);
        if (count === undefined)
            count = 0;
        GameObject.s_allTimeInstanceNumbers.set(derivedClassName, count + 1);
        this.m_allTimeInstanceNumber = count;
        // Get (or create) the instance manager for this object
        let im = GameObject.s_instanceManagers.get(derivedClassName);
        if (im === undefined) {
            this.m_instanceManager = new InstanceManager(`${this.m_derivedClassName}_${this.m_allTimeInstanceNumber}`, this.m_renderer, this.m_meshGroup, meshName, ModelData.sizeInBytes, 1, (renderItem, buffer) => { this.OnRenderItemInitialized(renderItem, buffer); }, (renderItem, buffer) => { this.OnRenderItemBufferChanged(renderItem, buffer); });
            GameObject.s_instanceManagers.set(derivedClassName, this.m_instanceManager);
        }
        else {
            this.m_instanceManager = im;
        }
        // Register this instance with the instance manager
        this.m_currentInstanceNumber = this.m_instanceManager.AddInstance(this);
    }
    Destruct() {
        // When the object is deleted, we need to inform the InstanceManager to remove the object
        // If this was the last instance, then we need to remove the instance manager from the map
        // of all instance managers
        if (this.m_instanceManager.RemoveInstance(this.m_currentInstanceNumber) === 0) {
            GameObject.s_instanceManagers.delete(this.m_derivedClassName);
        }
    }
    Name() { return `${this.m_derivedClassName}_${this.m_allTimeInstanceNumber}`; }
    OnRenderItemInitialized(renderItem, buffer) {
        renderItem.AddBindGroup(`bg_${this.m_derivedClassName}`, this.GenerateBindGroup(buffer));
    }
    OnRenderItemBufferChanged(renderItem, buffer) {
        renderItem.UpdateBindGroup(`bg_${this.m_derivedClassName}`, this.GenerateBindGroup(buffer));
    }
    GenerateBindGroup(buffer) {
        let device = this.m_renderer.GetDevice();
        // Get the BindGroupLayout that the mesh group uses
        let bindGroupLayout = this.m_meshGroup.GetRenderItemBindGroupLayout();
        if (bindGroupLayout === null) {
            let msg = `GameObject::GenerateBindGroup() failed for 'bg_${this.m_derivedClassName}' because m_meshGroup.GetRenderItemBindGroupLayout() returned null`;
            LOG_CORE_ERROR(msg);
            throw Error(msg);
        }
        let bindGroupLayoutGroupNumber = this.m_meshGroup.GetRenderItemBindGroupLayoutGroupNumber();
        //	// Get the GPUTexture
        //	let cubeTexture = this.m_renderer.GetTexture("tex_molecule");
        //
        //	// Create the sampler
        //	const sampler = device.createSampler({
        //		magFilter: 'linear',
        //		minFilter: 'linear',
        //	});
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
                //			{
                //				binding: 1,
                //				resource: sampler,
                //			},
                //			{
                //				binding: 2,
                //				resource: cubeTexture.createView(),
                //			},
            ],
        });
        return new BindGroup(bindGroupLayoutGroupNumber, cubeBindGroup);
    }
    SetInstanceNumber(index) { this.m_currentInstanceNumber = index; }
    FetchCurrentMaterialIndex() {
        this.m_modelData.SetMaterialIndex(this.m_renderer.GetMaterialIndex(this.m_materialName));
    }
    UpdatePhysicsImpl(timeDelta, parentModelMatrix, parentMatrixIsDirty) {
        // Run the derived physics update method
        this.UpdatePhysics(timeDelta, parentModelMatrix, parentMatrixIsDirty);
        // If the model matrix is dirty after doing the physics update or the parent matrix has changed,
        // update it here before passing it to the children
        let dirty = this.m_modelMatrixIsDirty || parentMatrixIsDirty;
        if (dirty)
            this.UpdateModelMatrix(parentModelMatrix);
        // Update the objects children
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
    // GPU Update
    UpdateGPU() {
        // Update the object's GPU resources
        if (this.m_modelMatrixIsDirty) {
            this.m_modelMatrixIsDirty = false;
            let data = this.m_modelData.Data();
            this.m_instanceManager.WriteData(this.m_currentInstanceNumber, data, 0, data.byteLength);
        }
        // Update the objects children GPU resources
        this.m_childObjects.forEach(child => {
            child.UpdateGPU();
        });
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
    // Static data
    static s_allTimeInstanceNumbers = new Map();
    static s_instanceManagers = new Map();
    m_derivedClassName;
    m_allTimeInstanceNumber;
    m_renderer;
    m_scene;
    m_childObjects;
    // Model data for the object
    m_position = vec3.create(0, 0, 0);
    m_rotation = vec3.create(0, 0, 0);
    m_scaling = vec3.create(1, 1, 1);
    m_modelMatrixIsDirty = true;
    m_modelData;
    // Instance/RenderItem
    m_currentInstanceNumber;
    m_instanceManager;
    // Materials data
    m_materialName = "";
    // Mesh details
    m_meshGroup;
}
export class Sphere extends GameObject {
    constructor(renderer, scene) {
        super("Sphere", renderer, scene, "mesh_sphere", "mat_test1");
    }
    UpdatePhysics(timeDelta, parentModelMatrix, parentMatrixIsDirty) {
    }
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
            this.m_gameObjects.getFromIndex(iii).UpdatePhysicsImpl(timeDelta, identity, false);
        // During the update, some objects may have requested a delete, but it is unsafe for
        // them to be deleted during the update. So instead, we add them to a list and delete
        // them here.
        this.m_delayedObjectsToDelete.forEach(val => { this.RemoveGameObject(val); });
        this.m_delayedObjectsToDelete.length = 0;
        // It is possible game objects will have disappeared after doing the physics update,
        // so you need to start from scratch
        numObjects = this.m_gameObjects.size();
        for (let iii = 0; iii < numObjects; ++iii)
            this.m_gameObjects.getFromIndex(iii).UpdateGPU();
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
//# sourceMappingURL=Scene2.js.map