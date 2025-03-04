import { LOG_INFO, LOG_TRACE, LOG_WARN, LOG_ERROR } from "./Log.js";
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
import { Camera } from "./Camera.js";
import { HybridLookup } from "./Utils.js"
import { Mat4, Vec3, Vec4, mat4, vec3 } from 'wgpu-matrix';



interface UsesInstancing
{
	SetInstanceNumber(i: number): void;
}

export class InstanceManager<T extends UsesInstancing>
{
	constructor(className: string, bytesPerInstance: number, renderer: Renderer, renderItemName: string,
		meshGroupName: string, meshName: string, numberOfInstancesToAllocateFor: number = 2,
		RenderItemInitializationCallback: (renderer: Renderer, renderItem: RenderItem, instanceDataBuffer: GPUBuffer) => void = () => { },
		OnBufferChangedCallback: (renderer: Renderer, renderItem: RenderItem, buffer: GPUBuffer) => void = () => { }
	)
	{
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
	public AddInstance(instance: T): number
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
			// different for different GameObjects, so it needs to be a user provided callback
			this.OnBufferChanged(this.m_renderer, this.m_renderItem, this.m_instanceBuffer.GetGPUBuffer());
		}

		// Return the index of the instance
		return this.m_instances.length - 1;
	}
	public WriteData(instanceNumber: number, data: Float32Array<ArrayBufferLike>): void
	{
		this.m_instanceBuffer.WriteData(instanceNumber, data.buffer, data.byteOffset, data.byteLength);
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
			this.m_renderer.RemoveRenderItem(this.m_renderItem.Name(), this.m_meshGroupName);
		else
			this.m_renderItem.SetInstanceCount(this.m_instances.length);

		return this.m_instances.length;
	}

	private m_className: string;
	private m_instances: T[] = [];
	private m_renderer: Renderer;
	private m_meshGroupName: string;
	private m_device: GPUDevice;

	private m_instanceBuffer: InstanceBufferPool;

	private m_renderItem: RenderItem;

	private OnBufferChanged: (renderer: Renderer, renderItem: RenderItem, buffer: GPUBuffer) => void;
}

export abstract class GameObject
{
	constructor(name: string, renderer: Renderer, scene: Scene, materialName: string = "")
	{
		this.m_name = name;
		this.m_renderer = renderer;
		this.m_scene = scene;
		this.m_childObjects = new HybridLookup<GameObject>();

		this.m_materialName = materialName;
		this.FetchCurrentMaterialIndex();
	}
	public abstract Destruct(): void;

	// Physics Update
	public abstract UpdatePhysics(timeDelta: number, parentModelMatrix: Mat4): void;
	public UpdatePhysicsImpl(timeDelta: number, parentModelMatrix: Mat4): void
	{
		// Update the object
		this.UpdatePhysics(timeDelta, parentModelMatrix);

		// Update the objects children
		for (let iii = 0; iii < this.m_childObjects.size(); ++iii)
			this.m_childObjects.getFromIndex(iii).UpdatePhysicsImpl(timeDelta, this.m_modelMatrix);
	}

	// GPU Update
	public abstract UpdateGPU(): void;
	public UpdateGPUImpl(): void
	{
		// Update the object's GPU resources
		this.UpdateGPU();

		// Update the objects children GPU resources
		for (let iii = 0; iii < this.m_childObjects.size(); ++iii)
			this.m_childObjects.getFromIndex(iii).UpdateGPUImpl();
	}

