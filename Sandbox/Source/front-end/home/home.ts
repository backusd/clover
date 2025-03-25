import { vec3, Vec3 } from 'wgpu-matrix';
import { LOG_TRACE, LOG_INFO, LOG_WARN, LOG_ERROR } from "../common/log.js"
import { 
    HybridLookup, 
    CallbackSet,
    JSONToVec3
} from "../common/utils.js"


// NOTE: You could have another class called EmptyMesh that extends Mesh that could be useful
// for things like lights where we don't want them to be clickable or parttake in collisions.
// However, that would mean needing to add virtualization just for that purpose. Rather, we
// should be able to simply create a Mesh object with no vertices that behaves this way.
class Mesh
{
    // empty class for now, but will be used to holds CPU-side vertex information
    // so we can do collision testing

    public meshy: number = 99;

    public static fromJson(json: any): Mesh
    {
        return new Mesh();
    }
}


type SceneObjectCallback = (sceneObject: SceneObject) => void;
class SceneObject
{
    constructor(name: string, mesh: Mesh)
    {
        this.m_name = name;
        this.m_mesh = mesh;
        this.m_position = vec3.create(0.0, 0.0, 0.0);
        this.m_rotationAxis = vec3.create(0.0, 1.0, 0.0);
        this.m_rotationAngle = 0.0;
        this.m_scaling = vec3.create(1.0, 1.0, 1.0);

        this.OnNameChanged = new CallbackSet<SceneObjectCallback>();
        this.OnMeshChanged = new CallbackSet<SceneObjectCallback>();
        this.OnPositionChanged = new CallbackSet<SceneObjectCallback>();
        this.OnRotationChanged = new CallbackSet<SceneObjectCallback>();
        this.OnScalingChanged = new CallbackSet<SceneObjectCallback>();
    }

    public GetName(): string { return this.m_name; }
    public GetMesh(): Mesh { return this.m_mesh; }
    public GetPosition(): Vec3 { return this.m_position; }
    public GetRotationAxis(): Vec3 { return this.m_rotationAxis; }
    public GetRotationAngle(): number { return this.m_rotationAngle; }
    public GetScaling(): Vec3 { return this.m_scaling; }

    public SetName(name: string): void { this.m_name = name; this.OnNameChanged.Invoke(this); }
    public SetMesh(mesh: Mesh): void { this.m_mesh = mesh; this.OnMeshChanged.Invoke(this); }
    public SetPosition(position: Vec3): void { this.m_position = position; this.OnPositionChanged.Invoke(this); }
    public SetRotationAxis(axis: Vec3): void { this.m_rotationAxis = axis; this.OnRotationChanged.Invoke(this); }
    public SetRotationAngle(angle: number): void { this.m_rotationAngle = angle; this.OnRotationChanged.Invoke(this); }
    public SetScaling(scaling: Vec3): void { this.m_scaling = scaling; this.OnScalingChanged.Invoke(this); }

    public OnNameChanged: CallbackSet<SceneObjectCallback>;
    public OnMeshChanged: CallbackSet<SceneObjectCallback>;
    public OnPositionChanged: CallbackSet<SceneObjectCallback>;
    public OnRotationChanged: CallbackSet<SceneObjectCallback>;
    public OnScalingChanged: CallbackSet<SceneObjectCallback>;

    private m_name: string;
    private m_mesh: Mesh;   // Mesh to be used for picking/collision testing
	private m_position: Vec3;
	private m_rotationAxis: Vec3;
	private m_rotationAngle: number;
	private m_scaling: Vec3;
}
type LightCallback = (light: Light) => void;
class Light extends SceneObject
{
    constructor(name: string, mesh: Mesh)
    {
        super(name, mesh);
        this.m_strength = vec3.create(1.0, 1.0, 1.0);
        this.OnStrengthChanged = new CallbackSet<LightCallback>();
    }
    public GetStrength(): Vec3 { return this.m_strength; }
    public SetStrength(strength: Vec3): void { this.m_strength = strength; this.OnStrengthChanged.Invoke(this); }
    
    public OnStrengthChanged: CallbackSet<LightCallback>;
    private m_strength: Vec3;
}
type DirectionalLightCallback = (light: DirectionalLight) => void;
class DirectionalLight extends Light
{
    constructor(name: string)
    {
        super(name, new Mesh());
        this.m_direction = vec3.create(1.0, 0.0, 0.0);
        this.OnDirectionChanged = new CallbackSet<DirectionalLightCallback>();
    }
    public GetDirection(): Vec3 { return this.m_direction; }
    public SetDirection(direction: Vec3): void { this.m_direction = direction; this.OnDirectionChanged.Invoke(this); }
    
