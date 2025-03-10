import
{
	LOG_CORE_INFO,
	LOG_CORE_TRACE,
	LOG_CORE_WARN,
	LOG_CORE_ERROR
} from "./Log.js"
import
{
	RenderItem,
	Mesh,
	MeshGroup,
	BindGroup,
	RenderPassLayer,
	RenderPassDescriptor,
	RenderPass,
	Renderer
} from "./Renderer.js";
import 
{
	UniformBufferBasicWrite,
	UniformBufferPool,
	InstanceBufferBasicWrite,
	InstanceBufferPool
} from "./Buffer.js"
import { Mat4, Vec3, Vec4, mat4, vec3, vec4 } from 'wgpu-matrix';
import { HybridLookup } from "./Utils.js"
import { Camera } from "./Camera.js";



class ModelData
{
	// The model data for each object is structured as follows:
	//		mat4x4f modelMatrix
	//		u32		materialIndex
	//		f32		_padding_
	//		f32		_padding_
	//		f32		_padding_
	constructor()
	{
		this.m_data = new ArrayBuffer(ModelData.sizeInBytes);
		this.m_modelMatrixView = new Float32Array(this.m_data, 0, 16);
		this.m_materialIndexView = new Uint32Array(this.m_data, Float32Array.BYTES_PER_ELEMENT * 16, 1);
	}
	public SetModelMatrix(viewProj: Mat4): void
	{
		this.m_modelMatrixView.set(viewProj);
	}
	public SetMaterialIndex(index: number): void
	{
		this.m_materialIndexView[0] = index;
	}
	public GetModelMatrix(): Mat4
	{
		return this.m_modelMatrixView;
	}
	public GetMaterialIndex(): number
	{
		return this.m_materialIndexView[0];
	}
	public Data(): ArrayBuffer
	{
		return this.m_data;
	}

	private m_data: ArrayBuffer;

	private m_modelMatrixView: Float32Array;
	private m_materialIndexView: Uint32Array;

	static sizeInBytes = Float32Array.BYTES_PER_ELEMENT * (16 + 4);
}


