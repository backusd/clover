import { LOG_INFO, LOG_TRACE, LOG_WARN, LOG_ERROR, LOG_CORE_ERROR } from "./Log.js";
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
import { BasicObjectVertex } from "./VertexTypes.js"
import { Material } from "./Material.js"


export function GetLightsLayer(renderer: Renderer, passBindGroupLayout: GPUBindGroupLayout): RenderPassLayer
{
	let device = renderer.GetDevice();

	// Create the shader
	const module: GPUShaderModule = device.createShaderModule({
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

	let light = Light(vec3f(0.3, 0.3, 0.3), 0, vec3f(0, 0, -1), 0, vec3f(0, 0, 0), 0);
	let directLight = ComputeDirectionalLighting(light, material, normalW, toEye);

	var litColor = ambient + vec4f(directLight, 0.0);

	// Common convention to take the alpha from the diffuse material
	litColor.a = material.diffuseAlbedo.a;

	return litColor;
}
`
	});

	// Bind group layout for the RenderItem
	let renderItemBindGroupLayout: GPUBindGroupLayout = device.createBindGroupLayout(
		{
			label: "bgl_lights",
			entries: [
				{
					binding: 0,
					visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
					buffer: {
						type: "uniform",
						minBindingSize: Float32Array.BYTES_PER_ELEMENT * (16 + 4) // BEST PRACTICE to always set this
					}
				}
			]
		}
	);

	let renderItemBindGroupLayoutGroupNumber = 1;

	let layoutDescriptor: GPUPipelineLayoutDescriptor = {
		label: "ld_lights",
		bindGroupLayouts: [passBindGroupLayout, renderItemBindGroupLayout]
	};
	let pipelineLayout: GPUPipelineLayout = device.createPipelineLayout(layoutDescriptor);
	pipelineLayout.label = "pl_lights";

	// Create the pipeline
	let pipeline = device.createRenderPipeline({
		label: "rp_lights",
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

	return new RenderPassLayer("rpl_lights", renderer, pipeline,
		null, undefined,													// Bind group details for the Layer
		renderItemBindGroupLayout, renderItemBindGroupLayoutGroupNumber);	// Bind group details for RenderItems
}