import { RenderPassLayer } from "./Renderer.js";
import { BasicObjectVertex } from "./VertexTypes.js";
export function GetBasicObjectLayer(renderer, passBindGroupLayout) {
    let device = renderer.GetDevice();
    // Create the shader
    const module = device.createShaderModule({
        label: 'sm_basic-object',
        code: `
struct Globals
{
	viewProj: mat4x4f,
	// 4 float boundary
	ambientLight: vec4f,
	// 4 float boundary
	eyePos: vec3f,
	numberOfDirectionalLights: u32,
	// 4 float boundary
	numberOfPointLights: u32,
	numberOfSpotLights: u32,
	padding1: u32,
	padding2: u32,
}

struct Material
{
	diffuseAlbedo: vec4f,
	fresnelR0: vec3f,
	shininess: f32
}

struct ModelDetails
{
	modelMatrix: mat4x4f,
	materialIndex: u32,
	padding1: u32,
	padding2: u32,
	padding3: u32,
}

struct Vertex
{
	@location(0) position: vec3f,
	@location(1) normal: vec3f,
	@location(2) tangent: vec3f,
	@location(3) textureCoords: vec2f
}

@group(0) @binding(0) var<uniform> globals : Globals;
@group(0) @binding(1) var<storage, read> materials: array<Material>;

@group(1) @binding(0) var<uniform> modelDetails: ModelDetails;

struct VertexOutput
{
	@builtin(position) position : vec4f,
	@location(0) positionW: vec3f,
	@location(1) normalW : vec3f,
}

@vertex
fn vertex_main(vertex: Vertex) -> VertexOutput
{
	let world = modelDetails.modelMatrix;

	// Transform to world space.
	let posW4 = world * vec4f(vertex.position, 1);
	let posW = posW4.xyz;

	// Assumes uniform scaling; otherwise, need to use inverse-transpose of world matrix
	let normal = (world * vec4f(vertex.normal, 0)).xyz;

	// Transform to homogeneous clip space.
	let posH = globals.viewProj * posW4;

	return VertexOutput(posH, posW, normal);
}


// =============================================================================

struct Light
{
	strength: vec3f,
	falloffStart: f32,
	direction: vec3f,
	falloffEnd: f32,
	position: vec3f,
	spotPower: f32
}
@group(0) @binding(2) var<storage, read> lights: array<Light>;

fn CalcAttenuation(d: f32, falloffStart: f32, falloffEnd: f32) -> f32
{
	return saturate((falloffEnd-d) / (falloffEnd - falloffStart));
}

// Schlick gives an approximation to Fresnel reflectance (see pg. 233 "Real-Time Rendering 3rd Ed.").
// R0 = ( (n-1)/(n+1) )^2, where n is the index of refraction.
fn SchlickFresnel(R0: vec3f, normal: vec3f, lightVec: vec3f) -> vec3f
{
	let cosIncidentAngle = saturate(dot(normal, lightVec));
	let  f0 = 1.0f - cosIncidentAngle;
	return R0 + (1.0f - R0)*(f0*f0*f0*f0*f0);
}

fn BlinnPhong(lightStrength: vec3f, lightVec: vec3f, normal: vec3f, toEye: vec3f, mat: Material) -> vec3f
{
	let m = mat.shininess * 256.0f;
	let halfVec = normalize(toEye + lightVec);

	let roughnessFactor = (m + 8.0f) * pow(max(dot(halfVec, normal), 0.0f), m) / 8.0f;
	let fresnelFactor = SchlickFresnel(mat.fresnelR0, halfVec, lightVec);

	var specAlbedo = fresnelFactor * roughnessFactor;

	// Our spec formula goes outside [0,1] range, but we are
	// doing LDR rendering.  So scale it down a bit.
	specAlbedo = specAlbedo / (specAlbedo + 1.0f);

	return (mat.diffuseAlbedo.rgb + specAlbedo) * lightStrength;
}

//---------------------------------------------------------------------------------------
// Evaluates the lighting equation for directional lights.
//---------------------------------------------------------------------------------------
fn ComputeDirectionalLighting(light: Light, material: Material, normal: vec3f, toEye: vec3f) -> vec3f
{
	// The light vector aims opposite the direction the light rays travel.
	let lightVec = -light.direction;

    // Scale light down by Lambert's cosine law.
    let ndotl = max(dot(lightVec, normal), 0.0f);
    let lightStrength = light.strength * ndotl;

    return BlinnPhong(lightStrength, lightVec, normal, toEye, material);
}

//---------------------------------------------------------------------------------------
// Evaluates the lighting equation for point lights.
//---------------------------------------------------------------------------------------
fn ComputePointLighting(light: Light, material: Material, position: vec3f, normal: vec3f, toEye: vec3f) -> vec3f
{
    // The vector from the surface to the light.
    var lightVec = light.position - position;

    // The distance from surface to light.
    let d = length(lightVec);

    // Range test.
    if(d > light.falloffEnd)
    {
        return vec3f(0.0f, 0.0f, 0.0f);
    }

    // Normalize the light vector.
    lightVec /= d;

    // Scale light down by Lambert's cosine law.
    let ndotl = max(dot(lightVec, normal), 0.0f);
    var lightStrength = light.strength * ndotl;

    // Attenuate light by distance.
    let att = CalcAttenuation(d, light.falloffStart, light.falloffEnd);
    lightStrength *= att;

    return BlinnPhong(lightStrength, lightVec, normal, toEye, material);
}

//---------------------------------------------------------------------------------------
// Evaluates the lighting equation for spot lights.
//---------------------------------------------------------------------------------------
fn ComputeSpotLighting(light: Light, material: Material, position: vec3f, normal: vec3f, toEye: vec3f) -> vec3f
{
    // The vector from the surface to the light.
    var lightVec = light.position - position;

    // The distance from surface to light.
    let d = length(lightVec);

    // Range test.
    if(d > light.falloffEnd)
    {
        return vec3f(0.0f, 0.0f, 0.0f);
    }

    // Normalize the light vector.
    lightVec /= d;

    // Scale light down by Lambert's cosine law.
    let ndotl = max(dot(lightVec, normal), 0.0f);
    var lightStrength = light.strength * ndotl;

    // Attenuate light by distance.
    let att = CalcAttenuation(d, light.falloffStart, light.falloffEnd);
    lightStrength *= att;

    // Scale by spotlight
    let spotFactor = pow(max(dot(-lightVec, light.direction), 0.0f), light.spotPower);
    lightStrength *= spotFactor;

    return BlinnPhong(lightStrength, lightVec, normal, toEye, material);
}

fn ComputeLighting(material: Material, position: vec3f, normal: vec3f, toEye: vec3f, shadowFactor: vec3f) -> vec4f
{
	var result = vec3f(0.0, 0.0, 0.0);

	// It is going to be assumed that the lights are sorted such that
	// all directional lights are first, then point lights, then spot lights
	var start = 0u;
	var end = globals.numberOfDirectionalLights;
	for (var iii = start; iii < end; iii++)
	{
		result += ComputeDirectionalLighting(lights[iii], material, normal, toEye);
	}

	start = globals.numberOfDirectionalLights;
	end = globals.numberOfDirectionalLights + globals.numberOfPointLights;
	for (var iii = start; iii < end; iii++)
	{
		result += ComputePointLighting(lights[iii], material, position, normal, toEye);
	}

	start = globals.numberOfDirectionalLights + globals.numberOfPointLights;
	end = globals.numberOfDirectionalLights + globals.numberOfPointLights + globals.numberOfSpotLights;
	for (var iii = start; iii < end; iii++)
	{
		result += ComputeSpotLighting(lights[iii], material, position, normal, toEye);
	}

	return vec4f(result, 0.0);
}

@fragment
fn fragment_main(input: VertexOutput) -> @location(0) vec4f
{
	// Look up the material
	let material = materials[modelDetails.materialIndex];

	// Interpolating normal can unnormalize it, so renormalize it.
	let normalW = normalize(input.normalW);

	// Vector from point being lit to eye.
	let toEye = normalize(globals.eyePos - input.positionW);

	// Indirect lighting
	let ambient = globals.ambientLight * material.diffuseAlbedo;

	let shadowFactor = vec3f(1.0, 1.0, 1.0);
	let directLight = ComputeLighting(material, input.positionW, normalW, toEye, shadowFactor);

	var litColor = ambient + directLight;

	// Common convention to take the alpha from the diffuse material
	litColor.a = material.diffuseAlbedo.a;

	return litColor;
}
`
    });
    /*
    struct Globals
{
    viewProj: mat4x4f,
    ambientLight: vec4f,
    eyePos: vec3f,
    padding1: f32
}

struct Material
{
    diffuseAlbedo: vec4f,
    fresnelR0: vec3f,
    shininess: f32
}

struct ModelDetails
{
    modelMatrix: mat4x4f,
    materialIndex: u32,
    padding1: u32,
    padding2: u32,
    padding3: u32,
}

struct Vertex
{
    @location(0) position: vec3f,
    @location(1) normal: vec3f,
    @location(2) tangent: vec3f,
    @location(3) textureCoords: vec2f
}

@group(0) @binding(0) var<uniform> globals : Globals;
@group(0) @binding(1) var<storage, read> materials: array<Material>;

@group(1) @binding(0) var<uniform> modelDetails: ModelDetails;

struct VertexOutput
{
    @builtin(position) position : vec4f,
    @location(0) positionW: vec3f,
    @location(1) normalW : vec3f,
}

@vertex
fn vertex_main(vertex: Vertex) -> VertexOutput
{
    let world = modelDetails.modelMatrix;

    // Transform to world space.
    let posW4 = world * vec4f(vertex.position, 1);
    let posW = posW4.xyz;

    // Assumes uniform scaling; otherwise, need to use inverse-transpose of world matrix
    let normal = (world * vec4f(vertex.normal, 0)).xyz;

    // Transform to homogeneous clip space.
    let posH = globals.viewProj * posW4;

    return VertexOutput(posH, posW, normal);
}

@fragment
fn fragment_main(input: VertexOutput) -> @location(0) vec4f
{
    // Look up the material
    let material = materials[modelDetails.materialIndex];

    // Interpolating normal can unnormalize it, so renormalize it.
    let normalW = normalize(input.normalW);

    // Vector from point being lit to eye.
    let toEye = normalize(globals.eyePos - input.positionW);

    // Indirect lighting
    let ambient = globals.ambientLight * material.diffuseAlbedo;

//  let shadowFactor = 1.0;
//  let directLight = ComputeLighting();
    let directLight = vec4f(0.0, 0.0, 0.0, 0.0);

    var litColor = ambient + directLight;

    // Common convention to take the alpha from the diffuse material
    litColor.a = material.diffuseAlbedo.a;

    return litColor;
}

    */
    // Bind group layout for the RenderItem
    let renderItemBindGroupLayout = device.createBindGroupLayout({
        label: "bgl_basic-object",
        entries: [
            {
                binding: 0,
                visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                buffer: {
                    type: "uniform",
                    minBindingSize: Float32Array.BYTES_PER_ELEMENT * (16 + 4) // BEST PRACTICE to always set this
                }
            },
            //				{
            //					binding: 1,
            //					visibility: GPUShaderStage.FRAGMENT,
            //					sampler: {}
            //				},
            //				{
            //					binding: 2,
            //					visibility: GPUShaderStage.FRAGMENT,
            //					texture: {}
            //				}
        ]
    });
    let renderItemBindGroupLayoutGroupNumber = 1;
    let layoutDescriptor = {
        label: "ld_basic-object",
        bindGroupLayouts: [passBindGroupLayout, renderItemBindGroupLayout]
    };
    let pipelineLayout = device.createPipelineLayout(layoutDescriptor);
    pipelineLayout.label = "pl_basic-object";
    // Create the pipeline
    let pipeline = device.createRenderPipeline({
        label: "rp_basic-object",
        layout: pipelineLayout,
        vertex: {
            module,
            buffers: [
                {
                    arrayStride: BasicObjectVertex.bytesPerVertex,
                    attributes: [
                        {
                            // position
                            shaderLocation: 0,
                            offset: BasicObjectVertex.PositionByteOffset(),
                            format: BasicObjectVertex.PositionVertexFormat(),
                        },
                        {
                            // normal
                            shaderLocation: 1,
                            offset: BasicObjectVertex.NormalByteOffset(),
                            format: BasicObjectVertex.NormalVertexFormat(),
                        },
                        {
                            // tangent
                            shaderLocation: 2,
                            offset: BasicObjectVertex.TangentByteOffset(),
                            format: BasicObjectVertex.TangentVertexFormat(),
                        },
                        {
                            // texture coords
                            shaderLocation: 3,
                            offset: BasicObjectVertex.TextureCoordsByteOffset(),
                            format: BasicObjectVertex.TextureCoordsVertexFormat(),
                        },
                    ],
                },
            ],
        },
        fragment: {
            module,
            targets: [
                {
                    format: navigator.gpu.getPreferredCanvasFormat(),
                },
            ],
        },
        primitive: {
            topology: 'triangle-list',
            cullMode: 'back'
        },
        depthStencil: {
            depthWriteEnabled: true,
            depthCompare: 'less',
            format: 'depth24plus',
        },
    });
    return new RenderPassLayer("rpl_basic-object", renderer, pipeline, null, undefined, // Bind group details for the Layer
    renderItemBindGroupLayout, renderItemBindGroupLayoutGroupNumber); // Bind group details for RenderItems
}
//# sourceMappingURL=BasicObjectLayer.js.map