export class Light
{
	// The light data is structured as follows:
	//		vec3f	strength
	//		f32		falloffStart
	//		vec3f   direction
	//		f32		falloffEnd
	//		vec3f	position
	//		f32		spotPower		
//	constructor(name: string, renderer: Renderer, scene: Scene)
	constructor(name: string)
	{
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

	public Data(): ArrayBuffer
	{
		return this.m_data;
	}


	private m_data: ArrayBuffer;

	protected m_strengthView: Float32Array;
	protected m_falloffStartView: Float32Array;
	protected m_directionView: Float32Array;
	protected m_falloffEndView: Float32Array;
	protected m_positionView: Float32Array;
	protected m_spotPowerView: Float32Array;

//	protected m_materialName: string;
//	protected m_material: Material;
//
//	private m_renderItem: RenderItem;
//	private m_modelMatrixBuffer: UniformBufferPool;

	static sizeInBytes = Float32Array.BYTES_PER_ELEMENT * (3 + 1 + 3 + 1 + 3 + 1);
}
export class DirectionalLight extends Light
{
	constructor(name: string)
	{
		super(name);
	}
	public SetDirection(direction: Vec3): void
	{
		this.m_directionView.set(direction);
	}
	public SetStrength(strength: Vec3): void
	{
		this.m_strengthView.set(strength);
	}
}
export class PointLight extends Light
{
	constructor(name: string)
	{
		super(name);
	}
	public SetPosition(position: Vec3): void
	{
		this.m_positionView.set(position);
	}
	public SetStrength(strength: Vec3): void
	{
		this.m_strengthView.set(strength);
	}
	public SetFalloffStart(start: number): void
	{
		this.m_falloffStartView[0] = start;
	}
	public SetFalloffEnd(end: number): void
	{
		this.m_falloffEndView[0] = end;
	}
}
export class SpotLight extends Light
{
	constructor(name: string)
	{
		super(name);
	}
	public SetStrength(strength: Vec3): void
	{
		this.m_strengthView.set(strength);
	}
	public SetDirection(direction: Vec3): void
	{
		this.m_directionView.set(direction);
	}
	public SetPosition(position: Vec3): void
	{
		this.m_positionView.set(position);
	}
	public SetFalloffStart(start: number): void
	{
		this.m_falloffStartView[0] = start;
	}
	public SetFalloffEnd(end: number): void
	{
		this.m_falloffEndView[0] = end;
	}
	public SetSpotPower(power: number): void
	{
		this.m_spotPowerView[0] = power;
	}
}




class InstanceManager
{
	constructor(renderItemName: string, renderer: Renderer, meshGroup: MeshGroup, meshName: string,
		bytesPerInstance: number, numberOfInstancesToAllocateFor: number,
		RenderItemInitializationCallback: (renderItem: RenderItem, instanceDataBuffer: GPUBuffer) => void = () => { },
		OnBufferChangedCallback: (renderItem: RenderItem, buffer: GPUBuffer) => void = () => { })
	{
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
	public AddInstance(instance: GameObject): number
	{
		// Add the instance to the list of instances we are tracking
		this.m_instances.push(instance);

		// Update the render item's instance count
		this.m_renderItem.SetInstanceCount(this.m_instances.length);

		// If adding this instance would push the instance buffer beyond capacity,
		// then double the instance buffer's size
		let currentCapacity = this.m_instanceBuffer.CurrentCapacity();
		if (this.m_instances.length >= currentCapacity)
		{
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
	public WriteData(instanceNumber: number, data: ArrayBufferLike, byteOffset: GPUSize64, numBytesToWrite: GPUSize64): void
	{
		this.m_instanceBuffer.WriteData(instanceNumber, data, byteOffset, numBytesToWrite);
	}
	public RemoveInstance(index: number): number
	{
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

	private m_instances: GameObject[];
	private m_renderer: Renderer;
	private m_meshGroup: MeshGroup;
	private m_renderItem: RenderItem;
	private m_instanceBuffer: InstanceBufferPool;

	private OnBufferChanged: (renderItem: RenderItem, buffer: GPUBuffer) => void;
}

// Base class for all 3D physical objects in the scene
export abstract class GameObject
{
	constructor(derivedClassName: string, renderer: Renderer, scene: Scene, meshName: string, materialName: string)
	{
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
		if (im === undefined)
		{
			this.m_instanceManager = new InstanceManager(`${this.m_derivedClassName}_${this.m_allTimeInstanceNumber}`, this.m_renderer,
				this.m_meshGroup, meshName, ModelData.sizeInBytes, 1,
				(renderItem: RenderItem, buffer: GPUBuffer) => { this.OnRenderItemInitialized(renderItem, buffer); },
				(renderItem: RenderItem, buffer: GPUBuffer) => { this.OnRenderItemBufferChanged(renderItem, buffer); });
			GameObject.s_instanceManagers.set(derivedClassName, this.m_instanceManager);
		}
		else
		{
			this.m_instanceManager = im;
		}

		// Register this instance with the instance manager
		this.m_currentInstanceNumber = this.m_instanceManager.AddInstance(this);
	}
	public Destruct(): void
	{
		// When the object is deleted, we need to inform the InstanceManager to remove the object
		// If this was the last instance, then we need to remove the instance manager from the map
		// of all instance managers
		if (this.m_instanceManager.RemoveInstance(this.m_currentInstanceNumber) === 0)
		{
			GameObject.s_instanceManagers.delete(this.m_derivedClassName);
		}
	}
	public Name(): string { return `${this.m_derivedClassName}_${this.m_allTimeInstanceNumber}`; }
	private OnRenderItemInitialized(renderItem: RenderItem, buffer: GPUBuffer): void
	{
		renderItem.AddBindGroup(`bg_${this.m_derivedClassName}`, this.GenerateBindGroup(buffer));
	}
	private OnRenderItemBufferChanged(renderItem: RenderItem, buffer: GPUBuffer): void
	{
		renderItem.UpdateBindGroup(`bg_${this.m_derivedClassName}`, this.GenerateBindGroup(buffer));
	}
	private GenerateBindGroup(buffer: GPUBuffer): BindGroup
	{
		let device = this.m_renderer.GetDevice();

		// Get the BindGroupLayout that the mesh group uses
		let bindGroupLayout = this.m_meshGroup.GetRenderItemBindGroupLayout();
		if (bindGroupLayout === null)
		{
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

	public SetInstanceNumber(index: number): void { this.m_currentInstanceNumber = index; }
	public FetchCurrentMaterialIndex(): void
	{
		this.m_modelData.SetMaterialIndex(this.m_renderer.GetMaterialIndex(this.m_materialName));
	}

	// Physics Update
	public abstract UpdatePhysics(timeDelta: number, parentModelMatrix: Mat4, parentMatrixIsDirty: boolean): void;
	public UpdatePhysicsImpl(timeDelta: number, parentModelMatrix: Mat4, parentMatrixIsDirty: boolean): void
	{
		// Run the derived physics update method
		this.UpdatePhysics(timeDelta, parentModelMatrix, parentMatrixIsDirty);

		// If the model matrix is dirty after doing the physics update or the parent matrix has changed,
		// update it here before passing it to the children
		let dirty = this.m_modelMatrixIsDirty || parentMatrixIsDirty;
		if (dirty)
			this.UpdateModelMatrix(parentModelMatrix);

		// Update the objects children
		this.m_childObjects.forEach(child =>
		{
			child.UpdatePhysicsImpl(timeDelta, this.m_modelData.GetModelMatrix(), dirty);
		});
	}
	public UpdateModelMatrix(parentModelMatrix: Mat4): void
	{
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
	public UpdateGPU(): void
	{
		// Update the object's GPU resources
		if (this.m_modelMatrixIsDirty)
		{
			this.m_modelMatrixIsDirty = false;
			let data = this.m_modelData.Data();
			this.m_instanceManager.WriteData(this.m_currentInstanceNumber, data, 0, data.byteLength);
		}

		// Update the objects children GPU resources
		this.m_childObjects.forEach(child =>
		{
			child.UpdateGPU();
		});
	}

	public AddChild(object: GameObject): GameObject
	{
		this.m_childObjects.push(object);
		return object;
	}
	public SetPosition(position: Vec3): void
	{
		this.m_position = position;
		this.m_modelMatrixIsDirty = true;
	}
	public SetRotation(rotation: Vec3): void
	{
		this.m_rotation = rotation;
		this.m_modelMatrixIsDirty = true;
	}
	public SetScaling(scaling: Vec3): void
	{
		this.m_scaling = scaling;
		this.m_modelMatrixIsDirty = true;
	}


	// Static data
	private static s_allTimeInstanceNumbers: Map<string, number> = new Map<string, number>();
	private static s_instanceManagers: Map<string, InstanceManager> = new Map<string, InstanceManager>();


	private m_derivedClassName: string;
	private m_allTimeInstanceNumber: number;
	protected m_renderer: Renderer;
	protected m_scene: Scene;
	protected m_childObjects: GameObject[];

	// Model data for the object
	protected m_position = vec3.create(0, 0, 0);
	protected m_rotation = vec3.create(0, 0, 0);
	protected m_scaling = vec3.create(1, 1, 1);
	protected m_modelMatrixIsDirty = true;
	private m_modelData: ModelData;

	// Instance/RenderItem
	private m_currentInstanceNumber: number;
	private m_instanceManager: InstanceManager;

	// Materials data
	protected m_materialName: string = "";

	// Mesh details
	private m_meshGroup: MeshGroup;

	// Texture and any other data should go here...........
	// ......

}



export class Sphere extends GameObject
{
	constructor(renderer: Renderer, scene: Scene)
	{
		super("Sphere", renderer, scene, "mesh_sphere", "mat_test1");
	}
	public UpdatePhysics(timeDelta: number, parentModelMatrix: Mat4, parentMatrixIsDirty: boolean): void
	{

	}
}


export class Scene
{
	constructor()
	{
		this.m_camera = new Camera();
		this.m_gameObjects = new HybridLookup<GameObject>();

		this.m_directionalLights = new HybridLookup<DirectionalLight>();
		this.m_pointLights = new HybridLookup<PointLight>();
		this.m_spotLights = new HybridLookup<SpotLight>();
		this.OnLightsBufferNeedsRebuilding = (directionalLights: HybridLookup<DirectionalLight>,
			pointLights: HybridLookup<PointLight>,
			spotLights: HybridLookup<SpotLight>) => { };
		this.OnLightChanged = (index: number, light: Light) => { };
	}
	public Update(timeDelta: number): void
	{
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
		this.m_delayedObjectsToDelete.forEach(val => { this.RemoveGameObject(val); })
		this.m_delayedObjectsToDelete.length = 0;

		// It is possible game objects will have disappeared after doing the physics update,
		// so you need to start from scratch
		numObjects = this.m_gameObjects.size();
		for (let iii = 0; iii < numObjects; ++iii)
			this.m_gameObjects.getFromIndex(iii).UpdateGPU();
	}
	public GetCamera(): Camera { return this.m_camera; }
	public AddGameObject(object: GameObject): GameObject
	{
		return this.m_gameObjects.add(object.Name(), object);
	}
	public RemoveGameObject(name: string): void
	{
		this.m_gameObjects.getFromKey(name).Destruct();
		this.m_gameObjects.removeFromKey(name);
	}
	public RemoveGameObjectDelayed(name: string): void
	{
		this.m_delayedObjectsToDelete.push(name);
	}

	public AddDirectionalLight(name: string, direction: Vec3, strength: Vec3): DirectionalLight
	{
		let light = new DirectionalLight(name);
		light.SetDirection(direction);
		light.SetStrength(strength);
		let l = this.m_directionalLights.add(name, light);
		this.OnLightsBufferNeedsRebuilding(this.m_directionalLights, this.m_pointLights, this.m_spotLights);
		return l;
	}
	public AddPointLight(name: string, position: Vec3, strength: Vec3, falloffStart: number, falloffEnd: number): PointLight
	{
		let light = new PointLight(name);
		light.SetPosition(position);
		light.SetStrength(strength);
		light.SetFalloffStart(falloffStart);
		light.SetFalloffEnd(falloffEnd);
		let l = this.m_pointLights.add(name, light);
		this.OnLightsBufferNeedsRebuilding(this.m_directionalLights, this.m_pointLights, this.m_spotLights);
		return l;
	}
	public AddSpotLight(name: string, position: Vec3, direction: Vec3, strength: Vec3,
		falloffStart: number, falloffEnd: number, spotPower: number): SpotLight
	{
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
	public NumberOfDirectionalLights(): number { return this.m_directionalLights.size(); }
	public NumberOfPointLights(): number { return this.m_pointLights.size(); }
	public NumberOfSpotLights(): number { return this.m_spotLights.size(); }

	public RemoveDirectionalLight(name: string): void
	{
		this.m_directionalLights.removeFromKey(name);
		this.OnLightsBufferNeedsRebuilding(this.m_directionalLights, this.m_pointLights, this.m_spotLights);
	}
	public RemovePointLight(name: string): void
	{
		this.m_pointLights.removeFromKey(name);
		this.OnLightsBufferNeedsRebuilding(this.m_directionalLights, this.m_pointLights, this.m_spotLights);
	}
	public RemoveSpotLight(name: string): void
	{
		this.m_spotLights.removeFromKey(name);
		this.OnLightsBufferNeedsRebuilding(this.m_directionalLights, this.m_pointLights, this.m_spotLights);
	}


	private NotifyDirectionalLightChanged(name: string): void
	{
		let index = this.m_directionalLights.indexOfKey(name);
		let light = this.m_directionalLights.getFromKey(name);
		this.OnLightChanged(index, light);
	}
	private NotifyPointLightChanged(name: string): void
	{
		let index = this.m_directionalLights.size() + this.m_directionalLights.indexOfKey(name);
		let light = this.m_directionalLights.getFromKey(name);
		this.OnLightChanged(index, light);
	}
	private NotifySpotLightChanged(name: string): void
	{
		let index = this.m_directionalLights.size() + this.m_pointLights.size() + this.m_directionalLights.indexOfKey(name);
		let light = this.m_directionalLights.getFromKey(name);
		this.OnLightChanged(index, light);
	}




	private m_camera: Camera;
	private m_gameObjects: HybridLookup<GameObject>;

	// Keep separate lists of all lights because they need to be sorted when we
	// upload them to the GPUBuffer. The ordering will go direction lights, point
	// lights, then spot lights
	private m_directionalLights: HybridLookup<DirectionalLight>;
	private m_pointLights: HybridLookup<PointLight>;
	private m_spotLights: HybridLookup<SpotLight>;
	// OnLightsBufferNeedsRebuilding is called anytime the entire GPUBuffer of lights should be re-built
	public OnLightsBufferNeedsRebuilding: (directionalLights: HybridLookup<DirectionalLight>,
		pointLights: HybridLookup<PointLight>,
		spotLights: HybridLookup<SpotLight>) => void;
	// OnLightChanged is called anytime the position (or any other data) for a light is changed - no need to rebuild buffers
	public OnLightChanged: (index: number, light: Light) => void;


	private m_delayedObjectsToDelete: string[] = [];
}