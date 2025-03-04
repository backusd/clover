import { LOG_CORE_ERROR } from "./Log.js";
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
            // Manually destroying the GPUBuffer may provide some benefit because it can release the GPU memory
            // immediately as opposed to waiting for garbage collection to kick in
            this.m_gpuBuffer.destroy();
            // Update the GPU Buffer and then do capacity updates in the derived class
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
        // Doesn't need to do anything because it doesn't own its own GPUBuffer
    }
    PreRender() {
        // Doesn't need to do anything because we just directly call writeBuffer on the gpu buffer
    }
    //    public WriteData(instanceIndex: number, data: Float32Array<ArrayBufferLike>): void
    WriteData(instanceIndex, data, byteOffset, numBytesToWrite) {
        // DEBUG_ONLY
        if (instanceIndex < 0 || instanceIndex >= this.m_numberOfInstances) {
            let msg = `InstanceBufferBasicWrite::WriteData() failed for buffer '${this.m_gpuBuffer.label}'. Trying to update instance index '${instanceIndex}', but the max index is '${this.m_numberOfInstances - 1}'`;
            LOG_CORE_ERROR(msg);
            throw Error(msg);
        }
        // DEBUG_ONLY
        if (data.byteLength !== this.m_bytesPerInstance) {
            let msg = `InstanceBufferBasicWrite::WriteData() failed for buffer '${this.m_gpuBuffer.label}'. BytesPerInstance is '${this.m_bytesPerInstance}', but trying to write ${data.byteLength}.`;
            LOG_CORE_ERROR(msg);
            throw Error(msg);
        }
        // this.m_device.queue.writeBuffer(
        //     this.m_gpuBuffer,
        //     instanceIndex * this.m_bytesPerInstance,
        //     data.buffer,
        //     data.byteOffset,
        //     data.byteLength
        //);
        this.m_device.queue.writeBuffer(this.m_gpuBuffer, instanceIndex * this.m_bytesPerInstance, data, byteOffset, numBytesToWrite);
    }
}
// NOTE: I never got InstanceBufferSingleStaging fully working because it requires awaiting for the
//       staging buffer to become available, but I didn't feel like propagating that await call all
//       the way back to the Renderer or InstanceManager. Therefore, because InstanceBufferBasicWrite
//       and InstanceBufferPool don't require any awaiting, I decided to not proceed with
//       InstanceBufferSingleStaging any further. Plus, InstanceBufferPool should be more performant
//       anyways.
//
//export class InstanceBufferSingleStaging extends InstanceBuffer
//{
//    constructor(device: GPUDevice, bytesPerInstance: number, numberOfInstances: number, label: string = "(unlabeled)")
//    {
//        super(device, bytesPerInstance, numberOfInstances, label);
//
//        this.m_stagingBuffer = device.createBuffer({
//            label: `Staging Buffer for ${label}`,
//            size: bytesPerInstance * numberOfInstances,
//            usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.MAP_WRITE,
//            mappedAtCreation: true
//        });
//
//        LOG_CORE_TRACE(`Initial state: '${this.m_stagingBuffer.mapState}'`);
//
//        this.m_mappedPromise = Promise.resolve(undefined);
//    }
//    protected SetCapacityDerived(numberOfInstances: number): void
//    {
//      //  // DEBUG_ONLY
//      //  let mapState = this.m_stagingBuffer.mapState;
//      //  if (mapState !== "mapped")
//      //  {
//      //      let msg = `InstanceBufferSingleStaging::SetCapacityDerived() failed for buffer '${this.m_gpuBuffer.label}'. The staging buffer map state should have been 'mapped', but instead it was '${mapState}'`;
//      //      LOG_CORE_ERROR(msg);
//      //      throw Error(msg);
//      //  }
//
//     //   if (this.m_stagingBuffer.mapState === "pending")
//     //   {
//     //       await this.m_mappedPromise;
//     //   }
//     //
//     //   // Unmap the staging buffer before we replacing it with a larger one
//     //   this.m_stagingBuffer.unmap();        
//
//        this.m_stagingBuffer = this.m_device.createBuffer({
//            label: `Staging Buffer for ${this.m_gpuBuffer.label}`,
//            size: this.m_bytesPerInstance * numberOfInstances,
//            usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.MAP_WRITE,
//            mappedAtCreation: true
//        });
//
//        this.m_mappedPromise = Promise.resolve(undefined);
//    }
//    public PreRender(): void
//    {
//        LOG_CORE_TRACE(`PreRender`);
//
//        if (this.m_stagingBuffer.mapState === 'mapped')
//        {
//            // Unmap the buffer so it can be used by GPU commands
//            this.m_stagingBuffer.unmap();
//
//            // Execute GPU commands to copy the staging buffer to the final buffer
//            const commandEncoder = this.m_device.createCommandEncoder({});
//            commandEncoder.copyBufferToBuffer(this.m_stagingBuffer, 0, this.m_gpuBuffer, 0, this.m_bytesPerInstance * this.m_numberOfInstances);
//            this.m_device.queue.submit([commandEncoder.finish()]);
//
//            // Try to map the buffer again, which will return a Promise
//            this.m_mappedPromise = this.m_stagingBuffer.mapAsync(GPUMapMode.WRITE);
//        }
//    }
//    public async WriteData(instanceIndex: number, data: Float32Array<ArrayBufferLike>): Promise<void>
//    {
//        LOG_CORE_TRACE(`WriteData: instance index = '${instanceIndex}'`);
//
//        // DEBUG_ONLY
//        if (instanceIndex < 0 || instanceIndex >= this.m_numberOfInstances)
//        {
//            let msg = `InstanceBufferSingleStaging::WriteData() failed for buffer '${this.m_gpuBuffer.label}'. Trying to update instance index '${instanceIndex}', but the max index is '${this.m_numberOfInstances - 1}'`;
//            LOG_CORE_ERROR(msg);
//            throw Error(msg);
//        }
//
//        // DEBUG_ONLY
//        if (data.byteLength !== this.m_bytesPerInstance)
//        {
//            let msg = `InstanceBufferSingleStaging::WriteData() failed for buffer '${this.m_gpuBuffer.label}'. BytesPerInstance is '${this.m_bytesPerInstance}', but trying to write ${data.byteLength}.`;
//            LOG_CORE_ERROR(msg);
//            throw Error(msg);
//        }
//
//        // DEBUG_ONLY
//        let mapState = this.m_stagingBuffer.mapState;
//        if (this.m_stagingBuffer.mapState === "pending")
//        {
//            await this.m_mappedPromise;
//        }
//
//        // Get the mapped range and copy our data into it
//        let mappedRange = new Float32Array(this.m_stagingBuffer.getMappedRange(instanceIndex * this.m_bytesPerInstance, this.m_bytesPerInstance));
//        mappedRange.set(data);
//    }
//    public PostRender(): void
//    {
//        // LOG_CORE_TRACE(`PostRender`);
//
//        // Immediately after the render commands are recorded, we must await for the
//        // the buffer to become writeable again because after rendering, we begin the
//        // the Update process again
//        // await this.m_mappedPromise;
//    }
//
//    private m_stagingBuffer: GPUBuffer;
//    private m_mappedPromise: Promise<undefined>;
//}
export class InstanceBufferPool extends InstanceBuffer {
    constructor(device, bytesPerInstance, numberOfInstances, label = "(unlabeled)") {
        super(device, bytesPerInstance, numberOfInstances, label);
        // DEBUG_ONLY
        // When calling getMappedRange(offset, size), the offset must be multiple of 8 & overall size must be a multiple of 4.
        // This is most easily satisfied by requiring the bytes per instance to be a multiple of 8
        // See documentation: https://developer.mozilla.org/en-US/docs/Web/API/GPUBuffer/getMappedRange
        if (this.m_bytesPerInstance % 8 !== 0) {
            let msg = `InstanceBufferPool::constructor() failed for buffer '${this.m_gpuBuffer.label}'. Invalid bytesPerInstance value '${bytesPerInstance}'. When calling getMappedRange(offset, size), the offset must be a multiple of 8 and size a multiple of 4, so we required bytesPerInstance must also be a multiple of 8 (see docs: https://developer.mozilla.org/en-US/docs/Web/API/GPUBuffer/getMappedRange)`;
            LOG_CORE_ERROR(msg);
            throw Error(msg);
        }
    }
    GetOrCreateBuffer() {
        // Pop will return undefined if the array is empty
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
        // Manually destroying the ready staging buffers may provide some benefit because it can release the GPU memory
        // immediately as opposed to waiting for garbage collection to kick in
        this.m_readyBuffers.forEach(buffer => { buffer.destroy(); });
        // Every buffer that currently exists is invalid, so we are going to just
        // create a brand new array of GPUBuffers which will force new staging buffers
        // to be created later
        this.m_readyBuffers = [];
        this.m_stagingBuffer = null;
    }
    PreRender() {
        if (this.m_stagingBuffer !== null) {
            // Create a copy reference to the active staging buffer
            let stagingBuffer = this.m_stagingBuffer;
            // Unmap the buffer so it can be used by GPU commands
            stagingBuffer.unmap();
            // Execute GPU commands to copy the staging buffer to the final buffer
            const commandEncoder = this.m_device.createCommandEncoder({});
            commandEncoder.copyBufferToBuffer(stagingBuffer, 0, this.m_gpuBuffer, 0, this.m_bytesPerInstance * this.m_numberOfInstances);
            this.m_device.queue.submit([commandEncoder.finish()]);
            // Save the current capacity value - will need this later when trying to add this
            // buffer back to the buffer pool
            let currentCapacity = this.CurrentCapacity();
            // Try to map the buffer again and when its done, add it to the ready buffers pool
            stagingBuffer.mapAsync(GPUMapMode.WRITE).then(() => {
                // If the current capacity has changed, then this buffer is not the correct
                // size. Therefore, we can simply unmap it and let it go out of scope
                if (currentCapacity === this.CurrentCapacity())
                    this.m_readyBuffers.push(stagingBuffer);
                else {
                    stagingBuffer.unmap();
                    // Manually destroying the GPUBuffer may provide some benefit because it can release the GPU memory
                    // immediately as opposed to waiting for garbage collection to kick in
                    stagingBuffer.destroy();
                }
            });
            // Set the m_stagingBuffer reference back to null so it can be re-populated during the
            // next frame's Update
            this.m_stagingBuffer = null;
        }
    }
    // public WriteData(instanceIndex: number, data: Float32Array<ArrayBufferLike>): void
    WriteData(instanceIndex, data, byteOffset, numBytesToWrite) {
        // DEBUG_ONLY
        if (instanceIndex < 0 || instanceIndex >= this.m_numberOfInstances) {
            let msg = `InstanceBufferPool::WriteData() failed for buffer '${this.m_gpuBuffer.label}'. Trying to update instance index '${instanceIndex}', but the max index is '${this.m_numberOfInstances - 1}'`;
            LOG_CORE_ERROR(msg);
            throw Error(msg);
        }
        // DEBUG_ONLY
        if (data.byteLength !== this.m_bytesPerInstance) {
            let msg = `InstanceBufferPool::WriteData() failed for buffer '${this.m_gpuBuffer.label}'. BytesPerInstance is '${this.m_bytesPerInstance}', but trying to write ${data.byteLength}.`;
            LOG_CORE_ERROR(msg);
            throw Error(msg);
        }
        if (this.m_stagingBuffer === null)
            this.m_stagingBuffer = this.GetOrCreateBuffer();
        // Get the mapped range and copy our data into it
        let mappedRange = new Float32Array(this.m_stagingBuffer.getMappedRange(instanceIndex * this.m_bytesPerInstance, this.m_bytesPerInstance));
        mappedRange.set(new Float32Array(data, byteOffset, numBytesToWrite));
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
        // DEBUG_ONLY
        if (data.byteLength !== this.m_bufferSizeInBytes) {
            let msg = `UniformBufferBasicWrite::WriteData() failed for buffer '${this.m_gpuBuffer.label}'. Buffer size is '${this.m_bufferSizeInBytes}', but trying to write ${data.byteLength}.`;
            LOG_CORE_ERROR(msg);
            throw Error(msg);
        }
        this.m_device.queue.writeBuffer(this.m_gpuBuffer, 0, data, byteOffset, numBytesToWrite);
    }
}
// NOTE: I think I got UniformBufferSingleStaging fully working, however it requires awaiting for the
//       staging buffer to become available, but I didn't feel like propagating that await call all
//       the way back to the Renderer or InstanceManager. Therefore, I'm not actually certain it is
//       doing the correct thing because we aren't awaiting every time we write data. Therefore, I'm
//       leaving it commented out for now because its behavior is unclear and UniformBufferPool is 
//       supposed to be more performant anyways.
//
//export class UniformBufferSingleStaging extends UniformBuffer
//{
//    constructor(device: GPUDevice, bufferSizeInBytes: number, label: string = "(unlabeled)")
//    {
//        super(device, bufferSizeInBytes, label);
//
//        this.m_stagingBuffer = device.createBuffer({
//            label: `Staging Buffer for ${label}`,
//            size: bufferSizeInBytes,
//            usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.MAP_WRITE,
//            mappedAtCreation: true
//        });
//
//        this.m_mappedPromise = Promise.resolve(undefined);
//    }
//    public async WriteData(data: Float32Array<ArrayBufferLike>): Promise<void>
//    {
//        // DEBUG_ONLY
//        if (data.byteLength !== this.m_bufferSizeInBytes)
//        {
//            let msg = `UniformBufferSingleStaging::WriteData() failed for buffer '${this.m_gpuBuffer.label}'. Buffer size is '${this.m_bufferSizeInBytes}', but trying to write ${data.byteLength}.`;
//            LOG_CORE_ERROR(msg);
//            throw Error(msg);
//        }
//
//        // Wait for the buffer to become mapped
//        await this.m_mappedPromise;
//
//        // Get the mapped range and copy our data into it
//        let mappedRange = new Float32Array(this.m_stagingBuffer.getMappedRange());
//        mappedRange.set(data);
//
//        // Unmap the buffer so it can be used by GPU commands
//        this.m_stagingBuffer.unmap();
//
//        // Execute GPU commands to copy the staging buffer to the final buffer
//        const commandEncoder = this.m_device.createCommandEncoder({});
//        commandEncoder.copyBufferToBuffer(this.m_stagingBuffer, 0, this.m_gpuBuffer, 0, data.byteLength);
//        this.m_device.queue.submit([commandEncoder.finish()]);
//
//        // Try to map the buffer again, which will return a Promise
//        this.m_mappedPromise = this.m_stagingBuffer.mapAsync(GPUMapMode.WRITE);
//    }
//
//    private m_stagingBuffer: GPUBuffer;
//    private m_mappedPromise: Promise<undefined>;
//}
export class UniformBufferPool extends UniformBuffer {
    constructor(device, bufferSizeInBytes, label = "(unlabeled)") {
        super(device, bufferSizeInBytes, label);
        this.m_readyBuffers = [];
        // DEBUG_ONLY
        // When calling getMappedRange(offset, size), the offset must be multiple of 8 & overall size must be a multiple of 4.
        // Because we don't use an offset, this is most easily satisfied by requiring that the total buffer size be a multiple of 4
        // See documentation: https://developer.mozilla.org/en-US/docs/Web/API/GPUBuffer/getMappedRange
        if (bufferSizeInBytes % 4 !== 0) {
            let msg = `UniformBufferPool::constructor() failed for buffer '${this.m_gpuBuffer.label}'. Invalid buffer size value '${bufferSizeInBytes}'. When calling getMappedRange(offset, size), the offset must be a multiple of 8 and size a multiple of 4, however, we don't use the offset. So we simply required the buffer size must be a multiple of 4 (see docs: https://developer.mozilla.org/en-US/docs/Web/API/GPUBuffer/getMappedRange)`;
            LOG_CORE_ERROR(msg);
            throw Error(msg);
        }
    }
    WriteData(data, byteOffset, numBytesToWrite) {
        // DEBUG_ONLY
        if (data.byteLength !== this.m_bufferSizeInBytes) {
            let msg = `UniformBufferSingleStaging::WriteData() failed for buffer '${this.m_gpuBuffer.label}'. Buffer size is '${this.m_bufferSizeInBytes}', but trying to write ${data.byteLength}.`;
            LOG_CORE_ERROR(msg);
            throw Error(msg);
        }
        let stagingBuffer = this.GetOrCreateBuffer();
        // Get the mapped range and copy our data into it
        let mappedRange = new Float32Array(stagingBuffer.getMappedRange());
        mappedRange.set(new Float32Array(data, byteOffset, numBytesToWrite));
        // Unmap the buffer so it can be used by GPU commands
        stagingBuffer.unmap();
        // Execute GPU commands to copy the staging buffer to the final buffer
        const commandEncoder = this.m_device.createCommandEncoder({});
        commandEncoder.copyBufferToBuffer(stagingBuffer, 0, this.m_gpuBuffer, 0, data.byteLength);
        this.m_device.queue.submit([commandEncoder.finish()]);
        // Try to map the buffer again and when its done, add it to the ready buffers pool
        stagingBuffer.mapAsync(GPUMapMode.WRITE).then(() => { this.m_readyBuffers.push(stagingBuffer); });
    }
    GetOrCreateBuffer() {
        // Pop will return undefined if the array is empty
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
//# sourceMappingURL=Buffer.js.map