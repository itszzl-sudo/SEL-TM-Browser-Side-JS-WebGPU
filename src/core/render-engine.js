/**
 * SEL-TM WebGPU 渲染引擎（热路径）
 * 负责 GPU 渲染管线，处理渐变、阴影、圆角等视觉效果
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
    this.animationTime = 0;
    this.fps = 0;
    this.frameCount = 0;
    this.lastFpsTime = performance.now();
  }

  async init() {
    if (!navigator.gpu) {
      console.error('WebGPU 不可用');
      return false;
    }

    this.context = this.canvas.getContext('webgpu');
    this.device = await navigator.gpu.requestAdapter().then(adapter => adapter.requestDevice());
    
    const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
    this.context.configure({
      device: this.device,
      format: presentationFormat,
      alphaMode: 'premultiplied'
    });

    await this.initPipelines(presentationFormat);
    console.log('🚀 WebGPU 高阶渲染管线（渐变/阴影/动画）初始化完成');
    return true;
  }

  async initPipelines(format) {
    // 布局渲染管线
    const layoutShaderCode = `
      struct Vertex {
        @location(0) pos: vec2f,
        @location(1) color: vec4f,
        @location(2) gradStart: vec4f,
        @location(3) gradEnd: vec4f,
        @location(4) uv: vec2f,
        @location(5) rect: vec4f,
        @location(6) radius: f32,
        @location(7) translate: vec2f,
        @location(8) rotate: f32,
        @location(9) scale: vec2f
      }
      struct VOut {
        @builtin(position) pos: vec4f,
        @location(0) color: vec4f,
        @location(1) gradStart: vec4f,
        @location(2) gradEnd: vec4f,
        @location(3) uv: vec2f,
        @location(4) rect: vec4f,
        @location(5) radius: f32
      }
      @vertex fn vs(v: Vertex) -> VOut {
        var out: VOut;
        
        var scaledPos = v.pos * v.scale;
        let cosR = cos(v.rotate);
        let sinR = sin(v.rotate);
        let rotatedX = scaledPos.x * cosR - scaledPos.y * sinR;
        let rotatedY = scaledPos.x * sinR + scaledPos.y * cosR;
        let finalPos = vec2f(rotatedX, rotatedY) + v.translate;
        
        out.pos = vec4f(finalPos, 0.0, 1.0);
        out.color = v.color;
        out.gradStart = v.gradStart;
        out.gradEnd = v.gradEnd;
        out.uv = v.uv;
        out.rect = v.rect;
        out.radius = v.radius;
        return out;
      }
      @fragment fn fs(in: VOut) -> @location(0) vec4f {
        let rectMin = in.rect.xy;
        let rectMax = in.rect.zw;
        let center = (rectMin + rectMax) / 2.0;
        let halfSize = (rectMax - rectMin) / 2.0;
        let cornerRadius = min(in.radius, min(halfSize.x, halfSize.y));
        let d = abs(in.pos.xy - center) - halfSize + vec2<f32>(cornerRadius);
        let dist = length(max(d, vec2<f32>(0.0))) + min(max(d.x, d.y), 0.0);
        let alpha = 1.0 - smoothstep(cornerRadius - 1.0, cornerRadius + 1.0, dist);
        
        let gradMix = mix(in.gradStart, in.gradEnd, in.uv.y);
        let finalColor = select(in.color, gradMix, in.gradEnd.a > 0.0);
        
        return vec4f(finalColor.rgb, finalColor.a * alpha);
      }
    `;

    const layoutShaderModule = this.device.createShaderModule({ code: layoutShaderCode });
    this.layoutPipeline = this.device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module: layoutShaderModule,
        entryPoint: 'vs',
        buffers: [{
          arrayStride: 104,
          attributes: [
            { shaderLocation: 0, offset: 0, format: 'float32x2' },
            { shaderLocation: 1, offset: 8, format: 'float32x4' },
            { shaderLocation: 2, offset: 24, format: 'float32x4' },
            { shaderLocation: 3, offset: 40, format: 'float32x4' },
            { shaderLocation: 4, offset: 56, format: 'float32x2' },
            { shaderLocation: 5, offset: 64, format: 'float32x4' },
            { shaderLocation: 6, offset: 80, format: 'float32' },
            { shaderLocation: 7, offset: 84, format: 'float32x2' },
            { shaderLocation: 8, offset: 92, format: 'float32' },
            { shaderLocation: 9, offset: 96, format: 'float32x2' }
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

    const compositorShaderModule = this.device.createShaderModule({ code: compositorShaderCode });
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
  }

  render(tasks) {
    this.layoutTasks = tasks;
    this.renderLoop();
  }

  renderLoop() {
    const commandEncoder = this.device.createCommandEncoder();
    const textureView = this.context.getCurrentTexture().createView();
    
    const renderPassDescriptor = {
      colorAttachments: [{
        view: textureView,
        loadOp: 'clear',
        storeOp: 'store',
        clearValue: { r: 0.05, g: 0.05, b: 0.08, a: 1.0 }
      }]
    };

    const pass = commandEncoder.beginRenderPass(renderPassDescriptor);

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
      const shadowData = this.generateShadowVertexData(this.layoutTasks);
      const shadowBuf = this.device.createBuffer({
        size: shadowData.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
      });
      this.device.queue.writeBuffer(shadowBuf, 0, shadowData);
      pass.setPipeline(this.layoutPipeline);
      pass.setVertexBuffer(0, shadowBuf);
      pass.draw(this.layoutTasks.length * 6);

      // 渲染边框
      const borderData = this.generateBorderVertices(this.layoutTasks);
      if (borderData.length > 0) {
        const borderBuf = this.device.createBuffer({
          size: borderData.byteLength,
          usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
        });
        this.device.queue.writeBuffer(borderBuf, 0, borderData);
        pass.setPipeline(this.layoutPipeline);
        pass.setVertexBuffer(0, borderBuf);
        pass.draw(borderData.length / 26);
      }

      // 渲染布局色块
      const vertexData = this.generateAdvancedVertexData(this.layoutTasks);
      const vertexBuf = this.device.createBuffer({
        size: vertexData.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
      });
      this.device.queue.writeBuffer(vertexBuf, 0, vertexData);
      pass.setPipeline(this.layoutPipeline);
      pass.setVertexBuffer(0, vertexBuf);
      pass.draw(this.layoutTasks.length * 6);
    }

    pass.end();
    this.device.queue.submit([commandEncoder.finish()]);

    this.animationTime += 1 / 60;
    requestAnimationFrame(() => this.renderLoop());
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
      const gradient = task.background && task.background.includes('gradient') ? 
                       this.parseGradient(task.background) : null;
      
      const gradStart = gradient ? gradient.start : [0, 0, 0, 0];
      const gradEnd = gradient ? gradient.end : [0, 0, 0, 0];

      const uv00 = [0, 0], uv01 = [0, 1], uv11 = [1, 1], uv10 = [1, 0], uv112 = [1, 1], uv002 = [0, 0];

      const rectMinX = ((task.x) / w) * 2 - 1;
      const rectMinY = 1 - ((task.y) / h) * 2;
      const rectMaxX = ((task.x + task.width) / w) * 2 - 1;
      const rectMaxY = 1 - ((task.y + task.height) / h) * 2;
      const rect = [rectMinX, rectMinY, rectMaxX, rectMaxY];
      const radius = (task.borderRadius || 0) / w * 2;

      const transform = task.transform || { translate: [0, 0], rotate: 0, scale: [1, 1] };
      const translate = [transform.translate[0] / w * 2, -transform.translate[1] / h * 2];
      const rotate = transform.rotate * Math.PI / 180;
      const scale = transform.scale;

      vertices.push(
        x1, y1, ...baseColor, ...gradStart, ...gradEnd, ...uv00, ...rect, radius, ...translate, rotate, ...scale,
        x1, y2, ...baseColor, ...gradStart, ...gradEnd, ...uv01, ...rect, radius, ...translate, rotate, ...scale,
        x2, y2, ...baseColor, ...gradStart, ...gradEnd, ...uv11, ...rect, radius, ...translate, rotate, ...scale,
        x1, y1, ...baseColor, ...gradStart, ...gradEnd, ...uv10, ...rect, radius, ...translate, rotate, ...scale,
        x2, y2, ...baseColor, ...gradStart, ...gradEnd, ...uv112, ...rect, radius, ...translate, rotate, ...scale,
        x2, y1, ...baseColor, ...gradStart, ...gradEnd, ...uv002, ...rect, radius, ...translate, rotate, ...scale
      );
    });

    return new Float32Array(vertices);
  }

  generateShadowVertexData(tasks) {
    const vertices = [];
    const w = this.canvas.width;
    const h = this.canvas.height;

    tasks.forEach(task => {
      const shadow = task.boxShadow ? this.parseBoxShadow(task.boxShadow) : null;
      if (!shadow || shadow.blur <= 0) return;

      const shadowX = task.x + shadow.x;
      const shadowY = task.y + shadow.y;
      const shadowW = task.width + shadow.blur * 2;
      const shadowH = task.height + shadow.blur * 2;

      const x1 = (shadowX - shadow.blur) / w * 2 - 1;
      const y1 = 1 - (shadowY - shadow.blur) / h * 2;
      const x2 = ((shadowX + shadowW) + shadow.blur) / w * 2 - 1;
      const y2 = 1 - ((shadowY + shadowH) + shadow.blur) / h * 2;

      const shadowColor = [...shadow.color];
      shadowColor[3] *= 0.5;

      const uv00 = [0, 0], uv01 = [0, 1], uv11 = [1, 1], uv10 = [1, 0], uv112 = [1, 1], uv002 = [0, 0];

      const rect = [-1, -1, 1, 1];
      const radius = 0;

      const transform = task.transform || { translate: [0, 0], rotate: 0, scale: [1, 1] };
      const translate = [transform.translate[0] / w * 2, -transform.translate[1] / h * 2];
      const rotate = transform.rotate * Math.PI / 180;
      const scale = transform.scale;

      vertices.push(
        x1, y1, ...shadowColor, [0, 0, 0, 0], [0, 0, 0, 0], ...uv00, ...rect, radius, ...translate, rotate, ...scale,
        x1, y2, ...shadowColor, [0, 0, 0, 0], [0, 0, 0, 0], ...uv01, ...rect, radius, ...translate, rotate, ...scale,
        x2, y2, ...shadowColor, [0, 0, 0, 0], [0, 0, 0, 0], ...uv11, ...rect, radius, ...translate, rotate, ...scale,
        x1, y1, ...shadowColor, [0, 0, 0, 0], [0, 0, 0, 0], ...uv10, ...rect, radius, ...translate, rotate, ...scale,
        x2, y2, ...shadowColor, [0, 0, 0, 0], [0, 0, 0, 0], ...uv112, ...rect, radius, ...translate, rotate, ...scale,
        x2, y1, ...shadowColor, [0, 0, 0, 0], [0, 0, 0, 0], ...uv002, ...rect, radius, ...translate, rotate, ...scale
      );
    });

    return new Float32Array(vertices);
  }

  generateBorderVertices(tasks) {
    const vertices = [];
    const w = this.canvas.width;
    const h = this.canvas.height;

    tasks.forEach(task => {
      const border = task.border;
      if (!border) return;

      const edges = [
        { side: 'top', dir: [0, -1], length: task.width },
        { side: 'right', dir: [1, 0], length: task.height },
        { side: 'bottom', dir: [0, 1], length: task.width },
        { side: 'left', dir: [-1, 0], length: task.height }
      ];

      edges.forEach(edge => {
        const b = border[edge.side] || (typeof border === 'object' ? border : null);
        if (!b || !b.width || b.width <= 0) return;

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
        const radius = 0;

        const transform = task.transform || { translate: [0, 0], rotate: 0, scale: [1, 1] };
        const translate = [transform.translate[0] / w * 2, -transform.translate[1] / h * 2];
        const rotate = transform.rotate * Math.PI / 180;
        const scale = transform.scale;

        vertices.push(
          x1n, y1n, ...color, ...color, ...color, ...uv00, ...rect, radius, ...translate, rotate, ...scale,
          x1n, y2n, ...color, ...color, ...color, ...uv01, ...rect, radius, ...translate, rotate, ...scale,
          x2n, y2n, ...color, ...color, ...color, ...uv11, ...rect, radius, ...translate, rotate, ...scale,
          x1n, y1n, ...color, ...color, ...color, ...uv10, ...rect, radius, ...translate, rotate, ...scale,
          x2n, y2n, ...color, ...color, ...color, ...uv11, ...rect, radius, ...translate, rotate, ...scale,
          x2n, y1n, ...color, ...color, ...color, ...uv00, ...rect, radius, ...translate, rotate, ...scale
        );
      });
    });

    return new Float32Array(vertices);
  }

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
    if (!shadowStr) return { x: 0, y: 0, blur: 0, spread: 0, color: [0, 0, 0, 0.3], inset: false };
    
    const numMatches = shadowStr.match(/-?[\d.]+(?=px)?/g) || [];
    const colorPatterns = [/rgba?\s*\([^)]+\)/, /#[0-9a-fA-F]{3,8}/, /[a-zA-Z]+/];
    
    let color = [0, 0, 0, 0.3];
    for (const pattern of colorPatterns) {
      const match = shadowStr.match(pattern);
      if (match) {
        color = this.hexToRgba(match[0]);
        break;
      }
    }
    
    return {
      x: numMatches[0] ? parseFloat(numMatches[0]) : 0,
      y: numMatches[1] ? parseFloat(numMatches[1]) : 0,
      blur: numMatches[2] ? parseFloat(numMatches[2]) : 4,
      spread: numMatches[3] ? parseFloat(numMatches[3]) : 0,
      color,
      inset: shadowStr.includes('inset')
    };
  }
}