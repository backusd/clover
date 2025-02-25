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
import { Scene } from "./Scene.js";
import { Camera } from "./Camera.js";
import { Mat4, Vec3, Vec4, mat4, vec3 } from 'wgpu-matrix';
import { Terrain } from "./Terrain.js";
import { ColorCube } from "./ColorCube.js";
import { TextureCube } from "./TextureCube.js";
import { TimingUI } from "./TimingUI.js";
import { RenderState } from "./RenderState.js"



export class Application
{
	constructor(renderer: Renderer, canvas: HTMLCanvasElement)
	{
		this.m_renderer = renderer;
		this.m_canvas = canvas;
		this.m_scene = new Scene();
		this.m_renderState = new RenderState();
		this.m_renderState.UpdateProjectionMatrix(canvas.width, canvas.height);

		// Create the TimingUI. Have it cache timing measurements from 20 frames before computing averages
		this.m_timingUI = new TimingUI(20, renderer);

		this.SetupInputCallbacks();
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

		let viewProjBindGroupLayout: GPUBindGroupLayout = device.createBindGroupLayout(
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

		const depthTexture = device.createTexture({
			size: [canvas.width, canvas.height],
			format: 'depth24plus',
			usage: GPUTextureUsage.RENDER_ATTACHMENT,
		});


		// View-projection matrix buffer
		const viewProjBufferSize = 4 * 16; // 4x4 matrix (sizeof(float) * 16 elements)
		let viewProjBuffer = device.createBuffer({
			size: viewProjBufferSize,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
		});

		let viewProjBindGroup = device.createBindGroup({
			layout: viewProjBindGroupLayout,
			entries: [
				{
					binding: 0,
					resource: {
						buffer: viewProjBuffer,
					},
				}
			],
		});

		let rpDescriptor: GPURenderPassDescriptor = {
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

		// Bind Groups
		let passBindGroup: BindGroup = new BindGroup(0, viewProjBindGroup);

		// RenderPassDescriptor
		let renderPassDescriptor: RenderPassDescriptor = new RenderPassDescriptor(rpDescriptor);

		// RenderPass
		let renderPass: RenderPass = new RenderPass("rp_main", device, renderPassDescriptor);
		renderPass.AddBindGroup(passBindGroup); // bind group for model-view-projection matrix
		renderPass.AddBuffer("viewProj-buffer", viewProjBuffer);
		renderPass.Update = (timeDelta: number, renderPass: RenderPass, state: RenderState, scene: Scene) =>
		{
			if (state.projectionMatrixHasChanged || scene.GetCamera().ViewHasChanged())
			{
				const viewProjectionMatrix = mat4.create();
				const viewMatrix = scene.GetCamera().GetViewMatrix();
				mat4.multiply(state.projectionMatrix, viewMatrix, viewProjectionMatrix);

				device.queue.writeBuffer(
					renderPass.GetBuffer("viewProj-buffer"),
					0,
					viewProjectionMatrix.buffer,
					viewProjectionMatrix.byteOffset,
					viewProjectionMatrix.byteLength
				);

				LOG_TRACE("viewProj-buffer updating...");
			}
		};

		// ====== Layers ==============================

		// Terrain
		let terrain: Terrain = new Terrain(10, 10);
		renderPass.AddRenderPassLayer(terrain.Initialize(this.m_renderer, viewProjBindGroupLayout));

		// Texture Cube
		let textureCube = new TextureCube();
		let textureCubeLayer = renderPass.AddRenderPassLayer(await textureCube.Initialize(this.m_renderer, viewProjBindGroupLayout));
		let textureCubeRI = textureCubeLayer.CreateRenderItem("ri_texture-cube", "mg_texture-cube", "mesh_texture-cube");


		// Solid Color Cube
		let colorCube = new ColorCube();
		let colorCubeLayer = renderPass.AddRenderPassLayer(colorCube.Initialize(this.m_renderer, viewProjBindGroupLayout));
		let colorCubeRI_2 = colorCubeLayer.CreateRenderItem("ri_color-cube-2", "mg_color-cube", "mesh_color-cube-2");
		let colorCubeRI_3 = colorCubeLayer.CreateRenderItem("ri_color-cube-3", "mg_color-cube", "mesh_color-cube-3");


		// ============================================

		this.m_renderer.AddRenderPass(renderPass);

		// DEBUG_ONLY
		this.m_renderer.EnableGPUTiming();
	}

	public Update(timeDelta: number): void
	{
		// Inform the timing UI a new frame is starting
		this.m_timingUI.Update(timeDelta);

		// Update the scene
		this.m_scene.Update(timeDelta);

		// Update the renderer
		this.m_renderer.Update(timeDelta, this.m_renderState, this.m_scene);
	}
	public EndFrame(): void
	{
		// When each frame is done being rendered, inform the timing UI
		this.m_timingUI.EndFrame(this.m_renderer);

		//
		// Reset all state that may have changed that may be actively tracked 
		//
		// Reset the projectionMatrixHasChanged back to false
		this.m_renderState.projectionMatrixHasChanged = false;

		// Reset the cameraViewHasChanged back to false
		this.m_scene.GetCamera().ResetViewHasChanged();
	}
	public OnCanvasResize(width: number, height: number): void
	{
		this.m_renderer.OnCanvasResize(width, height);
		this.m_renderState.UpdateProjectionMatrix(width, height);
	}

	private m_renderer: Renderer;
	private m_canvas: HTMLCanvasElement;
	private m_timingUI: TimingUI;
	private m_scene: Scene;
	private m_renderState: RenderState;
}