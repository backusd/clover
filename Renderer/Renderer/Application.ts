import { LOG_INFO, LOG_TRACE, LOG_WARN, LOG_ERROR } from "./Log.js";
import
{
	Mesh,
	MeshGroup,
	BindGroup,
	RenderPassLayer,
	RenderPassDescriptor,
	RenderPass,
	Renderer
} from "./Renderer.js";
import { Camera } from "./Camera.js"
import { Mat4, Vec3, Vec4, mat4, vec3 } from 'wgpu-matrix';
import { Terrain } from "./Terrain.js"
import { ColorCube } from "./ColorCube.js"

const cubeVertexNumFloats = 10;
const cubeVertexStride = 4 * cubeVertexNumFloats; // Byte size of one cube vertex.
const cubePositionOffset = 0;
const cubeColorOffset = 4 * 4; // Byte offset of cube vertex color attribute.
const cubeUVOffset = 4 * 8;
const cubeVertexCount = 36;

const cubeVertexArray = new Float32Array([
	// float4 position, float4 color, float2 uv,
	1, -1, 1, 1, 1, 0, 1, 1, 0, 1,
	-1, -1, 1, 1, 0, 0, 1, 1, 1, 1,
	-1, -1, -1, 1, 0, 0, 0, 1, 1, 0,
	1, -1, -1, 1, 1, 0, 0, 1, 0, 0,
	1, -1, 1, 1, 1, 0, 1, 1, 0, 1,
	-1, -1, -1, 1, 0, 0, 0, 1, 1, 0,

	1, 1, 1, 1, 1, 1, 1, 1, 0, 1,
	1, -1, 1, 1, 1, 0, 1, 1, 1, 1,
	1, -1, -1, 1, 1, 0, 0, 1, 1, 0,
	1, 1, -1, 1, 1, 1, 0, 1, 0, 0,
	1, 1, 1, 1, 1, 1, 1, 1, 0, 1,
	1, -1, -1, 1, 1, 0, 0, 1, 1, 0,

	-1, 1, 1, 1, 0, 1, 1, 1, 0, 1,
	1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
	1, 1, -1, 1, 1, 1, 0, 1, 1, 0,
	-1, 1, -1, 1, 0, 1, 0, 1, 0, 0,
	-1, 1, 1, 1, 0, 1, 1, 1, 0, 1,
	1, 1, -1, 1, 1, 1, 0, 1, 1, 0,

	-1, -1, 1, 1, 0, 0, 1, 1, 0, 1,
	-1, 1, 1, 1, 0, 1, 1, 1, 1, 1,
	-1, 1, -1, 1, 0, 1, 0, 1, 1, 0,
	-1, -1, -1, 1, 0, 0, 0, 1, 0, 0,
	-1, -1, 1, 1, 0, 0, 1, 1, 0, 1,
	-1, 1, -1, 1, 0, 1, 0, 1, 1, 0,

	1, 1, 1, 1, 1, 1, 1, 1, 0, 1,
	-1, 1, 1, 1, 0, 1, 1, 1, 1, 1,
	-1, -1, 1, 1, 0, 0, 1, 1, 1, 0,
	-1, -1, 1, 1, 0, 0, 1, 1, 1, 0,
	1, -1, 1, 1, 1, 0, 1, 1, 0, 0,
	1, 1, 1, 1, 1, 1, 1, 1, 0, 1,

	1, -1, -1, 1, 1, 0, 0, 1, 0, 1,
	-1, -1, -1, 1, 0, 0, 0, 1, 1, 1,
	-1, 1, -1, 1, 0, 1, 0, 1, 1, 0,
	1, 1, -1, 1, 1, 1, 0, 1, 0, 0,
	1, -1, -1, 1, 1, 0, 0, 1, 0, 1,
	-1, 1, -1, 1, 0, 1, 0, 1, 1, 0,
]);

