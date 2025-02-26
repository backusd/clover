import { LOG_ERROR } from "./Log.js";
import { BindGroup } from "./Renderer.js";
import { Camera } from "./Camera.js";
import { HybridLookup } from "./Utils.js";
import { mat4, vec3 } from 'wgpu-matrix';
export class GameObject {
    constructor(name, renderer) {
        this.m_name = name;
        this.m_renderer = renderer;
        this.m_childObjects = new HybridLookup();
    }
    UpdateImpl(timeDelta, parentModelMatrix) {
        this.Update(timeDelta, parentModelMatrix);
        this.UpdateChildren(timeDelta, this.m_modelMatrix);
    }
    Name() { return this.m_name; }
    UpdateModelMatrix(parentModelMatrix) {
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
    UpdateChildren(timeDelta, parentModelMatrix) {
        for (let iii = 0; iii < this.m_childObjects.size(); ++iii)
            this.m_childObjects.getFromIndex(iii).Update(timeDelta, parentModelMatrix);
    }
    AddChild(object) {
        return this.m_childObjects.add(object.Name(), object);
    }
    SetPosition(position) {
        this.m_position = position;
    }
    SetRotation(rotation) {
        this.m_rotation = rotation;
    }
    SetScaling(scaling) {
        this.m_scaling = scaling;
    }
    m_name;
    m_renderer;
    m_childObjects;
    m_position = vec3.create(0, 0, 0);
    m_rotation = vec3.create(0, 0, 0);
    m_scaling = vec3.create(1, 1, 1);
    m_modelMatrix = mat4.identity();
}
export class GameCube extends GameObject {
    constructor(name, renderer) {
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
    async InitializeAsync() {
        let device = this.m_renderer.GetDevice();
        // Get the bind group layout that all render items in this layer will use
        let layer = this.m_renderer.GetRenderPass("rp_main").GetRenderPassLayer("rpl_texture-cube");
        let bindGroupLayout = layer.GetRenderItemBindGroupLayout();
        if (bindGroupLayout === null) {
            let msg = "GameCube::InitializeAsync() failed because layer.GetRenderItemBindGroupLayout() returned null";
            LOG_ERROR(msg);
            throw Error(msg);
        }
        let bindGroupLayoutGroupNumber = layer.GetRenderItemBindGroupLayoutGroupNumber();
        // Fetch the image and upload it into a GPUTexture.
        let cubeTexture;
        {
            const response = await fetch('./images/molecule.jpeg');
            const imageBitmap = await createImageBitmap(await response.blob());
            cubeTexture = device.createTexture({
                size: [imageBitmap.width, imageBitmap.height, 1],
                format: 'rgba8unorm',
                usage: GPUTextureUsage.TEXTURE_BINDING |
                    GPUTextureUsage.COPY_DST |
                    GPUTextureUsage.RENDER_ATTACHMENT,
            });
            device.queue.copyExternalImageToTexture({ source: imageBitmap }, { texture: cubeTexture }, [imageBitmap.width, imageBitmap.height]);
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
    Update(timeDelta, parentModelMatrix) {
        this.m_rotation[1] += timeDelta;
        if (this.m_rotation[1] > 2 * Math.PI)
            this.m_rotation[1] -= 2 * Math.PI;
        this.UpdateModelMatrix(parentModelMatrix);
        // Update the GPUBuffer
        let device = this.m_renderer.GetDevice();
        device.queue.writeBuffer(this.m_modelMatrixBuffer, 0, this.m_modelMatrix.buffer, this.m_modelMatrix.byteOffset, this.m_modelMatrix.byteLength);
    }
    m_renderItem;
    m_modelMatrixBuffer;
}
export class GameCube2 extends GameObject {
    constructor(name, renderer) {
        super(name, renderer);
        // Create a render item for the cube
        let layer = renderer.GetRenderPass("rp_main").GetRenderPassLayer("rpl_texture-cube");
        this.m_renderItem = layer.CreateRenderItem("ri_game-cube-2", "mg_texture-cube", "mesh_texture-cube");
        // Create the model buffer
        this.m_modelMatrixBuffer = this.m_renderer.GetDevice().createBuffer({
            label: 'buffer_game-cube-2-model-matrix',
            size: 4 * 16, // sizeof(float) * floats per matrix
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
    }
    async InitializeAsync() {
        let device = this.m_renderer.GetDevice();
        // Get the bind group layout that all render items in this layer will use
        let layer = this.m_renderer.GetRenderPass("rp_main").GetRenderPassLayer("rpl_texture-cube");
        let bindGroupLayout = layer.GetRenderItemBindGroupLayout();
        if (bindGroupLayout === null) {
            let msg = "GameCube::InitializeAsync() failed because layer.GetRenderItemBindGroupLayout() returned null";
            LOG_ERROR(msg);
            throw Error(msg);
        }
        let bindGroupLayoutGroupNumber = layer.GetRenderItemBindGroupLayoutGroupNumber();
        // Fetch the image and upload it into a GPUTexture.
        let cubeTexture;
        {
            const response = await fetch('./images/molecule.jpeg');
            const imageBitmap = await createImageBitmap(await response.blob());
            cubeTexture = device.createTexture({
                size: [imageBitmap.width, imageBitmap.height, 1],
                format: 'rgba8unorm',
                usage: GPUTextureUsage.TEXTURE_BINDING |
                    GPUTextureUsage.COPY_DST |
                    GPUTextureUsage.RENDER_ATTACHMENT,
            });
            device.queue.copyExternalImageToTexture({ source: imageBitmap }, { texture: cubeTexture }, [imageBitmap.width, imageBitmap.height]);
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
    Update(timeDelta, parentModelMatrix) {
        this.UpdateModelMatrix(parentModelMatrix);
        // Update the GPUBuffer
        let device = this.m_renderer.GetDevice();
        device.queue.writeBuffer(this.m_modelMatrixBuffer, 0, this.m_modelMatrix.buffer, this.m_modelMatrix.byteOffset, this.m_modelMatrix.byteLength);
    }
    m_renderItem;
    m_modelMatrixBuffer;
}
export class Scene {
    constructor() {
        this.m_camera = new Camera();
        this.m_gameObjects = new HybridLookup();
    }
    Update(timeDelta) {
        // Update the Camera
        this.m_camera.Update(timeDelta);
        // Update the game objects
        let identity = mat4.identity();
        let numObjects = this.m_gameObjects.size();
        for (let iii = 0; iii < numObjects; ++iii)
            this.m_gameObjects.getFromIndex(iii).UpdateImpl(timeDelta, identity);
    }
    GetCamera() { return this.m_camera; }
    AddGameObject(object) {
        return this.m_gameObjects.add(object.Name(), object);
    }
    m_camera;
    m_gameObjects;
}
//# sourceMappingURL=Scene.js.map