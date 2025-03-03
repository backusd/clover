import { LOG_TRACE, LOG_CORE_ERROR } from "./Log.js";
import { MeshGroup, BindGroup, RenderPassDescriptor, RenderPass } from "./Renderer.js";
import { Scene, GameCube2, BasicBox } from "./Scene.js";
import { UniformBufferBasicWrite } from "./Buffer.js";
import { mat4 } from 'wgpu-matrix';
import { Terrain } from "./Terrain.js";
import { TimingUI } from "./TimingUI.js";
import { RenderState } from "./RenderState.js";
import { GenerateBoxMesh } from "./GeometryGenerator.js";
import { GetBasicObjectLayer } from "./BasicObjectLayer.js";
class KeyBoardState {
    shiftIsDown = false;
    LButtonIsDown = false;
}
export class Application {
    constructor(renderer, canvas) {
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
        device.addEventListener('uncapturederror', (event) => {
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
    SetupInputCallbacks() {
        window.addEventListener('keydown', (e) => this.OnKeyDown(e));
        window.addEventListener('keyup', (e) => this.OnKeyUp(e));
        this.m_canvas.style.touchAction = 'pinch-zoom';
        this.m_canvas.addEventListener('pointerdown', (e) => {
            //e.button describes the mouse button that was clicked
            // 0 is left, 1 is middle, 2 is right
            if (e.button === 0)
                this.OnLButtonDown(e);
            else if (e.button === 1)
                this.OnMButtonDown(e);
            else if (e.button === 2)
                this.OnRButtonDown(e);
        });
        this.m_canvas.addEventListener('pointerup', (e) => {
            // e.button describes the mouse button that was clicked
            // 0 is left, 1 is middle, 2 is right
            if (e.button === 0)
                this.OnLButtonUp(e);
            else if (e.button === 1)
                this.OnMButtonUp(e);
            else if (e.button === 2)
                this.OnRButtonUp(e);
        });
        this.m_canvas.addEventListener('pointermove', (e) => this.OnPointerMove(e));
        this.m_canvas.addEventListener('wheel', (e) => this.OnWheel(e), { passive: false });
    }
    OnKeyDown(e) {
        LOG_TRACE(`OnKeyDown: ${e.code}`);
        let handled = true;
        switch (e.code) {
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
        if (handled) {
            e.preventDefault();
            e.stopPropagation();
        }
    }
    OnKeyUp(e) {
        LOG_TRACE(`OnKeyUp: ${e.code}`);
        let handled = true;
        switch (e.code) {
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
        if (handled) {
            e.preventDefault();
            e.stopPropagation();
        }
    }
    OnLButtonDown(e) {
        LOG_TRACE("OnLButtonDown");
        this.m_keyboardState.LButtonIsDown = true;
        this.m_scene.GetCamera().StartMouseDragging();
    }
    OnMButtonDown(e) {
        LOG_TRACE("OnMButtonDown");
    }
    OnRButtonDown(e) {
        LOG_TRACE("OnRButtonDown");
    }
    OnLButtonUp(e) {
        LOG_TRACE("OnLButtonUp");
        this.m_keyboardState.LButtonIsDown = false;
        this.m_scene.GetCamera().StopMouseDragging();
    }
    OnMButtonUp(e) {
        LOG_TRACE("OnMButtonUp");
    }
    OnRButtonUp(e) {
        LOG_TRACE("OnRButtonUp");
    }
    OnPointerMove(e) {
        // LOG_TRACE(`OnPointerMove: (${e.movementX}, ${e.movementY}) | (${e.x}, ${e.y}) | ${this.m_canvas.width}, ${this.m_canvas.height}`);
        if (this.m_keyboardState.LButtonIsDown)
            this.m_scene.GetCamera().MouseDrag(e.movementX, e.movementY);
    }
    OnWheel(e) {
        LOG_TRACE(`OnWheel: ${e.deltaX}, ${e.deltaY} (${e.deltaMode})`);
        if (e.deltaY < 0)
            this.m_scene.GetCamera().ZoomIn();
        else
            this.m_scene.GetCamera().ZoomOut();
        e.preventDefault();
        e.stopPropagation();
    }
    async InitializeAsync() {
        let device = this.m_renderer.GetDevice();
        let context = this.m_renderer.GetContext();
        // ====== Layers ==============================
        // Terrain
        //		let terrain: Terrain = new Terrain(10, 10);
        //		renderPass.AddRenderPassLayer(terrain.Initialize(this.m_renderer, viewProjBindGroupLayout));
        //
        //		// Texture Cube
        //		let textureCube = new TextureCube();
        //		let textureCubeLayer = renderPass.AddRenderPassLayer(textureCube.Initialize(this.m_renderer, viewProjBindGroupLayout));
        //
        //		// Texture Cube with Instancing
        //		let textureCubeInstancing = new TextureCubeInstancing();
        //		let textureCubeInstancingLayer = renderPass.AddRenderPassLayer(textureCubeInstancing.Initialize(this.m_renderer, viewProjBindGroupLayout));
        // Solid Color Cube
        //		let colorCube = new ColorCube();
        //		let colorCubeLayer = renderPass.AddRenderPassLayer(colorCube.Initialize(this.m_renderer, viewProjBindGroupLayout));
        //		let colorCubeRI_2 = colorCubeLayer.CreateRenderItem("ri_color-cube-2", "mg_color-cube", "mesh_color-cube-2");
        //		let colorCubeRI_3 = colorCubeLayer.CreateRenderItem("ri_color-cube-3", "mg_color-cube", "mesh_color-cube-3");
        // ============================================
        //		this.m_renderer.AddRenderPass(renderPass);
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
        //		for (let iii = 0; iii < 100; ++iii)
        //		{
        //			let cube = new GameCube2(this.m_renderer, this.m_scene);
        //			cube.SetPosition([0, 1, 0]);
        //			cube.SetVelocity([5 * (Math.random() - 0.5), 0, 5 * (Math.random() - 0.5)]);
        //			this.m_scene.AddGameObject(cube);
        //		}
        // =========================================================================
        // Application Startup Process
        //	1. Load all textures (asynchronously)
        //	2. Load all meshes (asynchronously)
        //	3. Construct the render passes and sublayers
        //		a. Opaque Pass
        //			i.   TerrainLayer
        //			ii.  BasicGameObjectLayer
        //			iii. VertexSkinningLayer ???
        //			iv.  Skybox ???
        //		b. ... more passes to come ...
        //  4. Construct the game objects and add them to the Scene
        //
        // TODO: See note.
        // NOTE: Steps 1-3 could be automated by reading in and parsing an entire
        //       scene file (ex. a glTF file). If that's the case, we would need to
        //       define a very clear set of rules for the types of meshes/attributes
        //       we expect to read, but assuming we have that, the entire scene
        //		 and render passes could be configured all in one go.
        //
        // =========================================================================
        // 1. Load all textures (asynchronously)
        await this.m_renderer.AddTextureFromFile("tex_molecule", "./images/molecule.jpeg");
        // 2. Load all meshes (asynchronously)
        let boxMesh = GenerateBoxMesh("mesh_box", 1, 1, 1, 0);
        this.m_renderer.AddMeshGroup(new MeshGroup("mg_basic-object", this.m_renderer.GetDevice(), [boxMesh], 0));
        // 3. Construct the render passes and sublayers
        let viewProjBindGroupLayout = device.createBindGroupLayout({
            label: "Model-View-Projection BindGroupLayout",
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                    buffer: {
                        type: "uniform",
                        minBindingSize: Float32Array.BYTES_PER_ELEMENT * 16 // BEST PRACTICE to always set this	when possible	
                    }
                }
            ]
        });
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
        let rpDescriptor = {
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
        let passBindGroup = new BindGroup(0, viewProjBindGroup);
        // RenderPassDescriptor
        let renderPassDescriptor = new RenderPassDescriptor(rpDescriptor);
        // RenderPass: Opaque
        let renderPass = new RenderPass("rp_opaque", renderPassDescriptor);
        renderPass.AddBindGroup(passBindGroup); // bind group for model-view-projection matrix
        //	renderPass.AddBuffer("viewProj-buffer", this.m_viewProjBuffer.GetGPUBuffer());
        renderPass.Update = (timeDelta, renderPass, state, scene) => {
            if (state.projectionMatrixHasChanged || scene.GetCamera().ViewHasChanged()) {
                const viewProjectionMatrix = mat4.create();
                const viewMatrix = scene.GetCamera().GetViewMatrix();
                mat4.multiply(state.projectionMatrix, viewMatrix, viewProjectionMatrix);
                this.m_viewProjBuffer.WriteData(viewProjectionMatrix);
            }
        };
        this.m_renderer.AddRenderPass(renderPass);
        // ====== Layers ==============================
        //
        // Layer: Terrain
        let terrain = new Terrain(10, 10);
        renderPass.AddRenderPassLayer(terrain.Initialize(this.m_renderer, viewProjBindGroupLayout));
        // Layer: BasicObject
        let basicObjectLayer = renderPass.AddRenderPassLayer(GetBasicObjectLayer(this.m_renderer, viewProjBindGroupLayout));
        basicObjectLayer.AddMeshGroup("mg_basic-object");
        //  4. Construct the game objects and add them to the Scene
        let box = new BasicBox(this.m_renderer, this.m_scene);
        this.m_scene.AddGameObject(box);
        // DEBUG_ONLY
        this.m_renderer.EnableGPUTiming();
    }
    Update(timeDelta) {
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
    EndFrame() {
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
    OnCanvasResize(width, height) {
        this.m_renderer.OnCanvasResize(width, height);
        this.m_renderState.UpdateProjectionMatrix(width, height);
    }
    m_keyboardState;
    m_renderer;
    m_canvas;
    m_timingUI;
    m_scene;
    m_renderState;
    m_viewProjBuffer;
}
//# sourceMappingURL=Application.js.map