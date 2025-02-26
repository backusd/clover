import { Camera } from "./Camera.js";
import { HybridLookup } from "./Utils.js";
import { mat4, vec3 } from 'wgpu-matrix';
export class GameObject {
    constructor(name, renderer) {
        this.m_name = name;
        this.m_renderer = renderer;
        this.m_subObjects = new HybridLookup();
    }
    Name() { return this.m_name; }
    ModelMatrix() {
        let model = mat4.translation(this.m_position);
        let rotationX = mat4.rotationX(this.m_rotation[0]);
        let rotationY = mat4.rotationY(this.m_rotation[1]);
        let rotationZ = mat4.rotationZ(this.m_rotation[2]);
        let scaling = mat4.scaling(this.m_scaling);
        mat4.multiply(model, rotationX, model);
        mat4.multiply(model, rotationY, model);
        mat4.multiply(model, rotationZ, model);
        mat4.multiply(model, scaling, model);
        return model;
    }
    m_name;
    m_renderer;
    m_subObjects;
    m_position = vec3.create(0, 0, 0);
    m_rotation = vec3.create(0, 0, 0);
    m_scaling = vec3.create(1, 1, 1);
}
export class GameCube extends GameObject {
    constructor(name, renderer) {
        super(name, renderer);
        let layer = renderer.GetRenderPass("rp_main").GetRenderPassLayer("rpl_texture-cube");
        this.m_renderItem = layer.CreateRenderItem("ri_game-cube", "mg_texture-cube", "mesh_texture-cube");
    }
    Update(timeDelta) {
        //	... make the cube spin ... this is going to require changes to the shader
        //		don't forget to use @group(2) for RenderItem bindings'
    }
    m_renderItem;
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
        let numObjects = this.m_gameObjects.size();
        for (let iii = 0; iii < numObjects; ++iii)
            this.m_gameObjects.getFromIndex(iii).Update(timeDelta);
    }
    GetCamera() { return this.m_camera; }
    AddGameObject(object) {
        return this.m_gameObjects.add(object.Name(), object);
    }
    m_camera;
    m_gameObjects;
}
//# sourceMappingURL=Scene.js.map