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

const cubeVertexNumFloats = 10;
const cubeVertexStride = 4 * cubeVertexNumFloats; // Byte size of one cube vertex.
const cubePositionOffset = 0;
const cubeColorOffset = 4 * 4; // Byte offset of cube vertex color attribute.
const cubeUVOffset = 4 * 8;
const cubeVertexCount = 36;

const cubeVertexArray = new Float32Array([
	// float4 position, float4 color, float2 uv,
	1, -1, 1, 1, 1, 0, 1, 1, 0, 1,
	-1, -1, 1, 1, 0, 0, 1, 1, 1, 1,
	-1, -1, -1, 1, 0, 0, 0, 1, 1, 0,
	1, -1, -1, 1, 1, 0, 0, 1, 0, 0,
	1, -1, 1, 1, 1, 0, 1, 1, 0, 1,
	-1, -1, -1, 1, 0, 0, 0, 1, 1, 0,

	1, 1, 1, 1, 1, 1, 1, 1, 0, 1,
	1, -1, 1, 1, 1, 0, 1, 1, 1, 1,
	1, -1, -1, 1, 1, 0, 0, 1, 1, 0,
	1, 1, -1, 1, 1, 1, 0, 1, 0, 0,
	1, 1, 1, 1, 1, 1, 1, 1, 0, 1,
	1, -1, -1, 1, 1, 0, 0, 1, 1, 0,

	-1, 1, 1, 1, 0, 1, 1, 1, 0, 1,
	1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
	1, 1, -1, 1, 1, 1, 0, 1, 1, 0,
	-1, 1, -1, 1, 0, 1, 0, 1, 0, 0,
	-1, 1, 1, 1, 0, 1, 1, 1, 0, 1,
	1, 1, -1, 1, 1, 1, 0, 1, 1, 0,

	-1, -1, 1, 1, 0, 0, 1, 1, 0, 1,
	-1, 1, 1, 1, 0, 1, 1, 1, 1, 1,
	-1, 1, -1, 1, 0, 1, 0, 1, 1, 0,
	-1, -1, -1, 1, 0, 0, 0, 1, 0, 0,
	-1, -1, 1, 1, 0, 0, 1, 1, 0, 1,
	-1, 1, -1, 1, 0, 1, 0, 1, 1, 0,

	1, 1, 1, 1, 1, 1, 1, 1, 0, 1,
	-1, 1, 1, 1, 0, 1, 1, 1, 1, 1,
	-1, -1, 1, 1, 0, 0, 1, 1, 1, 0,
	-1, -1, 1, 1, 0, 0, 1, 1, 1, 0,
	1, -1, 1, 1, 1, 0, 1, 1, 0, 0,
	1, 1, 1, 1, 1, 1, 1, 1, 0, 1,

	1, -1, -1, 1, 1, 0, 0, 1, 0, 1,
	-1, -1, -1, 1, 0, 0, 0, 1, 1, 1,
	-1, 1, -1, 1, 0, 1, 0, 1, 1, 0,
	1, 1, -1, 1, 1, 1, 0, 1, 0, 0,
	1, -1, -1, 1, 1, 0, 0, 1, 0, 1,
	-1, 1, -1, 1, 0, 1, 0, 1, 1, 0,
]);

