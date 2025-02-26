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
	constructor(className: string, bytesPerInstance: number, device: GPUDevice, renderItems: RenderItem[], numberOfInstancesToAllocateFor: number = 2)
	{
		this.m_className = className;
		this.m_bytesPerInstance = bytesPerInstance;
		this.m_device = device;
		this.m_renderItems = renderItems;

		this.m_bytesInBuffer = bytesPerInstance * numberOfInstancesToAllocateFor;

		this.m_buffer = device.createBuffer({
			label: `Buffer for InstanceManager<${this.m_className}>`,
			size: this.m_bytesInBuffer,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		});
	}
	public AddInstance(instance: T): number
	{
		// Add the instance to the list of instances we are tracking
		this.m_instances.push(instance);

		// Update the render item's instance count
		this.m_renderItems.forEach(ri => { ri.IncrementInstanceCount(1); });

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
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		});
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

	private m_className: string;
	private m_instances: T[] = [];
	private m_bytesPerInstance: number;

	private m_device: GPUDevice;
	private m_buffer: GPUBuffer;
	private m_bytesInBuffer: number;

	private m_renderItems: RenderItem[];
}

export abstract class GameObject
{
	constructor(name: string, renderer: Renderer)
	{
		this.m_name = name;
		this.m_renderer = renderer;
		this.m_childObjects = new HybridLookup<GameObject>();
	}
	public abstract InitializeAsync(): Promise<void>;
	public abstract Update(timeDelta: number, parentModelMatrix: Mat4): void;
	public UpdateImpl(timeDelta: number, parentModelMatrix: Mat4): void
	{
		this.Update(timeDelta, parentModelMatrix);
		this.UpdateChildren(timeDelta, this.m_modelMatrix);
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
	public UpdateChildren(timeDelta: number, parentModelMatrix: Mat4): void
	{
		for (let iii = 0; iii < this.m_childObjects.size(); ++iii)
			this.m_childObjects.getFromIndex(iii).Update(timeDelta, parentModelMatrix);
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
	constructor(name: string, renderer: Renderer)
	{
		super(name, renderer);

		// Create a render item for the cube
		let layer = renderer.GetRenderPass("rp_main").GetRenderPassLayer("rpl_texture-cube");
		this.m_renderItem = layer.CreateRenderItem("ri_game-cube", "mg_texture-cube", "mesh_texture-cube");

		// Create the model buffer
		this.m_modelMatrixBuffer = this.m_renderer.GetDevice().createBuffer({
			label: 'buffer_game-cube-model-matrix',
			size: 4 * 16, // sizeof(float) * floats per matrix
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		});
	}
	public async InitializeAsync(): Promise<void>
	{
		let device = this.m_renderer.GetDevice();

		// Get the bind group layout that all render items in this layer will use
		let layer = this.m_renderer.GetRenderPass("rp_main").GetRenderPassLayer("rpl_texture-cube");
		let bindGroupLayout = layer.GetRenderItemBindGroupLayout();
		if (bindGroupLayout === null)
		{
			let msg = "GameCube::InitializeAsync() failed because layer.GetRenderItemBindGroupLayout() returned null";
			LOG_ERROR(msg);
			throw Error(msg);
		}
		let bindGroupLayoutGroupNumber = layer.GetRenderItemBindGroupLayoutGroupNumber();

		// Fetch the image and upload it into a GPUTexture.
		let cubeTexture: GPUTexture;
		{
			const response = await fetch('./images/molecule.jpeg');
			const imageBitmap = await createImageBitmap(await response.blob());

			cubeTexture = device.createTexture({
				size: [imageBitmap.width, imageBitmap.height, 1],
				format: 'rgba8unorm',
				usage:
					GPUTextureUsage.TEXTURE_BINDING |
					GPUTextureUsage.COPY_DST |
					GPUTextureUsage.RENDER_ATTACHMENT,
			});
			device.queue.copyExternalImageToTexture(
				{ source: imageBitmap },
				{ texture: cubeTexture },
				[imageBitmap.width, imageBitmap.height]
			);
		}

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
	public Update(timeDelta: number, parentModelMatrix: Mat4): void
	{
		this.m_rotation[1] += timeDelta;
		if (this.m_rotation[1] > 2 * Math.PI)
			this.m_rotation[1] -= 2 * Math.PI;

		this.UpdateModelMatrix(parentModelMatrix);

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
	constructor(name: string, renderer: Renderer)
	{
		super(name, renderer);

		// Create a render item for the cube
		let layer = renderer.GetRenderPass("rp_main").GetRenderPassLayer("rpl_texture-cube");
		let renderItem = layer.CreateRenderItem("ri_game-cube-2", "mg_texture-cube", "mesh_texture-cube");
		this.m_renderItems = [renderItem];

		// Get the instance number for this new instance
		this.m_instanceNumber = this.GetInstanceManager().AddInstance(this);
	}
	public async InitializeAsync(): Promise<void>
	{
		let device = this.m_renderer.GetDevice();

		// Get the bind group layout that all render items in this layer will use
		let layer = this.m_renderer.GetRenderPass("rp_main").GetRenderPassLayer("rpl_texture-cube");
		let bindGroupLayout = layer.GetRenderItemBindGroupLayout();
		if (bindGroupLayout === null)
		{
			let msg = "GameCube::InitializeAsync() failed because layer.GetRenderItemBindGroupLayout() returned null";
			LOG_ERROR(msg);
			throw Error(msg);
		}
		let bindGroupLayoutGroupNumber = layer.GetRenderItemBindGroupLayoutGroupNumber();

		// Fetch the image and upload it into a GPUTexture.
		let cubeTexture: GPUTexture;
		{
			const response = await fetch('./images/molecule.jpeg');
			const imageBitmap = await createImageBitmap(await response.blob());

			cubeTexture = device.createTexture({
				size: [imageBitmap.width, imageBitmap.height, 1],
				format: 'rgba8unorm',
				usage:
					GPUTextureUsage.TEXTURE_BINDING |
					GPUTextureUsage.COPY_DST |
					GPUTextureUsage.RENDER_ATTACHMENT,
			});
			device.queue.copyExternalImageToTexture(
				{ source: imageBitmap },
				{ texture: cubeTexture },
				[imageBitmap.width, imageBitmap.height]
			);
		}

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

		this.m_renderItem.AddBindGroup("bg_game-cube-2", new BindGroup(bindGroupLayoutGroupNumber, cubeBindGroup));
	}
	public Update(timeDelta: number, parentModelMatrix: Mat4): void
	{
		this.m_position[0] += timeDelta / 2;

		this.UpdateModelMatrix(parentModelMatrix);

		this.GetInstanceManager().WriteToBuffer(
			this.m_instanceNumber,
			this.m_modelMatrix.buffer,
			this.m_modelMatrix.byteOffset,
			this.m_modelMatrix.byteLength
		);
	}
	private GetInstanceManager(): InstanceManager<GameCube2>
	{
		if (GameCube2.s_instanceManager === null)
			GameCube2.s_instanceManager = new InstanceManager<GameCube2>("GameCube2", 4 * 16, this.m_renderer.GetDevice(), this.m_renderItems, 4);
		return GameCube2.s_instanceManager;
	}

	private m_renderItems: RenderItem[];
	private m_instanceNumber: number;

	private static s_instanceManager: InstanceManager<GameCube2> | null = null;
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

		// Update the game objects
		let identity = mat4.identity();
		let numObjects = this.m_gameObjects.size();
		for (let iii = 0; iii < numObjects; ++iii)
			this.m_gameObjects.getFromIndex(iii).UpdateImpl(timeDelta, identity);
	}
	public GetCamera(): Camera { return this.m_camera; }
	public AddGameObject(object: GameObject): GameObject
	{
		return this.m_gameObjects.add(object.Name(), object);
	}


	private m_camera: Camera;
	private m_gameObjects: HybridLookup<GameObject>;
}