import { vec3 } from 'wgpu-matrix';
import { HybridLookup, CallbackSet } from "../common/utils.js";
class Mesh {
    // empty class for now, but will be used to holds CPU-side vertex information
    // so we can do collision testing
    map = new HybridLookup();
}
class SceneObject {
    constructor(name, mesh, position = vec3.create(0, 0, 0), rotationAxis = vec3.create(0, 0, 0), rotationAngle = 0, scaling = vec3.create(1, 1, 1)) {
        this.m_name = name;
        this.m_mesh = mesh;
        this.m_position = position;
        this.m_rotationAxis = rotationAxis;
        this.m_rotationAngle = rotationAngle;
        this.m_scaling = scaling;
        this.OnNameChanged = new CallbackSet();
        this.OnMeshChanged = new CallbackSet();
        this.OnPositionChanged = new CallbackSet();
        this.OnRotationChanged = new CallbackSet();
        this.OnScalingChanged = new CallbackSet();
    }
    GetName() { return this.m_name; }
    GetMesh() { return this.m_mesh; }
    GetPosition() { return this.m_position; }
    GetRotationAxis() { return this.m_rotationAxis; }
    GetRotationAngle() { return this.m_rotationAngle; }
    GetScaling() { return this.m_scaling; }
    SetName(name) { this.m_name = name; this.OnNameChanged.Invoke(this); }
    SetMesh(mesh) { this.m_mesh = mesh; this.OnMeshChanged.Invoke(this); }
    SetPosition(position) { this.m_position = position; this.OnPositionChanged.Invoke(this); }
    SetRotationAxis(axis) { this.m_rotationAxis = axis; this.OnRotationChanged.Invoke(this); }
    SetRotationAngle(angle) { this.m_rotationAngle = angle; this.OnRotationChanged.Invoke(this); }
    SetScaling(scaling) { this.m_scaling = scaling; this.OnScalingChanged.Invoke(this); }
    OnNameChanged;
    OnMeshChanged;
    OnPositionChanged;
    OnRotationChanged;
    OnScalingChanged;
    m_name;
    m_mesh; // Mesh to be used for picking/collision testing
    m_position;
    m_rotationAxis;
    m_rotationAngle;
    m_scaling;
}
class Light extends SceneObject {
    constructor(name, mesh, strength = vec3.create(1.0, 1.0, 1.0), position = vec3.create(0, 0, 0), rotationAxis = vec3.create(0, 0, 0), rotationAngle = 0, scaling = vec3.create(1, 1, 1)) {
        super(name, mesh, position, rotationAxis, rotationAngle, scaling);
        this.m_strength = strength;
        this.OnStrengthChanged = new CallbackSet();
    }
    GetStrength() { return this.m_strength; }
    SetStrength(strength) { this.m_strength = strength; this.OnStrengthChanged.Invoke(this); }
    OnStrengthChanged;
    m_strength;
}
class DirectionalLight extends Light {
    constructor(name, mesh, strength = vec3.create(1.0, 1.0, 1.0), direction = vec3.create(1.0, 0.0, 0.0), position = vec3.create(0, 0, 0), rotationAxis = vec3.create(0, 0, 0), rotationAngle = 0, scaling = vec3.create(1, 1, 1)) {
        super(name, mesh, strength, position, rotationAxis, rotationAngle, scaling);
        this.m_direction = direction;
        this.OnDirectionChanged = new CallbackSet();
    }
    GetDirection() { return this.m_direction; }
    SetDirection(direction) { this.m_direction = direction; this.OnDirectionChanged.Invoke(this); }
    OnDirectionChanged;
    m_direction;
}
class PointLight extends Light {
    position;
    falloffStart = 0;
    falloffEnd = 1000;
}
class SpotLight extends Light {
    position;
    direction;
    falloffStart = 0;
    falloffEnd = 1000;
    spotPower = 1;
}
function OnSceneItemClick(objectName) {
    console.log(`Clicked: ${objectName}`);
    let light = new DirectionalLight("dummy name", new Mesh());
    let tokenA = light.OnDirectionChanged.Register((l) => { console.log(`A: dir = ${l.GetDirection()}`); });
    let tokenB = light.OnDirectionChanged.Register((l) => { console.log(`B: dir = ${l.GetDirection()}`); });
    light.SetDirection(vec3.create(1, 2, 3));
    light.OnDirectionChanged.Revoke(tokenA);
    light.SetDirection(vec3.create(4, 5, 6));
}
function ThrowIfNotDiv(elem, errorMessage) {
    if (elem === null) {
        throw Error(errorMessage);
    }
    if (!(elem instanceof HTMLDivElement)) {
        throw Error(errorMessage);
    }
    return elem;
}
function ThrowIfNotParagraph(elem, errorMessage) {
    if (elem === null) {
        throw Error(errorMessage);
    }
    if (!(elem instanceof HTMLParagraphElement)) {
        throw Error(errorMessage);
    }
    return elem;
}
// ===========================================================================================================
// Expandable Functionality
//   * Add a callback for every expandable element so that it can respond to opening and closing by clicking
// ===========================================================================================================
let titleBars = document.getElementsByClassName("expandable_title-bar");
for (let iii = 0; iii < titleBars.length; ++iii) {
    let titleBar = ThrowIfNotDiv(titleBars[iii], `Invalid use of class '.expandable_title-bar' - it is meant to be on a div element`);
    titleBar.addEventListener("click", (ev) => {
        // For this list item, we need to do 2 things: 1) toggle the open/close state on the whole
        // item to hide/reveal the content and 2) if the item is now open, then set we make the
        // title bar 'selected'
        let clickedListItem = ThrowIfNotDiv(titleBar.closest(".expandable_list-item"), `Invalid structuring of div with class 'expandable_title-bar' - calling 'closest(".expandable_list-item")' did not return a valid div`);
        if (clickedListItem.classList.toggle("expandable_is-open")) {
            titleBar.classList.add("scene-item-title-bar-selected");
            // Now, go through all items in the list to unselect all other items
            let expandableList = ThrowIfNotDiv(titleBar.closest(".expandable_list"), `Invalid structuring of div with class 'expandable_title-bar' - calling 'closest(".expandable_list")' did not return a valid div`);
            for (let iii = 0; iii < expandableList.children.length; ++iii) {
                let listItem = ThrowIfNotDiv(expandableList.children[iii], `Invalid structuring of 'expandable_list' - all of the children must be div elements`);
                // Skip the item that was clicked
                if (listItem === clickedListItem)
                    continue;
                // Make sure the item is unselected
                let listItemTitleBar = ThrowIfNotDiv(listItem.children[0], `Invalid structuring of 'expandable_list' - each item must have a first child that is a div representing the title bar`);
                listItemTitleBar.classList.remove("scene-item-title-bar-selected");
            }
            // Now trigger OnSceneItemClick for this item
            let title = ThrowIfNotParagraph(titleBar.querySelector('.scene-item-title'), "Invalid structuring of 'scene-item-title-bar' - expected to have a child with class 'scene-item-title'");
            if (title.textContent !== null)
                OnSceneItemClick(title.textContent);
        }
    });
}
//# sourceMappingURL=home.js.map