export class TextureCube
{
	public async Initialize(renderer: Renderer, passBindGroupLayout: GPUBindGroupLayout): Promise<RenderPassLayer>
	{
		let device = renderer.GetDevice();
		let context = renderer.GetContext();

		

		// Creating a 2nd box mesh
		let cubeVertexArray_2 = new Float32Array(cubeVertexArray.length);
		for (let row = 0; row < 36; row++)
		{
			for (let col = 0; col < 10; col++)
			{
				let iii = row * 10 + col;
				if (col >= 1)
					cubeVertexArray_2[iii] = cubeVertexArray[iii];
				else
					cubeVertexArray_2[iii] = cubeVertexArray[iii] + 3;
			}
		}

		let boxMesh_2 = new Mesh();
		boxMesh_2.CreateMeshFromRawData("mesh_texture-cube-2", cubeVertexArray_2, cubeVertexNumFloats);

		// Creating a 3rd box mesh
		let cubeVertexArray_3 = new Float32Array(cubeVertexArray.length);
		for (let row = 0; row < 36; row++)
		{
			for (let col = 0; col < 10; col++)
			{
				let iii = row * 10 + col;
				if (col === 1)
					cubeVertexArray_3[iii] = cubeVertexArray[iii] + 3;
				else
					cubeVertexArray_3[iii] = cubeVertexArray[iii];
			}
		}

		let boxMesh_3 = new Mesh();
		boxMesh_3.CreateMeshFromRawData("mesh_texture-cube-3", cubeVertexArray_3, cubeVertexNumFloats);


		// Box Mesh
		let boxMesh = new Mesh();
		boxMesh.CreateMeshFromRawData("mesh_texture-cube", cubeVertexArray, cubeVertexNumFloats);

		// MeshGroup
		let cubeMeshGroup = new MeshGroup("mg_texture-cube", device, [boxMesh, boxMesh_2, boxMesh_3], 0);

		const module: GPUShaderModule = device.createShaderModule({
			label: 'Texture cube shader module',
			code: `
struct Uniforms
{
  viewProjectionMatrix : mat4x4f
}

struct Vertex
{
  @location(0) position: vec4f,
  @location(1) uv: vec2f
}

@group(0) @binding(0) var<uniform> uniforms : Uniforms;

@group(1) @binding(0) var<uniform> modelMatrix: mat4x4f;
@group(1) @binding(1) var mySampler: sampler;
@group(1) @binding(2) var myTexture: texture_2d<f32>;

struct VertexOutput
{
  @builtin(position) Position : vec4f,
  @location(0) fragUV : vec2f,
}

@vertex
fn vertex_main(vertex: Vertex) -> VertexOutput
{
	let mvp = uniforms.viewProjectionMatrix * modelMatrix;
	return VertexOutput(mvp * vertex.position, vertex.uv);
}

@fragment
fn fragment_main(@location(0) fragUV: vec2f) -> @location(0) vec4f
{
	return textureSample(myTexture, mySampler, fragUV);
}
`
		});


		//let cubeBindGroupLayout: GPUBindGroupLayout = device.createBindGroupLayout(
		//	{
		//		label: "bgl_texture-cube",
		//		entries: [
		//			{
		//				binding: 0,
		//				visibility: GPUShaderStage.FRAGMENT,
		//				sampler: {}
		//			},
		//			{
		//				binding: 1,
		//				visibility: GPUShaderStage.FRAGMENT,
		//				texture: {}
		//			}
		//		]
		//	}
		//);
		let cubeBindGroupLayout: GPUBindGroupLayout = device.createBindGroupLayout(
			{
				label: "bgl_game-cube",
				entries: [
					{
						binding: 0,
						visibility: GPUShaderStage.VERTEX,
						buffer: { type: "uniform" }
					},
					{
						binding: 1,
						visibility: GPUShaderStage.FRAGMENT,
						sampler: {}
					},
					{
						binding: 2,
						visibility: GPUShaderStage.FRAGMENT,
						texture: {}
					}
				]
			}
		);

		let cubePipelineLayoutDescriptor: GPUPipelineLayoutDescriptor = {
			bindGroupLayouts: [passBindGroupLayout, cubeBindGroupLayout]
		};
		let cubePipelineLayout: GPUPipelineLayout = device.createPipelineLayout(cubePipelineLayoutDescriptor);
		cubePipelineLayout.label = "pl_texture-cube";

		let pipeline = device.createRenderPipeline({
			label: "rp_texture-cube",
			layout: cubePipelineLayout,
			vertex: {
				module,
				buffers: [
					{
						arrayStride: cubeVertexStride,
						attributes: [
							{
								// position
								shaderLocation: 0,
								offset: cubePositionOffset,
								format: 'float32x4',
							},
							{
								// uv
								shaderLocation: 1,
								offset: cubeUVOffset,
								format: 'float32x2',
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
				cullMode: 'back',
			},
			depthStencil: {
				depthWriteEnabled: true,
				depthCompare: 'less',
				format: 'depth24plus',
			},
		});

		// Fetch the image and upload it into a GPUTexture.
	//	let cubeTexture: GPUTexture;
	//	{
	//		const response = await fetch('./images/molecule.jpeg');
	//		const imageBitmap = await createImageBitmap(await response.blob());
	//
	//		cubeTexture = device.createTexture({
	//			size: [imageBitmap.width, imageBitmap.height, 1],
	//			format: 'rgba8unorm',
	//			usage:
	//				GPUTextureUsage.TEXTURE_BINDING |
	//				GPUTextureUsage.COPY_DST |
	//				GPUTextureUsage.RENDER_ATTACHMENT,
	//		});
	//		device.queue.copyExternalImageToTexture(
	//			{ source: imageBitmap },
	//			{ texture: cubeTexture },
	//			[imageBitmap.width, imageBitmap.height]
	//		);
	//	}

		// Create a sampler with linear filtering for smooth interpolation.
	//	const sampler = device.createSampler({
	//		magFilter: 'linear',
	//		minFilter: 'linear',
	//	});

	//	let cubeBindGroup = device.createBindGroup({
	//		layout: cubeBindGroupLayout,
	//		entries: [
	//			{
	//				binding: 0,
	//				resource: sampler,
	//			},
	//			{
	//				binding: 1,
	//				resource: cubeTexture.createView(),
	//			},
	//		],
	//	});
	//	let textureCubeLayerBindGroup: BindGroup = new BindGroup(1, cubeBindGroup);


		// RenderPassLayer
		let renderPassLayer: RenderPassLayer = new RenderPassLayer("rpl_texture-cube", pipeline, cubeBindGroupLayout);
		renderPassLayer.AddMeshGroup(cubeMeshGroup);

	//	renderPassLayer.AddBindGroup(textureCubeLayerBindGroup);

		return renderPassLayer;
	}
}