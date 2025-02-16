import { LOG_INFO } from "./Log.js";
export class Application {
    constructor(renderer) {
        this.m_renderer = renderer;
        LOG_INFO("Application constructor");
    }
    async InitializeAsync() {
        LOG_INFO("Application InitializeAsync");
    }
    Update() {
    }
    Render() {
    }
    m_renderer;
}
//# sourceMappingURL=Application.js.map