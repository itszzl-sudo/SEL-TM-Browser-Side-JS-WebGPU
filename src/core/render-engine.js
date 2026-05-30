/**
 * SEL-TM WebGPU 渲染引擎（热路径）
 * 负责 GPU 渲染管线，处理渐变、阴影、圆角等视觉效果
 *
 * 特性：
 * - Context Lost 自动恢复
 * - 着色器编译错误处理
 * - Buffer 分配失败处理
 * - GPU 内存管理
 * - 优雅降级
 */
export class SELWebGPU {
  constructor(canvas) {
    this.canvas = canvas;
    this.device = null;
    this.context = null;
    this.format = 'bgra8unorm';
    this.layoutPipeline = null;
    this.compositorPipeline = null;
    this.layoutTasks = [];

    // 状态管理
    this.initialized = false;
    this.contextLost = false;
    this.destroyed = false;
    this.lastError = null;

    // 性能监控
    this.animationTime = 0;
    this.fps = 0;
    this.frameCount = 0;
    this.lastFpsTime = performance.now();

    // GPU 内存统计
    this.bufferCount = 0;
    this.textureCount = 0;

    // 回调函数
    this.onContextLost = null;
    this.onContextRestored = null;
    this.onError = null;
  }

  /**
   * 检查 WebGPU 支持
   */
  static isSupported() {
    return typeof navigator !== 'undefined' && !!navigator.gpu;
  }

  /**
   * 获取浏览器支持信息
   */
  static getSupportInfo() {
    if (typeof navigator === 'undefined' || !navigator.gpu) {
      return {
        supported: false,
        reason: 'WebGPU 不可用',
        suggestion: '请使用 Chrome 113+、Firefox 121+、Safari 16.4+ 或 Edge 113+'
      };
    }

    const adapter = navigator.gpu;
    return {
      supported: true,
      adapter: adapter.adapterType || 'unknown',
      features: Object.keys(adapter.features || {})
    };
  }

  async init() {
    if (this.destroyed) {
      this._reportError('渲染引擎已销毁，无法重新初始化');
      return false;
    }

    try {
      // 1. 检查 WebGPU 支持
      if (!SELWebGPU.isSupported()) {
        this._reportError('WebGPU 不可用，请升级浏览器');
        return false;
      }

      // 2. 获取 GPU Context
      this.context = this.canvas.getContext('webgpu');
      if (!this.context) {
        this._reportError('无法获取 WebGPU Context');
        return false;
      }

      // 3. 设置 Context Lost 监听（必须在 requestAdapter 之前）
      this._setupContextLostHandler();

      // 4. 请求 GPU Adapter 和 Device
      const adapter = await navigator.gpu.requestAdapter({
        powerPreference: 'high-performance'
      });

      if (!adapter) {
        this._reportError('无法获取 GPU Adapter，可能需要更新驱动程序');
        return false;
      }

      this.device = await adapter.requestDevice({
        requiredLimits: {
          maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize
        }
      });

      // 5. 设置 Device Lost 监听
      this._setupDeviceLostHandler();

      // 6. 配置 Context
      const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
      this.format = presentationFormat;

      this.context.configure({
        device: this.device,
        format: presentationFormat,
        alphaMode: 'premultiplied'
      });

      // 7. 初始化渲染管线
      await this.initPipelines(presentationFormat);

      this.initialized = true;
      this.contextLost = false;
      console.log('🚀 WebGPU 高阶渲染管线（渐变/阴影/动画）初始化完成');
      console.log(`   设备: ${adapter.adapterType || 'unknown'}`);
      console.log(`   格式: ${presentationFormat}`);

      return true;

    } catch (error) {
      this._reportError(`初始化失败: ${error.message}`, error);
      return false;
    }
  }

  /**
   * 设置 Context Lost 处理器
   */
  _setupContextLostHandler() {
    if (!this.canvas) return;

    this.canvas.addEventListener('contextlost', (event) => {
      event.preventDefault();
      console.warn('⚠️ WebGPU Context 丢失');
      this.contextLost = true;
      this.initialized = false;

      if (this.onContextLost) {
        this.onContextLost('contextlost');
      }

      // 自动尝试恢复
      this._scheduleRecovery();
    }, { passive: false });

    this.canvas.addEventListener('contextrestored', () => {
      console.log('✅ WebGPU Context 恢复');
      this.contextLost = false;

      if (this.onContextRestored) {
        this.onContextRestored();
      }

      // 重新初始化
      this._attemptRecovery();
    });
  }

  /**
   * 设置 Device Lost 处理器
   */
  _setupDeviceLostHandler() {
    if (!this.device) return;

    this.device.lost.then((info) => {
      if (info.reason === 'destroyed') {
        console.log('ℹ️ WebGPU Device 被正常销毁');
      } else {
        console.error(`❌ WebGPU Device 丢失: ${info.reason}`);
        this._reportError(`GPU Device 丢失: ${info.message || info.reason}`);
      }

      this.initialized = false;
      this.contextLost = true;

      if (this.onContextLost) {
        this.onContextLost('devicelost');
      }
    }).catch((error) => {
      console.error('Device lost 监听错误:', error);
    });
  }

  /**
   * 安排恢复尝试
   */
  _scheduleRecovery() {
    setTimeout(() => this._attemptRecovery(), 1000);
  }

