import { vec3 } from 'wgpu-matrix';
import { HybridLookup, CallbackSet } from "../common/utils.js";
// NOTE: You could have another class called EmptyMesh that extends Mesh that could be useful
// for things like lights where we don't want them to be clickable or parttake in collisions.
// However, that would mean needing to add virtualization just for that purpose. Rather, we
// should be able to simply create a Mesh object with no vertices that behaves this way.
class Mesh {
    // empty class for now, but will be used to holds CPU-side vertex information
    // so we can do collision testing
    map = new HybridLookup();
}
class SceneObject {
    constructor(name, mesh) {
        this.m_name = name;
        this.m_mesh = mesh;
        this.m_position = vec3.create(0.0, 0.0, 0.0);
        this.m_rotationAxis = vec3.create(0.0, 1.0, 0.0);
        this.m_rotationAngle = 0.0;
        this.m_scaling = vec3.create(1.0, 1.0, 1.0);
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
    constructor(name, mesh) {
        super(name, mesh);
        this.m_strength = vec3.create(1.0, 1.0, 1.0);
        this.OnStrengthChanged = new CallbackSet();
    }
    GetStrength() { return this.m_strength; }
    SetStrength(strength) { this.m_strength = strength; this.OnStrengthChanged.Invoke(this); }
    OnStrengthChanged;
    m_strength;
}
class DirectionalLight extends Light {
    constructor(name) {
        super(name, new Mesh());
        this.m_direction = vec3.create(1.0, 0.0, 0.0);
        this.OnDirectionChanged = new CallbackSet();
    }
    GetDirection() { return this.m_direction; }
    SetDirection(direction) { this.m_direction = direction; this.OnDirectionChanged.Invoke(this); }
    OnDirectionChanged;
    m_direction;
}
class PointLight extends Light {
    constructor(name) {
        super(name, new Mesh());
        this.m_falloffStart = 0.0;
        this.m_falloffEnd = 1000.0;
        this.OnFalloffStartChanged = new CallbackSet();
        this.OnFalloffEndChanged = new CallbackSet();
    }
    GetFalloffStart() { return this.m_falloffStart; }
    GetFalloffEnd() { return this.m_falloffEnd; }
    SetFalloffStart(start) { this.m_falloffStart = start; this.OnFalloffStartChanged.Invoke(this); }
    SetFalloffEnd(end) { this.m_falloffEnd = end; this.OnFalloffEndChanged.Invoke(this); }
    OnFalloffStartChanged;
    OnFalloffEndChanged;
    m_falloffStart = 0;
    m_falloffEnd = 1000;
}
class SpotLight extends Light {
    constructor(name) {
        super(name, new Mesh());
        this.m_direction = vec3.create(1.0, 0.0, 0.0);
        this.m_falloffStart = 0.0;
        this.m_falloffEnd = 1000.0;
        this.m_spotPower = 1.0;
        this.OnDirectionChanged = new CallbackSet();
        this.OnFalloffStartChanged = new CallbackSet();
        this.OnFalloffEndChanged = new CallbackSet();
        this.OnSpotPowerChanged = new CallbackSet();
    }
    GetDirection() { return this.m_direction; }
    GetFalloffStart() { return this.m_falloffStart; }
    GetFalloffEnd() { return this.m_falloffEnd; }
    GetSpotPower() { return this.m_spotPower; }
    SetDirection(direction) { this.m_direction = direction; this.OnDirectionChanged.Invoke(this); }
    SetFalloffStart(start) { this.m_falloffStart = start; this.OnFalloffStartChanged.Invoke(this); }
    SetFalloffEnd(end) { this.m_falloffEnd = end; this.OnFalloffEndChanged.Invoke(this); }
    SetSpotPower(power) { this.m_spotPower = power; this.OnSpotPowerChanged.Invoke(this); }
    OnDirectionChanged;
    OnFalloffStartChanged;
    OnFalloffEndChanged;
    OnSpotPowerChanged;
    m_direction;
    m_falloffStart;
    m_falloffEnd;
    m_spotPower = 1;
}
function OnSceneItemClick(objectName) {
    console.log(`Clicked: ${objectName}`);
    let light = new SpotLight("dummy name");
    let tokenA = light.OnSpotPowerChanged.Register((l) => { console.log(`A: spot power = ${l.GetSpotPower()}`); });
    let tokenB = light.OnSpotPowerChanged.Register((l) => { console.log(`B: spot power = ${l.GetSpotPower()}`); });
    light.SetSpotPower(5);
    light.OnSpotPowerChanged.Revoke(tokenA);
    light.SetSpotPower(10);
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