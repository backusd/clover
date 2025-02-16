import { Mat4, Vec3, Vec4, mat4, vec3 } from 'wgpu-matrix';



export class Camera
{
	constructor()
	{
		this.m_eye = vec3.create(3, 2, 5);
		this.m_at = vec3.create(0, 0, 0);
		this.m_up = vec3.create(0, 1, 0);

		this.m_viewMatrix = mat4.create();
		this.UpdateViewMatrix();
	}
	private UpdateViewMatrix(): void
	{
		mat4.lookAt(this.m_eye, this.m_at, this.m_up, this.m_viewMatrix);
	}
	public GetViewMatrix(): Mat4
	{
		return this.m_viewMatrix;
	}



	private m_eye: Vec3;
	private m_at: Vec3;
	private m_up: Vec3;
	private m_viewMatrix: Mat4;
}