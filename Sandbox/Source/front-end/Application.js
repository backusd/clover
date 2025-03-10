import { LOG_TRACE, LOG_CORE_ERROR } from "./Log.js";
import { MeshGroup, BindGroup, RenderPassDescriptor, RenderPass } from "./Renderer.js";
import { Scene, Sphere, Light } from "./Scene2.js";
import { UniformBufferBasicWrite, InstanceBufferBasicWrite } from "./Buffer.js";
import { mat4, vec3, vec4 } from 'wgpu-matrix';
import { Terrain } from "./Terrain.js";
import { TimingUI } from "./TimingUI.js";
import { RenderState } from "./RenderState.js";
import { GenerateBoxMesh, GenerateSphereMesh, GenerateGeosphereMesh, GenerateCylinderMesh, GenerateGridMesh, GenerateQuadMesh } from "./GeometryGenerator.js";
import { GetBasicObjectLayer } from "./BasicObjectLayer.js";
import { GetLightsLayer } from "./LightsLayer.js";
import { Material } from "./Material.js";
class KeyBoardState {
    shiftIsDown = false;
    LButtonIsDown = false;
}
class Globals {
    // The global data is structured as follows:
    //		mat4x4f viewProjectionMatrix
    //		vec4f   ambientLight
    //		vec3f   eyePosition
    //		u32		numberOfDirectionalLights
    //		u32		numberOfPointLights
    //		u32		numberOfSpotLights
    //		f32		_padding_
    //		f32		_padding_
    constructor() {
        this.m_data = new ArrayBuffer(Globals.sizeInBytes);
        this.m_viewProjectionView = new Float32Array(this.m_data, 0, 16);
        this.m_ambientLightView = new Float32Array(this.m_data, Float32Array.BYTES_PER_ELEMENT * 16, 4);
        this.m_eyePositionView = new Float32Array(this.m_data, Float32Array.BYTES_PER_ELEMENT * (16 + 4), 3);
        this.m_numberOfDirectionalLightsView = new Uint32Array(this.m_data, Float32Array.BYTES_PER_ELEMENT * (16 + 4 + 3), 1);
        this.m_numberOfPointLightsView = new Uint32Array(this.m_data, Float32Array.BYTES_PER_ELEMENT * (16 + 4 + 3 + 1), 1);
        this.m_numberOfSpotLightsView = new Uint32Array(this.m_data, Float32Array.BYTES_PER_ELEMENT * (16 + 4 + 3 + 1 + 1), 1);
    }
    SetViewProjection(viewProj) {
        this.m_viewProjectionView.set(viewProj);
    }
    SetAmbientLight(ambient) {
        this.m_ambientLightView.set(ambient);
    }
    SetEyePosition(eyePos) {
        this.m_eyePositionView.set(eyePos);
    }
    SetNumberOfDirectionalLights(numLights) {
        this.m_numberOfDirectionalLightsView[0] = numLights;
    }
    SetNumberOfPointLights(numLights) {
        this.m_numberOfPointLightsView[0] = numLights;
    }
    SetNumberOfSpotLights(numLights) {
        this.m_numberOfSpotLightsView[0] = numLights;
    }
    Data() {
        return this.m_data;
    }
    m_data;
    m_viewProjectionView;
    m_ambientLightView;
    m_eyePositionView;
    m_numberOfDirectionalLightsView;
    m_numberOfPointLightsView;
    m_numberOfSpotLightsView;
    static sizeInBytes = Float32Array.BYTES_PER_ELEMENT * (16 + 4 + 3 + 1 + 1 + 1 + 2);
}
export class Application {
    constructor(renderer, canvas) {
        let device = renderer.GetDevice();
        this.m_keyboardState = new KeyBoardState();
        this.m_renderer = renderer;
        this.m_canvas = canvas;
        this.m_scene = new Scene(this.m_renderer);
        this.m_renderState = new RenderState();
        this.m_renderState.UpdateProjectionMatrix(canvas.width, canvas.height);
        this.m_globals = new Globals();
        this.m_globals.SetAmbientLight([0.25, 0.25, 0.35, 1.0]);
        this.m_globals.SetEyePosition(this.m_scene.GetCamera().GetPosition());
        this.m_globals.SetNumberOfDirectionalLights(0);
        this.m_globals.SetNumberOfPointLights(0);
        this.m_globals.SetNumberOfSpotLights(0);
        this.m_globalsBuffer = new UniformBufferBasicWrite(device, Globals.sizeInBytes, "buffer_globals");
        // Create the lights buffer
        this.m_lightsBuffer = new InstanceBufferBasicWrite(device, Light.sizeInBytes, 1, "buffer_lights");
        // Set callback for when lights are added/removed and the whole buffer needs rebuilding
        this.m_scene.OnLightsBufferNeedsRebuilding = (directionalLights, pointLights, spotLights) => {
            // Update the globals data which specifies the light counts
            this.m_globals.SetNumberOfDirectionalLights(directionalLights.size());
            this.m_globals.SetNumberOfPointLights(pointLights.size());
            this.m_globals.SetNumberOfSpotLights(spotLights.size());
            this.m_globalsBuffer.WriteData(this.m_globals.Data());
            // Update the lighting GPUBuffer
            this.m_lightsBuffer.SetCapacity(directionalLights.size() + pointLights.size() + spotLights.size());
            let offset = 0;
            for (let iii = 0; iii < directionalLights.size(); ++iii)
                this.m_lightsBuffer.WriteData(iii + offset, directionalLights.getFromIndex(iii).Data());
            offset = directionalLights.size();
            for (let iii = 0; iii < pointLights.size(); ++iii)
                this.m_lightsBuffer.WriteData(iii + offset, pointLights.getFromIndex(iii).Data());
            offset = directionalLights.size() + pointLights.size();
            for (let iii = 0; iii < spotLights.size(); ++iii)
                this.m_lightsBuffer.WriteData(iii + offset, spotLights.getFromIndex(iii).Data());
            // Because the underlying GPUBuffer that holds the lighting data may have been destroyed
            // to create one with a large size, we need to regenerate the bind group to reference
            // the new GPUBuffer
            this.UpdatePassBindGroup();
        };
        // Set callback for when a single light changed, which means we can update the buffer directly
        this.m_scene.OnLightChanged = (index, light) => {
            this.m_lightsBuffer.WriteData(index, light.Data());
        };
        // Set callback for when the material buffer changes
        this.m_renderer.OnMaterialBufferChanged = (materialGroup) => {
            // Because the underlying GPUBuffer that holds the material data has changed
            // we need to regenerate the bind group to reference the new GPUBuffer
            this.UpdatePassBindGroup();
        };
        this.m_passBindGroupLayout = device.createBindGroupLayout({
            label: "bgl_main-render-pass",
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                    buffer: {
                        type: "uniform",
                        minBindingSize: Globals.sizeInBytes // BEST PRACTICE to always set this	when possible	
                    }
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.FRAGMENT,
                    buffer: {
                        type: "read-only-storage",
                        // Must always bind at least one material
                        minBindingSize: Material.bytesPerMaterial // BEST PRACTICE to always set this
                    }
                },
                {
                    binding: 2,
                    visibility: GPUShaderStage.FRAGMENT,
                    buffer: {
                        type: "read-only-storage",
                        // Must always bind at least one light
                        minBindingSize: Light.sizeInBytes // BEST Practice to always set this
                    }
                }
            ]
        });
        // At the application level, we are going to add an eventlistener for all webgpu errors
        // Right now, this will just throw an exception. However, in the future, this should try
        // to handle any error more gracefully if possible and should also report the error to the
        // server for logging
        // TODO: Report the error to the game server
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
    }
    UpdatePassBindGroup() {
        let rp = this.m_renderer.GetRenderPass("rp_opaque");
        rp.UpdateBindGroup(0, this.GeneratePassBindGroup());
    }
    GeneratePassBindGroup() {
        let device = this.m_renderer.GetDevice();
        let passBindGroup = device.createBindGroup({
            layout: this.m_passBindGroupLayout,
            entries: [
                {
                    binding: 0,
                    resource: {
                        buffer: this.m_globalsBuffer.GetGPUBuffer(),
                    },
                },
                {
                    binding: 1,
                    resource: {
                        buffer: this.m_renderer.GetMaterialsGPUBuffer(),
                    },
                },
                {
                    binding: 2,
                    resource: {
                        buffer: this.m_lightsBuffer.GetGPUBuffer(),
                    },
                }
            ],
        });
        return new BindGroup(0, passBindGroup);
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
                //this.m_scene.AddDirectionalLight("dir_light-2", [-1, 0, 0], [1, 0, 0]);
                //this.m_scene.AddPointLight("pt_light-1", [4, 0, 0], [1, 1, 1], 3, 10);
                //this.m_scene.AddSpotLight("spt_light-1", [3, 1, 0], [-1, 0, 0], [1, 1, 1], 2, 10, 8);
                // Inject random cube
                //	let cube = new GameCube2(this.m_renderer, this.m_scene);
                //	cube.SetPosition([0, 1, 0]);
                //	cube.SetVelocity([5 * (Math.random() - 0.5), 0, 5 * (Math.random() - 0.5)]);
                //	this.m_scene.AddGameObject(cube);
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
        // =========================================================================
        // Application Startup Process
        //	1. Load all textures (asynchronously)
        //	2. Load all meshes (asynchronously)
        //	3. Load all materials (asynchronously)
        //	4. Construct the render passes and sublayers
        //		a. Opaque Pass
        //			i.   TerrainLayer
        //			ii.  BasicGameObjectLayer
        //			iii. VertexSkinningLayer ???
        //			iv.  Skybox ???
        //		b. ... more passes to come ...
        //  5. Construct the game objects and add them to the Scene
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
        let sphereMesh = GenerateSphereMesh("mesh_sphere", 1, 40, 40);
        let geosphereMesh = GenerateGeosphereMesh("mesh_geosphere", 1, 4);
        let cylinderMesh = GenerateCylinderMesh("mesh_cylinder", 2, 1, 4, 40, 5);
        let gridMesh = GenerateGridMesh("mesh_grid", 2, 3, 2, 3);
        let quadMesh = GenerateQuadMesh("mesh_quad", 1, 1, 1, 1, 1);
        this.m_renderer.AddMeshGroup(new MeshGroup("mg_game-object", this.m_renderer.GetDevice(), [boxMesh, sphereMesh, geosphereMesh, cylinderMesh, gridMesh, quadMesh], 0));
        this.m_renderer.AddMeshGroup(new MeshGroup("mg_lights", this.m_renderer.GetDevice(), [boxMesh, sphereMesh, cylinderMesh], 0));
        // 4. Construct the render passes and sublayers
        const depthTexture = device.createTexture({
            size: [this.m_canvas.width, this.m_canvas.height],
            format: 'depth24plus',
            usage: GPUTextureUsage.RENDER_ATTACHMENT,
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
        let passBindGroup = this.GeneratePassBindGroup();
        // RenderPassDescriptor
        let renderPassDescriptor = new RenderPassDescriptor(rpDescriptor);
        // RenderPass: Opaque
        let renderPass = new RenderPass("rp_opaque", renderPassDescriptor);
        renderPass.AddBindGroup(passBindGroup); // bind group for model-view-projection matrix
        //	renderPass.AddBuffer("viewProj-buffer", this.m_viewProjBuffer.GetGPUBuffer());
        renderPass.Update = (timeDelta, renderPass, state, scene) => {
            if (state.projectionMatrixHasChanged || scene.GetCamera().ViewHasChanged()) {
                // View Projection
                const viewProjectionMatrix = mat4.create();
                const viewMatrix = scene.GetCamera().GetViewMatrix();
                mat4.multiply(state.projectionMatrix, viewMatrix, viewProjectionMatrix);
                this.m_globals.SetViewProjection(viewProjectionMatrix);
                // Eye Position
                this.m_globals.SetEyePosition(this.m_scene.GetCamera().GetPosition());
                // Update the GPUBuffer
                this.m_globalsBuffer.WriteData(this.m_globals.Data());
            }
        };
        this.m_renderer.AddRenderPass(renderPass);
        // ====== Layers ==============================
        //
        // Layer: Terrain
        let terrain = new Terrain(10, 10);
        renderPass.AddRenderPassLayer(terrain.Initialize(this.m_renderer, this.m_passBindGroupLayout));
        // Layer: Lights
        let lightsLayer = renderPass.AddRenderPassLayer(GetLightsLayer(this.m_renderer, this.m_passBindGroupLayout));
        lightsLayer.AddMeshGroup("mg_lights");
        // Layer: BasicObject
        let basicObjectLayer = renderPass.AddRenderPassLayer(GetBasicObjectLayer(this.m_renderer, this.m_passBindGroupLayout));
        basicObjectLayer.AddMeshGroup("mg_game-object");
        // 3. Load all materials (asynchronously)
        // NOTE: This needs to come AFTER creating the render passes because it will trigger the
        //       OnMaterialBufferChanged callback which will try to look up the main render pass
        let mat1 = new Material("mat_test1", vec4.create(1.0, 1.0, 0.0, 1.0), vec3.create(0.01, 0.01, 0.01), 0.75);
        let mat2 = new Material("mat_test2", vec4.create(0.5, 0.5, 1.0, 1.0), vec3.create(0.01, 0.01, 0.01), 0.75);
        this.m_renderer.AddMaterial(mat1);
        this.m_renderer.AddMaterial(mat2);
        //  5. Construct the game objects and add them to the Scene
        let sphere = new Sphere(this.m_renderer, this.m_scene);
        this.m_scene.AddSceneObject(sphere);
        // Add Lights to the scene
        // NOTE: This needs to come after setting the lighting changed callbacks so that the 
        // callbacks trigger when adding lights
        this.m_scene.AddDirectionalLight("dir_light_1", [0, 0, -1], [1, 1, 1]);
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
    m_passBindGroupLayout;
    // Hold onto global data that will be bound once per pass
    m_globals;
    m_globalsBuffer;
    m_lightsBuffer;
}
//# sourceMappingURL=Application.js.map