export class Application
{
	constructor(renderer: Renderer, canvas: HTMLCanvasElement)
	{
		this.m_pipeline = null;
		this.m_renderPassDescriptor = null;
		this.m_uniformBindGroup = null;
		this.m_renderer = renderer;
		this.m_canvas = canvas;
		this.m_camera = new Camera();
		this.SetupInputCallbacks();

		let device = this.m_renderer.GetDevice();
		const uniformBufferSize = 4 * 16; // 2x 4x4 matrix
		this.m_uniformBuffer = device.createBuffer({
			size: uniformBufferSize,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		});

		this.m_boxMeshGroup = new MeshGroup("Box MeshGroup", device, [], 0);
		


	//	// Create a vertex buffer from the cube data.
	//	this.m_verticesBuffer = device.createBuffer({
	//		label: "vertices buffer",
	//		size: cubeVertexArray.byteLength,
	//		usage: GPUBufferUsage.VERTEX,
	//		mappedAtCreation: true,
	//	});
	//	new Float32Array(this.m_verticesBuffer.getMappedRange()).set(cubeVertexArray);
	//	this.m_verticesBuffer.unmap();
	}
	private SetupInputCallbacks(): void
	{
		window.addEventListener('keydown', (e: KeyboardEvent) => this.OnKeyDown(e));
		window.addEventListener('keyup', (e: KeyboardEvent) => this.OnKeyUp(e));

		this.m_canvas.style.touchAction = 'pinch-zoom';
		this.m_canvas.addEventListener('pointerdown', (e: PointerEvent) =>
		{
			//e.button describes the mouse button that was clicked
			// 0 is left, 1 is middle, 2 is right
			if (e.button === 0)
				this.OnLButtonDown(e);
			else if (e.button === 1)
				this.OnMButtonDown(e);
			else if (e.button === 2)
				this.OnRButtonDown(e);
		});
		this.m_canvas.addEventListener('pointerup', (e: PointerEvent) =>
		{
			// e.button describes the mouse button that was clicked
			// 0 is left, 1 is middle, 2 is right
			if (e.button === 0)
				this.OnLButtonUp(e);
			else if (e.button === 1)
				this.OnMButtonUp(e);
			else if (e.button === 2)
				this.OnRButtonUp(e);
		});
		this.m_canvas.addEventListener('pointermove', (e: PointerEvent) => this.OnPointerMove(e));
		this.m_canvas.addEventListener('wheel', (e: WheelEvent) => this.OnWheel(e), { passive: false });
	}
	private OnKeyDown(e: KeyboardEvent): void
	{
		LOG_TRACE(`OnKeyDown: ${e.code}`);

		let handled = true;

		switch (e.code)
		{
			case 'KeyW': break;
			case 'KeyS': break;
			case 'KeyA': break;
			case 'KeyD': break;
			case 'Space': break;

			case 'ShiftLeft':
			case 'ControlLeft':
			case 'KeyC':
				break;

			default:
				handled = false;
				break;
		}

		if (handled)
		{
			e.preventDefault();
			e.stopPropagation();
		}
	}
	private OnKeyUp(e: KeyboardEvent): void
	{
		LOG_TRACE(`OnKeyUp: ${e.code}`);

		let handled = true;

		switch (e.code)
		{
			case 'KeyW': break;
			case 'KeyS': break;
			case 'KeyA': break;
			case 'KeyD': break;
			case 'Space': break;

			case 'ShiftLeft':
			case 'ControlLeft':
			case 'KeyC':
				break;

			default:
				handled = false;
				break;
		}

		if (handled)
		{
			e.preventDefault();
			e.stopPropagation();
		}
	}
	private OnLButtonDown(e: PointerEvent)
	{
		LOG_TRACE("OnLButtonDown");

		// Box Mesh
		//	let boxMesh = new Mesh();
		//	boxMesh.CreateMeshFromRawData("Box mesh", cubeVertexArray, cubeVertexNumFloats);
		//	this.m_boxMeshGroup.AddMesh(boxMesh);
	//	this.m_boxMeshGroup.RemoveMesh("Box mesh 3");
	}
	private OnMButtonDown(e: PointerEvent)
	{
		LOG_TRACE("OnMButtonDown");

	}
	private OnRButtonDown(e: PointerEvent)
	{
		LOG_TRACE("OnRButtonDown");

	}
	private OnLButtonUp(e: PointerEvent)
	{
		LOG_TRACE("OnLButtonUp");

	}
	private OnMButtonUp(e: PointerEvent)
	{
		LOG_TRACE("OnMButtonUp");

	}
	private OnRButtonUp(e: PointerEvent)
	{
		LOG_TRACE("OnRButtonUp");
	}
	private OnPointerMove(e: PointerEvent)
	{
		//LOG_TRACE(`OnPointerMove: (${e.movementX}, ${e.movementY})`);
	}
	private OnWheel(e: WheelEvent)
	{
		LOG_TRACE(`OnWheel: ${e.deltaX}, ${e.deltaY} (${e.deltaMode})`);
		e.preventDefault();
		e.stopPropagation();
	}

