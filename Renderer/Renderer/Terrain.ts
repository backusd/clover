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
import { Mat4, Vec3, Vec4, mat4, vec3 } from 'wgpu-matrix';

const terrainVertexNumFloats = 8;
const vertexStride = 4 * terrainVertexNumFloats; // Byte size of one vertex = (4 bytes/float) * (4 floats for position + 4 floats for color)
const positionOffest = 0;
const colorOffset = 4 * 4; // Byte offset of the vertex color attribute
const vertexCount = 2;

const terrainVertexArray = new Float32Array([
	// float4 position, float4 color
	-1, 0, 0, 1,     1, 1, 1, 1,	// 2 points making up a line from 
	 1, 0, 0, 1,     1, 1, 1, 1,	// (-1, 0, 0) -> (1, 0, 0)
]);

export class Terrain
{
	constructor(width: number, depth: number)
	{
		this.m_width = width;
		this.m_depth = depth;
	}
	public Initialize(renderer: Renderer, passBindGroupLayout: GPUBindGroupLayout): RenderPassLayer
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
			label: 'sm_terrain',
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

struct Vertex
{
  @location(0) position: vec4f,
  @location(1) color: vec4f
}

@group(0) @binding(0) var<uniform> uniforms : Uniforms;
@group(0) @binding(1) var<storage, read> materials: array<Material>;

@group(1) @binding(0) var<storage, read> models: array<mat4x4f>;

struct VertexOutput
{
  @builtin(position) Position : vec4f,
  @location(0) color : vec4f,
}

@vertex
fn vertex_main(vertex: Vertex, @builtin(instance_index) instance: u32) -> VertexOutput
{
//let mvp = models[instance] * uniforms.viewProjectionMatrix;
  let mvp = uniforms.viewProjectionMatrix * models[instance];
  return VertexOutput(mvp * vertex.position, vertex.color);
}

@fragment
fn fragment_main(@location(0) color: vec4f) -> @location(0) vec4f
{
  return color;
}
`
		});

		// Create Buffer for instance data
		const sizeOfFloat = 4;
		let bytesInAMatrix = sizeOfFloat * 4 * 4;
		let numInstances = (this.m_width * 2 + 1) + (this.m_depth * 2 + 1);
		const instanceBuffer = device.createBuffer({
			label: 'Instance Buffer',
			size: bytesInAMatrix * numInstances,
			usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
		});

		// Copy data into the buffer
		let instanceData = new Float32Array(16 * numInstances);
		let instance = 0;
		for (let x = -1 * this.m_width; x <= this.m_width; x++)
		{
			let data = instanceData.subarray(instance * 16, (instance + 1) * 16);
			let m = mat4.multiply(mat4.scaling([1, 1, this.m_depth]), mat4.rotationY(Math.PI / 2));
			mat4.multiply(mat4.translation([x, 0, 0]), m, data);
			instance++;
		}

		for (let y = -1 * this.m_depth; y <= this.m_depth; y++)
		{
			let data = instanceData.subarray(instance * 16, (instance + 1) * 16);
			mat4.multiply(mat4.translation([0, 0, y]), mat4.scaling([this.m_width, 1, 1]), data);
			instance++;
		}

	//	let instance1 = instanceData.subarray(0, 16);
	//	let instance2 = instanceData.subarray(16, 32);
	//	let instance3 = instanceData.subarray(32, 48);
	//	let instance4 = instanceData.subarray(48, 64);
	//	let instance5 = instanceData.subarray(64, 80);
	//	let instance6 = instanceData.subarray(80, 96);
	//	let instance7 = instanceData.subarray(96, 112);
	//	let instance8 = instanceData.subarray(112, 128);
	//	let instance9 = instanceData.subarray(128, 144);
	//	let instance10 = instanceData.subarray(144, 160);
	//	let instance11 = instanceData.subarray(160, 176);
	//	let instance12 = instanceData.subarray(176, 192);
	//
	//	mat4.translation([0,  1,  1], instance1);
	//	mat4.translation([0,  1, -1], instance2);
	//	mat4.translation([0, -1,  1], instance3);
	//	mat4.translation([0, -1, -1], instance4);
	//
	//	mat4.multiply(mat4.translation([1, 1, 0]), mat4.rotationY(Math.PI / 2), instance5);
	//	mat4.multiply(mat4.translation([1, -1, 0]), mat4.rotationY(Math.PI / 2), instance6);
	//	mat4.multiply(mat4.translation([-1, 1, 0]), mat4.rotationY(Math.PI / 2), instance7);
	//	mat4.multiply(mat4.translation([-1, -1, 0]), mat4.rotationY(Math.PI / 2), instance8);
	//
	//	mat4.multiply(mat4.translation([1, 0, 1]), mat4.rotationZ(Math.PI / 2), instance9);
	//	mat4.multiply(mat4.translation([1, 0, -1]), mat4.rotationZ(Math.PI / 2), instance10);
	//	mat4.multiply(mat4.translation([-1, 0, 1]), mat4.rotationZ(Math.PI / 2), instance11);
	//	mat4.multiply(mat4.translation([-1, 0, -1]), mat4.rotationZ(Math.PI / 2), instance12);
		
		device.queue.writeBuffer(
			instanceBuffer,
			0,
			instanceData.buffer,
			instanceData.byteOffset,
			instanceData.byteLength
		);




		let instanceBindGroupLayout: GPUBindGroupLayout = device.createBindGroupLayout(
			{
				label: "Instance BindGroupLayout",
				entries: [
					{
						binding: 0,
						visibility: GPUShaderStage.VERTEX,
						buffer: { type: "read-only-storage" }				
					}
				]
			}
		);

		let layoutDescriptor: GPUPipelineLayoutDescriptor = {
			bindGroupLayouts: [passBindGroupLayout, instanceBindGroupLayout]
		};
		let pipelineLayout: GPUPipelineLayout = device.createPipelineLayout(layoutDescriptor);
		pipelineLayout.label = "Terrain PipelineLayout";

		// Create the pipeline
		let pipeline = device.createRenderPipeline({
			label: "terrain pipeline",
			layout: pipelineLayout,
			vertex: {
				module,
				buffers: [
					{
						arrayStride: vertexStride,
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

		// Instance data BindGroup
		let instanceBindGroup = device.createBindGroup({
			layout: instanceBindGroupLayout,
			entries: [
				{
					binding: 0,
					resource: {
						buffer: instanceBuffer,
					}
				}
			],
		});
		let terrainLayerBindGroup: BindGroup = new BindGroup(1, instanceBindGroup);

		// Terrain MeshGroup
		let terrainMesh = new Mesh();
		terrainMesh.CreateMeshFromRawData("mesh_terrain", terrainVertexArray, terrainVertexNumFloats);

		let terrainMeshGroup = new MeshGroup("mg_terrain", device, [terrainMesh], 0);
		let renderItem = terrainMeshGroup.CreateRenderItem("ri_terrain", "mesh_terrain");
		renderItem.SetInstanceCount(numInstances);


		// Mesh groups may be used across multiple layers so we add them to the renderer first
		// and then must add them by name to a layer
		renderer.AddMeshGroup(terrainMeshGroup);


		// RenderPassLayer
		let renderPassLayer: RenderPassLayer = new RenderPassLayer("rpl_terrain", renderer, pipeline);
		renderPassLayer.AddMeshGroup(terrainMeshGroup.Name());
		renderPassLayer.AddBindGroup(terrainLayerBindGroup);

	//	// RenderItem
	//	let renderItem = renderPassLayer.CreateRenderItem("ri_terrain", "mg_terrain", "mesh_terrain");
	//	renderItem.SetInstanceCount(numInstances);

		return renderPassLayer;
	}

	private m_width: number;
	private m_depth: number;
}