  /**
   * 尝试恢复 WebGPU
   */
  async _attemptRecovery() {
    if (this.destroyed) return;
    if (this.initialized && !this.contextLost) return;

    console.log('🔄 尝试恢复 WebGPU...');

    try {
      // 清理旧资源
      await this._cleanup();

      // 重新初始化
      const success = await this.init();

      if (success) {
        console.log('✅ WebGPU 恢复成功');
        // 重新渲染
        if (this.layoutTasks.length > 0) {
          this.render(this.layoutTasks);
        }
      } else {
        console.error('❌ WebGPU 恢复失败');
        // 再次安排恢复
        this._scheduleRecovery();
      }
    } catch (error) {
      console.error('恢复过程出错:', error);
      this._scheduleRecovery();
    }
  }

  /**
   * 清理 GPU 资源
   */
  async _cleanup() {
    try {
      if (this.device) {
        // 等待所有操作完成
        await this.device.queue.onSubmittedWorkDone();
      }
    } catch (error) {
      console.warn('清理时出错:', error);
    }

    this.layoutPipeline = null;
    this.compositorPipeline = null;
    this.bufferCount = 0;
    this.textureCount = 0;
  }

  /**
   * 初始化渲染管线
   */
  async initPipelines(format) {
    try {
      // 布局渲染管线 - 支持四角独立圆角、skew变换、滤镜
      const layoutShaderCode = `
        struct Vertex {
          @location(0) pos: vec2f,
          @location(1) color: vec4f,
          @location(2) gradStart: vec4f,
          @location(3) gradEnd: vec4f,
          @location(4) uv: vec2f,
          @location(5) rect: vec4f,
          @location(6) radiusTL: f32,
          @location(7) radiusTR: f32,
          @location(8) radiusBR: f32,
          @location(9) radiusBL: f32,
          @location(10) translate: vec2f,
          @location(11) rotate: f32,
          @location(12) scale: vec2f,
          @location(13) skewX: f32,
          @location(14) skewY: f32,
          @location(15) filterBlur: f32
        }
        struct VOut {
          @builtin(position) pos: vec4f,
          @location(0) color: vec4f,
          @location(1) gradStart: vec4f,
          @location(2) gradEnd: vec4f,
          @location(3) uv: vec4f,
          @location(4) rect: vec4f,
          @location(5) radiusTL: f32,
          @location(6) radiusTR: f32,
          @location(7) radiusBR: f32,
          @location(8) radiusBL: f32,
          @location(9) filterBlur: f32
        }
        @vertex fn vs(v: Vertex) -> VOut {
          var out: VOut;

          // 应用缩放
          var transformedPos = v.pos * v.scale;

          // 应用斜切变换 (skew)
          let skewXRad = v.skewX * 0.0174533; // deg to rad
          let skewYRad = v.skewY * 0.0174533;
          let skewedX = transformedPos.x + transformedPos.y * tan(skewXRad);
          let skewedY = transformedPos.y + transformedPos.x * tan(skewYRad);
          transformedPos = vec2f(skewedX, skewedY);

          // 应用旋转
          let cosR = cos(v.rotate);
          let sinR = sin(v.rotate);
          let rotatedX = transformedPos.x * cosR - transformedPos.y * sinR;
          let rotatedY = transformedPos.x * sinR + transformedPos.y * cosR;
          let finalPos = vec2f(rotatedX, rotatedY) + v.translate;

          out.pos = vec4f(finalPos, 0.0, 1.0);
          out.color = v.color;
          out.gradStart = v.gradStart;
          out.gradEnd = v.gradEnd;
          out.uv = vec4f(v.uv, 0.0, 0.0);
          out.rect = v.rect;
          out.radiusTL = v.radiusTL;
          out.radiusTR = v.radiusTR;
          out.radiusBR = v.radiusBR;
          out.radiusBL = v.radiusBL;
          out.filterBlur = v.filterBlur;
          return out;
        }
        @fragment fn fs(in: VOut) -> @location(0) vec4f {
          let rectMin = in.rect.xy;
          let rectMax = in.rect.zw;
          let center = (rectMin + rectMax) / 2.0;
          let halfSize = (rectMax - rectMin) / 2.0;

          // 根据位置选择正确的圆角半径
          let inTopHalf = in.pos.y > center.y;
          let inLeftHalf = in.pos.x < center.x;
          var cornerRadius: f32;
          if (inTopHalf && inLeftHalf) {
            cornerRadius = in.radiusTL;
          } else if (inTopHalf && !inLeftHalf) {
            cornerRadius = in.radiusTR;
          } else if (!inTopHalf && !inLeftHalf) {
            cornerRadius = in.radiusBR;
          } else {
            cornerRadius = in.radiusBL;
          }

          cornerRadius = min(cornerRadius, min(halfSize.x, halfSize.y));
          let d = abs(in.pos.xy - center) - halfSize + vec2<f32>(cornerRadius);
          let dist = length(max(d, vec2<f32>(0.0))) + min(max(d.x, d.y), 0.0);
          var alpha = 1.0 - smoothstep(cornerRadius - 1.0, cornerRadius + 1.0, dist);

          // 应用滤镜模糊效果
          if (in.filterBlur > 0.0) {
            alpha = alpha * (1.0 - clamp(in.filterBlur / 20.0, 0.0, 0.5));
          }

          let gradMix = mix(in.gradStart, in.gradEnd, in.uv.y);
          let finalColor = select(in.color, gradMix, in.gradEnd.a > 0.0);

          return vec4f(finalColor.rgb, finalColor.a * alpha);
        }
      `;

      // 创建着色器模块（带错误处理）
      const layoutShaderModule = this._createShaderModule(layoutShaderCode, 'layout');
      if (!layoutShaderModule) return false;

      this.layoutPipeline = this.device.createRenderPipeline({
        layout: 'auto',
        vertex: {
          module: layoutShaderModule,
          entryPoint: 'vs',
          buffers: [{
            arrayStride: 128,
            attributes: [
              { shaderLocation: 0, offset: 0, format: 'float32x2' },
              { shaderLocation: 1, offset: 8, format: 'float32x4' },
              { shaderLocation: 2, offset: 24, format: 'float32x4' },
              { shaderLocation: 3, offset: 40, format: 'float32x4' },
              { shaderLocation: 4, offset: 56, format: 'float32x2' },
              { shaderLocation: 5, offset: 64, format: 'float32x4' },
              { shaderLocation: 6, offset: 80, format: 'float32' },
              { shaderLocation: 7, offset: 84, format: 'float32' },
              { shaderLocation: 8, offset: 88, format: 'float32' },
              { shaderLocation: 9, offset: 92, format: 'float32' },
              { shaderLocation: 10, offset: 96, format: 'float32x2' },
              { shaderLocation: 11, offset: 104, format: 'float32' },
              { shaderLocation: 12, offset: 108, format: 'float32x2' },
              { shaderLocation: 13, offset: 116, format: 'float32' },
              { shaderLocation: 14, offset: 120, format: 'float32' },
              { shaderLocation: 15, offset: 124, format: 'float32' }
            ]
          }]
        },
        fragment: { module: layoutShaderModule, entryPoint: 'fs', targets: [{ format }] },
        primitive: { topology: 'triangle-list' }
      });

      // 合成管线（简化版）
      const compositorShaderCode = `
        struct Vertex {
          @location(0) pos: vec2f,
          @location(1) uv: vec2f
        }
        struct VOut {
          @builtin(position) pos: vec4f,
          @location(0) uv: vec2f
        }
        @vertex fn vs(v: Vertex) -> VOut {
          var out: VOut;
          out.pos = vec4f(v.pos, 0.0, 1.0);
          out.uv = v.uv;
          return out;
        }
        @fragment fn fs(in: VOut) -> @location(0) vec4f {
          return vec4f(1.0, 1.0, 1.0, 1.0);
        }
      `;

      const compositorShaderModule = this._createShaderModule(compositorShaderCode, 'compositor');
      if (!compositorShaderModule) return false;

      this.compositorPipeline = this.device.createRenderPipeline({
        layout: 'auto',
        vertex: {
          module: compositorShaderModule,
          entryPoint: 'vs',
          buffers: [{
            arrayStride: 16,
            attributes: [
              { shaderLocation: 0, offset: 0, format: 'float32x2' },
              { shaderLocation: 1, offset: 8, format: 'float32x2' }
            ]
          }]
        },
        fragment: { module: compositorShaderModule, entryPoint: 'fs', targets: [{ format }] },
        primitive: { topology: 'triangle-list' }
      });

      return true;

    } catch (error) {
      this._reportError(`管线初始化失败: ${error.message}`, error);
      return false;
    }
  }

