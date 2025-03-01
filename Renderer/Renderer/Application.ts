import { LOG_INFO, LOG_TRACE, LOG_WARN, LOG_ERROR, LOG_CORE_ERROR } from "./Log.js";
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
import
{
	Scene,
	GameCube,
	GameCube2
} from "./Scene.js";
import 
{
	UniformBufferBasicWrite,
	UniformBufferPool,
	InstanceBufferBasicWrite,
	InstanceBufferPool
} from "./Buffer.js"
import { Camera } from "./Camera.js";
import { Mat4, Vec3, Vec4, mat4, vec3 } from 'wgpu-matrix';
import { Terrain } from "./Terrain.js";
import { ColorCube } from "./ColorCube.js";
import { TextureCube } from "./TextureCube.js";
import { TextureCubeInstancing } from "./TextureCubeInstancing.js";
import { TimingUI } from "./TimingUI.js";
import { RenderState } from "./RenderState.js"


class KeyBoardState
{
	shiftIsDown: boolean = false;
	LButtonIsDown: boolean = false;
}
export class Application
{
	constructor(renderer: Renderer, canvas: HTMLCanvasElement)
	{
		this.m_keyboardState = new KeyBoardState();
		this.m_renderer = renderer;
		this.m_canvas = canvas;
		this.m_scene = new Scene();
		this.m_renderState = new RenderState();
		this.m_renderState.UpdateProjectionMatrix(canvas.width, canvas.height);

		// At the application level, we are going to add an eventlistener for all webgpu errors
		// Right now, this will just throw an exception. However, in the future, this should try
		// to handle any error more gracefully if possible and should also report the error to the
		// server for logging
		// TODO: Report the error to the game server
		let device = renderer.GetDevice();
		device.addEventListener('uncapturederror', (event) =>
		{
			let msg = `'uncapturederror' event listener on the GPUDevice was triggered. This means a WebGPU error was not captured. Error: '${event.error}'`;
			LOG_CORE_ERROR(msg);
			throw Error(msg);

			// TODO: Report the error to the game server. Could look something like this:
			//			reportErrorToServer({
			//				type: event.error.constructor.name,
			//				message: event.error.message,
			//			});
			//		 However, we should probably also try to capture information like the user, what 
			//		 browser (& version) they are using (if possible), what GPU they are using (if 
			//		 possible), date / time, and anything else that might be relevant
			// NOTE: reporting the error to the server should only be done in production. NOT in debug.
		});

		// Create the TimingUI. Have it cache timing measurements from 20 frames before computing averages
		this.m_timingUI = new TimingUI(20, renderer);

		this.SetupInputCallbacks();

		this.m_viewProjBuffer = new UniformBufferBasicWrite(this.m_renderer.GetDevice(), Float32Array.BYTES_PER_ELEMENT * 16, "View-Projection Buffer");
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
			case 'KeyQ':

				// this.m_scene.RemoveGameObject("GameCube2:0");

				let cube = new GameCube2(this.m_renderer, this.m_scene);
				cube.SetPosition([0, 1, 0]);
				cube.SetVelocity([5 * (Math.random() - 0.5), 0, 5 * (Math.random() - 0.5)]);
				this.m_scene.AddGameObject(cube);

				break;


			case 'KeyW': break;
			case 'KeyS': break;
			case 'KeyA': break;
			case 'KeyD': break;
			case 'Space': break;

			case 'ShiftLeft':
			case 'ShiftRight':
				this.m_keyboardState.shiftIsDown = true;
				break;

			case 'ControlLeft':
			case 'KeyC':
				break;

			case 'ArrowUp':
				if (this.m_keyboardState.shiftIsDown)
					this.m_scene.GetCamera().StartRotatingUpward();
				else
					this.m_scene.GetCamera().StartMovingForward();
				break;
			case 'ArrowDown':
				if (this.m_keyboardState.shiftIsDown)
					this.m_scene.GetCamera().StartRotatingDownward();
				else
					this.m_scene.GetCamera().StartMovingBackward();
				break;
			case 'ArrowLeft':
				if (this.m_keyboardState.shiftIsDown)
					this.m_scene.GetCamera().StartRotatingLeft();
				else
					this.m_scene.GetCamera().StartMovingLeft();
				break;
			case 'ArrowRight':
				if (this.m_keyboardState.shiftIsDown)
					this.m_scene.GetCamera().StartRotatingRight();
				else
					this.m_scene.GetCamera().StartMovingRight();
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
			case 'ShiftRight':
				this.m_keyboardState.shiftIsDown = false;
				break;

			case 'ControlLeft':
			case 'KeyC':
				break;

			case 'ArrowUp':
				// Because we don't know if the Shift key was down when the ArrowUp was pressed
				// we need to stop both types of motion that could have been started
				this.m_scene.GetCamera().StopMovingForward();
				this.m_scene.GetCamera().StopRotatingUpward();
				break;
			case 'ArrowDown':
				this.m_scene.GetCamera().StopMovingBackward();
				this.m_scene.GetCamera().StopRotatingDownward();
				break;
			case 'ArrowLeft':
				this.m_scene.GetCamera().StopMovingLeft();
				this.m_scene.GetCamera().StopRotatingLeft();
				break;
			case 'ArrowRight':
				this.m_scene.GetCamera().StopMovingRight();
				this.m_scene.GetCamera().StopRotatingRight();
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
		this.m_keyboardState.LButtonIsDown = true;
		this.m_scene.GetCamera().StartMouseDragging();
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
		this.m_keyboardState.LButtonIsDown = false;
		this.m_scene.GetCamera().StopMouseDragging();
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
		// LOG_TRACE(`OnPointerMove: (${e.movementX}, ${e.movementY}) | (${e.x}, ${e.y}) | ${this.m_canvas.width}, ${this.m_canvas.height}`);

		if (this.m_keyboardState.LButtonIsDown)
			this.m_scene.GetCamera().MouseDrag(e.movementX, e.movementY);
	}
	private OnWheel(e: WheelEvent)
	{
		LOG_TRACE(`OnWheel: ${e.deltaX}, ${e.deltaY} (${e.deltaMode})`);

		if (e.deltaY < 0)
			this.m_scene.GetCamera().ZoomIn();
		else
			this.m_scene.GetCamera().ZoomOut();
			
		e.preventDefault();
		e.stopPropagation();
	}

