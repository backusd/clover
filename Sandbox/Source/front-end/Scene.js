import { Camera } from "./Camera.js";
import { HybridLookup } from "./Utils.js";
export class GameObject {
    constructor(name, renderer) {
        this.m_name = name;
        this.m_renderer = renderer;
        this.m_subObjects = new HybridLookup();
    }
    Name() { return this.m_name; }
    m_name;
    m_renderer;
    m_subObjects;
}
export class GameCube extends GameObject {
    constructor(name, renderer) {
        super(name, renderer);
    }
    Update(timeDelta) {
    }
    m_position;
    m_rotation;
    m_scale;
    m_modelMatrix;
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
    m_camera;
    m_gameObjects;
}
//# sourceMappingURL=Scene.js.map