import { mat4, vec3 } from 'wgpu-matrix';
export class Camera {
    constructor() {
        this.m_eye = vec3.create(0, 2, 10);
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
    IsMoving() {
        return this.m_isMovingForward || this.m_isMovingBackward ||
            this.m_isMovingRight || this.m_isMovingLeft ||
            this.m_isRotatingUpward || this.m_isRotatingDownward ||
            this.m_isRotatingRight || this.m_isRotatingLeft;
    }
    IsTranslating() {
        return this.m_isMovingForward || this.m_isMovingBackward ||
            this.m_isMovingRight || this.m_isMovingLeft;
    }
    IsRotating() {
        return this.m_isRotatingUpward || this.m_isRotatingDownward ||
            this.m_isRotatingRight || this.m_isRotatingLeft;
    }
    IsMouseDragging() {
        return this.m_isMouseDragging;
    }
    StopAllMovement() {
        this.m_isMovingForward = false;
        this.m_isMovingBackward = false;
        this.m_isMovingRight = false;
        this.m_isMovingLeft = false;
        this.m_isRotatingUpward = false;
        this.m_isRotatingDownward = false;
        this.m_isRotatingRight = false;
        this.m_isRotatingLeft = false;
    }
    StartMovingForward() {
        if (!(this.m_isMovingBackward || this.IsRotating() || this.IsMouseDragging()))
            this.m_isMovingForward = true;
    }
    StartMovingBackward() {
        if (!(this.m_isMovingForward || this.IsRotating() || this.IsMouseDragging()))
            this.m_isMovingBackward = true;
    }
    StartMovingRight() {
        if (!(this.m_isMovingLeft || this.IsRotating() || this.IsMouseDragging()))
            this.m_isMovingRight = true;
    }
    StartMovingLeft() {
        if (!(this.m_isMovingRight || this.IsRotating() || this.IsMouseDragging()))
            this.m_isMovingLeft = true;
    }
    StartRotatingUpward() {
        if (!(this.m_isRotatingDownward || this.IsTranslating() || this.IsMouseDragging()))
            this.m_isRotatingUpward = true;
    }
    StartRotatingDownward() {
        if (!(this.m_isRotatingUpward || this.IsTranslating() || this.IsMouseDragging()))
            this.m_isRotatingDownward = true;
    }
    StartRotatingRight() {
        if (!(this.m_isRotatingLeft || this.IsTranslating() || this.IsMouseDragging()))
            this.m_isRotatingRight = true;
    }
    StartRotatingLeft() {
        if (!(this.m_isRotatingRight || this.IsTranslating() || this.IsMouseDragging()))
            this.m_isRotatingLeft = true;
    }
    StartMouseDragging() {
        this.StopAllMovement();
        this.m_isMouseDragging = true;
    }
    StopMovingForward() { this.m_isMovingForward = false; }
    StopMovingBackward() { this.m_isMovingBackward = false; }
    StopMovingRight() { this.m_isMovingRight = false; }
    StopMovingLeft() { this.m_isMovingLeft = false; }
    StopRotatingUpward() { this.m_isRotatingUpward = false; }
    StopRotatingDownward() { this.m_isRotatingDownward = false; }
    StopRotatingRight() { this.m_isRotatingRight = false; }
    StopRotatingLeft() { this.m_isRotatingLeft = false; }
    StopMouseDragging() { this.m_isMouseDragging = false; }
    RotateAroundYAxis(angle) {
        let eyeToAt = vec3.subtract(this.m_eye, this.m_at);
        // Rotation axis is always the y-axis
        let rotationAxis = vec3.create(0, 1, 0);
        let rotationMatrix = mat4.axisRotation(rotationAxis, angle);
        vec3.transformMat4(eyeToAt, rotationMatrix, eyeToAt);
        vec3.add(eyeToAt, this.m_at, this.m_eye);
        this.UpdateViewMatrix();
    }
    RotateVertically(angle) {
        let eyeToAt = vec3.subtract(this.m_eye, this.m_at);
        let xzProjection = vec3.create(eyeToAt[0], 0, eyeToAt[2]);
        // If then angle is positive, don't update m_eye if it would make it go beyond vertical
        if (angle >= 0) {
            if (vec3.angle(eyeToAt, xzProjection) + angle > Math.PI / 2 - 0.1)
                return;
        }
        else {
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
    MouseDrag(deltaX, deltaY) {
        if (deltaX !== 0)
            this.RotateAroundYAxis(deltaX * -0.01);
        if (deltaY !== 0)
            this.RotateVertically(deltaY * 0.01);
    }
    ZoomIn() {
        // Move m_eye towards m_at
        let eyeToAt = vec3.subtract(this.m_eye, this.m_at);
        let length = vec3.length(eyeToAt);
        // Don't zoom in closer than 0.5 units
        if (length > 0.5) {
            // Zoom in 10% closer
            let delta = vec3.scale(vec3.normalize(eyeToAt), length * 0.1);
            vec3.subtract(this.m_eye, delta, this.m_eye);
            this.UpdateViewMatrix();
        }
    }
    ZoomOut() {
        // Move m_eye towards m_at
        let eyeToAt = vec3.subtract(this.m_eye, this.m_at);
        let length = vec3.length(eyeToAt);
        // Zoom in 10% further
        let delta = vec3.scale(vec3.normalize(eyeToAt), length * 0.1);
        vec3.add(this.m_eye, delta, this.m_eye);
        this.UpdateViewMatrix();
    }
    Update(timeDelta) {
        // If we are moving forward or backward, we want to always keep m_at somewhere on the xz-plane
        // and we always keep m_up at (0, 1, 0). So we just need to progress the x & z values of m_eye
        // and m_at
        if (this.m_isMovingForward) {
            let direction = vec3.normalize(vec3.subtract(this.m_at, this.m_eye));
            let delta = vec3.create(direction[0] * this.m_speed * timeDelta, 0, direction[2] * this.m_speed * timeDelta);
            vec3.add(this.m_eye, delta, this.m_eye);
            vec3.add(this.m_at, delta, this.m_at);
            this.UpdateViewMatrix();
        }
        else if (this.m_isMovingBackward) {
            let direction = vec3.normalize(vec3.subtract(this.m_eye, this.m_at));
            let delta = vec3.create(direction[0] * this.m_speed * timeDelta, 0, direction[2] * this.m_speed * timeDelta);
            vec3.add(this.m_eye, delta, this.m_eye);
            vec3.add(this.m_at, delta, this.m_at);
            this.UpdateViewMatrix();
        }
        // If we are moving left or right, we want to always keep m_at somewhere on the xz-plane
        // and we always keep m_up at (0, 1, 0). So we just need to progress the x & z values of m_eye
        // and m_at
        if (this.m_isMovingLeft) {
            let direction = vec3.normalize(vec3.cross(vec3.subtract(this.m_eye, this.m_at), this.m_up));
            let delta = vec3.create(direction[0] * this.m_speed * timeDelta, 0, direction[2] * this.m_speed * timeDelta);
            vec3.add(this.m_eye, delta, this.m_eye);
            vec3.add(this.m_at, delta, this.m_at);
            this.UpdateViewMatrix();
        }
        else if (this.m_isMovingRight) {
            let direction = vec3.normalize(vec3.cross(this.m_up, vec3.subtract(this.m_eye, this.m_at)));
            let delta = vec3.create(direction[0] * this.m_speed * timeDelta, 0, direction[2] * this.m_speed * timeDelta);
            vec3.add(this.m_eye, delta, this.m_eye);
            vec3.add(this.m_at, delta, this.m_at);
            this.UpdateViewMatrix();
        }
        // If we are rotating up or down, we want to always keep m_at and m_up the same. We just
        // need to move the m_eye vector along the arc of a circle so it keeps the same distance to m_at
        if (this.m_isRotatingUpward) {
            this.RotateVertically(this.m_rotationRadPerSec * timeDelta);
        }
        else if (this.m_isRotatingDownward) {
            this.RotateVertically(-1 * this.m_rotationRadPerSec * timeDelta);
        }
        // If we are rotating right or left, we want to always keep m_at and m_up the same. We just
        // need to rotate m_eye vector around the y-axis that goes through m_at
        if (this.m_isRotatingRight) {
            this.RotateAroundYAxis(this.m_rotationRadPerSec * timeDelta);
        }
        else if (this.m_isRotatingLeft) {
            this.RotateAroundYAxis(-1 * this.m_rotationRadPerSec * timeDelta);
        }
    }
    m_eye;
    m_at;
    m_up;
    m_speed = 2.5;
    m_rotationRadPerSec = 1.0;
    m_isMovingForward = false;
    m_isMovingBackward = false;
    m_isMovingRight = false;
    m_isMovingLeft = false;
    m_isRotatingUpward = false;
    m_isRotatingDownward = false;
    m_isRotatingRight = false;
    m_isRotatingLeft = false;
    m_isMouseDragging = false;
    m_viewMatrix;
    m_viewHasChanged = false;
}
//# sourceMappingURL=Camera.js.map