	public async InitializeAsync(): Promise<void>
	{
		let device = this.m_renderer.GetDevice();
		let context = this.m_renderer.GetContext();

		let canvas: HTMLCanvasElement | OffscreenCanvas = context.canvas;
		if (canvas instanceof OffscreenCanvas)
			throw Error("Cannot initialize Renderer. canvis is instanceof OffscreenCanvas - not sure how to handle that");

		const devicePixelRatio = window.devicePixelRatio;
		canvas.width = canvas.clientWidth * devicePixelRatio;
		canvas.height = canvas.clientHeight * devicePixelRatio;



		// Creating a 2nd box mesh
		let cubeVertexArray_2 = new Float32Array(cubeVertexArray.length);
		for (let row = 0; row < 36; row++)
		{
			for (let col = 0; col < 10; col++)
			{
				let iii = row * 10 + col;
				if (col >= 1)
					cubeVertexArray_2[iii] = cubeVertexArray[iii];
				else
					cubeVertexArray_2[iii] = cubeVertexArray[iii] + 3;
			}
		}

		let boxMesh_2 = new Mesh();
		boxMesh_2.CreateMeshFromRawData("Box mesh 2", cubeVertexArray_2, cubeVertexNumFloats);

		// Creating a 3rd box mesh
		let cubeVertexArray_3 = new Float32Array(cubeVertexArray.length);
		for (let row = 0; row < 36; row++)
		{
			for (let col = 0; col < 10; col++)
			{
				let iii = row * 10 + col;
				if (col === 1)
					cubeVertexArray_3[iii] = cubeVertexArray[iii] + 3;
				else
					cubeVertexArray_3[iii] = cubeVertexArray[iii];
			}
		}

		let boxMesh_3 = new Mesh();
		boxMesh_3.CreateMeshFromRawData("Box mesh 3", cubeVertexArray_3, cubeVertexNumFloats);

		// Creating a 4th box mesh
		let cubeVertexArray_4 = new Float32Array(cubeVertexArray.length);
		for (let row = 0; row < 36; row++)
		{
			for (let col = 0; col < 10; col++)
			{
				let iii = row * 10 + col;
				if (col === 2)
					cubeVertexArray_4[iii] = cubeVertexArray[iii] + 3;
				else
					cubeVertexArray_4[iii] = cubeVertexArray[iii];
			}
		}

		let boxMesh_4 = new Mesh();
		boxMesh_4.CreateMeshFromRawData("Box mesh 4", cubeVertexArray_4, cubeVertexNumFloats);


		// Box Mesh
		let boxMesh = new Mesh();
		boxMesh.CreateMeshFromRawData("Box mesh", cubeVertexArray, cubeVertexNumFloats);

		// MeshGroup
		//let boxMeshGroup = new MeshGroup("Box MeshGroup", device, [], 0);
		this.m_boxMeshGroup.AddMeshes([boxMesh, boxMesh_2, boxMesh_3, boxMesh_4]);


		const module: GPUShaderModule = device.createShaderModule({
			label: 'cube shader module',
			code: `
struct Uniforms
{
  viewProjectionMatrix : mat4x4f
}

struct Vertex
{
  @location(0) position: vec4f,
  @location(1) uv: vec2f
}

@group(0) @binding(0) var<uniform> uniforms : Uniforms;

@group(1) @binding(0) var mySampler: sampler;
@group(1) @binding(1) var myTexture: texture_2d<f32>;

struct VertexOutput
{
  @builtin(position) Position : vec4f,
  @location(0) fragUV : vec2f,
}

@vertex
fn vertex_main(vertex: Vertex) -> VertexOutput
{
  return VertexOutput(uniforms.viewProjectionMatrix * vertex.position, vertex.uv);
}

@fragment
fn fragment_main(@location(0) fragUV: vec2f) -> @location(0) vec4f
{
  return textureSample(myTexture, mySampler, fragUV);
}
`
		});

		let mvpBindGroupLayout: GPUBindGroupLayout = device.createBindGroupLayout(
			{
				label: "Model-View-Projection BindGroupLayout",
				entries: [
					{
						binding: 0,
						visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
						buffer: {}						
					}
				]
			}
		);
		let cubeBindGroupLayout: GPUBindGroupLayout = device.createBindGroupLayout(
			{
				label: "Cube BindGroupLayout",
				entries: [
					{
						binding: 0,
						visibility: GPUShaderStage.FRAGMENT,
						sampler: {}
					},
					{
						binding: 1,
						visibility: GPUShaderStage.FRAGMENT,
						texture: {}
					}
				]
			}
		);

		let cubePipelineLayoutDescriptor: GPUPipelineLayoutDescriptor = {
			bindGroupLayouts: [mvpBindGroupLayout, cubeBindGroupLayout]
		};
		let cubePipelineLayout: GPUPipelineLayout = device.createPipelineLayout(cubePipelineLayoutDescriptor);
		cubePipelineLayout.label = "Cube PipelineLayout";

		this.m_pipeline = device.createRenderPipeline({
			label: "main pipeline",
			layout: cubePipelineLayout,
			vertex: {
				module,
				buffers: [
					{
						arrayStride: cubeVertexStride,
						attributes: [
							{
								// position
								shaderLocation: 0,
								offset: cubePositionOffset,
								format: 'float32x4',
							},
							{
								// uv
								shaderLocation: 1,
								offset: cubeUVOffset,
								format: 'float32x2',
							},
						],
					},
				],
			},
			fragment: {
				module,
				targets: [
					{
						format: navigator.gpu.getPreferredCanvasFormat(),
					},
				],
			},
			primitive: {
				topology: 'triangle-list',
				cullMode: 'back',
			},
			depthStencil: {
				depthWriteEnabled: true,
				depthCompare: 'less',
				format: 'depth24plus',
			},
		});

		const depthTexture = device.createTexture({
			size: [canvas.width, canvas.height],
			format: 'depth24plus',
			usage: GPUTextureUsage.RENDER_ATTACHMENT,
		});

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

		// Create a sampler with linear filtering for smooth interpolation.
		const sampler = device.createSampler({
			magFilter: 'linear',
			minFilter: 'linear',
		});

		let mvpBindGroup = device.createBindGroup({
			layout: mvpBindGroupLayout,
			entries: [
				{
					binding: 0,
					resource: {
						buffer: this.m_uniformBuffer,
					},
				}
			],
		});
		let cubeBindGroup = device.createBindGroup({
			layout: cubeBindGroupLayout,
			entries: [
				{
					binding: 0,
					resource: sampler,
				},
				{
					binding: 1,
					resource: cubeTexture.createView(),
				},
			],
		});

		this.m_renderPassDescriptor = {
			colorAttachments: [
				{
					view: context.getCurrentTexture().createView(),
					clearValue: [0.5, 0.5, 0.5, 1.0],
					loadOp: 'clear',
					storeOp: 'store',
				},
			],
			depthStencilAttachment: {
				view: depthTexture.createView(),

				depthClearValue: 1.0,
				depthLoadOp: 'clear',
				depthStoreOp: 'store',
			},
		};	


		// Box MeshGroup
	//	let boxMeshGroup: MeshGroup = new MeshGroup(this.m_verticesBuffer, 0);
	//	let boxDescriptor: MeshDescriptor = {
	//		vertexCount: cubeVertexCount,
	//		startVertex: 0,
	//		instanceCount: undefined,
	//		startInstance: undefined
	//	}
	//	boxMeshGroup.AddMeshDescriptor(boxDescriptor);

		// Bind Groups
		let passBindGroup: BindGroup = new BindGroup(0, mvpBindGroup);
		let cubeLayerBindGroup: BindGroup = new BindGroup(1, cubeBindGroup);

		// RenderPassDescriptor
		let renderPassDescriptor: RenderPassDescriptor = new RenderPassDescriptor(this.m_renderPassDescriptor);

		// RenderPassLayer
		let renderPassLayer: RenderPassLayer = new RenderPassLayer(this.m_pipeline);
		renderPassLayer.AddMeshGroup(this.m_boxMeshGroup);
		renderPassLayer.AddBindGroup(cubeLayerBindGroup);

		// RenderPass
		let renderPass: RenderPass = new RenderPass(renderPassDescriptor);
		renderPass.AddBindGroup(passBindGroup); // bind group for model-view-projection matrix





		let terrain: Terrain = new Terrain(10, 10);
		renderPass.AddRenderPassLayer(terrain.Initialize(this.m_renderer, mvpBindGroupLayout));



		let colorCube = new ColorCube();
		renderPass.AddRenderPassLayer(colorCube.Initialize(this.m_renderer, mvpBindGroupLayout));



	//	renderPass.AddRenderPassLayer(renderPassLayer);

		this.m_renderer.AddRenderPass(renderPass);
	}

