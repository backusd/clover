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


export function GetBasicObjectLayer(renderer: Renderer, passBindGroupLayout: GPUBindGroupLayout): RenderPassLayer
{
	let device = renderer.GetDevice();

	// Create the shader
	const module: GPUShaderModule = device.createShaderModule({
		label: 'sm_basic-object',
		code: `
struct Uniforms
{
	viewProjectionMatrix : mat4x4f
}

struct Material
{
	diffuseAlbedo: vec4f,
	fresnelR0: vec3f,
	roughness: f32
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

@group(0) @binding(0) var<uniform> uniforms : Uniforms;
@group(0) @binding(1) var<storage, read> materials: array<Material>;

@group(1) @binding(0) var<uniform> modelDetails: ModelDetails;

struct VertexOutput
{
	@builtin(position) Position : vec4f,
	@location(0) color : vec4f,
}

@vertex
fn vertex_main(vertex: Vertex) -> VertexOutput
{
	let mvp = uniforms.viewProjectionMatrix * modelDetails.modelMatrix;
	return VertexOutput(mvp * vec4f(vertex.position, 1), materials[modelDetails.materialIndex].diffuseAlbedo);
}

@fragment
fn fragment_main(@location(0) color: vec4f) -> @location(0) vec4f
{
	return color;
}
`
	});

	// Bind group layout for the RenderItem
	let renderItemBindGroupLayout: GPUBindGroupLayout = device.createBindGroupLayout(
		{
			label: "bgl_basic-object",
			entries: [
				{
					binding: 0,
					visibility: GPUShaderStage.VERTEX,
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
		}
	);
	let renderItemBindGroupLayoutGroupNumber = 1;

	let layoutDescriptor: GPUPipelineLayoutDescriptor = {
		label: "ld_basic-object",
		bindGroupLayouts: [passBindGroupLayout, renderItemBindGroupLayout]
	};
	let pipelineLayout: GPUPipelineLayout = device.createPipelineLayout(layoutDescriptor);
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

	return new RenderPassLayer("rpl_basic-object", renderer, pipeline,
		null, undefined,													// Bind group details for the Layer
		renderItemBindGroupLayout, renderItemBindGroupLayoutGroupNumber);	// Bind group details for RenderItems
}