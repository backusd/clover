import { LOG_INFO, LOG_TRACE, LOG_WARN, LOG_ERROR } from "./Log.js";
import
{
	RenderItem,
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
	public ModelMatrix(): Mat4
	{
		let model = mat4.translation(this.m_position);
		let rotationX = mat4.rotationX(this.m_rotation[0]);
		let rotationY = mat4.rotationY(this.m_rotation[1]);
		let rotationZ = mat4.rotationZ(this.m_rotation[2]);
		let scaling = mat4.scaling(this.m_scaling);

		mat4.multiply(model, rotationX, model);
		mat4.multiply(model, rotationY, model);
		mat4.multiply(model, rotationZ, model);
		mat4.multiply(model, scaling, model);

		return model;
	}

	protected m_name: string;
	protected m_renderer: Renderer;
	protected m_subObjects: HybridLookup<GameObject>;

	protected m_position = vec3.create(0, 0, 0);
	protected m_rotation = vec3.create(0, 0, 0);
	protected m_scaling = vec3.create(1, 1, 1);
}

export class GameCube extends GameObject
{
	constructor(name: string, renderer: Renderer)
	{
		super(name, renderer);

		let layer = renderer.GetRenderPass("rp_main").GetRenderPassLayer("rpl_texture-cube");
		this.m_renderItem = layer.CreateRenderItem("ri_game-cube", "mg_texture-cube", "mesh_texture-cube");
	}
	public Update(timeDelta: number): void
	{
	//	... make the cube spin ... this is going to require changes to the shader
	//		don't forget to use @group(2) for RenderItem bindings'
	}

	private m_renderItem: RenderItem;
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
	public AddGameObject(object: GameObject): GameObject
	{
		return this.m_gameObjects.add(object.Name(), object);
	}


	private m_camera: Camera;
	private m_gameObjects: HybridLookup<GameObject>;
}