  /**
   * 创建着色器模块（带错误处理）
   */
  _createShaderModule(code, name) {
    try {
      const module = this.device.createShaderModule({ code });

      // 异步获取编译结果
      module.getCompilationInfo().then((info) => {
        if (info.messages.length > 0) {
          const errors = info.messages.filter(m => m.type === 'error');
          const warnings = info.messages.filter(m => m.type === 'warning');

          if (errors.length > 0) {
            console.error(`❌ 着色器 [${name}] 编译错误:`);
            errors.forEach(m => console.error(`   ${m.message}`));
            this._reportError(`着色器 [${name}] 编译失败`);
          }

          if (warnings.length > 0) {
            console.warn(`⚠️ 着色器 [${name}] 警告:`);
            warnings.forEach(m => console.warn(`   ${m.message}`));
          }
        }
      }).catch((error) => {
        console.warn(`无法获取着色器 [${name}] 编译信息:`, error);
      });

      return module;

    } catch (error) {
      this._reportError(`创建着色器 [${name}] 失败: ${error.message}`, error);
      return null;
    }
  }

  /**
   * 安全创建 Buffer
   */
  _createBuffer(size, usage) {
    try {
      if (!this.device) {
        throw new Error('Device 未初始化');
      }

      // 检查大小限制
      const maxBufferSize = this.device.limits.maxStorageBufferBindingSize;
      if (size > maxBufferSize) {
        throw new Error(`Buffer 大小 ${size} 超过限制 ${maxBufferSize}`);
      }

      const buffer = this.device.createBuffer({
        size,
        usage,
        mappedAtCreation: false
      });

      this.bufferCount++;
      return buffer;

    } catch (error) {
      this._reportError(`创建 Buffer 失败 (大小: ${size}): ${error.message}`, error);
      return null;
    }
  }

  /**
   * 销毁 Buffer
   */
  _destroyBuffer(buffer) {
    if (buffer) {
      try {
        buffer.destroy();
        this.bufferCount--;
      } catch (error) {
        console.warn('销毁 Buffer 时出错:', error);
      }
    }
  }

  /**
   * 主渲染方法
   */
  render(tasks) {
    if (this.destroyed) {
      console.warn('渲染引擎已销毁，跳过渲染');
      return;
    }

    this.layoutTasks = tasks || [];

    if (!this.initialized || this.contextLost) {
      if (!this.contextLost) {
        this._attemptRecovery();
      }
      return;
    }

    try {
      this.renderLoop();
    } catch (error) {
      this._reportError(`渲染循环错误: ${error.message}`, error);
      this._scheduleRecovery();
    }
  }

