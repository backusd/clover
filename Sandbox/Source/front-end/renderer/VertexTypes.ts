import { Vec2, Vec3, vec2, vec3 } from 'wgpu-matrix';



export class BasicObjectVertex
{
    constructor(px: number, py: number, pz: number, nx: number, ny: number, nz: number, tx: number, ty: number, tz: number, tcu: number, tcv: number)
    {
        this.position = vec3.create(px, py, pz);
        this.normal = vec3.create(nx, ny, nz);
        this.tangent = vec3.create(tx, ty, tz);
        this.textureCoords = vec2.create(tcu, tcv);
    }
    MidPoint(v: BasicObjectVertex): BasicObjectVertex
    {
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

    position: Vec3;
    normal: Vec3;
    tangent: Vec3;
    textureCoords: Vec2;

    static readonly floatsPerVertex = 3 + 3 + 3 + 2;
    static readonly bytesPerVertex = (3 + 3 + 3 + 2) * Float32Array.BYTES_PER_ELEMENT;

    static PositionByteOffset(): number { return 0; }
    static NormalByteOffset(): number { return Float32Array.BYTES_PER_ELEMENT * 3; }
    static TangentByteOffset(): number { return Float32Array.BYTES_PER_ELEMENT * (3 + 3); }
    static TextureCoordsByteOffset(): number { return Float32Array.BYTES_PER_ELEMENT * (3 + 3 + 3); }

    static PositionVertexFormat(): GPUVertexFormat { return 'float32x3'; }
    static NormalVertexFormat(): GPUVertexFormat { return 'float32x3'; }
    static TangentVertexFormat(): GPUVertexFormat { return 'float32x3'; }
    static TextureCoordsVertexFormat(): GPUVertexFormat { return 'float32x2'; }
}