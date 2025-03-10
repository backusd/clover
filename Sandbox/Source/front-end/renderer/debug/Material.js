import { vec4, vec3 } from 'wgpu-matrix';
import { HybridLookup } from "./Utils.js";
import { InstanceBufferBasicWrite } from "./Buffer.js";
export class Material {
    constructor(_name, _diffuseAlbedo, _fresnelR0, _shininess) {
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
    Name() { return this.m_name; }
    GetDiffuseAlbedo() { return this.m_diffuseAlbedoView; }
    GetFresnelR0() { return this.m_fresnelR0View; }
    GetShininess() { return this.m_shininessView[0]; }
    SetDiffuseAlbedo(x, y, z, w) {
        this.m_diffuseAlbedoView[0] = x;
        this.m_diffuseAlbedoView[1] = y;
        this.m_diffuseAlbedoView[2] = z;
        this.m_diffuseAlbedoView[3] = w;
    }
    SetFresnelR0(x, y, z) {
        this.m_fresnelR0View[0] = x;
        this.m_fresnelR0View[1] = y;
        this.m_fresnelR0View[2] = z;
    }
    SetShininess(shininess) {
        this.m_shininessView[0] = shininess;
    }
    Data() { return this.m_data; }
    m_name = "(unnamed)";
    m_data;
    m_diffuseAlbedoView;
    m_fresnelR0View;
    m_shininessView;
    diffuseAlbedo = vec4.create(1.0, 1.0, 1.0, 1.0);
    fresnelR0 = vec3.create(0.01, 0.01, 0.01);
    roughness = 0.25;
    static bytesPerMaterial = Float32Array.BYTES_PER_ELEMENT * (4 + 3 + 1);
}
export class MaterialGroup {
    constructor(name, device, materials) {
        this.m_name = name;
        this.m_materials = new HybridLookup();
        let numMaterials = 0;
        if (materials != null) {
            numMaterials = materials.length;
            materials.forEach(mat => { this.m_materials.add(mat.Name(), mat); });
        }
        // Allocate at least enough space for one material
        let numInstancesToAllocate = Math.max(1, numMaterials);
        this.m_buffer = new InstanceBufferBasicWrite(device, Material.bytesPerMaterial, numInstancesToAllocate, `buffer for MaterialGroup: ${name}`);
        this.UpdateAllMaterialsOnGPU();
    }
    Name() { return this.m_name; }
    UpdateAllMaterialsOnGPU() {
        for (let iii = 0; iii < this.m_materials.size(); ++iii)
            this.UpdateMaterialOnGPU(iii, this.m_materials.getFromIndex(iii));
    }
    UpdateMaterialOnGPU(index, material) {
        this.m_buffer.WriteData(index, material.Data());
    }
    GetGPUBuffer() { return this.m_buffer.GetGPUBuffer(); }
    AddMaterial(material) {
        // We are just going to do a brute force approach where we assume
        // the GPUBuffer is destroyed and recreated with a larger size and therefore,
        // we need to update the entire buffer with all materials 
        this.m_materials.add(material.Name(), material);
        this.m_buffer.SetCapacity(this.m_materials.size());
        this.UpdateAllMaterialsOnGPU();
        return material;
    }
    UpdateMaterial(name, newMaterial) {
        let index = this.m_materials.indexOfKey(name);
        this.m_materials.updateFromIndex(index, newMaterial);
        this.UpdateMaterialOnGPU(index, newMaterial);
    }
    AddMaterials(materials) {
        if (materials.length === 0)
            return;
        // We are just going to do a brute force approach where we assume
        // the GPUBuffer is destroyed and recreated with a larger size and therefore,
        // we need to update the entire buffer with all materials 
        materials.forEach(material => { this.m_materials.add(material.Name(), material); });
        this.m_buffer.SetCapacity(this.m_materials.size());
        this.UpdateAllMaterialsOnGPU();
    }
    GetMaterialIndex(name) { return this.m_materials.indexOfKey(name); }
    GetMaterial(nameOrIndex) {
        if (typeof nameOrIndex === "string")
            return this.m_materials.getFromKey(nameOrIndex);
        return this.m_materials.getFromIndex(nameOrIndex);
    }
    m_name;
    m_materials;
    m_buffer;
}
//# sourceMappingURL=Material.js.map