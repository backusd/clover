
import { Mat4, Vec3, Vec4, mat4, vec3 } from 'wgpu-matrix';


export class RenderState
{
	public UpdateProjectionMatrix(width: number, height: number)
	{
		const aspect = width / height;
		this.projectionMatrix = mat4.perspective(Math.PI / 4.0, aspect, 1, 100.0);
		this.projectionMatrixHasChanged = true;
	}
	public projectionMatrix: Mat4;
	public projectionMatrixHasChanged: boolean = false;
}