import { LOG_CORE_ERROR } from "./Log.js";
class UniformBuffer {
    constructor(device, bufferSizeInBytes, label = "(unlabeled)") {
        this.m_device = device;
        this.m_gpuBuffer = device.createBuffer({
            label: label,
            size: bufferSizeInBytes,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        // DEBUG_ONLY
        this.m_bufferSizeInBytes = bufferSizeInBytes;
    }
    GetGPUBuffer() { return this.m_gpuBuffer; }
    m_device;
    m_gpuBuffer;
    // DEBUG_ONLY
    m_bufferSizeInBytes;
}
export class UniformBufferWritable extends UniformBuffer {
    constructor(device, bufferSizeInBytes, label = "(unlabeled)") {
        super(device, bufferSizeInBytes, label);
    }
    WriteData(data) {
        // DEBUG_ONLY
        if (data.byteLength !== this.m_bufferSizeInBytes) {
            let msg = `UniformBufferWritable::WriteData() failed for buffer '${this.m_gpuBuffer.label}'. Buffer size is '${this.m_bufferSizeInBytes}', but trying to write ${data.byteLength}.`;
            LOG_CORE_ERROR(msg);
            throw Error(msg);
        }
        this.m_device.queue.writeBuffer(this.m_gpuBuffer, 0, data.buffer, data.byteOffset, data.byteLength);
    }
}
export class UniformBufferSingleStaging extends UniformBuffer {
    constructor(device, bufferSizeInBytes, label = "(unlabeled)") {
        super(device, bufferSizeInBytes, label);
        this.m_stagingBuffer = device.createBuffer({
            label: `Staging Buffer for ${label}`,
            size: bufferSizeInBytes,
            usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.MAP_WRITE,
            mappedAtCreation: true
        });
        this.m_mappedPromise = Promise.resolve(undefined);
    }
    async WriteData(data) {
        // DEBUG_ONLY
        if (data.byteLength !== this.m_bufferSizeInBytes) {
            let msg = `UniformBufferSingleStaging::WriteData() failed for buffer '${this.m_gpuBuffer.label}'. Buffer size is '${this.m_bufferSizeInBytes}', but trying to write ${data.byteLength}.`;
            LOG_CORE_ERROR(msg);
            throw Error(msg);
        }
        // Wait for the buffer to become mapped
        await this.m_mappedPromise;
        // Get the mapped range and copy our data into it
        let mappedRange = new Float32Array(this.m_stagingBuffer.getMappedRange());
        mappedRange.set(data);
        // Unmap the buffer so it can be used by GPU commands
        this.m_stagingBuffer.unmap();
        // Execute GPU commands to copy the staging buffer to the final buffer
        const commandEncoder = this.m_device.createCommandEncoder({});
        commandEncoder.copyBufferToBuffer(this.m_stagingBuffer, 0, this.m_gpuBuffer, 0, data.byteLength);
        this.m_device.queue.submit([commandEncoder.finish()]);
        // Try to map the buffer again, which will return a Promise
        this.m_mappedPromise = this.m_stagingBuffer.mapAsync(GPUMapMode.WRITE);
    }
    m_stagingBuffer;
    m_mappedPromise;
}
//export class UniformBufferPool extends UniformBuffer
//{
//
//}
//# sourceMappingURL=Buffer.js.map