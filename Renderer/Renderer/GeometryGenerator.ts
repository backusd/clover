import { Vec2, Vec3, vec2, vec3 } from 'wgpu-matrix';
import
    {
        LOG_CORE_INFO,
        LOG_CORE_TRACE,
        LOG_CORE_WARN,
        LOG_CORE_ERROR
} from "./Log.js"
import { BasicObjectVertex } from "./VertexTypes.js"
import { Mesh } from "./Renderer.js"

function PackVertices(vertices: BasicObjectVertex[]): Float32Array
{
    let array = new Float32Array(vertices.length * BasicObjectVertex.floatsPerVertex);

    for (let iii = 0; iii < vertices.length; ++iii)
    {
        let vertex = vertices[iii];
        let index = iii * BasicObjectVertex.floatsPerVertex;

        array[index]     = vertex.position[0];
        array[index + 1] = vertex.position[1];
        array[index + 2] = vertex.position[2];

        array[index + 3] = vertex.normal[0];
        array[index + 4] = vertex.normal[1];
        array[index + 5] = vertex.normal[2];

        array[index + 6] = vertex.tangent[0];
        array[index + 7] = vertex.tangent[1];
        array[index + 8] = vertex.tangent[2];

        array[index + 9]  = vertex.textureCoords[0];
        array[index + 10] = vertex.textureCoords[1];
    }

    return array;
}
function Subdivide(vertices: BasicObjectVertex[], indices: Uint32Array): void
{
    let newVertices = new Array<BasicObjectVertex>();

    const numTris = indices.length / 3;
    let newIndices = new Uint32Array(numTris * 12); 
    let newIndicesIndex = 0;

    //       v1
    //       *
    //      / \
    //     /   \
    //  m0*-----*m1
    //   / \   / \
    //  /   \ /   \
    // *-----*-----*
    // v0    m2     v2

    for (let iii = 0; iii < numTris; ++iii)
    {
        let v0 = vertices[indices[iii * 3 + 0]].CreateCopy();
        let v1 = vertices[indices[iii * 3 + 1]].CreateCopy();
        let v2 = vertices[indices[iii * 3 + 2]].CreateCopy();

        //
		// Generate the midpoints.
		//

        let m0 = v0.MidPoint(v1);
        let m1 = v1.MidPoint(v2);
        let m2 = v0.MidPoint(v2);

        //
        // Add new geometry.
        //

        newVertices.push(v0); // 0
        newVertices.push(v1); // 1
        newVertices.push(v2); // 2
        newVertices.push(m0); // 3
        newVertices.push(m1); // 4
        newVertices.push(m2); // 5

        newIndices[newIndicesIndex++] = iii * 6 + 0;
        newIndices[newIndicesIndex++] = iii * 6 + 3;
        newIndices[newIndicesIndex++] = iii * 6 + 5;

        newIndices[newIndicesIndex++] = iii * 6 + 3;
        newIndices[newIndicesIndex++] = iii * 6 + 4;
        newIndices[newIndicesIndex++] = iii * 6 + 5;

        newIndices[newIndicesIndex++] = iii * 6 + 5;
        newIndices[newIndicesIndex++] = iii * 6 + 4;
        newIndices[newIndicesIndex++] = iii * 6 + 2;

        newIndices[newIndicesIndex++] = iii * 6 + 3;
        newIndices[newIndicesIndex++] = iii * 6 + 1;
        newIndices[newIndicesIndex++] = iii * 6 + 4;
    }

    vertices = newVertices;
    indices = newIndices;
}

