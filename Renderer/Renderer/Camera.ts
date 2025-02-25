import { Mat4, Vec3, Vec4, mat4, vec3 } from 'wgpu-matrix';
import { LOG_INFO, LOG_TRACE, LOG_WARN, LOG_ERROR } from "./Log.js";


export class Camera
{
	constructor()
	{
		this.m_eye = vec3.create(0, 2, 10);
		this.m_at = vec3.create(0, 0, 0);
		this.m_up = vec3.create(0, 1, 0);

		this.m_viewMatrix = mat4.create();
		this.UpdateViewMatrix();
	}
	private UpdateViewMatrix(): void
	{
		mat4.lookAt(this.m_eye, this.m_at, this.m_up, this.m_viewMatrix);
		this.m_viewHasChanged = true;
	}
	public GetViewMatrix(): Mat4
	{
		return this.m_viewMatrix;
	}
	public ViewHasChanged(): boolean { return this.m_viewHasChanged; }
	public ResetViewHasChanged(): void { this.m_viewHasChanged = false; }

	public IsMoving(): boolean
	{
		return this.m_isMovingForward || this.m_isMovingBackward ||
			this.m_isMovingRight || this.m_isMovingLeft ||
			this.m_isRotatingUpward || this.m_isRotatingDownward ||
			this.m_isRotatingRight || this.m_isRotatingLeft;
	}
	public IsTranslating(): boolean
	{
		return this.m_isMovingForward || this.m_isMovingBackward ||
			this.m_isMovingRight || this.m_isMovingLeft;
	}
	public IsRotating(): boolean
	{
		return this.m_isRotatingUpward || this.m_isRotatingDownward ||
			this.m_isRotatingRight || this.m_isRotatingLeft;
	}
	public StartMovingForward(): void
	{
		if (!(this.m_isMovingBackward || this.IsRotating()))
			this.m_isMovingForward = true;
	}
	public StartMovingBackward(): void
	{
		if (!(this.m_isMovingForward || this.IsRotating()))
			this.m_isMovingBackward = true;
	}
	public StartMovingRight(): void
	{
		if (!(this.m_isMovingLeft || this.IsRotating()))
			this.m_isMovingRight = true;
	}
	public StartMovingLeft(): void
	{
		if (!(this.m_isMovingRight || this.IsRotating()))
			this.m_isMovingLeft = true;
	}
	public StartRotatingUpward(): void
	{
		if (!(this.m_isRotatingDownward || this.IsTranslating()))
			this.m_isRotatingUpward = true;
	}
	public StartRotatingDownward(): void
	{
		if (!(this.m_isRotatingUpward || this.IsTranslating()))
			this.m_isRotatingDownward = true;
	}
	public StartRotatingRight(): void
	{
		if (!(this.m_isRotatingLeft || this.IsTranslating()))
			this.m_isRotatingRight = true;
	}
	public StartRotatingLeft(): void
	{
		if (!(this.m_isRotatingRight || this.IsTranslating()))
			this.m_isRotatingLeft = true;
	}


	public StopMovingForward(): void { this.m_isMovingForward = false; }
	public StopMovingBackward(): void { this.m_isMovingBackward = false; }
	public StopMovingRight(): void { this.m_isMovingRight = false; }
	public StopMovingLeft(): void { this.m_isMovingLeft = false; }
	public StopRotatingUpward(): void { this.m_isRotatingUpward = false; }
	public StopRotatingDownward(): void { this.m_isRotatingDownward = false; }
	public StopRotatingRight(): void { this.m_isRotatingRight = false; }
	public StopRotatingLeft(): void { this.m_isRotatingLeft = false; }

