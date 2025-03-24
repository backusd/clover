import { vec3 } from 'wgpu-matrix';
import { HybridLookup } from "../common/common.js";
class Mesh {
    // empty class for now, but will be used to holds CPU-side vertex information
    // so we can do collision testing
    map = new HybridLookup();
}
class SceneObject {
    constructor(name, mesh, position = vec3.create(0, 0, 0), rotationAxis = vec3.create(0, 0, 0), rotationAngle = 0, scaling = vec3.create(1, 1, 1), OnNameChangedCallback = (sceneObject) => { }, OnMeshChangedCallback = (sceneObject) => { }, OnPositionChangedCallback = (sceneObject) => { }, OnRotationChangedCallback = (sceneObject) => { }, OnScalingChangedCallback = (sceneObject) => { }) {
        this.m_name = name;
        this.m_mesh = mesh;
        this.m_position = position;
        this.m_rotationAxis = rotationAxis;
        this.m_rotationAngle = rotationAngle;
        this.m_scaling = scaling;
        this.OnNameChanged = OnNameChangedCallback;
        this.OnMeshChanged = OnMeshChangedCallback;
        this.OnPositionChanged = OnPositionChangedCallback;
        this.OnRotationChanged = OnRotationChangedCallback;
        this.OnScalingChanged = OnScalingChangedCallback;
        // We will stick to the convention that these callbacks should be called at initialization
        // because technically all these values have been set and therefore some callbacks may need
        // to be called. If the calling code does NOT wish to have these called, then you can 
        // manually set each callback OUTSIDE of the constructor because the callbacks are public.
        this.OnNameChanged(this);
        this.OnMeshChanged(this);
        this.OnPositionChanged(this);
        this.OnRotationChanged(this);
        this.OnScalingChanged(this);
    }
    GetName() { return this.m_name; }
    GetMesh() { return this.m_mesh; }
    GetPosition() { return this.m_position; }
    GetRotationAxis() { return this.m_rotationAxis; }
    GetRotationAngle() { return this.m_rotationAngle; }
    GetScaling() { return this.m_scaling; }
    SetName(name) { this.m_name = name; this.OnNameChanged(this); }
    SetMesh(mesh) { this.m_mesh = mesh; this.OnMeshChanged(this); }
    SetPosition(position) { this.m_position = position; this.OnPositionChanged(this); }
    SetRotationAxis(axis) { this.m_rotationAxis = axis; this.OnRotationChanged(this); }
    SetRotationAngle(angle) { this.m_rotationAngle = angle; this.OnRotationChanged(this); }
    SetScaling(scaling) { this.m_scaling = scaling; this.OnScalingChanged(this); }
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
    strength;
}
class DirectionalLight extends Light {
    direction;
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
    let light = new Light("dummy name", new Mesh());
    light.strength = vec3.create(1, 2, 3);
    console.log(`Light   : ${light}`);
    console.log(`Strength: ${light.strength}`);
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