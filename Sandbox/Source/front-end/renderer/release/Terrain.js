import { Mesh, MeshGroup, BindGroup, RenderPassLayer } from "./Renderer.js";
import { mat4 } from 'wgpu-matrix';
const terrainVertexNumFloats = 8;
const vertexStride = 4 * terrainVertexNumFloats;
const positionOffest = 0;
const colorOffset = 4 * 4;
const vertexCount = 2;
const terrainVertexArray = new Float32Array([
    -1, 0, 0, 1, 1, 1, 1, 1,
    1, 0, 0, 1, 1, 1, 1, 1,
]);
export class Terrain {
    constructor(width, depth) {
        this.m_width = width;
        this.m_depth = depth;
    }
    Initialize(renderer, passBindGroupLayout) {
        let device = renderer.GetDevice();
        let context = renderer.GetContext();
        let vertexBuffer = device.createBuffer({
            label: "terrain vertex buffer",
            size: terrainVertexArray.byteLength,
            usage: GPUBufferUsage.VERTEX,
            mappedAtCreation: true,
        });
        new Float32Array(vertexBuffer.getMappedRange()).set(terrainVertexArray);
        vertexBuffer.unmap();
        const module = device.createShaderModule({
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
        const sizeOfFloat = 4;
        let bytesInAMatrix = sizeOfFloat * 4 * 4;
        let numInstances = (this.m_width * 2 + 1) + (this.m_depth * 2 + 1);
        const instanceBuffer = device.createBuffer({
            label: 'Instance Buffer',
            size: bytesInAMatrix * numInstances,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });
        let instanceData = new Float32Array(16 * numInstances);
        let instance = 0;
        for (let x = -1 * this.m_width; x <= this.m_width; x++) {
            let data = instanceData.subarray(instance * 16, (instance + 1) * 16);
            let m = mat4.multiply(mat4.scaling([1, 1, this.m_depth]), mat4.rotationY(Math.PI / 2));
            mat4.multiply(mat4.translation([x, 0, 0]), m, data);
            instance++;
        }
        for (let y = -1 * this.m_depth; y <= this.m_depth; y++) {
            let data = instanceData.subarray(instance * 16, (instance + 1) * 16);
            mat4.multiply(mat4.translation([0, 0, y]), mat4.scaling([this.m_width, 1, 1]), data);
            instance++;
        }
        device.queue.writeBuffer(instanceBuffer, 0, instanceData.buffer, instanceData.byteOffset, instanceData.byteLength);
        let instanceBindGroupLayout = device.createBindGroupLayout({
            label: "Instance BindGroupLayout",
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.VERTEX,
                    buffer: { type: "read-only-storage" }
                }
            ]
        });
        let layoutDescriptor = {
            bindGroupLayouts: [passBindGroupLayout, instanceBindGroupLayout]
        };
        let pipelineLayout = device.createPipelineLayout(layoutDescriptor);
        pipelineLayout.label = "Terrain PipelineLayout";
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
                                shaderLocation: 0,
                                offset: positionOffest,
                                format: 'float32x4',
                            },
                            {
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
        let terrainLayerBindGroup = new BindGroup(1, instanceBindGroup);
        let terrainMesh = new Mesh();
        terrainMesh.CreateMeshFromRawData("mesh_terrain", terrainVertexArray, terrainVertexNumFloats);
        let terrainMeshGroup = new MeshGroup("mg_terrain", device, [terrainMesh], 0);
        let renderItem = terrainMeshGroup.CreateRenderItem("ri_terrain", "mesh_terrain");
        renderItem.SetInstanceCount(numInstances);
        renderer.AddMeshGroup(terrainMeshGroup);
        let renderPassLayer = new RenderPassLayer("rpl_terrain", renderer, pipeline);
        renderPassLayer.AddMeshGroup(terrainMeshGroup.Name());
        renderPassLayer.AddBindGroup(terrainLayerBindGroup);
        return renderPassLayer;
    }
    m_width;
    m_depth;
}
