import { vec2, vec3 } from 'wgpu-matrix';
export class BasicObjectVertex {
    constructor(px, py, pz, nx, ny, nz, tx, ty, tz, tcu, tcv) {
        this.position = vec3.create(px, py, pz);
        this.normal = vec3.create(nx, ny, nz);
        this.tangent = vec3.create(tx, ty, tz);
        this.textureCoords = vec2.create(tcu, tcv);
    }
    MidPoint(v) {
        let p0 = vec3.copy(this.position);
        let p1 = vec3.copy(v.position);
        let n0 = vec3.copy(this.normal);
        let n1 = vec3.copy(v.normal);
        let t0 = vec3.copy(this.tangent);
        let t1 = vec3.copy(v.tangent);
        let tc0 = vec2.copy(this.textureCoords);
        let tc1 = vec2.copy(v.textureCoords);
        // Compute the midpoints of all the attributes. Vectors need to be normalized
        // since linear interpolating can make them not unit length.
        let p = vec3.scale(vec3.add(p0, p1), 0.5);
        let n = vec3.normalize(vec3.scale(vec3.add(n0, n1), 0.5));
        let t = vec3.normalize(vec3.scale(vec3.add(t0, t1), 0.5));
        let tc = vec2.scale(vec2.add(tc0, tc1), 0.5);
        return new BasicObjectVertex(p[0], p[1], p[2], n[0], n[1], n[2], t[0], t[1], t[2], tc[0], tc[1]);
    }
    position;
    normal;
    tangent;
    textureCoords;
    static floatsPerVertex = 3 + 3 + 3 + 2;
    static bytesPerVertex = (3 + 3 + 3 + 2) * Float32Array.BYTES_PER_ELEMENT;
    static PositionByteOffset() { return 0; }
    static NormalByteOffset() { return Float32Array.BYTES_PER_ELEMENT * 3; }
    static TangentByteOffset() { return Float32Array.BYTES_PER_ELEMENT * (3 + 3); }
    static TextureCoordsByteOffset() { return Float32Array.BYTES_PER_ELEMENT * (3 + 3 + 3); }
    static PositionVertexFormat() { return 'float32x3'; }
    static NormalVertexFormat() { return 'float32x3'; }
    static TangentVertexFormat() { return 'float32x3'; }
    static TextureCoordsVertexFormat() { return 'float32x2'; }
}
//# sourceMappingURL=VertexTypes.js.map