  /**
   * 渲染循环
   */
  renderLoop() {
    if (!this.initialized || !this.device || !this.context) {
      return;
    }

    let commandEncoder;
    let textureView;

    try {
      commandEncoder = this.device.createCommandEncoder();
      textureView = this.context.getCurrentTexture().createView();
    } catch (error) {
      this._reportError(`获取渲染资源失败: ${error.message}`, error);
      return;
    }

    const renderPassDescriptor = {
      colorAttachments: [{
        view: textureView,
        loadOp: 'clear',
        storeOp: 'store',
        clearValue: { r: 0.05, g: 0.05, b: 0.08, a: 1.0 }
      }]
    };

    let pass;
    try {
      pass = commandEncoder.beginRenderPass(renderPassDescriptor);
    } catch (error) {
      this._reportError(`开始渲染 Pass 失败: ${error.message}`, error);
      return;
    }

    // 更新 FPS
    this.frameCount++;
    const now = performance.now();
    if (now - this.lastFpsTime >= 1000) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.lastFpsTime = now;
    }

    if (this.layoutTasks.length > 0) {
      // 渲染阴影
      this._renderShadows(pass, this.layoutTasks);

      // 渲染边框
      this._renderBorders(pass, this.layoutTasks);

      // 渲染布局色块
      this._renderLayout(pass, this.layoutTasks);

      // 渲染文本装饰
      this._renderTextDecorations(pass, this.layoutTasks);

      // 渲染文字阴影
      this._renderTextShadows(pass, this.layoutTasks);
    }

    pass.end();

    try {
      const commands = commandEncoder.finish();
      this.device.queue.submit([commands]);
    } catch (error) {
      this._reportError(`提交命令失败: ${error.message}`, error);
      return;
    }

