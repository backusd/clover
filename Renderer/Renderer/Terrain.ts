import { LOG_INFO, LOG_TRACE, LOG_WARN, LOG_ERROR } from "./Log.js";
import
{
	MeshDescriptor,
	MeshGroup,
	BindGroup,
	RenderPassDescriptor,
	RenderPass,
	Renderer
} from "./Renderer.js";
import { Mat4, Vec3, Vec4, mat4, vec3 } from 'wgpu-matrix';

const vertexSize = 4 * 2; // Byte size of one vertex
const positionOffest = 0;
const colorOffset = 4 * 4; // Byte offset of the vertex color attribute
const vertexCount = 8;

const terrainVertexArray = new Float32Array([
	// float4 position, float4 color
	 1, 1, 0, 1,     1, 1, 1, 1,	// +x +y
	-1, 1, 0, 1,     1, 1, 1, 1,	// -x +y

	1,  1, 0, 1,     1, 1, 1, 1,	// +x +y
	1, -1, 0, 1,     1, 1, 1, 1,	// +x -y

	-1,  1, 0, 1,     1, 1, 1, 1,	// -x +y
	-1, -1, 0, 1,     1, 1, 1, 1,	// -x -y

	 1, -1, 0, 1,     1, 1, 1, 1,	// +x -y
	-1, -1, 0, 1,     1, 1, 1, 1,	// -x -y
]);

export class Terrain
{
	constructor(width: number, depth: number)
	{
		this.m_width = width;
		this.m_depth = depth;
	}
	public Initialize(renderer: Renderer): void
	{
		let device = renderer.GetDevice();
		let context = renderer.GetContext();

		// Create a vertex buffer for the terrain grid data
		let vertexBuffer = device.createBuffer({
			label: "terrain vertex buffer",
			size: terrainVertexArray.byteLength,
			usage: GPUBufferUsage.VERTEX,
			mappedAtCreation: true,
		});
		new Float32Array(vertexBuffer.getMappedRange()).set(terrainVertexArray);
		vertexBuffer.unmap();

		// Create the shaders
		const module: GPUShaderModule = device.createShaderModule({
			label: 'terrain shader module',
			code: `
struct Uniforms
{
  modelViewProjectionMatrix : mat4x4f,
}

struct Vertex
{
  @location(0) position: vec4f,
  @location(1) color: vec4f
}

@group(0) @binding(0) var<uniform> uniforms : Uniforms;

struct VertexOutput
{
  @builtin(position) Position : vec4f,
  @location(0) color : vec4f,
}

@vertex
fn vertex_main(vertex: Vertex) -> VertexOutput
{
  return VertexOutput(uniforms.modelViewProjectionMatrix * vertex.position, vertex.color);
}

@fragment
fn fragment_main(@location(0) color: vec4f) -> @location(0) vec4f
{
  return color;
}
`
		});

		// Create the pipeline
		let pipeline = device.createRenderPipeline({
			label: "terrain pipeline",
			layout: 'auto',
			vertex: {
				module,
				buffers: [
					{
						arrayStride: vertexSize,
						attributes: [
							{
								// position
								shaderLocation: 0,
								offset: positionOffest,
								format: 'float32x4',
							},
							{
								// color
								shaderLocation: 1,
								offset: colorOffset,
								format: 'float32x4',
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
				topology: 'line-list'
			},
			depthStencil: {
				depthWriteEnabled: true,
				depthCompare: 'less',
				format: 'depth24plus',
			},
		});

		// Terrain MeshGroup
		let terrainMeshGroup: MeshGroup = new MeshGroup(vertexBuffer, 0);
		let boxDescriptor: MeshDescriptor = {
			vertexCount: vertexCount,
			startVertex: 0,
			instanceCount: undefined,
			startInstance: undefined
		}
		terrainMeshGroup.AddMeshDescriptor(boxDescriptor);

	}

	private m_width: number;
	private m_depth: number;
}