import { mat4 } from 'wgpu-matrix';
export class RenderState {
    UpdateProjectionMatrix(width, height) {
        const aspect = width / height;
        this.projectionMatrix = mat4.perspective(Math.PI / 4.0, aspect, 1, 100.0);
        this.projectionMatrixHasChanged = true;
    }
    projectionMatrix;
    projectionMatrixHasChanged = false;
}
//# sourceMappingURL=RenderState.js.map