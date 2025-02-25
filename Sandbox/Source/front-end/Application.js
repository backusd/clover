import { LOG_TRACE } from "./Log.js";
import { BindGroup, RenderPassDescriptor, RenderPass } from "./Renderer.js";
import { Scene } from "./Scene.js";
import { mat4 } from 'wgpu-matrix';
import { Terrain } from "./Terrain.js";
import { ColorCube } from "./ColorCube.js";
import { TextureCube } from "./TextureCube.js";
import { TimingUI } from "./TimingUI.js";
import { RenderState } from "./RenderState.js";
class KeyBoardState {
    shiftIsDown = false;
}
export class Application {
    constructor(renderer, canvas) {
        this.m_keyboardState = new KeyBoardState();
        this.m_renderer = renderer;
        this.m_canvas = canvas;
        this.m_scene = new Scene();
        this.m_renderState = new RenderState();
        this.m_renderState.UpdateProjectionMatrix(canvas.width, canvas.height);
        // Create the TimingUI. Have it cache timing measurements from 20 frames before computing averages
        this.m_timingUI = new TimingUI(20, renderer);
        this.SetupInputCallbacks();
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
    }
    OnMButtonDown(e) {
        LOG_TRACE("OnMButtonDown");
    }
    OnRButtonDown(e) {
        LOG_TRACE("OnRButtonDown");
    }
    OnLButtonUp(e) {
        LOG_TRACE("OnLButtonUp");
    }
    OnMButtonUp(e) {
        LOG_TRACE("OnMButtonUp");
    }
    OnRButtonUp(e) {
        LOG_TRACE("OnRButtonUp");
    }
    OnPointerMove(e) {
        //LOG_TRACE(`OnPointerMove: (${e.movementX}, ${e.movementY})`);
    }
    OnWheel(e) {
        LOG_TRACE(`OnWheel: ${e.deltaX}, ${e.deltaY} (${e.deltaMode})`);
        e.preventDefault();
        e.stopPropagation();
    }
    async InitializeAsync() {
        let device = this.m_renderer.GetDevice();
        let context = this.m_renderer.GetContext();
        let canvas = context.canvas;
        if (canvas instanceof OffscreenCanvas)
            throw Error("Cannot initialize Renderer. canvis is instanceof OffscreenCanvas - not sure how to handle that");
        const devicePixelRatio = window.devicePixelRatio;
        canvas.width = canvas.clientWidth * devicePixelRatio;
        canvas.height = canvas.clientHeight * devicePixelRatio;
        let viewProjBindGroupLayout = device.createBindGroupLayout({
            label: "Model-View-Projection BindGroupLayout",
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                    buffer: {}
                }
            ]
        });
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
        // RenderPass
        let renderPass = new RenderPass("rp_main", device, renderPassDescriptor);
        renderPass.AddBindGroup(passBindGroup); // bind group for model-view-projection matrix
        renderPass.AddBuffer("viewProj-buffer", viewProjBuffer);
        renderPass.Update = (timeDelta, renderPass, state, scene) => {
            if (state.projectionMatrixHasChanged || scene.GetCamera().ViewHasChanged()) {
                const viewProjectionMatrix = mat4.create();
                const viewMatrix = scene.GetCamera().GetViewMatrix();
                mat4.multiply(state.projectionMatrix, viewMatrix, viewProjectionMatrix);
                device.queue.writeBuffer(renderPass.GetBuffer("viewProj-buffer"), 0, viewProjectionMatrix.buffer, viewProjectionMatrix.byteOffset, viewProjectionMatrix.byteLength);
            }
        };
        // ====== Layers ==============================
        // Terrain
        let terrain = new Terrain(10, 10);
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
}
//# sourceMappingURL=Application.js.map