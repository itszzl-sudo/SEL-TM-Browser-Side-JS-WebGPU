/**
 * 颜色解析工具类
 * 支持多种颜色格式：hex、rgba、rgb、hsl、hsla、颜色名称
 */
export class ColorParser {
  /**
   * 将颜色字符串转换为 RGBA 数组（0-1范围）
   * @param {string} hex - 颜色字符串
   * @param {number} alpha - 透明度（默认1）
   * @returns {number[]} [r, g, b, a]
   */
  hexToRgba(hex, alpha = 1) {
    if (!hex) return [0.5, 0.5, 0.5, alpha];
    
    // 处理 rgba() 格式
    const rgbaMatch = hex.match(/rgba?\s*\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+))?\s*\)/);
    if (rgbaMatch) {
      const r = parseFloat(rgbaMatch[1]) / 255;
      const g = parseFloat(rgbaMatch[2]) / 255;
      const b = parseFloat(rgbaMatch[3]) / 255;
      const a = rgbaMatch[4] !== undefined ? parseFloat(rgbaMatch[4]) : alpha;
      return [r, g, b, a];
    }
    
    // 处理 hsl() 格式
    const hslMatch = hex.match(/hsla?\s*\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*(?:,\s*([\d.]+))?\s*\)/);
    if (hslMatch) {
      const h = parseFloat(hslMatch[1]) / 360;
      const s = parseFloat(hslMatch[2]) / 100;
      const l = parseFloat(hslMatch[3]) / 100;
      const a = hslMatch[4] !== undefined ? parseFloat(hslMatch[4]) : alpha;
      const [r, g, b] = this.hslToRgb(h, s, l);
      return [r, g, b, a];
    }
    
    // 处理十六进制颜色
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
    
    // 处理颜色名称
    const colorNames = {
      'red': [1, 0, 0, alpha],
      'green': [0, 0.502, 0, alpha],
      'blue': [0, 0, 1, alpha],
      'white': [1, 1, 1, alpha],
      'black': [0, 0, 0, alpha],
      'yellow': [1, 1, 0, alpha],
      'cyan': [0, 1, 1, alpha],
      'magenta': [1, 0, 1, alpha],
      'orange': [1, 0.647, 0, alpha],
      'purple': [0.502, 0.251, 0.502, alpha],
      'pink': [1, 0.753, 0.796, alpha],
      'gray': [0.502, 0.502, 0.502, alpha],
      'grey': [0.502, 0.502, 0.502, alpha],
      'transparent': [0, 0, 0, 0]
    };
    
    if (colorNames[hex.toLowerCase()]) {
      return colorNames[hex.toLowerCase()];
    }
    
    return [0.5, 0.5, 0.5, alpha];
  }

  /**
   * HSL 转 RGB
   * @param {number} h - 色相 (0-1)
   * @param {number} s - 饱和度 (0-1)
   * @param {number} l - 亮度 (0-1)
   * @returns {number[]} [r, g, b]
   */
  hslToRgb(h, s, l) {
    let r, g, b;
    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }
    return [r, g, b];
  }
}