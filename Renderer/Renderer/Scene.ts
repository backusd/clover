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
import { Camera } from "./Camera.js";
import { HybridLookup } from "./Utils.js"
import { Mat4, Vec3, Vec4, mat4, vec3 } from 'wgpu-matrix';



export class InstanceManager<T>
{
	constructor(className: string, bytesPerInstance: number, renderer: Renderer, renderItemName: string,
		meshGroupName: string, meshName: string, numberOfInstancesToAllocateFor: number = 2,
		renderItemInitializationCallback: (renderer: Renderer, renderItem: RenderItem, instanceDataBuffer: GPUBuffer) => void = () => { },
		onBufferChangedCallback: (renderer: Renderer, renderItem: RenderItem, buffer: GPUBuffer) => void = () => { }
	)
	{
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
	public AddInstance(instance: T): number
	{
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
	private IncreaseBufferCapacity(bytes: number): void
	{
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
	public WriteToBuffer(instanceNumber: number, data: BufferSource | SharedArrayBuffer, dataOffset: GPUSize64, size: GPUSize64)
	{
		this.m_device.queue.writeBuffer(
			this.m_buffer,								// buffer to write to
			instanceNumber * this.m_bytesPerInstance,	// byte offset in the buffer
			data,										// data to write into buffer
			dataOffset,									// Offset in the data to start from
			size										// Total number of bytes to write
		);
	}
	public GetInstanceDataBuffer(): GPUBuffer { return this.m_buffer; }

	private m_className: string;
	private m_instances: T[] = [];
	private m_bytesPerInstance: number;

	private m_renderer: Renderer;
	private m_device: GPUDevice;
	private m_buffer: GPUBuffer;
	private m_bytesInBuffer: number;

	private m_renderItem: RenderItem;

	private OnBufferChanged: (renderer: Renderer, renderItem: RenderItem, buffer: GPUBuffer) => void;
}

export abstract class GameObject
{
	constructor(name: string, renderer: Renderer)
	{
		this.m_name = name;
		this.m_renderer = renderer;
		this.m_childObjects = new HybridLookup<GameObject>();
	}

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

	protected m_name: string;
	protected m_renderer: Renderer;
	protected m_childObjects: HybridLookup<GameObject>;

	protected m_position = vec3.create(0, 0, 0);
	protected m_rotation = vec3.create(0, 0, 0);
	protected m_scaling = vec3.create(1, 1, 1);
	protected m_modelMatrix = mat4.identity();
}
export class GameCube extends GameObject
{
	constructor(renderer: Renderer)
	{
		super("GameCube", renderer);

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
	public UpdatePhysics(timeDelta: number, parentModelMatrix: Mat4): void
	{
		this.m_rotation[1] += timeDelta;
		if (this.m_rotation[1] > 2 * Math.PI)
			this.m_rotation[1] -= 2 * Math.PI;

		this.UpdateModelMatrix(parentModelMatrix);
	}
	public UpdateGPU(): void
	{
		// Update the GPUBuffer
		let device = this.m_renderer.GetDevice();
		device.queue.writeBuffer(
			this.m_modelMatrixBuffer,
			0,
			this.m_modelMatrix.buffer,
			this.m_modelMatrix.byteOffset,
			this.m_modelMatrix.byteLength
		);
	}

	private m_renderItem: RenderItem;
	private m_modelMatrixBuffer: GPUBuffer;
}
export class GameCube2 extends GameObject
{
	constructor(renderer: Renderer)
	{
		// Need to make sure the name of the GameObject is unique
		super(`GameCube2:${GameCube2.s_instanceNum}`, renderer);
		GameCube2.s_instanceNum++;

		// Make a call to GetInstanceManager() will initialize the instance manager
		// Calling AddInstance() will generate a new instance and return its index into the array of instances
		this.m_instanceNumber = this.GetInstanceManager().AddInstance(this);
	}
	private GetInstanceManager(): InstanceManager<GameCube2>
	{
		if (GameCube2.s_instanceManager === null)
		{
			GameCube2.s_instanceManager = new InstanceManager<GameCube2>(
				"GameCube2", 4 * 16, this.m_renderer, "ri_game-cube-2", "mg_texture-cube-instancing", "mesh_texture-cube-instancing", 4,
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

	public UpdatePhysics(timeDelta: number, parentModelMatrix: Mat4): void
	{
		this.m_position[0] += timeDelta * 2;

		this.UpdateModelMatrix(parentModelMatrix);

	}
	public UpdateGPU(): void
	{
		this.GetInstanceManager().WriteToBuffer(
			this.m_instanceNumber,
			this.m_modelMatrix.buffer,
			this.m_modelMatrix.byteOffset,
			this.m_modelMatrix.byteLength
		);
	}




	private m_instanceNumber: number;

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


	private m_camera: Camera;
	private m_gameObjects: HybridLookup<GameObject>;
}