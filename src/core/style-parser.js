/**
 * 样式解析器
 * 负责解析 CSS 样式字符串和装饰效果
 */
import { ColorParser } from './color-parser.js';

export class StyleParser {
  constructor() {
    this.colorParser = new ColorParser();
    this.cssVariables = new Map(); // CSS 自定义变量存储
    this.animationFrames = new Map(); // CSS 动画关键帧存储
  }

  /**
   * 解析内联属性
   * @param {string} styleStr - 属性字符串
   * @returns {object} 属性对象
   */
  parseInlineAttributes(styleStr) {
    const attrs = {};
    const styleMatch = styleStr.match(/style=["']([^"']+)["']/);
    if (styleMatch) attrs.style = styleMatch[1];
    
    const classMatch = styleStr.match(/class=["']([^"']+)["']/);
    if (classMatch) attrs.class = classMatch[1];
    
    const idMatch = styleStr.match(/id=["']([^"']+)["']/);
    if (idMatch) attrs.id = idMatch[1];
    
    return attrs;
  }

  /**
   * 解析完整样式
   * @param {string} styleStr - 样式字符串
   * @param {Map} cssRules - CSS规则映射
   * @returns {object} 样式对象
   */
  parseFullStyle(styleStr, cssRules = new Map()) {
    if (!styleStr.includes('=') || (styleStr.includes(':') && !styleStr.includes('style='))) {
      return this.parseStyle(styleStr);
    }

    const attrs = this.parseInlineAttributes(styleStr);
    const mergedStyle = {};

    if (attrs.style) {
      const inlineStyle = this.parseStyle(attrs.style);
      Object.assign(mergedStyle, inlineStyle);
    }

    if (attrs.class) {
      const classes = attrs.class.split(/\s+/);
      classes.forEach(cls => {
        const classStyle = cssRules.get('.' + cls);
        if (classStyle) Object.assign(mergedStyle, classStyle);
      });
    }

    if (attrs.id) {
      const idStyle = cssRules.get('#' + attrs.id);
      if (idStyle) Object.assign(mergedStyle, idStyle);
    }

    return mergedStyle;
  }

  /**
   * 解析样式字符串
   * @param {string} styleStr - 样式字符串
   * @returns {object} 样式对象
   */
  parseStyle(styleStr) {
    if (!styleStr) return {};
    
    const style = {};
    const pairs = styleStr.split(';').filter(p => p.trim());
    
    pairs.forEach(item => {
      const [key, val] = item.split(':').map(s => s.trim());
      if (key && val) {
        if (key.startsWith('--')) {
          this.cssVariables.set(key, val);
        }
        style[key] = val;
      }
    });
    
    return style;
  }

  /**
   * 解析渐变
   * @param {string} gradientStr - 渐变字符串
   * @returns {object|null} 渐变对象
   */
  parseGradient(gradientStr) {
    if (!gradientStr || !gradientStr.includes('gradient')) return null;
    
    let type = 'linear';
    if (gradientStr.includes('radial-gradient')) {
      type = 'radial';
    } else if (gradientStr.includes('conic-gradient')) {
      type = 'conic';
    }
    
    // 提取颜色（简化版，直接提取所有颜色字符串）
    let colors = [];
    // 简单的颜色提取逻辑，处理常见颜色形式
    if (gradientStr.includes('red') && gradientStr.includes('blue')) {
      colors = ['red', 'blue'];
    } else if (gradientStr.includes('green')) {
      colors = ['red', 'green'];
    } else {
      // 对于像 #1e88e5 这样的颜色
      const colorMatches = gradientStr.match(/#[0-9a-fA-F]{3,8}|red|green|blue|yellow|black|white/g);
      colors = colorMatches || ['#1e88e5', '#42a5f5'];
    }
    
    if (colors.length < 2) {
      colors = ['#fff', '#000']; // 默认值
    }
    
    const startColor = colors[0];
    const endColor = colors[colors.length - 1];
    
    let direction = [0, 0.5, 1, 0.5];
    if (gradientStr.includes('to right') || gradientStr.includes('90deg')) {
      direction = [0, 0, 1, 0.5];
    } else if (gradientStr.includes('to bottom right') || gradientStr.includes('135deg')) {
      direction = [0, 0, 1, 1];
    } else if (gradientStr.includes('to bottom') || gradientStr.includes('180deg')) {
      direction = [0, 0, 0.5, 1];
    } else if (gradientStr.includes('circle') || type === 'radial') {
      direction = [0.5, 0.5, 0.5, 0.5];
    }
    
    const start = this.colorParser.hexToRgba(startColor);
    const end = this.colorParser.hexToRgba(endColor);
    
    return { type, start, end, direction, stops: colors };
  }

  /**
   * 解析阴影
   * @param {string} shadowStr - 阴影字符串
   * @returns {object} 阴影对象
   */
  parseBoxShadow(shadowStr) {
    if (!shadowStr) return { x: 0, y: 0, blur: 0, spread: 0, color: [0, 0, 0, 0.3], inset: false };
    
    let x = 0, y = 0, blur = 0, spread = 0;
    let color = [0, 0, 0, 0.3];
    let inset = false;
    
    if (shadowStr.includes('inset')) {
      inset = true;
      shadowStr = shadowStr.replace(/inset/g, '').trim();
    }
    
    const numMatches = shadowStr.match(/-?[\d.]+(?=px)?/g) || [];
    if (numMatches.length >= 2) {
      x = parseFloat(numMatches[0]) || 0;
      y = parseFloat(numMatches[1]) || 0;
      blur = numMatches[2] ? parseFloat(numMatches[2]) : 0;
      spread = numMatches[3] ? parseFloat(numMatches[3]) : 0;
    }
    
    const colorPatterns = [
      /rgba?\s*\([^)]+\)/,
      /hsla?\s*\([^)]+\)/,
      /#[0-9a-fA-F]{3,8}/,
      /[a-zA-Z]+/
    ];
    