	public Name(): string { return this.m_name; }
	public UpdateModelMatrix(parentModelMatrix: Mat4): void
	{
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

	public AddChild(object: GameObject): GameObject
	{
		return this.m_childObjects.add(object.Name(), object);
	}
	public SetPosition(position: Vec3): void
	{
		this.m_position = position;
	}
	public SetRotation(rotation: Vec3): void
	{
		this.m_rotation = rotation;
	}
	public SetScaling(scaling: Vec3): void
	{
		this.m_scaling = scaling;
	}

	public FetchCurrentMaterialIndex(): void
	{
		if (this.m_materialName.length > 0)
			this.m_materialIndex = this.m_renderer.GetMaterialIndex(this.m_materialName);
	}

	protected m_name: string;
	protected m_renderer: Renderer;
	protected m_scene: Scene;
	protected m_childObjects: HybridLookup<GameObject>;

	// Data manage usage of materials
	protected m_materialName: string = "";
	protected m_materialIndex: number = 0;

	protected m_position = vec3.create(0, 0, 0);
	protected m_rotation = vec3.create(0, 0, 0);
	protected m_scaling = vec3.create(1, 1, 1);
	protected m_modelMatrix = mat4.identity();
}


export class BasicBox extends GameObject
{
	constructor(renderer: Renderer, scene: Scene)
	{
		super("BasicBox", renderer, scene, "mat_test2");

		let device = this.m_renderer.GetDevice();

		// Create a render item for the cube
		this.m_renderItem = renderer.CreateRenderItem("ri_game-cube", "mg_basic-object", "mesh_box");

		// Create the model buffer
		this.m_modelMatrixBuffer = new UniformBufferPool(device,
			Float32Array.BYTES_PER_ELEMENT * (16 + 4),	// 16 for the model matrix (mat4x4) & 1 for the material index
			"buffer_basic-box-model-matrix");

		// Get the BindGroupLayout that the mesh group uses
		let meshGroup = renderer.GetMeshGroup("mg_basic-object");
		let bindGroupLayout = meshGroup.GetRenderItemBindGroupLayout();
		if (bindGroupLayout === null)
		{
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
	public Destruct(): void
	{
		// When the object is deleted, we simply need to manually remove the RenderItem
		// from the MeshGroup
		this.m_renderer.RemoveRenderItem(this.m_renderItem.Name(), "mg_basic-object");
	}

	public UpdatePhysics(timeDelta: number, parentModelMatrix: Mat4): void
	{
		this.m_rotation[1] += timeDelta;
		if (this.m_rotation[1] > 2 * Math.PI)
			this.m_rotation[1] -= 2 * Math.PI;

		this.UpdateModelMatrix(parentModelMatrix);
	}
	public UpdateGPU(): void
	{
		let data = new ArrayBuffer(Float32Array.BYTES_PER_ELEMENT * 20);
		let modelMatrixView = new Float32Array(data, 0, 16);
		let materialIndexView = new Uint32Array(data, Float32Array.BYTES_PER_ELEMENT * 16, 1);

		modelMatrixView.set(this.m_modelMatrix);
		materialIndexView.set([this.m_materialIndex]);

		this.m_modelMatrixBuffer.WriteData(data);
	}

	private m_renderItem: RenderItem;
	private m_modelMatrixBuffer: UniformBufferPool;
}




export class GameCube extends GameObject
{
	constructor(renderer: Renderer, scene: Scene)
	{
		super("GameCube", renderer, scene);

		let device = this.m_renderer.GetDevice();

		// Create a render item for the cube
		this.m_renderItem = renderer.CreateRenderItem("ri_game-cube", "mg_texture-cube", "mesh_texture-cube");

		// Create the model buffer
		this.m_modelMatrixBuffer = new UniformBufferPool(device, Float32Array.BYTES_PER_ELEMENT * 16, "buffer_game-cube-model-matrix");

		// Get the BindGroupLayout that the mesh group uses
		let meshGroup = renderer.GetMeshGroup("mg_texture-cube");
		let bindGroupLayout = meshGroup.GetRenderItemBindGroupLayout();
		if (bindGroupLayout === null)
		{
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
	public Destruct(): void
	{
		// When the object is deleted, we simply need to manually remove the RenderItem
		// from the MeshGroup
		this.m_renderer.RemoveRenderItem(this.m_renderItem.Name(), "mg_texture-cube");
	}

	public UpdatePhysics(timeDelta: number, parentModelMatrix: Mat4): void
	{
		this.m_rotation[1] += timeDelta;
		if (this.m_rotation[1] > 2 * Math.PI)
			this.m_rotation[1] -= 2 * Math.PI;

		this.UpdateModelMatrix(parentModelMatrix);
	}
	public async UpdateGPU(): Promise<void>
	{
		await this.m_modelMatrixBuffer.WriteData(this.m_modelMatrix.buffer);
	}

	private m_renderItem: RenderItem;
	private m_modelMatrixBuffer: UniformBufferPool;
}
export class GameCube2 extends GameObject implements UsesInstancing
{
	constructor(renderer: Renderer, scene: Scene)
	{
		// Need to make sure the name of the GameObject is unique
		super(`GameCube2:${GameCube2.s_instanceNum}`, renderer, scene);
		GameCube2.s_instanceNum++;

		// Make a call to GetInstanceManager() will initialize the instance manager if necessary
		// Calling AddInstance() will generate a new instance and return its index into the array of instances
		this.m_instanceNumber = this.GetInstanceManager().AddInstance(this);
	}
	public Destruct(): void
	{
		// When the object is deleted, we need to inform the InstanceManager to remove the object
		// If this was the last instance, then we need to set the InstanceManager to null
		if (this.GetInstanceManager().RemoveInstance(this.m_instanceNumber) === 0)
		{
			GameCube2.s_instanceManager = null;
		}
	}
	public SetInstanceNumber(num: number): void { this.m_instanceNumber = num; }
	private GetInstanceManager(): InstanceManager<GameCube2>
	{
		if (GameCube2.s_instanceManager === null)
		{
			GameCube2.s_instanceManager = new InstanceManager<GameCube2>(
				"GameCube2", Float32Array.BYTES_PER_ELEMENT * 16, this.m_renderer,
				"ri_game-cube-2", "mg_texture-cube-instancing", "mesh_texture-cube-instancing", 4,
				(renderer: Renderer, renderItem: RenderItem, instanceDataBuffer: GPUBuffer) =>
				{
					GameCube2.InitializeGameCube2RenderItem(renderer, renderItem, instanceDataBuffer);
				},
				(renderer: Renderer, renderItem: RenderItem, instanceDataBuffer: GPUBuffer) =>
				{
					GameCube2.OnInstanceBufferChanged(renderer, renderItem, instanceDataBuffer);
				}
			);
		}
		return GameCube2.s_instanceManager;
	}
	public static InitializeGameCube2RenderItem(renderer: Renderer, renderItem: RenderItem, instanceDataBuffer: GPUBuffer): void
	{
		renderItem.AddBindGroup("bg_game-cube-2", GameCube2.GenerateBindGroup(renderer, instanceDataBuffer));
	}
	public static OnInstanceBufferChanged(renderer: Renderer, renderItem: RenderItem, buffer: GPUBuffer): void
	{
		renderItem.UpdateBindGroup("bg_game-cube-2", GameCube2.GenerateBindGroup(renderer, buffer));
	}
	public static GenerateBindGroup(renderer: Renderer, buffer: GPUBuffer): BindGroup
	{
		let device = renderer.GetDevice();

		// Get the BindGroupLayout that the mesh group uses
		let meshGroup = renderer.GetMeshGroup("mg_texture-cube-instancing");
		let bindGroupLayout = meshGroup.GetRenderItemBindGroupLayout();
		if (bindGroupLayout === null)
		{
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

	public UpdatePhysics(timeDelta: number, parentModelMatrix: Mat4): void
	{
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
	public UpdateGPU(): void
	{
		this.GetInstanceManager().WriteData(this.m_instanceNumber, this.m_modelMatrix);
	}

	public SetVelocity(v: Vec3): void { this.m_velocity = v; }

	private m_instanceNumber: number;
	private m_velocity = vec3.create(0, 0, 0);

	private static s_instanceManager: InstanceManager<GameCube2> | null = null;
	private static s_instanceNum: number = 0;
}

export class Scene
{
	constructor()
	{
		this.m_camera = new Camera();
		this.m_gameObjects = new HybridLookup<GameObject>();
	}
	public Update(timeDelta: number): void
	{
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
		this.m_delayedObjectsToDelete.forEach(val => { this.RemoveGameObject(val); })
		this.m_delayedObjectsToDelete.length = 0;

		// It is possible game objects will have disappeared after doing the physics update,
		// so you need to start from scratch
		numObjects = this.m_gameObjects.size();
		for (let iii = 0; iii < numObjects; ++iii)
			this.m_gameObjects.getFromIndex(iii).UpdateGPUImpl();
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


	private m_camera: Camera;
	private m_gameObjects: HybridLookup<GameObject>;

	private m_delayedObjectsToDelete: string[] = [];
}