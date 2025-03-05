import { Mat4, Vec3, Vec4, mat4, vec4, vec3 } from 'wgpu-matrix';
import { HybridLookup } from "./Utils.js"
import { InstanceBufferBasicWrite } from "./Buffer.js"
import
	{
		LOG_CORE_INFO,
		LOG_CORE_TRACE,
		LOG_CORE_WARN,
		LOG_CORE_ERROR
	} from "./Log.js"


export class Material
{
	constructor(_name: string, _diffuseAlbedo: Vec4, _fresnelR0: Vec3, _shininess: number)
	{
		this.m_name = _name;
		this.m_data = new ArrayBuffer(Material.bytesPerMaterial);

		// The material is structured as follows:
		//		float4 diffuseAlbedo
		//		float3 fresnelR0
		//		float  shininess
		this.m_diffuseAlbedoView = new Float32Array(this.m_data, 0, 4);
		this.m_fresnelR0View = new Float32Array(this.m_data, Float32Array.BYTES_PER_ELEMENT * 4, 3);
		this.m_shininessView = new Float32Array(this.m_data, Float32Array.BYTES_PER_ELEMENT * (4 + 3), 1);

		this.m_diffuseAlbedoView.set(_diffuseAlbedo);
		this.m_fresnelR0View.set(_fresnelR0);
		this.m_shininessView.set([_shininess]);
	}
	public Name(): string { return this.m_name; }

	public GetDiffuseAlbedo(): Vec4 { return this.m_diffuseAlbedoView; }
	public GetFresnelR0(): Vec3 { return this.m_fresnelR0View; }
	public GetShininess(): number { return this.m_shininessView[0]; }

	public SetDiffuseAlbedo(x: number, y: number, z: number, w: number): void
	{
		this.m_diffuseAlbedoView[0] = x;
		this.m_diffuseAlbedoView[1] = y;
		this.m_diffuseAlbedoView[2] = z;
		this.m_diffuseAlbedoView[3] = w;
	}
	public SetFresnelR0(x: number, y: number, z: number): void
	{
		this.m_fresnelR0View[0] = x;
		this.m_fresnelR0View[1] = y;
		this.m_fresnelR0View[2] = z;
	}
	public SetShininess(shininess: number): void
	{
		this.m_shininessView[0] = shininess;
	}

	public Data(): ArrayBuffer { return this.m_data; }

	private m_name: string = "(unnamed)";
	private m_data: ArrayBuffer;

	private m_diffuseAlbedoView: Float32Array;
	private m_fresnelR0View: Float32Array;
	private m_shininessView: Float32Array;

	diffuseAlbedo: Vec4 = vec4.create(1.0, 1.0, 1.0, 1.0);
	fresnelR0 = vec3.create(0.01, 0.01, 0.01);
	roughness: number = 0.25;

	static bytesPerMaterial: number = Float32Array.BYTES_PER_ELEMENT * (4 + 3 + 1);
}

export class MaterialGroup
{
	constructor(name: string, device: GPUDevice, materials: Material[] | null)
	{
		this.m_name = name;
		this.m_materials = new HybridLookup<Material>();

		let numMaterials = 0;
		if (materials != null)
		{
			numMaterials = materials.length;
			materials.forEach(mat => { this.m_materials.add(mat.Name(), mat); })
		}

		// Allocate at least enough space for one material
		let numInstancesToAllocate = Math.max(1, numMaterials);
		this.m_buffer = new InstanceBufferBasicWrite(device, Material.bytesPerMaterial, numInstancesToAllocate, `buffer for MaterialGroup: ${name}`);

		this.UpdateAllMaterials();
	}
	public Name(): string { return this.m_name; }
	private UpdateAllMaterials(): void
	{
		for (let iii = 0; iii < this.m_materials.size(); ++iii)
			this.UpdateMaterial(iii, this.m_materials.getFromIndex(iii));
	}
	private UpdateMaterial(index: number, material: Material): void
	{
		this.m_buffer.WriteData(index, material.Data());
	}
	public GetGPUBuffer(): GPUBuffer { return this.m_buffer.GetGPUBuffer(); }
	public AddMaterial(material: Material): Material
	{
		// We are just going to do a brute force approach where we assume
		// the GPUBuffer is destroyed and recreated with a larger size and therefore,
		// we need to update the entire buffer with all materials 
		this.m_materials.add(material.Name(), material);

		this.m_buffer.SetCapacity(this.m_materials.size());
		this.UpdateAllMaterials();

		return material;
	}
	public AddMaterials(materials: Material[]): void
	{
		if (materials.length === 0)
			return;

		// We are just going to do a brute force approach where we assume
		// the GPUBuffer is destroyed and recreated with a larger size and therefore,
		// we need to update the entire buffer with all materials 
		materials.forEach(material => { this.m_materials.add(material.Name(), material); });		

		this.m_buffer.SetCapacity(this.m_materials.size());
		this.UpdateAllMaterials();
	}
	public GetMaterialIndex(name: string): number { return this.m_materials.indexOfKey(name); }
	public GetMaterial(nameOrIndex: string | number): Material
	{
		if (typeof nameOrIndex === "string")
			return this.m_materials.getFromKey(nameOrIndex);

		return this.m_materials.getFromIndex(nameOrIndex);
	}


	private m_name: string;
	private m_materials: HybridLookup<Material>;
	private m_buffer: InstanceBufferBasicWrite;
}