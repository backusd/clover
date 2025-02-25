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
    StartMovingForward() {
        if (!(this.m_isMovingBackward || this.IsRotating()))
            this.m_isMovingForward = true;
    }
    StartMovingBackward() {
        if (!(this.m_isMovingForward || this.IsRotating()))
            this.m_isMovingBackward = true;
    }
    StartMovingRight() {
        if (!(this.m_isMovingLeft || this.IsRotating()))
            this.m_isMovingRight = true;
    }
    StartMovingLeft() {
        if (!(this.m_isMovingRight || this.IsRotating()))
            this.m_isMovingLeft = true;
    }
    StartRotatingUpward() {
        if (!(this.m_isRotatingDownward || this.IsTranslating()))
            this.m_isRotatingUpward = true;
    }
    StartRotatingDownward() {
        if (!(this.m_isRotatingUpward || this.IsTranslating()))
            this.m_isRotatingDownward = true;
    }
    StartRotatingRight() {
        if (!(this.m_isRotatingLeft || this.IsTranslating()))
            this.m_isRotatingRight = true;
    }
    StartRotatingLeft() {
        if (!(this.m_isRotatingRight || this.IsTranslating()))
            this.m_isRotatingLeft = true;
    }
    StopMovingForward() { this.m_isMovingForward = false; }
    StopMovingBackward() { this.m_isMovingBackward = false; }
    StopMovingRight() { this.m_isMovingRight = false; }
    StopMovingLeft() { this.m_isMovingLeft = false; }
    StopRotatingUpward() { this.m_isRotatingUpward = false; }
    StopRotatingDownward() { this.m_isRotatingDownward = false; }
    StopRotatingRight() { this.m_isRotatingRight = false; }
    StopRotatingLeft() { this.m_isRotatingLeft = false; }
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
            let angle = this.m_rotationRadPerSec * timeDelta;
            let eyeToAt = vec3.subtract(this.m_eye, this.m_at);
            let xzProjection = vec3.create(eyeToAt[0], 0, eyeToAt[2]);
            // Don't update the angle if it would make m_eye go beyond vertical
            if (vec3.angle(eyeToAt, xzProjection) + angle < Math.PI / 2 - 0.1) {
                let rotationAxis = vec3.cross(eyeToAt, this.m_up);
                let rotationMatrix = mat4.axisRotation(rotationAxis, angle);
                vec3.transformMat4(eyeToAt, rotationMatrix, eyeToAt);
                vec3.add(eyeToAt, this.m_at, this.m_eye);
                this.UpdateViewMatrix();
            }
        }
        else if (this.m_isRotatingDownward) {
            let angle = -1 * this.m_rotationRadPerSec * timeDelta;
            let eyeToAt = vec3.subtract(this.m_eye, this.m_at);
            let xzProjection = vec3.create(eyeToAt[0], 0, eyeToAt[2]);
            // Don't update the angle if it would make m_eye go below the xz-plane
            if (vec3.angle(eyeToAt, xzProjection) + angle > 0) {
                let rotationAxis = vec3.cross(eyeToAt, this.m_up);
                let rotationMatrix = mat4.axisRotation(rotationAxis, angle);
                vec3.transformMat4(eyeToAt, rotationMatrix, eyeToAt);
                vec3.add(eyeToAt, this.m_at, this.m_eye);
                this.UpdateViewMatrix();
            }
        }
        // If we are rotating right or left, we want to always keep m_at and m_up the same. We just
        // need to rotate m_eye vector around the y-axis that goes through m_at
        if (this.m_isRotatingRight) {
            let angle = this.m_rotationRadPerSec * timeDelta;
            let eyeToAt = vec3.subtract(this.m_eye, this.m_at);
            let rotationAxis = vec3.create(0, 1, 0);
            let rotationMatrix = mat4.axisRotation(rotationAxis, angle);
            vec3.transformMat4(eyeToAt, rotationMatrix, eyeToAt);
            vec3.add(eyeToAt, this.m_at, this.m_eye);
            this.UpdateViewMatrix();
        }
        else if (this.m_isRotatingLeft) {
            let angle = -1 * this.m_rotationRadPerSec * timeDelta;
            let eyeToAt = vec3.subtract(this.m_eye, this.m_at);
            let rotationAxis = vec3.create(0, 1, 0);
            let rotationMatrix = mat4.axisRotation(rotationAxis, angle);
            vec3.transformMat4(eyeToAt, rotationMatrix, eyeToAt);
            vec3.add(eyeToAt, this.m_at, this.m_eye);
            this.UpdateViewMatrix();
        }
    }
    m_eye;
    m_at;
    m_up;
    m_speed = 2.5;
    m_rotationRadPerSec = 0.5;
    m_isMovingForward = false;
    m_isMovingBackward = false;
    m_isMovingRight = false;
    m_isMovingLeft = false;
    m_isRotatingUpward = false;
    m_isRotatingDownward = false;
    m_isRotatingRight = false;
    m_isRotatingLeft = false;
    m_viewMatrix;
    m_viewHasChanged = false;
}
//# sourceMappingURL=Camera.js.map