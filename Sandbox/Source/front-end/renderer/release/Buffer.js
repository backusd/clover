class InstanceBuffer {
    constructor(device, bytesPerInstance, numberOfInstances, label = "(unlabeled)") {
        this.m_device = device;
        this.m_gpuBuffer = device.createBuffer({
            label: label,
            size: bytesPerInstance * numberOfInstances,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });
        this.m_bytesPerInstance = bytesPerInstance;
        this.m_numberOfInstances = numberOfInstances;
    }
    GetGPUBuffer() { return this.m_gpuBuffer; }
    CurrentCapacity() { return this.m_numberOfInstances; }
    SetCapacity(numberOfInstances) {
        if (numberOfInstances > this.m_numberOfInstances) {
            this.m_numberOfInstances = numberOfInstances;
            this.m_gpuBuffer.destroy();
            this.m_gpuBuffer = this.m_device.createBuffer({
                label: this.m_gpuBuffer.label,
                size: this.m_bytesPerInstance * this.m_numberOfInstances,
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
            });
            this.SetCapacityDerived(numberOfInstances);
        }
    }
    m_device;
    m_gpuBuffer;
    m_bytesPerInstance;
    m_numberOfInstances;
}
export class InstanceBufferBasicWrite extends InstanceBuffer {
    constructor(device, bytesPerInstance, numberOfInstances, label = "(unlabeled)") {
        super(device, bytesPerInstance, numberOfInstances, label);
    }
    SetCapacityDerived(numberOfInstances) {
    }
    PreRender() {
    }
    WriteData(instanceIndex, data, byteOffset, numBytesToWrite) {
        this.m_device.queue.writeBuffer(this.m_gpuBuffer, instanceIndex * this.m_bytesPerInstance, data, byteOffset, numBytesToWrite);
    }
}
export class InstanceBufferPool extends InstanceBuffer {
    constructor(device, bytesPerInstance, numberOfInstances, label = "(unlabeled)") {
        super(device, bytesPerInstance, numberOfInstances, label);
    }
    GetOrCreateBuffer() {
        let buffer = this.m_readyBuffers.pop();
        if (buffer === undefined) {
            buffer = this.m_device.createBuffer({
                label: `Pool Buffer for ${this.m_gpuBuffer.label}`,
                size: this.m_bytesPerInstance * this.m_numberOfInstances,
                usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.MAP_WRITE,
                mappedAtCreation: true
            });
        }
        return buffer;
    }
    SetCapacityDerived(numberOfInstances) {
        this.m_readyBuffers.forEach(buffer => { buffer.destroy(); });
        this.m_readyBuffers = [];
        this.m_stagingBuffer = null;
    }
    PreRender() {
        if (this.m_stagingBuffer !== null) {
            let stagingBuffer = this.m_stagingBuffer;
            stagingBuffer.unmap();
            const commandEncoder = this.m_device.createCommandEncoder({});
            commandEncoder.copyBufferToBuffer(stagingBuffer, 0, this.m_gpuBuffer, 0, this.m_bytesPerInstance * this.m_numberOfInstances);
            this.m_device.queue.submit([commandEncoder.finish()]);
            let currentCapacity = this.CurrentCapacity();
            stagingBuffer.mapAsync(GPUMapMode.WRITE).then(() => {
                if (currentCapacity === this.CurrentCapacity())
                    this.m_readyBuffers.push(stagingBuffer);
                else {
                    stagingBuffer.unmap();
                    stagingBuffer.destroy();
                }
            });
            this.m_stagingBuffer = null;
        }
    }
    WriteData(instanceIndex, data, byteOffset, numBytesToWrite) {
        if (this.m_stagingBuffer === null)
            this.m_stagingBuffer = this.GetOrCreateBuffer();
        let mappedRange = new Float32Array(this.m_stagingBuffer.getMappedRange(instanceIndex * this.m_bytesPerInstance, this.m_bytesPerInstance));
        mappedRange.set(new Float32Array(data, byteOffset, numBytesToWrite / Float32Array.BYTES_PER_ELEMENT));
    }
    m_readyBuffers = [];
    m_stagingBuffer = null;
}
class UniformBuffer {
    constructor(device, bufferSizeInBytes, label = "(unlabeled)") {
        this.m_device = device;
        this.m_gpuBuffer = device.createBuffer({
            label: label,
            size: bufferSizeInBytes,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        this.m_bufferSizeInBytes = bufferSizeInBytes;
    }
    GetGPUBuffer() { return this.m_gpuBuffer; }
    m_device;
    m_gpuBuffer;
    m_bufferSizeInBytes;
}
export class UniformBufferBasicWrite extends UniformBuffer {
    constructor(device, bufferSizeInBytes, label = "(unlabeled)") {
        super(device, bufferSizeInBytes, label);
    }
    WriteData(data, byteOffset, numBytesToWrite) {
        this.m_device.queue.writeBuffer(this.m_gpuBuffer, 0, data, byteOffset, numBytesToWrite);
    }
}
export class UniformBufferPool extends UniformBuffer {
    constructor(device, bufferSizeInBytes, label = "(unlabeled)") {
        super(device, bufferSizeInBytes, label);
        this.m_readyBuffers = [];
    }
    WriteData(data, byteOffset, numBytesToWrite) {
        let stagingBuffer = this.GetOrCreateBuffer();
        let mappedRange = new Float32Array(stagingBuffer.getMappedRange());
        mappedRange.set(new Float32Array(data, byteOffset, numBytesToWrite));
        stagingBuffer.unmap();
        const commandEncoder = this.m_device.createCommandEncoder({});
        commandEncoder.copyBufferToBuffer(stagingBuffer, 0, this.m_gpuBuffer, 0, data.byteLength);
        this.m_device.queue.submit([commandEncoder.finish()]);
        stagingBuffer.mapAsync(GPUMapMode.WRITE).then(() => { this.m_readyBuffers.push(stagingBuffer); });
    }
    GetOrCreateBuffer() {
        let buffer = this.m_readyBuffers.pop();
        if (buffer === undefined) {
            buffer = this.m_device.createBuffer({
                label: `Pool Buffer for ${this.m_gpuBuffer.label}`,
                size: this.m_bufferSizeInBytes,
                usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.MAP_WRITE,
                mappedAtCreation: true
            });
        }
        return buffer;
    }
    m_readyBuffers;
}
