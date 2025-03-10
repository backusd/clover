import { Mat4, Vec3, Vec4, mat4, vec3 } from 'wgpu-matrix';
import { LOG_INFO, LOG_TRACE, LOG_WARN, LOG_ERROR } from "./Log.js";


export class Camera
{
	constructor(eye: Vec3 = vec3.create(10, 10, 10), at: Vec3 = vec3.create(0, 0, 0), up: Vec3 = vec3.create(0, 1, 0))
	{
		this.m_eye = eye;
		this.m_at = at;
		this.m_up = up;

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
	public GetPosition(): Vec3 { return this.m_eye; }
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
	public IsMouseDragging(): boolean
	{
		return this.m_isMouseDragging;
	}
	public StopAllMovement(): void
	{
		this.m_isMovingForward = false;
		this.m_isMovingBackward = false;
		this.m_isMovingRight = false;
		this.m_isMovingLeft = false;
		this.m_isRotatingUpward = false;
		this.m_isRotatingDownward = false;
		this.m_isRotatingRight = false;
		this.m_isRotatingLeft = false;
	}
	public StartMovingForward(): void
	{
		if (!(this.m_isMovingBackward || this.IsRotating() || this.IsMouseDragging()))
			this.m_isMovingForward = true;
	}
	public StartMovingBackward(): void
	{
		if (!(this.m_isMovingForward || this.IsRotating() || this.IsMouseDragging()))
			this.m_isMovingBackward = true;
	}
	public StartMovingRight(): void
	{
		if (!(this.m_isMovingLeft || this.IsRotating() || this.IsMouseDragging()))
			this.m_isMovingRight = true;
	}
	public StartMovingLeft(): void
	{
		if (!(this.m_isMovingRight || this.IsRotating() || this.IsMouseDragging()))
			this.m_isMovingLeft = true;
	}
	public StartRotatingUpward(): void
	{
		if (!(this.m_isRotatingDownward || this.IsTranslating() || this.IsMouseDragging()))
			this.m_isRotatingUpward = true;
	}
	public StartRotatingDownward(): void
	{
		if (!(this.m_isRotatingUpward || this.IsTranslating() || this.IsMouseDragging()))
			this.m_isRotatingDownward = true;
	}
	public StartRotatingRight(): void
	{
		if (!(this.m_isRotatingLeft || this.IsTranslating() || this.IsMouseDragging()))
			this.m_isRotatingRight = true;
	}
	public StartRotatingLeft(): void
	{
		if (!(this.m_isRotatingRight || this.IsTranslating() || this.IsMouseDragging()))
			this.m_isRotatingLeft = true;
	}
	public StartMouseDragging(): void
	{
		this.StopAllMovement();
		this.m_isMouseDragging = true;
	}


	public StopMovingForward(): void { this.m_isMovingForward = false; }
	public StopMovingBackward(): void { this.m_isMovingBackward = false; }
	public StopMovingRight(): void { this.m_isMovingRight = false; }
	public StopMovingLeft(): void { this.m_isMovingLeft = false; }
	public StopRotatingUpward(): void { this.m_isRotatingUpward = false; }
	public StopRotatingDownward(): void { this.m_isRotatingDownward = false; }
	public StopRotatingRight(): void { this.m_isRotatingRight = false; }
	public StopRotatingLeft(): void { this.m_isRotatingLeft = false; }
	public StopMouseDragging(): void { this.m_isMouseDragging = false; }

	public RotateAroundYAxis(angle: number): void
	{
		let eyeToAt = vec3.subtract(this.m_eye, this.m_at);

		// Rotation axis is always the y-axis
		let rotationAxis = vec3.create(0, 1, 0);
		let rotationMatrix = mat4.axisRotation(rotationAxis, angle);

		vec3.transformMat4(eyeToAt, rotationMatrix, eyeToAt);
		vec3.add(eyeToAt, this.m_at, this.m_eye);

		this.UpdateViewMatrix();
	}
	public RotateVertically(angle: number): void
	{
		let eyeToAt = vec3.subtract(this.m_eye, this.m_at);
		let xzProjection = vec3.create(eyeToAt[0], 0, eyeToAt[2]);

		// If then angle is positive, don't update m_eye if it would make it go beyond vertical
		if (angle >= 0)
		{
			if (vec3.angle(eyeToAt, xzProjection) + angle > Math.PI / 2 - 0.1)
				return;
		}
		else
		{
			// Don't update the angle if it would make m_eye go below the xz-plane
			if (vec3.angle(eyeToAt, xzProjection) + angle <= 0)
				return;
		}

		let rotationAxis = vec3.cross(eyeToAt, this.m_up);
		let rotationMatrix = mat4.axisRotation(rotationAxis, angle);

		vec3.transformMat4(eyeToAt, rotationMatrix, eyeToAt);
		vec3.add(eyeToAt, this.m_at, this.m_eye);

		this.UpdateViewMatrix();
	}

	public MouseDrag(deltaX: number, deltaY: number): void
	{
		if (deltaX !== 0)
			this.RotateAroundYAxis(deltaX * -0.01);

		if (deltaY !== 0)
			this.RotateVertically(deltaY * 0.01);
	}

	public ZoomIn(): void
	{
		// Move m_eye towards m_at
		let eyeToAt = vec3.subtract(this.m_eye, this.m_at);
		let length = vec3.length(eyeToAt);

		// Don't zoom in closer than 0.5 units
		if (length > 0.5)
		{
			// Zoom in 10% closer
			let delta = vec3.scale(vec3.normalize(eyeToAt), length * 0.1);
			vec3.subtract(this.m_eye, delta, this.m_eye);

			this.UpdateViewMatrix();
		}		
	}
	public ZoomOut(): void
	{
		// Move m_eye towards m_at
		let eyeToAt = vec3.subtract(this.m_eye, this.m_at);
		let length = vec3.length(eyeToAt);

		// Zoom in 10% further
		let delta = vec3.scale(vec3.normalize(eyeToAt), length * 0.1);
		vec3.add(this.m_eye, delta, this.m_eye);

		this.UpdateViewMatrix();
	}

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
			this.RotateVertically(this.m_rotationRadPerSec * timeDelta);
		}
		else if (this.m_isRotatingDownward)
		{
			this.RotateVertically(-1 * this.m_rotationRadPerSec * timeDelta);
		}

		// If we are rotating right or left, we want to always keep m_at and m_up the same. We just
		// need to rotate m_eye vector around the y-axis that goes through m_at
		if (this.m_isRotatingRight)
		{
			this.RotateAroundYAxis(this.m_rotationRadPerSec * timeDelta);
		}
		else if (this.m_isRotatingLeft)
		{
			this.RotateAroundYAxis(-1 * this.m_rotationRadPerSec * timeDelta);
		}
	}

	private m_eye: Vec3;
	private m_at: Vec3;
	private m_up: Vec3;

	private m_speed: number = 2.5;
	private m_rotationRadPerSec: number = 1.0;
	private m_isMovingForward = false;
	private m_isMovingBackward = false;
	private m_isMovingRight = false;
	private m_isMovingLeft = false;
	private m_isRotatingUpward = false;
	private m_isRotatingDownward = false;
	private m_isRotatingRight = false;
	private m_isRotatingLeft = false;
	private m_isMouseDragging = false;

	private m_viewMatrix: Mat4;
	private m_viewHasChanged = false;
}