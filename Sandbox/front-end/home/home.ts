import { vec3, Vec3 } from 'wgpu-matrix';
import { HybridLookup } from "../common/common.js"

class Mesh
{
    // empty class for now, but will be used to holds CPU-side vertex information
    // so we can do collision testing

    public map: HybridLookup<string> = new HybridLookup<string>();
}

class SceneObject
{
    constructor(name: string, mesh: Mesh, position: Vec3 = vec3.create(0, 0, 0),
        rotationAxis: Vec3 = vec3.create(0, 0, 0), rotationAngle: number = 0,
        scaling: Vec3 = vec3.create(1, 1, 1),
        OnNameChangedCallback: (sceneObject: SceneObject) => void = (sceneObject: SceneObject) => {},
        OnMeshChangedCallback: (sceneObject: SceneObject) => void = (sceneObject: SceneObject) => {},
        OnPositionChangedCallback: (sceneObject: SceneObject) => void = (sceneObject: SceneObject) => {},
        OnRotationChangedCallback: (sceneObject: SceneObject) => void = (sceneObject: SceneObject) => {},
        OnScalingChangedCallback: (sceneObject: SceneObject) => void = (sceneObject: SceneObject) => {})
    {
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

    public GetName(): string { return this.m_name; }
    public GetMesh(): Mesh { return this.m_mesh; }
    public GetPosition(): Vec3 { return this.m_position; }
    public GetRotationAxis(): Vec3 { return this.m_rotationAxis; }
    public GetRotationAngle(): number { return this.m_rotationAngle; }
    public GetScaling(): Vec3 { return this.m_scaling; }

    public SetName(name: string): void { this.m_name = name; this.OnNameChanged(this); }
    public SetMesh(mesh: Mesh): void { this.m_mesh = mesh; this.OnMeshChanged(this); }
    public SetPosition(position: Vec3): void { this.m_position = position; this.OnPositionChanged(this); }
    public SetRotationAxis(axis: Vec3): void { this.m_rotationAxis = axis; this.OnRotationChanged(this); }
    public SetRotationAngle(angle: number): void { this.m_rotationAngle = angle; this.OnRotationChanged(this); }
    public SetScaling(scaling: Vec3): void { this.m_scaling = scaling; this.OnScalingChanged(this); }

    public OnNameChanged: (sceneObject: SceneObject) => void;
    public OnMeshChanged: (sceneObject: SceneObject) => void;
    public OnPositionChanged: (sceneObject: SceneObject) => void;
    public OnRotationChanged: (sceneObject: SceneObject) => void;
    public OnScalingChanged: (sceneObject: SceneObject) => void;

    private m_name: string;
    private m_mesh: Mesh;   // Mesh to be used for picking/collision testing
	private m_position: Vec3;
	private m_rotationAxis: Vec3;
	private m_rotationAngle: number;
	private m_scaling: Vec3;
}
class Light extends SceneObject
{
    public strength: Vec3;
}
class DirectionalLight extends Light
{
    public direction: Vec3;
}
class PointLight extends Light
{
    public position: Vec3;
    public falloffStart: number = 0;
    public falloffEnd: number = 1000;
}
class SpotLight extends Light
{
    public position: Vec3;
    public direction: Vec3;
    public falloffStart: number = 0;
    public falloffEnd: number = 1000;
    public spotPower: number = 1;
}



function OnSceneItemClick(objectName: string): void 
{
    console.log(`Clicked: ${objectName}`);

    let light: Light = new Light("dummy name", new Mesh());
    light.strength = vec3.create(1, 2, 3);
    console.log(`Light   : ${light}`);
    console.log(`Strength: ${light.strength}`);
}

function ThrowIfNotDiv(elem: Element | null, errorMessage: string): HTMLDivElement {
    if (elem === null)
    {
        throw Error(errorMessage);
    }
    if (!(elem instanceof HTMLDivElement))
    {
        throw Error(errorMessage);
    }
    return elem;
}
function ThrowIfNotParagraph(elem: Element | null, errorMessage: string): HTMLParagraphElement {
    if (elem === null)
    {
        throw Error(errorMessage);
    }
    if (!(elem instanceof HTMLParagraphElement))
    {
        throw Error(errorMessage);
    }
    return elem;
}

// ===========================================================================================================
// Expandable Functionality
//   * Add a callback for every expandable element so that it can respond to opening and closing by clicking
// ===========================================================================================================
let titleBars = document.getElementsByClassName("expandable_title-bar")
for (let iii = 0; iii < titleBars.length; ++iii)
{
    let titleBar = ThrowIfNotDiv(titleBars[iii], `Invalid use of class '.expandable_title-bar' - it is meant to be on a div element`);
    titleBar.addEventListener("click", (ev: MouseEvent) => {

        // For this list item, we need to do 2 things: 1) toggle the open/close state on the whole
        // item to hide/reveal the content and 2) if the item is now open, then set we make the
        // title bar 'selected'
        let clickedListItem = ThrowIfNotDiv(titleBar.closest(".expandable_list-item"), `Invalid structuring of div with class 'expandable_title-bar' - calling 'closest(".expandable_list-item")' did not return a valid div`);
        if (clickedListItem.classList.toggle("expandable_is-open"))
        {
            titleBar.classList.add("scene-item-title-bar-selected");

            // Now, go through all items in the list to unselect all other items
            let expandableList = ThrowIfNotDiv(titleBar.closest(".expandable_list"), `Invalid structuring of div with class 'expandable_title-bar' - calling 'closest(".expandable_list")' did not return a valid div`);
            for (let iii = 0; iii < expandableList.children.length; ++iii)
            {
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
