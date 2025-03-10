import { Mesh, MeshGroup, RenderPassLayer } from "./Renderer.js";
const cubeVertexNumFloats = 10;
const cubeVertexStride = 4 * cubeVertexNumFloats;
const cubePositionOffset = 0;
const cubeColorOffset = 4 * 4;
const cubeUVOffset = 4 * 8;
const cubeVertexCount = 36;
const cubeVertexArray = new Float32Array([
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
export class TextureCube {
    Initialize(renderer, passBindGroupLayout) {
        let device = renderer.GetDevice();
        let boxMesh = new Mesh();
        boxMesh.CreateMeshFromRawData("mesh_texture-cube", cubeVertexArray, cubeVertexNumFloats);
        let cubeMeshGroup = new MeshGroup("mg_texture-cube", device, [boxMesh], 0);
        const module = device.createShaderModule({
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
        let cubeBindGroupLayout = device.createBindGroupLayout({
            label: "bgl_game-cube",
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.VERTEX,
                    buffer: {
                        type: "uniform",
                        minBindingSize: 4 * 16
                    }
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
        });
        let cubeBindGroupLayoutGroupNumber = 1;
        let cubePipelineLayoutDescriptor = {
            bindGroupLayouts: [passBindGroupLayout, cubeBindGroupLayout]
        };
        let cubePipelineLayout = device.createPipelineLayout(cubePipelineLayoutDescriptor);
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
                                shaderLocation: 0,
                                offset: cubePositionOffset,
                                format: 'float32x4',
                            },
                            {
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
        renderer.AddMeshGroup(cubeMeshGroup);
        let renderPassLayer = new RenderPassLayer("rpl_texture-cube", renderer, pipeline, cubeBindGroupLayout, cubeBindGroupLayoutGroupNumber);
        renderPassLayer.AddMeshGroup(cubeMeshGroup.Name());
        return renderPassLayer;
    }
}