export function GenerateBoxMesh(name: string, width: number, height: number, depth: number, numSubdivisions: number): Mesh
{
    //
    // Create the vertices.
    //
    let v = new Array<BasicObjectVertex>(24);

    let w2 = 0.5 * width;
	let h2 = 0.5 * height;
	let d2 = 0.5 * depth;

    // Fill in the front face vertex data.
    v[0] = new BasicObjectVertex(-w2, -h2, -d2, 0.0, 0.0, -1.0, 1.0, 0.0, 0.0, 0.0, 1.0);
    v[1] = new BasicObjectVertex(-w2, +h2, -d2, 0.0, 0.0, -1.0, 1.0, 0.0, 0.0, 0.0, 0.0);
    v[2] = new BasicObjectVertex(+w2, +h2, -d2, 0.0, 0.0, -1.0, 1.0, 0.0, 0.0, 1.0, 0.0);
    v[3] = new BasicObjectVertex(+w2, -h2, -d2, 0.0, 0.0, -1.0, 1.0, 0.0, 0.0, 1.0, 1.0);

    // Fill in the back face vertex data.
    v[4] = new BasicObjectVertex(-w2, -h2, +d2, 0.0, 0.0, 1.0, -1.0, 0.0, 0.0, 1.0, 1.0);
    v[5] = new BasicObjectVertex(+w2, -h2, +d2, 0.0, 0.0, 1.0, -1.0, 0.0, 0.0, 0.0, 1.0);
    v[6] = new BasicObjectVertex(+w2, +h2, +d2, 0.0, 0.0, 1.0, -1.0, 0.0, 0.0, 0.0, 0.0);
    v[7] = new BasicObjectVertex(-w2, +h2, +d2, 0.0, 0.0, 1.0, -1.0, 0.0, 0.0, 1.0, 0.0);

    // Fill in the top face vertex data.
    v[8] = new BasicObjectVertex(-w2, +h2, -d2, 0.0, 1.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0);
    v[9] = new BasicObjectVertex(-w2, +h2, +d2, 0.0, 1.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0);
    v[10] = new BasicObjectVertex(+w2, +h2, +d2, 0.0, 1.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0);
    v[11] = new BasicObjectVertex(+w2, +h2, -d2, 0.0, 1.0, 0.0, 1.0, 0.0, 0.0, 1.0, 1.0);

    // Fill in the bottom face vertex data.
    v[12] = new BasicObjectVertex(-w2, -h2, -d2, 0.0, -1.0, 0.0, -1.0, 0.0, 0.0, 1.0, 1.0);
    v[13] = new BasicObjectVertex(+w2, -h2, -d2, 0.0, -1.0, 0.0, -1.0, 0.0, 0.0, 0.0, 1.0);
    v[14] = new BasicObjectVertex(+w2, -h2, +d2, 0.0, -1.0, 0.0, -1.0, 0.0, 0.0, 0.0, 0.0);
    v[15] = new BasicObjectVertex(-w2, -h2, +d2, 0.0, -1.0, 0.0, -1.0, 0.0, 0.0, 1.0, 0.0);

    // Fill in the left face vertex data.
    v[16] = new BasicObjectVertex(-w2, -h2, +d2, -1.0, 0.0, 0.0, 0.0, 0.0, -1.0, 0.0, 1.0);
    v[17] = new BasicObjectVertex(-w2, +h2, +d2, -1.0, 0.0, 0.0, 0.0, 0.0, -1.0, 0.0, 0.0);
    v[18] = new BasicObjectVertex(-w2, +h2, -d2, -1.0, 0.0, 0.0, 0.0, 0.0, -1.0, 1.0, 0.0);
    v[19] = new BasicObjectVertex(-w2, -h2, -d2, -1.0, 0.0, 0.0, 0.0, 0.0, -1.0, 1.0, 1.0);

    // Fill in the right face vertex data.
    v[20] = new BasicObjectVertex(+w2, -h2, -d2, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 1.0);
    v[21] = new BasicObjectVertex(+w2, +h2, -d2, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0);
    v[22] = new BasicObjectVertex(+w2, +h2, +d2, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 1.0, 0.0);
    v[23] = new BasicObjectVertex(+w2, -h2, +d2, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 1.0, 1.0);

    //
	// Create the indices.
	//

    let i = new Uint32Array(36);

    // Fill in the front face index data
    i[0] = 0; i[1] = 1; i[2] = 2;
    i[3] = 0; i[4] = 2; i[5] = 3;

    // Fill in the back face index data
    i[6] = 4; i[7] = 5; i[8] = 6;
    i[9] = 4; i[10] = 6; i[11] = 7;

    // Fill in the top face index data
    i[12] = 8; i[13] = 9; i[14] = 10;
    i[15] = 8; i[16] = 10; i[17] = 11;

    // Fill in the bottom face index data
    i[18] = 12; i[19] = 13; i[20] = 14;
    i[21] = 12; i[22] = 14; i[23] = 15;

    // Fill in the left face index data
    i[24] = 16; i[25] = 17; i[26] = 18;
    i[27] = 16; i[28] = 18; i[29] = 19;

    // Fill in the right face index data
    i[30] = 20; i[31] = 21; i[32] = 22;
    i[33] = 20; i[34] = 22; i[35] = 23;

    if (numSubdivisions < 0)
    {
        LOG_CORE_ERROR(`GenerateBoxMesh: Invalid numSubdivisions value '${numSubdivisions}'. Value must be in the range [0, 6]. Setting numSubdivisions to 0`);
        numSubdivisions = 0;
    }
    else if (numSubdivisions > 6)
    {
        LOG_CORE_WARN(`GenerateBoxMesh: Invalid numSubdivisions value '${numSubdivisions}'. Value must be in the range [0, 6]. Setting numSubdivisions to 6`);
        numSubdivisions = 6;
    }

    for (let iii = 0; iii < numSubdivisions; ++iii)
        Subdivide(v, i);

    let mesh = new Mesh();
    mesh.CreateMeshFromRawData(name, PackVertices(v), BasicObjectVertex.floatsPerVertex, i);
    return mesh;
}