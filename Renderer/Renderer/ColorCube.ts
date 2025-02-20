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

const vertexCount = 8;
const numFloatsPerVertex = 8;
const vertexStride = 4 * numFloatsPerVertex;
const positionByteOffset = 0;
const colorByteOffset = 4 * 4;

const cubeVertexArray = new Float32Array([
	// float4 position, float4 color
	 1,  1,  1,  1,     1, 0, 0, 1,    // 0:  x  y  z
	-1,  1,  1,  1,     0, 1, 0, 1,    // 1: -x  y  z	
	 1, -1,  1,  1,     0, 0, 1, 1,    // 2:  x -y  z
	 1,  1, -1,  1,     1, 1, 0, 1,    // 3:  x  y -z
	-1, -1,  1,  1,     1, 0, 1, 1,    // 4: -x -y  z
	-1,  1, -1,  1,     0, 1, 1, 1,    // 5: -x  y -z
	 1, -1, -1,  1,     1, 1, 1, 1,    // 6:  x -y -z
	-1, -1, -1,  1,     0, 0, 0, 1	   // 7: -x -y -z
]);

const cubeIndexArray = new Uint16Array([
	// +x face
	0, 2, 3,
	6, 3, 2,
	// -x face
	1, 5, 4,
	7, 4, 5,
	// +z face
	0, 1, 2,
	4, 2, 1,
	// -z face
	3, 6, 5,
	7, 5, 6,
	// +y face
	0, 3, 1,
	5, 1, 3,
	// -y face
	2, 4, 6,
	7, 6, 4
]);

export class ColorCube
{
	public Initialize(renderer: Renderer, passBindGroupLayout: GPUBindGroupLayout): RenderPassLayer
	{
		let device = renderer.GetDevice();
		let context = renderer.GetContext();

		// Create the Mesh
		let mesh = new Mesh();
		mesh.CreateMeshFromRawData("color cube mesh", cubeVertexArray, numFloatsPerVertex, cubeIndexArray);




		// Creating a 2nd cube mesh
		let cubeVertexArray_2 = new Float32Array(cubeVertexArray.length);
		for (let row = 0; row < 8; row++)
		{
			for (let col = 0; col < 8; col++)
			{
				let iii = row * 8 + col;
				if (col === 0)
					cubeVertexArray_2[iii] = cubeVertexArray[iii] + 3;
				else
					cubeVertexArray_2[iii] = cubeVertexArray[iii];
			}
		}

		let mesh_2 = new Mesh();
		mesh_2.CreateMeshFromRawData("Color cube mesh 2", cubeVertexArray_2, numFloatsPerVertex, cubeIndexArray);

		// Creating a 3nd cube mesh
		let cubeVertexArray_3 = new Float32Array(cubeVertexArray.length);
		for (let row = 0; row < 8; row++)
		{
			for (let col = 0; col < 8; col++)
			{
				let iii = row * 8 + col;
				if (col === 1)
					cubeVertexArray_3[iii] = cubeVertexArray[iii] + 3;
				else
					cubeVertexArray_3[iii] = cubeVertexArray[iii];
			}
		}

		let mesh_3 = new Mesh();
		mesh_3.CreateMeshFromRawData("Color cube mesh 3", cubeVertexArray_3, numFloatsPerVertex, cubeIndexArray);


		// MeshGroup
		let meshGroup = new MeshGroup("color cube mesh group", device, [mesh, mesh_2, mesh_3], 0);

		// Create the shaders
		const module: GPUShaderModule = device.createShaderModule({
			label: 'color cube shader module',
			code: `
struct Uniforms
{
  viewProjectionMatrix : mat4x4f
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
  return VertexOutput(uniforms.viewProjectionMatrix * vertex.position, vertex.color);
}

@fragment
fn fragment_main(@location(0) color: vec4f) -> @location(0) vec4f
{
  return color;
}
`
		});


		let layoutDescriptor: GPUPipelineLayoutDescriptor = {
			bindGroupLayouts: [passBindGroupLayout]
		};
		let pipelineLayout: GPUPipelineLayout = device.createPipelineLayout(layoutDescriptor);
		pipelineLayout.label = "Color Cube PipelineLayout";

		// Create the pipeline
		let pipeline = device.createRenderPipeline({
			label: "Color Cube Pipeline",
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
								offset: positionByteOffset,
								format: 'float32x4',
							},
							{
								// color
								shaderLocation: 1,
								offset: colorByteOffset,
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
				topology: 'triangle-list',
				cullMode: 'back'
			},
			depthStencil: {
				depthWriteEnabled: true,
				depthCompare: 'less',
				format: 'depth24plus',
			},
		});


		// RenderPassLayer
		let renderPassLayer: RenderPassLayer = new RenderPassLayer(pipeline);
		renderPassLayer.AddMeshGroup(meshGroup);

		return renderPassLayer;

	}
}