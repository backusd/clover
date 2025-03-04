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
function Subdivide(vertices: BasicObjectVertex[], indices: Uint32Array<ArrayBuffer>): { vertices: BasicObjectVertex[], indices: Uint32Array<ArrayBuffer> }
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
        let _v0 = vertices[indices[iii * 3 + 0]];
        let _v1 = vertices[indices[iii * 3 + 1]];
        let _v2 = vertices[indices[iii * 3 + 2]];

        let v0 = new BasicObjectVertex(
            _v0.position[0], _v0.position[1], _v0.position[2],
            _v0.normal[0], _v0.normal[1], _v0.normal[2],
            _v0.tangent[0], _v0.tangent[1], _v0.tangent[2],
            _v0.textureCoords[0], _v0.textureCoords[1]
        );

        let v1 = new BasicObjectVertex(
            _v1.position[0], _v1.position[1], _v1.position[2],
            _v1.normal[0], _v1.normal[1], _v1.normal[2],
            _v1.tangent[0], _v1.tangent[1], _v1.tangent[2],
            _v1.textureCoords[0], _v1.textureCoords[1]
        );

        let v2 = new BasicObjectVertex(
            _v2.position[0], _v2.position[1], _v2.position[2],
            _v2.normal[0], _v2.normal[1], _v2.normal[2],
            _v2.tangent[0], _v2.tangent[1], _v2.tangent[2],
            _v2.textureCoords[0], _v2.textureCoords[1]
        );

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

    return { vertices: newVertices, indices: newIndices };
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
    {
        let { vertices: newV, indices: newI } = Subdivide(v, i);
        v = newV;
        i = newI;
    }

    let mesh = new Mesh();
    mesh.CreateMeshFromRawData(name, PackVertices(v), BasicObjectVertex.floatsPerVertex, i);
    return mesh;
}
export function GenerateSphereMesh(name: string, radius: number, sliceCount: number, stackCount: number): Mesh
{
    if (stackCount <= 0)
    {
        LOG_CORE_ERROR(`GenerateSphereMesh: Invalid stackCount value '${stackCount}'. Value must be >= 1. Setting stackCount to 10`);
        stackCount = 10;
    }
    if (sliceCount <= 0)
    {
        LOG_CORE_ERROR(`GenerateSphereMesh: Invalid sliceCount value '${sliceCount}'. Value must be >= 1. Setting sliceCount to 10`);
        sliceCount = 10;
    }

    //
    // Compute the vertices stating at the top pole and moving down the stacks.
    //
    let v = new Array<BasicObjectVertex>();

    // Poles: note that there will be texture coordinate distortion as there is
	// not a unique point on the texture map to assign to the pole when mapping
	// a rectangular texture onto a sphere.
	let topVertex = new BasicObjectVertex(0.0, +radius, 0.0, 0.0, +1.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0);
	let bottomVertex = new BasicObjectVertex(0.0, -radius, 0.0, 0.0, -1.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0);

    v.push(topVertex);

    let phiStep = Math.PI / stackCount;
    let thetaStep = 2 * Math.PI / sliceCount;

    // Compute vertices for each stack ring (do not count the poles as rings).
    for (let iii = 1; iii <= stackCount - 1; ++iii)
    {
		let phi = iii * phiStep;

        // Vertices of ring.
        for (let jjj = 0; jjj <= sliceCount; ++jjj)
        {
			let theta = jjj * thetaStep;

            // spherical to cartesian
            let p = vec3.create(
                radius * Math.sin(phi) * Math.cos(theta),
                radius * Math.cos(phi),
                radius * Math.sin(phi) * Math.sin(theta)
            );

            // Partial derivative of P with respect to theta
            let t = vec3.normalize(
                vec3.create(
                    -radius * Math.sin(phi) * Math.sin(theta),
                    0.0,
                    +radius * Math.sin(phi) * Math.cos(theta)
                )
            );

            let n = vec3.normalize(p);

            let tcu = theta / (Math.PI * 2);
            let tcv = phi / Math.PI;

            v.push(new BasicObjectVertex(p[0], p[1], p[2], n[0], n[1], n[2], t[0], t[1], t[2], tcu, tcv));
        }
    }

    v.push(bottomVertex);

    //
    // Compute indices for top stack.  The top stack was written first to the vertex buffer
    // and connects the top pole to the first ring.
    //

    let indices: number[] = [];

    for (let iii = 1; iii <= sliceCount; ++iii)
    {
        indices.push(0);
        indices.push(iii + 1);
        indices.push(iii);
    }

    //
	// Compute indices for inner stacks (not connected to poles).
	//

	// Offset the indices to the index of the first vertex in the first ring.
	// This is just skipping the top pole vertex.
    let baseIndex = 1;
    let ringVertexCount = sliceCount + 1;
    for (let iii = 0; iii < stackCount - 2; ++iii)
    {
        for (let jjj = 0; jjj < sliceCount; ++jjj)
        {
            indices.push(baseIndex + iii * ringVertexCount + jjj);
            indices.push(baseIndex + iii * ringVertexCount + jjj + 1);
            indices.push(baseIndex + (iii + 1) * ringVertexCount + jjj);
            indices.push(baseIndex + (iii + 1) * ringVertexCount + jjj);
            indices.push(baseIndex + iii * ringVertexCount + jjj + 1);
            indices.push(baseIndex + (iii + 1) * ringVertexCount + jjj + 1);
        }
    }

    //
	// Compute indices for bottom stack.  The bottom stack was written last to the vertex buffer
	// and connects the bottom pole to the bottom ring.
	//

	// South pole vertex was added last.
	let southPoleIndex = v.length - 1;

    // Offset the indices to the index of the first vertex in the last ring.
    baseIndex = southPoleIndex - ringVertexCount;

    for (let iii = 0; iii < sliceCount; ++iii)
    {
        indices.push(southPoleIndex);
        indices.push(baseIndex + iii);
        indices.push(baseIndex + iii + 1);
    }

    let i = new Uint32Array(indices);

    let mesh = new Mesh();
    mesh.CreateMeshFromRawData(name, PackVertices(v), BasicObjectVertex.floatsPerVertex, i);
    return mesh;
}
export function GenerateGeosphereMesh(name: string, radius: number, numSubdivisions: number): Mesh
{
    if (numSubdivisions < 0)
    {
        LOG_CORE_ERROR(`GenerateGeosphereMesh: Invalid numSubdivisions value '${numSubdivisions}'. Value must be in the range [0, 6]. Setting numSubdivisions to 0`);
        numSubdivisions = 0;
    }
    else if (numSubdivisions > 6)
    {
        LOG_CORE_WARN(`GenerateGeosphereMesh: Invalid numSubdivisions value '${numSubdivisions}'. Value must be in the range [0, 6]. Setting numSubdivisions to 6`);
        numSubdivisions = 6;
    }

    // Approximate a sphere by tessellating an icosahedron.
    const X = 0.525731;
    const Z = 0.850651;

    let pos: Vec3[] = [
        vec3.create(-X, 0.0, Z), vec3.create(X, 0.0, Z),
        vec3.create(-X, 0.0, -Z), vec3.create(X, 0.0, -Z),
        vec3.create(0.0, Z, X), vec3.create(0.0, Z, -X),
        vec3.create(0.0, -Z, X), vec3.create(0.0, -Z, -X),
        vec3.create(Z, X, 0.0), vec3.create(-Z, X, 0.0),
        vec3.create(Z, -X, 0.0), vec3.create(-Z, -X, 0.0)
    ];

    let i: number[] = [
        1, 4, 0, 4, 9, 0, 4, 5, 9, 8, 5, 4, 1, 8, 4,
        1, 10, 8, 10, 3, 8, 8, 3, 5, 3, 2, 5, 3, 7, 2,
        3, 10, 7, 10, 6, 7, 6, 11, 7, 6, 0, 11, 6, 1, 0,
        10, 1, 6, 11, 0, 9, 2, 11, 9, 5, 2, 9, 11, 2, 7 
    ];
    let indices = new Uint32Array(i);

    let v = new Array<BasicObjectVertex>(12);

    for (let iii = 0; iii < 12; ++iii)
        v[iii] = new BasicObjectVertex(pos[iii][0], pos[iii][1], pos[iii][2], 0, 0, 0, 0, 0, 0, 0, 0);

    for (let iii = 0; iii < numSubdivisions; ++iii)
    {
        let { vertices: newV, indices: newI } = Subdivide(v, indices);
        v = newV;
        indices = newI;
    }

    // Project vertices onto sphere and scale.
    for (let iii = 0; iii < v.length; ++iii)
    {
        let vertex = v[iii];

        // normal: Project onto unit sphere.
        vec3.normalize(vertex.position, vertex.normal);

        // position: Project onto sphere
        vec3.scale(vertex.normal, radius, vertex.position);

        // texCoords: Derive texture coordinates from spherical coordinates.
        let theta = Math.atan2(vertex.position[2], vertex.position[0]);

        // Put in [0, 2pi].
        if (theta < 0.0)
            theta += (Math.PI * 2);

        let phi = Math.acos(vertex.position[1] / radius);

        vertex.textureCoords[0] = theta / (Math.PI * 2);
        vertex.textureCoords[0] = phi / Math.PI;

        // tangent: Partial derivative of P with respect to theta
        vertex.tangent[0] = -radius * Math.sin(phi) * Math.sin(theta);
        vertex.tangent[1] = 0.0;
        vertex.tangent[2] = +radius * Math.sin(phi) * Math.cos(theta);
    }

    let mesh = new Mesh();
    mesh.CreateMeshFromRawData(name, PackVertices(v), BasicObjectVertex.floatsPerVertex, indices);
    return mesh;
}