	public Update(timeDelta: number): void
	{
		// If we are moving forward or backward, we want to always keep m_at somewhere on the xz-plane
		// and we always keep m_up at (0, 1, 0). So we just need to progress the x & z values of m_eye
		// and m_at
		if (this.m_isMovingForward)
		{
			let direction = vec3.normalize(vec3.subtract(this.m_at, this.m_eye));
			let delta = vec3.create(direction[0] * this.m_speed * timeDelta, 0, direction[2] * this.m_speed * timeDelta);

			vec3.add(this.m_eye, delta, this.m_eye);
			vec3.add(this.m_at, delta, this.m_at);

			this.UpdateViewMatrix();
		}
		else if (this.m_isMovingBackward)
		{
			let direction = vec3.normalize(vec3.subtract(this.m_eye, this.m_at));
			let delta = vec3.create(direction[0] * this.m_speed * timeDelta, 0, direction[2] * this.m_speed * timeDelta);

			vec3.add(this.m_eye, delta, this.m_eye);
			vec3.add(this.m_at, delta, this.m_at);

			this.UpdateViewMatrix();
		}

		// If we are moving left or right, we want to always keep m_at somewhere on the xz-plane
		// and we always keep m_up at (0, 1, 0). So we just need to progress the x & z values of m_eye
		// and m_at
		if (this.m_isMovingLeft)
		{
			let direction = vec3.normalize(vec3.cross(vec3.subtract(this.m_eye, this.m_at), this.m_up));
			let delta = vec3.create(direction[0] * this.m_speed * timeDelta, 0, direction[2] * this.m_speed * timeDelta);

			vec3.add(this.m_eye, delta, this.m_eye);
			vec3.add(this.m_at, delta, this.m_at);

			this.UpdateViewMatrix();
		}
		else if (this.m_isMovingRight)
		{
			let direction = vec3.normalize(vec3.cross(this.m_up, vec3.subtract(this.m_eye, this.m_at)));
			let delta = vec3.create(direction[0] * this.m_speed * timeDelta, 0, direction[2] * this.m_speed * timeDelta);

			vec3.add(this.m_eye, delta, this.m_eye);
			vec3.add(this.m_at, delta, this.m_at);

			this.UpdateViewMatrix();
		}

		// If we are rotating up or down, we want to always keep m_at and m_up the same. We just
		// need to move the m_eye vector along the arc of a circle so it keeps the same distance to m_at
		if (this.m_isRotatingUpward)
		{
			let angle = this.m_rotationRadPerSec * timeDelta;
			let eyeToAt = vec3.subtract(this.m_eye, this.m_at);
			let xzProjection = vec3.create(eyeToAt[0], 0, eyeToAt[2]);

			// Don't update the angle if it would make m_eye go beyond vertical
			if (vec3.angle(eyeToAt, xzProjection) + angle < Math.PI / 2 - 0.1)
			{
				let rotationAxis = vec3.cross(eyeToAt, this.m_up);
				let rotationMatrix = mat4.axisRotation(rotationAxis, angle);

				vec3.transformMat4(eyeToAt, rotationMatrix, eyeToAt);
				vec3.add(eyeToAt, this.m_at, this.m_eye);

				this.UpdateViewMatrix();
			}
		}
		else if (this.m_isRotatingDownward)
		{
			let angle = -1 * this.m_rotationRadPerSec * timeDelta;
			let eyeToAt = vec3.subtract(this.m_eye, this.m_at);
			let xzProjection = vec3.create(eyeToAt[0], 0, eyeToAt[2]);

			// Don't update the angle if it would make m_eye go below the xz-plane
			if (vec3.angle(eyeToAt, xzProjection) + angle > 0)
			{
				let rotationAxis = vec3.cross(eyeToAt, this.m_up);
				let rotationMatrix = mat4.axisRotation(rotationAxis, angle);

				vec3.transformMat4(eyeToAt, rotationMatrix, eyeToAt);
				vec3.add(eyeToAt, this.m_at, this.m_eye);

				this.UpdateViewMatrix();
			}
		}

		// If we are rotating right or left, we want to always keep m_at and m_up the same. We just
		// need to rotate m_eye vector around the y-axis that goes through m_at
		if (this.m_isRotatingRight)
		{
			let angle = this.m_rotationRadPerSec * timeDelta;
			let eyeToAt = vec3.subtract(this.m_eye, this.m_at);

			let rotationAxis = vec3.create(0, 1, 0);
			let rotationMatrix = mat4.axisRotation(rotationAxis, angle);

			vec3.transformMat4(eyeToAt, rotationMatrix, eyeToAt);
			vec3.add(eyeToAt, this.m_at, this.m_eye);

			this.UpdateViewMatrix();
		}
		else if (this.m_isRotatingLeft)
		{
			let angle = -1 * this.m_rotationRadPerSec * timeDelta;
			let eyeToAt = vec3.subtract(this.m_eye, this.m_at);

			let rotationAxis = vec3.create(0, 1, 0);
			let rotationMatrix = mat4.axisRotation(rotationAxis, angle);

			vec3.transformMat4(eyeToAt, rotationMatrix, eyeToAt);
			vec3.add(eyeToAt, this.m_at, this.m_eye);

			this.UpdateViewMatrix();
		}
	}

	private m_eye: Vec3;
	private m_at: Vec3;
	private m_up: Vec3;

	private m_speed: number = 2.5;
	private m_rotationRadPerSec: number = 0.5;
	private m_isMovingForward = false;
	private m_isMovingBackward = false;
	private m_isMovingRight = false;
	private m_isMovingLeft = false;
	private m_isRotatingUpward = false;
	private m_isRotatingDownward = false;
	private m_isRotatingRight = false;
	private m_isRotatingLeft = false;

	private m_viewMatrix: Mat4;
	private m_viewHasChanged = false;
}