    this.animationTime += 1 / 60;
    requestAnimationFrame(() => this.renderLoop());
  }

  /**
   * 渲染阴影
   */
  _renderShadows(pass, tasks) {
    const shadowData = this.generateShadowVertexData(tasks);
    if (shadowData.byteLength === 0) return;

    const shadowBuf = this._createBuffer(shadowData.byteLength, GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST);
    if (!shadowBuf) return;

    try {
      this.device.queue.writeBuffer(shadowBuf, 0, shadowData);
      pass.setPipeline(this.layoutPipeline);
      pass.setVertexBuffer(0, shadowBuf);
      pass.draw(shadowData.length / 32);

      // 延迟销毁 buffer
      setTimeout(() => this._destroyBuffer(shadowBuf), 100);
    } catch (error) {
      this._reportError(`阴影渲染失败: ${error.message}`, error);
      this._destroyBuffer(shadowBuf);
    }
  }

  /**
   * 渲染边框
   */
  _renderBorders(pass, tasks) {
    const borderData = this.generateBorderVertices(tasks);
    if (borderData.length === 0) return;

    const borderBuf = this._createBuffer(borderData.byteLength, GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST);
    if (!borderBuf) return;

    try {
      this.device.queue.writeBuffer(borderBuf, 0, borderData);
      pass.setPipeline(this.layoutPipeline);
      pass.setVertexBuffer(0, borderBuf);
      pass.draw(borderData.length / 32);

      setTimeout(() => this._destroyBuffer(borderBuf), 100);
    } catch (error) {
      this._reportError(`边框渲染失败: ${error.message}`, error);
      this._destroyBuffer(borderBuf);
    }
  }

  /**
   * 渲染布局
   */
  _renderLayout(pass, tasks) {
    const vertexData = this.generateAdvancedVertexData(tasks);
    if (vertexData.byteLength === 0) return;

    const vertexBuf = this._createBuffer(vertexData.byteLength, GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST);
    if (!vertexBuf) return;

    try {
      this.device.queue.writeBuffer(vertexBuf, 0, vertexData);
      pass.setPipeline(this.layoutPipeline);
      pass.setVertexBuffer(0, vertexBuf);
      pass.draw(vertexData.length / 32);

      setTimeout(() => this._destroyBuffer(vertexBuf), 100);
    } catch (error) {
      this._reportError(`布局渲染失败: ${error.message}`, error);
      this._destroyBuffer(vertexBuf);
    }
  }

  generateAdvancedVertexData(tasks) {
    const vertices = [];
    const w = this.canvas.width;
    const h = this.canvas.height;

    tasks.forEach(task => {
      const x1 = (task.x / w) * 2 - 1;
      const y1 = 1 - (task.y / h) * 2;
      const x2 = ((task.x + task.width) / w) * 2 - 1;
      const y2 = 1 - ((task.y + task.height) / h) * 2;

      const bgColor = task.backgroundColor || '#4fc3f7';
      const baseColor = this.hexToRgba(bgColor);
      const opacity = typeof task.opacity === 'number' ? Math.max(0, Math.min(1, task.opacity)) : 1;
      baseColor[3] *= opacity;

      let gradient = null;
      if (task.gradient) {
        gradient = task.gradient;
      } else if (task.background && task.background.includes('gradient')) {
        gradient = this.parseGradient(task.background);
      }

      const gradStart = gradient ? gradient.start : [0, 0, 0, 0];
      const gradEnd = gradient ? gradient.end : [0, 0, 0, 0];

      const uv00 = [0, 0], uv01 = [0, 1], uv11 = [1, 1], uv10 = [1, 0], uv112 = [1, 1], uv002 = [0, 0];

      const rectMinX = ((task.x) / w) * 2 - 1;
      const rectMinY = 1 - ((task.y) / h) * 2;
      const rectMaxX = ((task.x + task.width) / w) * 2 - 1;
      const rectMaxY = 1 - ((task.y + task.height) / h) * 2;
      const rect = [rectMinX, rectMinY, rectMaxX, rectMaxY];

      // 四角独立圆角
      const borderRadius = task.borderRadius || {};
      const radiusTL = (typeof borderRadius === 'object' ? (borderRadius.topLeft || 0) : borderRadius) / w * 2;
      const radiusTR = (typeof borderRadius === 'object' ? (borderRadius.topRight || 0) : borderRadius) / w * 2;
      const radiusBR = (typeof borderRadius === 'object' ? (borderRadius.bottomRight || 0) : borderRadius) / w * 2;
      const radiusBL = (typeof borderRadius === 'object' ? (borderRadius.bottomLeft || 0) : borderRadius) / w * 2;

      const transform = task.transform || {};
      const trans = transform.translate && Array.isArray(transform.translate) && transform.translate.length >= 2
        ? transform.translate
        : [0, 0];
      const translate = [trans[0] / w * 2, -trans[1] / h * 2];
      const rotate = typeof transform.rotate === 'number' ? transform.rotate * Math.PI / 180 : 0;
      const sc = transform.scale && Array.isArray(transform.scale) && transform.scale.length >= 2
        ? transform.scale
        : [1, 1];
      const skewX = typeof transform.skewX === 'number' ? transform.skewX : 0;
      const skewY = typeof transform.skewY === 'number' ? transform.skewY : 0;
      const filterBlur = typeof task.filter === 'object' && task.filter.blur ? task.filter.blur : 0;

      vertices.push(
        x1, y1, ...baseColor, ...gradStart, ...gradEnd, ...uv00, ...rect, radiusTL, radiusTR, radiusBR, radiusBL, ...translate, rotate, ...sc, skewX, skewY, filterBlur,
        x1, y2, ...baseColor, ...gradStart, ...gradEnd, ...uv01, ...rect, radiusTL, radiusTR, radiusBR, radiusBL, ...translate, rotate, ...sc, skewX, skewY, filterBlur,
        x2, y2, ...baseColor, ...gradStart, ...gradEnd, ...uv11, ...rect, radiusTL, radiusTR, radiusBR, radiusBL, ...translate, rotate, ...sc, skewX, skewY, filterBlur,
        x1, y1, ...baseColor, ...gradStart, ...gradEnd, ...uv10, ...rect, radiusTL, radiusTR, radiusBR, radiusBL, ...translate, rotate, ...sc, skewX, skewY, filterBlur,
        x2, y2, ...baseColor, ...gradStart, ...gradEnd, ...uv112, ...rect, radiusTL, radiusTR, radiusBR, radiusBL, ...translate, rotate, ...sc, skewX, skewY, filterBlur,
        x2, y1, ...baseColor, ...gradStart, ...gradEnd, ...uv002, ...rect, radiusTL, radiusTR, radiusBR, radiusBL, ...translate, rotate, ...sc, skewX, skewY, filterBlur
      );
    });

    return new Float32Array(vertices);
  }

  generateShadowVertexData(tasks) {
    const vertices = [];
    const w = this.canvas.width;
    const h = this.canvas.height;

    tasks.forEach(task => {
      const shadowArray = typeof task.boxShadow === 'object' && Array.isArray(task.boxShadow) ? task.boxShadow :
                         (task.boxShadow ? this.parseBoxShadow(task.boxShadow) : null);
      if (!shadowArray || shadowArray.length === 0) return;

      shadowArray.forEach(shadow => {
        if (shadow.blur <= 0 && !shadow.inset) return;

        let shadowX, shadowY, shadowW, shadowH;

        if (shadow.inset) {
          shadowX = task.x - shadow.spread;
          shadowY = task.y - shadow.spread;
          shadowW = task.width + shadow.spread * 2;
          shadowH = task.height + shadow.spread * 2;
        } else {
          shadowX = task.x + shadow.x;
          shadowY = task.y + shadow.y;
          shadowW = task.width + shadow.blur * 2;
          shadowH = task.height + shadow.blur * 2;
        }

        const x1 = (shadowX - shadow.blur) / w * 2 - 1;
        const y1 = 1 - (shadowY - shadow.blur) / h * 2;
        const x2 = ((shadowX + shadowW) + shadow.blur) / w * 2 - 1;
        const y2 = 1 - ((shadowY + shadowH) + shadow.blur) / h * 2;

        const shadowColor = [...shadow.color];
        shadowColor[3] *= shadow.inset ? 0.3 : 0.5;

        const uv00 = [0, 0], uv01 = [0, 1], uv11 = [1, 1], uv10 = [1, 0], uv112 = [1, 1], uv002 = [0, 0];

        const rect = [-1, -1, 1, 1];
        const radiusTL = 0, radiusTR = 0, radiusBR = 0, radiusBL = 0;

        const transform = task.transform || { translate: [0, 0], rotate: 0, scale: [1, 1] };
        const translate = [transform.translate[0] / w * 2, -transform.translate[1] / h * 2];
        const rotate = transform.rotate * Math.PI / 180;
        const scale = transform.scale;

        vertices.push(
          x1, y1, ...shadowColor, [0, 0, 0, 0], [0, 0, 0, 0], ...uv00, ...rect, radiusTL, radiusTR, radiusBR, radiusBL, ...translate, rotate, ...scale, 0, 0, 0,
          x1, y2, ...shadowColor, [0, 0, 0, 0], [0, 0, 0, 0], ...uv01, ...rect, radiusTL, radiusTR, radiusBR, radiusBL, ...translate, rotate, ...scale, 0, 0, 0,
          x2, y2, ...shadowColor, [0, 0, 0, 0], [0, 0, 0, 0], ...uv11, ...rect, radiusTL, radiusTR, radiusBR, radiusBL, ...translate, rotate, ...scale, 0, 0, 0,
          x1, y1, ...shadowColor, [0, 0, 0, 0], [0, 0, 0, 0], ...uv10, ...rect, radiusTL, radiusTR, radiusBR, radiusBL, ...translate, rotate, ...scale, 0, 0, 0,
          x2, y2, ...shadowColor, [0, 0, 0, 0], [0, 0, 0, 0], ...uv112, ...rect, radiusTL, radiusTR, radiusBR, radiusBL, ...translate, rotate, ...scale, 0, 0, 0,
          x2, y1, ...shadowColor, [0, 0, 0, 0], [0, 0, 0, 0], ...uv002, ...rect, radiusTL, radiusTR, radiusBR, radiusBL, ...translate, rotate, ...scale, 0, 0, 0
        );
      });
    });

    return new Float32Array(vertices);
  }

  generateBorderVertices(tasks) {
    const vertices = [];
    const w = this.canvas.width;
    const h = this.canvas.height;

    tasks.forEach(task => {
      const border = task.border;
      if (!border || typeof border !== 'object' || !border.width || border.width <= 0) return;

      const edges = [
        { side: 'top', dir: [0, -1], length: task.width },
        { side: 'right', dir: [1, 0], length: task.height },
        { side: 'bottom', dir: [0, 1], length: task.width },
        { side: 'left', dir: [-1, 0], length: task.height }
      ];

      edges.forEach(edge => {
        const b = border;

        const x1 = task.x;
        const y1 = task.y;
        const x2 = task.x + task.width;
        const y2 = task.y + task.height;

        let x, y, bw, bh;
        switch (edge.side) {
          case 'top':
            x = x1; y = y1; bw = edge.length; bh = b.width;
            break;
          case 'right':
            x = x2 - b.width; y = y1; bw = b.width; bh = edge.length;
            break;
          case 'bottom':
            x = x1; y = y2 - b.width; bw = edge.length; bh = b.width;
            break;
          case 'left':
            x = x1; y = y1; bw = b.width; bh = edge.length;
            break;
        }

        const x1n = (x / w) * 2 - 1;
        const y1n = 1 - (y / h) * 2;
        const x2n = ((x + bw) / w) * 2 - 1;
        const y2n = 1 - ((y + bh) / h) * 2;

        const color = b.color || [0, 0, 0, 1];
        const uv00 = [0, 0], uv01 = [0, 1], uv11 = [1, 1], uv10 = [1, 0];
        const rect = [-1, -1, 1, 1];
        const radiusTL = 0, radiusTR = 0, radiusBR = 0, radiusBL = 0;

        const transform = task.transform || { translate: [0, 0], rotate: 0, scale: [1, 1] };
        const translate = [transform.translate[0] / w * 2, -transform.translate[1] / h * 2];
        const rotate = transform.rotate * Math.PI / 180;
        const scale = transform.scale;

        vertices.push(
          x1n, y1n, ...color, ...color, ...color, ...uv00, ...rect, radiusTL, radiusTR, radiusBR, radiusBL, ...translate, rotate, ...scale, 0, 0, 0,
          x1n, y2n, ...color, ...color, ...color, ...uv01, ...rect, radiusTL, radiusTR, radiusBR, radiusBL, ...translate, rotate, ...scale, 0, 0, 0,
          x2n, y2n, ...color, ...color, ...color, ...uv11, ...rect, radiusTL, radiusTR, radiusBR, radiusBL, ...translate, rotate, ...scale, 0, 0, 0,
          x1n, y1n, ...color, ...color, ...color, ...uv10, ...rect, radiusTL, radiusTR, radiusBR, radiusBL, ...translate, rotate, ...scale, 0, 0, 0,
          x2n, y2n, ...color, ...color, ...color, ...uv11, ...rect, radiusTL, radiusTR, radiusBR, radiusBL, ...translate, rotate, ...scale, 0, 0, 0,
          x2n, y1n, ...color, ...color, ...color, ...uv00, ...rect, radiusTL, radiusTR, radiusBR, radiusBL, ...translate, rotate, ...scale, 0, 0, 0
        );
      });
    });

    return new Float32Array(vertices);
  }

  /**
   * 生成文本装饰顶点数据
   * 支持下划线(underline)、删除线(line-through)、上划线(overline)
   */
  generateTextDecorationVertices(tasks) {
    const vertices = [];
    const w = this.canvas.width;
    const h = this.canvas.height;

    tasks.forEach(task => {
      const textDeco = task.textDecoration;
      if (!textDeco || textDeco.line === 'none') return;

      const fontSize = task.fontSize || 16;
      const textWidth = task.width || 100;
      const textHeight = task.height || fontSize;
      const thickness = textDeco.thickness || 2;
      const decoColor = textDeco.color || [0, 0, 0, 1];

      const lineTypes = textDeco.line.split(' ');
      lineTypes.forEach(lineType => {
        let yOffset, yHeight;
        switch (lineType) {
          case 'underline':
            yOffset = textHeight - thickness - 2;
            yHeight = thickness;
            break;
          case 'overline':
            yOffset = 2;
            yHeight = thickness;
            break;
          case 'line-through':
            yOffset = textHeight * 0.4;
            yHeight = thickness;
            break;
          default:
            return;
        }

        const x1 = task.x;
        const y1 = task.y + yOffset;
        const x2 = task.x + textWidth;
        const y2 = task.y + yOffset + yHeight;

        const x1n = (x1 / w) * 2 - 1;
        const y1n = 1 - (y1 / h) * 2;
        const x2n = (x2 / w) * 2 - 1;
        const y2n = 1 - (y2 / h) * 2;

        const uv00 = [0, 0], uv01 = [0, 1], uv11 = [1, 1], uv10 = [1, 0];
        const rect = [-1, -1, 1, 1];
        const radiusTL = 0, radiusTR = 0, radiusBR = 0, radiusBL = 0;
        const translate = [0, 0];
        const rotate = 0;
        const scale = [1, 1];

        vertices.push(
          x1n, y1n, ...decoColor, ...decoColor, ...decoColor, ...uv00, ...rect, radiusTL, radiusTR, radiusBR, radiusBL, ...translate, rotate, ...scale, 0, 0, 0,
          x1n, y2n, ...decoColor, ...decoColor, ...decoColor, ...uv01, ...rect, radiusTL, radiusTR, radiusBR, radiusBL, ...translate, rotate, ...scale, 0, 0, 0,
          x2n, y2n, ...decoColor, ...decoColor, ...decoColor, ...uv11, ...rect, radiusTL, radiusTR, radiusBR, radiusBL, ...translate, rotate, ...scale, 0, 0, 0,
          x1n, y1n, ...decoColor, ...decoColor, ...decoColor, ...uv10, ...rect, radiusTL, radiusTR, radiusBR, radiusBL, ...translate, rotate, ...scale, 0, 0, 0,
          x2n, y2n, ...decoColor, ...decoColor, ...decoColor, ...uv11, ...rect, radiusTL, radiusTR, radiusBR, radiusBL, ...translate, rotate, ...scale, 0, 0, 0,
          x2n, y1n, ...decoColor, ...decoColor, ...decoColor, ...uv00, ...rect, radiusTL, radiusTR, radiusBR, radiusBL, ...translate, rotate, ...scale, 0, 0, 0
        );
      });
    });

    return new Float32Array(vertices);
  }

  /**
   * 渲染文本装饰
   */
  _renderTextDecorations(pass, tasks) {
    const decoData = this.generateTextDecorationVertices(tasks);
    if (decoData.length === 0) return;

    const decoBuf = this._createBuffer(decoData.byteLength, GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST);
    if (!decoBuf) return;

    try {
      this.device.queue.writeBuffer(decoBuf, 0, decoData);
      pass.setPipeline(this.layoutPipeline);
      pass.setVertexBuffer(0, decoBuf);
      pass.draw(decoData.length / 32);

      setTimeout(() => this._destroyBuffer(decoBuf), 100);
    } catch (error) {
      this._reportError(`文本装饰渲染失败: ${error.message}`, error);
      this._destroyBuffer(decoBuf);
    }
  }

  /**
   * 生成文字阴影顶点数据
   */
  generateTextShadowVertexData(tasks) {
    const vertices = [];
    const w = this.canvas.width;
    const h = this.canvas.height;

    tasks.forEach(task => {
      const textShadow = task.textShadow;
      if (!textShadow || !Array.isArray(textShadow) || textShadow.length === 0) return;

      const fontSize = task.fontSize || 16;
      const textWidth = task.width || 100;
      const textHeight = task.height || fontSize;

      textShadow.forEach(shadow => {
        const sx = shadow.x || 0;
        const sy = shadow.y || 0;
        const blur = shadow.blur || 0;
        const shadowColor = shadow.color || [0, 0, 0, 0.5];

        const x1 = task.x + sx - blur;
        const y1 = task.y + sy - blur;
        const x2 = task.x + textWidth + sx + blur;
        const y2 = task.y + textHeight + sy + blur;

        const x1n = (x1 / w) * 2 - 1;
        const y1n = 1 - (y1 / h) * 2;
        const x2n = (x2 / w) * 2 - 1;
        const y2n = 1 - (y2 / h) * 2;

        const uv00 = [0, 0], uv01 = [0, 1], uv11 = [1, 1], uv10 = [1, 0];
        const rect = [-1, -1, 1, 1];
        const radiusTL = 0, radiusTR = 0, radiusBR = 0, radiusBL = 0;
        const translate = [0, 0];
        const rotate = 0;
        const scale = [1, 1];

        vertices.push(
          x1n, y1n, ...shadowColor, ...shadowColor, ...shadowColor, ...uv00, ...rect, radiusTL, radiusTR, radiusBR, radiusBL, ...translate, rotate, ...scale, 0, 0, 0,
          x1n, y2n, ...shadowColor, ...shadowColor, ...shadowColor, ...uv01, ...rect, radiusTL, radiusTR, radiusBR, radiusBL, ...translate, rotate, ...scale, 0, 0, 0,
          x2n, y2n, ...shadowColor, ...shadowColor, ...shadowColor, ...uv11, ...rect, radiusTL, radiusTR, radiusBR, radiusBL, ...translate, rotate, ...scale, 0, 0, 0,
          x1n, y1n, ...shadowColor, ...shadowColor, ...shadowColor, ...uv10, ...rect, radiusTL, radiusTR, radiusBR, radiusBL, ...translate, rotate, ...scale, 0, 0, 0,
          x2n, y2n, ...shadowColor, ...shadowColor, ...shadowColor, ...uv11, ...rect, radiusTL, radiusTR, radiusBR, radiusBL, ...translate, rotate, ...scale, 0, 0, 0,
          x2n, y1n, ...shadowColor, ...shadowColor, ...shadowColor, ...uv00, ...rect, radiusTL, radiusTR, radiusBR, radiusBL, ...translate, rotate, ...scale, 0, 0, 0
        );
      });
    });

    return new Float32Array(vertices);
  }

  /**
   * 渲染文字阴影
   */
  _renderTextShadows(pass, tasks) {
    const shadowData = this.generateTextShadowVertexData(tasks);
    if (shadowData.length === 0) return;

    const shadowBuf = this._createBuffer(shadowData.byteLength, GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST);
    if (!shadowBuf) return;

    try {
      this.device.queue.writeBuffer(shadowBuf, 0, shadowData);
      pass.setPipeline(this.layoutPipeline);
      pass.setVertexBuffer(0, shadowBuf);
      pass.draw(shadowData.length / 32);

      setTimeout(() => this._destroyBuffer(shadowBuf), 100);
    } catch (error) {
      this._reportError(`文字阴影渲染失败: ${error.message}`, error);
      this._destroyBuffer(shadowBuf);
    }
  }

  /**
   * 销毁渲染引擎
   */
  destroy() {
    this.destroyed = true;
    this.initialized = false;

    this._cleanup();
    this.layoutTasks = [];

    console.log('🗑️ 渲染引擎已销毁');
  }

  /**
   * 上报错误
   */
  _reportError(message, error = null) {
    this.lastError = { message, error, time: Date.now() };

    if (this.onError) {
      this.onError(message, error);
    }

    if (error) {
      console.error(`[WebGPU Error] ${message}`, error);
    } else {
      console.error(`[WebGPU Error] ${message}`);
    }
  }

  /**
   * 颜色转换
   */
  hexToRgba(hex, alpha = 1) {
    if (!hex) return [0.5, 0.5, 0.5, alpha];

    const rgbaMatch = hex.match(/rgba?\s*\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+))?\s*\)/);
    if (rgbaMatch) {
      return [
        parseFloat(rgbaMatch[1]) / 255,
        parseFloat(rgbaMatch[2]) / 255,
        parseFloat(rgbaMatch[3]) / 255,
        rgbaMatch[4] !== undefined ? parseFloat(rgbaMatch[4]) : alpha
      ];
    }

    if (hex.startsWith('#')) {
      let r, g, b;
      if (hex.length === 4) {
        r = parseInt(hex[1] + hex[1], 16) / 255;
        g = parseInt(hex[2] + hex[2], 16) / 255;
        b = parseInt(hex[3] + hex[3], 16) / 255;
      } else {
        r = parseInt(hex.slice(1, 3), 16) / 255;
        g = parseInt(hex.slice(3, 5), 16) / 255;
        b = parseInt(hex.slice(5, 7), 16) / 255;
      }
      return [r, g, b, alpha];
    }

    const colorNames = {
      'red': [1, 0, 0, alpha],
      'green': [0, 0.502, 0, alpha],
      'blue': [0, 0, 1, alpha],
      'white': [1, 1, 1, alpha],
      'black': [0, 0, 0, alpha],
      'yellow': [1, 1, 0, alpha],
      'cyan': [0, 1, 1, alpha],
      'transparent': [0, 0, 0, 0]
    };

    return colorNames[hex.toLowerCase()] || [0.5, 0.5, 0.5, alpha];
  }

  parseGradient(gradientStr) {
    if (!gradientStr || !gradientStr.includes('gradient')) return null;

    const colorFormats = [
      /#[0-9a-fA-F]{3,8}/g,
      /rgba?\s*\([^)]+\)/g,
      /[a-zA-Z]+(?=\s*[\d]|$)/g
    ];

    let colors = [];
    colorFormats.forEach(regex => {
      const matches = gradientStr.match(regex) || [];
      colors = colors.concat(matches);
    });

    if (colors.length < 2) return null;

    return {
      start: this.hexToRgba(colors[0]),
      end: this.hexToRgba(colors[colors.length - 1]),
      direction: gradientStr.includes('to right') ? [0, 0, 1, 0.5] : [0, 0.5, 1, 0.5]
    };
  }

  parseBoxShadow(shadowStr) {
    if (!shadowStr) return [{ x: 0, y: 0, blur: 0, spread: 0, color: [0, 0, 0, 0.3], inset: false }];

    const shadows = [];
    const shadowParts = shadowStr.split(',').map(s => s.trim());

    for (const part of shadowParts) {
      if (!part) continue;

      const numMatches = part.match(/-?[\d.]+(?=px)?/g) || [];
      const colorPatterns = [/rgba?\s*\([^)]+\)/, /#[0-9a-fA-F]{3,8}/, /[a-zA-Z]+/];

      let color = [0, 0, 0, 0.3];
      for (const pattern of colorPatterns) {
        const match = part.match(pattern);
        if (match) {
          color = this.hexToRgba(match[0]);
          break;
        }
      }

      shadows.push({
        x: numMatches[0] ? parseFloat(numMatches[0]) : 0,
        y: numMatches[1] ? parseFloat(numMatches[1]) : 0,
        blur: numMatches[2] ? parseFloat(numMatches[2]) : 4,
        spread: numMatches[3] ? parseFloat(numMatches[3]) : 0,
        color,
        inset: part.includes('inset')
      });
    }

    return shadows.length > 0 ? shadows : [{ x: 0, y: 0, blur: 0, spread: 0, color: [0, 0, 0, 0.3], inset: false }];
  }
}