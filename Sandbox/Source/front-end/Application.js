import { LOG_TRACE } from "./Log.js";
export class Application {
    constructor(renderer, canvas) {
        this.m_renderer = renderer;
        this.m_canvas = canvas;
        this.SetupInputCallbacks();
    }
    SetupInputCallbacks() {
        window.addEventListener('keydown', (e) => this.OnKeyDown(e));
        window.addEventListener('keyup', (e) => this.OnKeyUp(e));
        this.m_canvas.style.touchAction = 'pinch-zoom';
        this.m_canvas.addEventListener('pointerdown', (e) => {
            //e.button describes the mouse button that was clicked
            // 0 is left, 1 is middle, 2 is right
            if (e.button === 0)
                this.OnLButtonDown(e);
            else if (e.button === 1)
                this.OnMButtonDown(e);
            else if (e.button === 2)
                this.OnRButtonDown(e);
        });
        this.m_canvas.addEventListener('pointerup', (e) => {
            // e.button describes the mouse button that was clicked
            // 0 is left, 1 is middle, 2 is right
            if (e.button === 0)
                this.OnLButtonUp(e);
            else if (e.button === 1)
                this.OnMButtonUp(e);
            else if (e.button === 2)
                this.OnRButtonUp(e);
        });
        this.m_canvas.addEventListener('pointermove', (e) => this.OnPointerMove(e));
        this.m_canvas.addEventListener('wheel', (e) => this.OnWheel(e));
    }
    OnKeyDown(e) {
        LOG_TRACE(`OnKeyDown: ${e.code}`);
        let handled = true;
        switch (e.code) {
            case 'KeyW': break;
            case 'KeyS': break;
            case 'KeyA': break;
            case 'KeyD': break;
            case 'Space': break;
            case 'ShiftLeft':
            case 'ControlLeft':
            case 'KeyC':
                break;
            default:
                handled = false;
                break;
        }
        if (handled) {
            e.preventDefault();
            e.stopPropagation();
        }
    }
    OnKeyUp(e) {
        LOG_TRACE(`OnKeyUp: ${e.code}`);
        let handled = true;
        switch (e.code) {
            case 'KeyW': break;
            case 'KeyS': break;
            case 'KeyA': break;
            case 'KeyD': break;
            case 'Space': break;
            case 'ShiftLeft':
            case 'ControlLeft':
            case 'KeyC':
                break;
            default:
                handled = false;
                break;
        }
        if (handled) {
            e.preventDefault();
            e.stopPropagation();
        }
    }
    OnLButtonDown(e) {
        LOG_TRACE("OnLButtonDown");
    }
    OnMButtonDown(e) {
        LOG_TRACE("OnMButtonDown");
    }
    OnRButtonDown(e) {
        LOG_TRACE("OnRButtonDown");
    }
    OnLButtonUp(e) {
        LOG_TRACE("OnLButtonUp");
    }
    OnMButtonUp(e) {
        LOG_TRACE("OnMButtonUp");
    }
    OnRButtonUp(e) {
        LOG_TRACE("OnRButtonUp");
    }
    OnPointerMove(e) {
        LOG_TRACE(`OnPointerMove: (${e.movementX}, ${e.movementY})`);
    }
    OnWheel(e) {
        LOG_TRACE(`OnWheel: ${e.deltaX}, ${e.deltaY} (${e.deltaMode})`);
        e.preventDefault();
        e.stopPropagation();
    }
    async InitializeAsync() {
    }
    Update() {
    }
    Render() {
    }
    m_renderer;
    m_canvas;
}
//# sourceMappingURL=Application.js.map