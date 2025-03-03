import { RenderPassLayer } from "./Renderer.js";
import { BasicObjectVertex } from "./VertexTypes.js";
export function GetBasicObjectLayer(renderer, passBindGroupLayout) {
    let device = renderer.GetDevice();
    // Create the shader
    const module = device.createShaderModule({
        label: 'sm_basic-object',
        code: `
struct Uniforms
{
	viewProjectionMatrix : mat4x4f
}

struct Vertex
{
	@location(0) position: vec3f,
	@location(1) normal: vec3f,
	@location(2) tangent: vec3f,
	@location(3) textureCoords: vec2f
}

@group(0) @binding(0) var<uniform> uniforms : Uniforms;

@group(1) @binding(0) var<uniform> modelMatrix: mat4x4f;

struct VertexOutput
{
	@builtin(position) Position : vec4f,
	@location(0) color : vec4f,
}

@vertex
fn vertex_main(vertex: Vertex) -> VertexOutput
{
	let mvp = uniforms.viewProjectionMatrix * modelMatrix;
	return VertexOutput(mvp * vec4f(vertex.position, 1), vec4f(1, 1, 1, 1));
}

@fragment
fn fragment_main(@location(0) color: vec4f) -> @location(0) vec4f
{
	return color;
}
`
    });
    // Bind group layout for the RenderItem
    let basicObjectBindGroupLayout = device.createBindGroupLayout({
        label: "bgl_basic-object",
        entries: [
            {
                binding: 0,
                visibility: GPUShaderStage.VERTEX,
                buffer: {
                    type: "uniform",
                    minBindingSize: Float32Array.BYTES_PER_ELEMENT * 16 // BEST PRACTICE to always set this
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
    // There is no bind group for the layer, so the bind group for the RenderItem will be at index 1
    let basicObjectBindGroupLayoutGroupNumber = 1;
    let layoutDescriptor = {
        label: "ld_basic-object",
        bindGroupLayouts: [passBindGroupLayout, basicObjectBindGroupLayout]
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
    return new RenderPassLayer("rpl_basic-object", renderer, pipeline, basicObjectBindGroupLayout, basicObjectBindGroupLayoutGroupNumber);
}
//# sourceMappingURL=BasicObjectLayer.js.map