import { mat4, vec3 } from 'wgpu-matrix';
export class Camera {
    constructor() {
        this.m_eye = vec3.create(3, 2, 5);
        this.m_at = vec3.create(0, 0, 0);
        this.m_up = vec3.create(0, 1, 0);
        this.m_viewMatrix = mat4.create();
        this.UpdateViewMatrix();
    }
    UpdateViewMatrix() {
        mat4.lookAt(this.m_eye, this.m_at, this.m_up, this.m_viewMatrix);
        this.m_viewHasChanged = true;
    }
    GetViewMatrix() {
        return this.m_viewMatrix;
    }
    ViewHasChanged() { return this.m_viewHasChanged; }
    ResetViewHasChanged() { this.m_viewHasChanged = false; }
    m_eye;
    m_at;
    m_up;
    m_viewMatrix;
    m_viewHasChanged = false;
}
//# sourceMappingURL=Camera.js.map