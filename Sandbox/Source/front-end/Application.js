import { LOG_TRACE } from "./Log.js";
import { BindGroup, RenderPassDescriptor, RenderPass } from "./Renderer.js";
import { Camera } from "./Camera.js";
import { mat4 } from 'wgpu-matrix';
import { Terrain } from "./Terrain.js";
import { ColorCube } from "./ColorCube.js";
import { TextureCube } from "./TextureCube.js";
export class Application {
    constructor(renderer, canvas) {
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
            case 'ControlLeft':
            case 'KeyC':
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
            case 'ControlLeft':
            case 'KeyC':
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
        let mvpBindGroupLayout = device.createBindGroupLayout({
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
        // Bind Groups
        let passBindGroup = new BindGroup(0, mvpBindGroup);
        // RenderPassDescriptor
        let renderPassDescriptor = new RenderPassDescriptor(this.m_renderPassDescriptor);
        // RenderPass
        let renderPass = new RenderPass(renderPassDescriptor);
        renderPass.AddBindGroup(passBindGroup); // bind group for model-view-projection matrix
        // ====== Layers ==============================
        // Terrain
        let terrain = new Terrain(10, 10);
        renderPass.AddRenderPassLayer(terrain.Initialize(this.m_renderer, mvpBindGroupLayout));
        // Texture Cube
        let textureCube = new TextureCube();
        let textureCubeLayer = renderPass.AddRenderPassLayer(await textureCube.Initialize(this.m_renderer, mvpBindGroupLayout));
        let textureCubeRI = textureCubeLayer.CreateRenderItem("ri_texture-cube", "mg_texture-cube", "mesh_texture-cube");
        // Solid Color Cube
        let colorCube = new ColorCube();
        let colorCubeLayer = renderPass.AddRenderPassLayer(colorCube.Initialize(this.m_renderer, mvpBindGroupLayout));
        let colorCubeRI_2 = colorCubeLayer.CreateRenderItem("ri_color-cube-2", "mg_color-cube", "mesh_color-cube-2");
        let colorCubeRI_3 = colorCubeLayer.CreateRenderItem("ri_color-cube-3", "mg_color-cube", "mesh_color-cube-3");
        // ============================================
        this.m_renderer.AddRenderPass(renderPass);
    }
    GetViewProjectionMatrix(deltaTime) {
        let context = this.m_renderer.GetContext();
        let canvas = context.canvas;
        if (canvas instanceof OffscreenCanvas)
            throw Error("Cannot GetModelViewProjectionMatrix. canvas is instanceof OffscreenCanvas - not sure how to handle that");
        const aspect = canvas.width / canvas.height;
        const projectionMatrix = mat4.perspective((2 * Math.PI) / 5, aspect, 1, 100.0);
        const modelViewProjectionMatrix = mat4.create();
        const viewMatrix = this.m_camera.GetViewMatrix();
        mat4.multiply(projectionMatrix, viewMatrix, modelViewProjectionMatrix);
        return modelViewProjectionMatrix;
    }
    Update(timeDelta) {
        let device = this.m_renderer.GetDevice();
        const modelViewProjection = this.GetViewProjectionMatrix(0);
        device.queue.writeBuffer(this.m_uniformBuffer, 0, modelViewProjection.buffer, modelViewProjection.byteOffset, modelViewProjection.byteLength);
    }
    m_renderer;
    m_canvas;
    m_camera;
    m_renderPassDescriptor;
    m_pipeline;
    m_uniformBuffer;
    m_uniformBindGroup;
}
//# sourceMappingURL=Application.js.map