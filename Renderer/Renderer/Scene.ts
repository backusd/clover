import { LOG_INFO, LOG_TRACE, LOG_WARN, LOG_ERROR } from "./Log.js";
import
{
	Mesh,
	MeshGroup,
	BindGroup,
	RenderPassLayer,
	RenderPassDescriptor,
	RenderPass,
	Renderer
} from "./Renderer.js";
import { Camera } from "./Camera.js";
import { HybridLookup } from "./Utils.js"
import { Mat4, Vec3, Vec4, mat4, vec3 } from 'wgpu-matrix';



export abstract class GameObject
{
	constructor(name: string, renderer: Renderer)
	{
		this.m_name = name;
		this.m_renderer = renderer;
		this.m_subObjects = new HybridLookup<GameObject>();
	}
	public abstract Update(timeDelta: number): void;
	public Name(): string { return this.m_name; }

	protected m_name: string;
	protected m_renderer: Renderer;
	protected m_subObjects: HybridLookup<GameObject>;
}

export class GameCube extends GameObject
{
	constructor(name: string, renderer: Renderer)
	{
		super(name, renderer);
	}
	public Update(timeDelta: number): void
	{

	}

	private m_position: Vec3;
	private m_rotation: Vec3;
	private m_scale: Vec3;
	private m_modelMatrix: Mat4;
//	private m_renderItem: RenderItem;
}

export class Scene
{
	constructor()
	{
		this.m_camera = new Camera();
		this.m_gameObjects = new HybridLookup<GameObject>();
	}
	public Update(timeDelta: number): void
	{
		// Update the Camera
		this.m_camera.Update(timeDelta);

		// Update the game objects
		let numObjects = this.m_gameObjects.size();
		for (let iii = 0; iii < numObjects; ++iii)
			this.m_gameObjects.getFromIndex(iii).Update(timeDelta);
	}
	public GetCamera(): Camera { return this.m_camera; }


	private m_camera: Camera;
	private m_gameObjects: HybridLookup<GameObject>;
}