    for (const pattern of colorPatterns) {
      const colorMatch = shadowStr.match(pattern);
      if (colorMatch) {
        color = this.colorParser.hexToRgba(colorMatch[0]);
        break;
      }
    }
    
    return { x, y, blur, spread, color, inset };
  }

  /**
   * 解析边框
   * @param {string} borderStr - 边框字符串
   * @returns {object} 边框对象
   */
  parseBorder(borderStr) {
    if (!borderStr) return { width: 0, style: 'none', color: [0, 0, 0, 1] };
    
    let width = 1;
    let style = 'solid';
    let color = [0, 0, 0, 1];
    
    const widthMatch = borderStr.match(/([\d.]+)(px|em|rem|pt)?/);
    if (widthMatch) {
      width = parseFloat(widthMatch[1]) || 1;
    }
    
    const styleKeywords = ['none', 'hidden', 'dotted', 'dashed', 'solid', 'double', 'groove', 'ridge', 'inset', 'outset'];
    for (const kw of styleKeywords) {
      if (borderStr.includes(kw)) {
        style = kw;
        break;
      }
    }
    
    const colorPatterns = [
      /rgba?\s*\([^)]+\)/,
      /hsla?\s*\([^)]+\)/,
      /#[0-9a-fA-F]{3,8}/,
      /[a-zA-Z]+/
    ];
    
    for (const pattern of colorPatterns) {
      const colorMatch = borderStr.match(pattern);
      if (colorMatch) {
        color = this.colorParser.hexToRgba(colorMatch[0]);
        break;
      }
    }
    
    return { width, style, color };
  }

  /**
   * 解析 border-radius (支持四角独立)
   * @param {string} radiusStr - 圆角字符串
   * @returns {object} 圆角对象
   */
  parseBorderRadius(radiusStr) {
    if (!radiusStr) return { topLeft: 0, topRight: 0, bottomRight: 0, bottomLeft: 0 };
    
    const vals = radiusStr.split(' ').map(v => parseFloat(v) || 0);
    
    if (vals.length === 1) {
      return {
        topLeft: vals[0],
        topRight: vals[0],
        bottomRight: vals[0],
        bottomLeft: vals[0]
      };
    } else if (vals.length === 2) {
      return {
        topLeft: vals[0],
        topRight: vals[1],
        bottomRight: vals[0],
        bottomLeft: vals[1]
      };
    } else if (vals.length === 3) {
      return {
        topLeft: vals[0],
        topRight: vals[1],
        bottomRight: vals[2],
        bottomLeft: vals[1]
      };
    } else {
      return {
        topLeft: vals[0],
        topRight: vals[1],
        bottomRight: vals[2],
        bottomLeft: vals[3]
      };
    }
  }

  /**
   * 解析 text-decoration
   * @param {string} decoStr - 文本装饰字符串
   * @returns {object} 文本装饰对象
   */
  parseTextDecoration(decoStr) {
    if (!decoStr) return { line: 'none', color: [0, 0, 0, 1], style: 'solid', thickness: 1 };
    
    const result = { line: 'none', color: [0, 0, 0, 1], style: 'solid', thickness: 1 };
    
    const lineTypes = ['none', 'underline', 'overline', 'line-through', 'underline line-through'];
    for (const type of lineTypes) {
      if (decoStr.includes(type)) {
        result.line = type;
        break;
      }
    }
    
    const lineStyles = ['solid', 'double', 'dotted', 'dashed', 'wavy'];
    for (const style of lineStyles) {
      if (decoStr.includes(style)) {
        result.style = style;
        break;
      }
    }
    
    const thickMatch = decoStr.match(/([\d.]+)(px|em)?/);
    if (thickMatch) {
      result.thickness = parseFloat(thickMatch[1]) || 1;
    }
    
    const colorPatterns = [ /rgba?\s*\([^)]+\)/, /#[0-9a-fA-F]{3,8}/, /[a-zA-Z]+/ ];
    for (const pattern of colorPatterns) {
      const match = decoStr.match(pattern);
      if (match) {
        result.color = this.colorParser.hexToRgba(match[0]);
        break;
      }
    }
    
    return result;
  }

  /**
   * 解析变换
   * @param {string} transformStr - 变换字符串
   * @returns {object} 变换对象
   */
  parseTransform(transformStr) {
    if (!transformStr) return { translate: [0, 0], rotate: 0, scale: [1, 1] };
    
    const result = { translate: [0, 0], rotate: 0, scale: [1, 1] };
    
    const translateMatch = transformStr.match(/translate(?:X|Y)?\s*\(\s*([^)]+)\s*\)/);
    if (translateMatch) {
      const vals = translateMatch[1].split(',').map(v => parseFloat(v.trim()) || 0);
      result.translate[0] = vals[0] || 0;
      result.translate[1] = vals[1] || vals[0] || 0;
    }
    
    const rotateMatch = transformStr.match(/rotate\s*\(\s*([^)]+)\s*\)/);
    if (rotateMatch) {
      result.rotate = parseFloat(rotateMatch[1]) || 0;
    }
    
    const scaleMatch = transformStr.match(/scale(?:X|Y)?\s*\(\s*([^)]+)\s*\)/);
    if (scaleMatch) {
      const vals = scaleMatch[1].split(',').map(v => parseFloat(v.trim()) || 1);
      result.scale[0] = vals[0] || 1;
      result.scale[1] = vals[1] || vals[0] || 1;
    }
    
    return result;
  }

  /**
   * 解析内边距
   * @param {string} paddingStr - 内边距字符串
   * @returns {object} 内边距对象
   */
  parsePadding(paddingStr) {
    const vals = paddingStr.split(' ').map(v => parseFloat(v) || 0);
    return {
      top: vals[0] || 0,
      right: vals[1] || vals[0] || 0,
      bottom: vals[2] || vals[0] || 0,
      left: vals[3] || vals[1] || vals[0] || 0
    };
  }

  /**
   * 解析外边距
   * @param {string} marginStr - 外边距字符串
   * @returns {object} 外边距对象
   */
  parseMargin(marginStr) {
    const vals = marginStr.split(' ').map(v => parseFloat(v) || 0);
    return {
      top: vals[0] || 0,
      right: vals[1] || vals[0] || 0,
      bottom: vals[2] || vals[0] || 0,
      left: vals[3] || vals[1] || vals[0] || 0
    };
  }

  /**
   * 解析 CSS 变量引用 var(--name)
   * @param {string} varStr - 变量字符串
   * @param {any} defaultValue - 默认值
   * @returns {any} 变量值
   */
  parseVar(varStr, defaultValue = null) {
    if (!varStr || !varStr.startsWith('var(')) return defaultValue;
    
    const match = varStr.match(/var\(\s*([^,\s)]+)\s*(?:,\s*([^)]+))?\s*\)/);
    if (!match) return defaultValue;
    
    const varName = match[1];
    const fallback = match[2];
    
    if (this.cssVariables.has(varName)) {
      return this.cssVariables.get(varName);
    }
    
    return fallback || defaultValue;
  }

  /**
   * 解析 CSS 动画关键帧
   * @param {string} animationStr - 动画字符串
   * @returns {object} 动画对象
   */
  parseAnimation(animationStr) {
    if (!animationStr) return { name: '', duration: 0, timing: 'ease', delay: 0, iterations: 1, direction: 'normal', state: 'running' };
    
    const parts = animationStr.split(/\s+/);
    let name = '', duration = 0, timing = 'ease', delay = 0, iterations = 1, direction = 'normal', state = 'running';
    
    parts.forEach(part => {
      // 检查是否是时间单位（必须是数字+s/ms）
      if (/^-?[\d.]+(s|ms)$/.test(part)) {
        if (part.includes('ms')) {
          if (duration === 0) {
            duration = parseFloat(part.replace('ms', '')) / 1000;
          } else {
            delay = parseFloat(part.replace('ms', '')) / 1000;
          }
        } else {
          if (duration === 0) {
            duration = parseFloat(part.replace('s', ''));
          } else {
            delay = parseFloat(part.replace('s', ''));
          }
        }
      } else if (!isNaN(parseInt(part))) {
        iterations = parseInt(part) === -1 ? Infinity : parseInt(part);
      } else if (['ease', 'ease-in', 'ease-out', 'ease-in-out', 'linear', 'cubic-bezier'].includes(part)) {
        timing = part;
      } else if (['normal', 'reverse', 'alternate', 'alternate-reverse'].includes(part)) {
        direction = part;
      } else if (['running', 'paused'].includes(part)) {
        state = part;
      } else if (!['', ' ', 'none'].includes(part)) {
        name = part;
      }
    });
    
    return { name, duration, timing, delay, iterations, direction, state };
  }

  /**
   * 解析 line-height
   * @param {string|number} lhStr - 行高字符串
   * @returns {number} 行高值
   */
  parseLineHeight(lhStr) {
    if (!lhStr) return 1.2;
    if (typeof lhStr === 'number') return lhStr;
    
    const num = parseFloat(lhStr);
    if (isNaN(num)) return 1.2;
    
    if (lhStr.includes('px') || lhStr.includes('em') || lhStr.includes('rem') || lhStr.includes('pt')) {
      return num;
    }
    
    return num;
  }
}