    public OnDirectionChanged: CallbackSet<DirectionalLightCallback>;
    private m_direction: Vec3;
}
type PointLightCallback = (light: PointLight) => void;
class PointLight extends Light
{
    constructor(name: string)
    {
        super(name, new Mesh());
        this.m_falloffStart = 0.0;
        this.m_falloffEnd = 1000.0;
        this.OnFalloffStartChanged = new CallbackSet<PointLightCallback>();
        this.OnFalloffEndChanged = new CallbackSet<PointLightCallback>();
    }
    public GetFalloffStart(): number { return this.m_falloffStart; }
    public GetFalloffEnd(): number { return this.m_falloffEnd; }
    public SetFalloffStart(start: number): void { this.m_falloffStart = start; this.OnFalloffStartChanged.Invoke(this); }
    public SetFalloffEnd(end: number): void { this.m_falloffEnd = end; this.OnFalloffEndChanged.Invoke(this); }

    public OnFalloffStartChanged: CallbackSet<PointLightCallback>;
    public OnFalloffEndChanged: CallbackSet<PointLightCallback>;

    private m_falloffStart: number = 0;
    private m_falloffEnd: number = 1000;
}
type SpotLightCallback = (light: SpotLight) => void;
class SpotLight extends Light
{
    constructor(name: string)
    {
        super(name, new Mesh());
        this.m_direction = vec3.create(1.0, 0.0, 0.0);
        this.m_falloffStart = 0.0;
        this.m_falloffEnd = 1000.0;
        this.m_spotPower = 1.0;
        this.OnDirectionChanged = new CallbackSet<SpotLightCallback>();
        this.OnFalloffStartChanged = new CallbackSet<SpotLightCallback>();
        this.OnFalloffEndChanged = new CallbackSet<SpotLightCallback>();
        this.OnSpotPowerChanged = new CallbackSet<SpotLightCallback>();
    }
    public GetDirection(): Vec3 { return this.m_direction; }
    public GetFalloffStart(): number { return this.m_falloffStart; }
    public GetFalloffEnd(): number { return this.m_falloffEnd; }
    public GetSpotPower(): number { return this.m_spotPower; }

    public SetDirection(direction: Vec3): void { this.m_direction = direction; this.OnDirectionChanged.Invoke(this); }
    public SetFalloffStart(start: number): void { this.m_falloffStart = start; this.OnFalloffStartChanged.Invoke(this); }
    public SetFalloffEnd(end: number): void { this.m_falloffEnd = end; this.OnFalloffEndChanged.Invoke(this); }
    public SetSpotPower(power: number): void { this.m_spotPower = power; this.OnSpotPowerChanged.Invoke(this); }
    
    public OnDirectionChanged: CallbackSet<SpotLightCallback>;
    public OnFalloffStartChanged: CallbackSet<SpotLightCallback>;
    public OnFalloffEndChanged: CallbackSet<SpotLightCallback>;
    public OnSpotPowerChanged: CallbackSet<SpotLightCallback>;

    private m_direction: Vec3;
    private m_falloffStart: number;
    private m_falloffEnd: number;
    private m_spotPower: number = 1;

    public toJSON(): any 
    {
        return { SpotLight: {
            name: this.GetName(),
            mesh: this.GetMesh(),
            position: this.GetPosition(),
            rotationAxis: this.GetRotationAxis(),
            rotationAngle: this.GetRotationAngle(),
            scaling: this.GetScaling(),
            direction: this.m_direction,
            falloffStart: this.m_falloffStart,
            falloffEnd: this.m_falloffEnd,
            spotPower: this.m_spotPower
        } };
    }
    public static fromJson(json: any): SpotLight
    {
        let name = json["name"];
        let spotlight = new SpotLight(name);
        spotlight.SetPosition(JSONToVec3(json.position));
        spotlight.SetRotationAxis(JSONToVec3(json["rotationAxis"]));
        spotlight.SetRotationAngle(json["rotationAngle"]);
        spotlight.SetScaling(JSONToVec3(json["scaling"]));
        spotlight.SetDirection(JSONToVec3(json["direction"]));
        spotlight.SetFalloffStart(json["falloffStart"]);
        spotlight.SetFalloffEnd(json["falloffEnd"]);
        spotlight.SetSpotPower(json["spotPower"]);
        return spotlight;
    }
}



function OnPos(obj: SceneObject): void
{
    console.log(`pos = ${obj.GetPosition()}`);
}

function OnSceneItemClick(objectName: string): void 
{
    console.log(`Clicked: ${objectName}`);

    let light: SpotLight = new SpotLight("dummy name");
    light.SetPosition(vec3.create(1, 2, 3));
    light.SetRotationAxis(vec3.create(1, 0, 0));
    light.SetFalloffStart(5);
    light.SetFalloffEnd(10);
    light.SetStrength(vec3.create(0.5, 0.4, 0.9));
    light.SetSpotPower(2);
    light.SetDirection(vec3.create(-1, 0, -1));
    light.OnPositionChanged.Register(OnPos);

    let str = JSON.stringify(light);
    console.log(str);

    let light2 = SpotLight.fromJson(JSON.parse(str).SpotLight);
    light2.OnPositionChanged.Register(OnPos);
    light2.SetPosition(vec3.create(11, 12, 13));
    console.log(JSON.stringify(light2));
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