	public async InitializeAsync(): Promise<void>
	{
		let device = this.m_renderer.GetDevice();
		let context = this.m_renderer.GetContext();

		// Load all textures that will be used by the application
		await this.m_renderer.AddTextureFromFile("tex_molecule", "./images/molecule.jpeg");




		let viewProjBindGroupLayout: GPUBindGroupLayout = device.createBindGroupLayout(
			{
				label: "Model-View-Projection BindGroupLayout",
				entries: [
					{
						binding: 0,
						visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
						buffer: {
							type: "uniform",
							minBindingSize: 4 * 16	// BEST PRACTICE to always set this	when possible	
						}						
					}
				]
			}
		);

		const depthTexture = device.createTexture({
			size: [this.m_canvas.width, this.m_canvas.height],
			format: 'depth24plus',
			usage: GPUTextureUsage.RENDER_ATTACHMENT,
		}); 

		let viewProjBindGroup = device.createBindGroup({
			layout: viewProjBindGroupLayout,
			entries: [
				{
					binding: 0,
					resource: {
						buffer: this.m_viewProjBuffer.GetGPUBuffer(),
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
		let renderPass: RenderPass = new RenderPass("rp_main", renderPassDescriptor);
		renderPass.AddBindGroup(passBindGroup); // bind group for model-view-projection matrix
	//	renderPass.AddBuffer("viewProj-buffer", this.m_viewProjBuffer.GetGPUBuffer());
		renderPass.Update = (timeDelta: number, renderPass: RenderPass, state: RenderState, scene: Scene) =>
		{
			if (state.projectionMatrixHasChanged || scene.GetCamera().ViewHasChanged())
			{
				const viewProjectionMatrix = mat4.create();
				const viewMatrix = scene.GetCamera().GetViewMatrix();
				mat4.multiply(state.projectionMatrix, viewMatrix, viewProjectionMatrix);

				this.m_viewProjBuffer.WriteData(viewProjectionMatrix);

				//device.queue.writeBuffer(
				//	renderPass.GetBuffer("viewProj-buffer"),
				//	0,
				//	viewProjectionMatrix.buffer,
				//	viewProjectionMatrix.byteOffset,
				//	viewProjectionMatrix.byteLength
				//);
			}
		};

		// ====== Layers ==============================

		// Terrain
		let terrain: Terrain = new Terrain(10, 10);
		renderPass.AddRenderPassLayer(terrain.Initialize(this.m_renderer, viewProjBindGroupLayout));

		// Texture Cube
		let textureCube = new TextureCube();
		let textureCubeLayer = renderPass.AddRenderPassLayer(textureCube.Initialize(this.m_renderer, viewProjBindGroupLayout));

		// Texture Cube with Instancing
		let textureCubeInstancing = new TextureCubeInstancing();
		let textureCubeInstancingLayer = renderPass.AddRenderPassLayer(textureCubeInstancing.Initialize(this.m_renderer, viewProjBindGroupLayout));

		// Solid Color Cube
//		let colorCube = new ColorCube();
//		let colorCubeLayer = renderPass.AddRenderPassLayer(colorCube.Initialize(this.m_renderer, viewProjBindGroupLayout));
//		let colorCubeRI_2 = colorCubeLayer.CreateRenderItem("ri_color-cube-2", "mg_color-cube", "mesh_color-cube-2");
//		let colorCubeRI_3 = colorCubeLayer.CreateRenderItem("ri_color-cube-3", "mg_color-cube", "mesh_color-cube-3");


		// ============================================

		this.m_renderer.AddRenderPass(renderPass);

		// DEBUG_ONLY
		this.m_renderer.EnableGPUTiming();





		// Create the scene
	//	let cube = new GameCube(this.m_renderer, this.m_scene);

	//	let cube2 = new GameCube2(this.m_renderer, this.m_scene);
	//	cube2.SetPosition([3, 0, 0]);
	//	cube2.SetScaling([0.5, 0.5, 0.5]);
	//
		//	cube.AddChild(cube2);

	//	let cube3 = new GameCube2(this.m_renderer, this.m_scene);
	//	cube3.SetPosition([-3, 0, 0]);

	//	this.m_scene.AddGameObject(cube);
	//	this.m_scene.AddGameObject(cube2);
		//	this.m_scene.AddGameObject(cube3);


		for (let iii = 0; iii < 100; ++iii)
		{
			let cube = new GameCube2(this.m_renderer, this.m_scene);
			cube.SetPosition([0, 1, 0]);
			cube.SetVelocity([5 * (Math.random() - 0.5), 0, 5 * (Math.random() - 0.5)]);
			this.m_scene.AddGameObject(cube);
		}
	}

	public Update(timeDelta: number): void
	{
		// Inform the timing UI a new frame is starting
		this.m_timingUI.Update(timeDelta);

		// Update the scene
		// NOTE: This MUST come before calling Update on the Renderer because this update
		//       can cause the camera to update in which case the view matrix will change
		//       which require buffer updates that are performed in the Renderer update.
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

	private m_keyboardState: KeyBoardState;
	private m_renderer: Renderer;
	private m_canvas: HTMLCanvasElement;
	private m_timingUI: TimingUI;
	private m_scene: Scene;
	private m_renderState: RenderState;

	private m_viewProjBuffer: UniformBufferBasicWrite;
}