	private GetViewProjectionMatrix(deltaTime: number)
	{
		let context = this.m_renderer.GetContext();

		let canvas: HTMLCanvasElement | OffscreenCanvas = context.canvas;
		if (canvas instanceof OffscreenCanvas)
			throw Error("Cannot GetModelViewProjectionMatrix. canvas is instanceof OffscreenCanvas - not sure how to handle that");

		const aspect = canvas.width / canvas.height;
		const projectionMatrix = mat4.perspective((2 * Math.PI) / 5, aspect, 1, 100.0);

		const modelViewProjectionMatrix = mat4.create();
		const viewMatrix = this.m_camera.GetViewMatrix();
		mat4.multiply(projectionMatrix, viewMatrix, modelViewProjectionMatrix);
		return modelViewProjectionMatrix;
	}

	public Update(timeDelta: number): void
	{
		let device = this.m_renderer.GetDevice();
		const modelViewProjection = this.GetViewProjectionMatrix(0);
		device.queue.writeBuffer(
			this.m_uniformBuffer,
			0,
			modelViewProjection.buffer,
			modelViewProjection.byteOffset,
			modelViewProjection.byteLength
		);
	}

	private m_renderer: Renderer;
	private m_canvas: HTMLCanvasElement;
	private m_camera: Camera;
	private m_renderPassDescriptor: GPURenderPassDescriptor | null;
	private m_pipeline: GPURenderPipeline | null;
	private m_uniformBuffer: GPUBuffer;
//	private m_verticesBuffer: GPUBuffer;
	private m_uniformBindGroup: GPUBindGroup | null;
	private m_boxMeshGroup: MeshGroup;
}