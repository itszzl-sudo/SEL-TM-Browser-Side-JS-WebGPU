/**
 * 样式解析器
 * 负责解析CSS样式字符串和装饰效果
 */
export class StyleParser {
  constructor() {
    this.colorParser = new (await import('./color-parser.js')).ColorParser();
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
    // 如果直接传入的是内联样式字符串（不含标签属性），直接解析
    if (!styleStr.includes('=') || (styleStr.includes(':') && !styleStr.includes('style='))) {
      return this.parseStyle(styleStr);
    }

    const attrs = this.parseInlineAttributes(styleStr);
    const mergedStyle = {};

    // 解析内联样式
    if (attrs.style) {
      const inlineStyle = this.parseStyle(attrs.style);
      Object.assign(mergedStyle, inlineStyle);
    }

    // 解析类样式
    if (attrs.class) {
      const classes = attrs.class.split(/\s+/);
      classes.forEach(cls => {
        const classStyle = cssRules.get('.' + cls);
        if (classStyle) Object.assign(mergedStyle, classStyle);
      });
    }

    // 解析ID样式
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
    
    const colorFormats = [
      /#[0-9a-fA-F]{3,8}/g,
      /rgba?\s*\([^)]+\)/g,
      /hsla?\s*\([^)]+\)/g,
      /[a-zA-Z]+(?=\s*[\d]|$)/g
    ];
    
    let colors = [];
    colorFormats.forEach(regex => {
      const matches = gradientStr.match(regex) || [];
      colors = colors.concat(matches);
    });
    
    if (colors.length < 2) return null;
    
    const startColor = colors[0];
    const endColor = colors[colors.length - 1];
    
    let direction = [0, 0.5, 1, 0.5];
    if (gradientStr.includes('to right') || gradientStr.includes('90deg')) {
      direction = [0, 0, 1, 0.5];
    } else if (gradientStr.includes('to bottom right') || gradientStr.includes('135deg')) {
      direction = [0, 0, 1, 1];
    }
    
    const start = this.colorParser.hexToRgba(startColor);
    const end = this.colorParser.hexToRgba(endColor);
    
    return { start, end, direction };
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
   * 解析变换
   * @param {string} transformStr - 变换字符串
   * @returns {object} 变换对象
   */
  parseTransform(transformStr) {
    if (!transformStr) return { translate: [0, 0], rotate: 0, scale: [1, 1] };
    
    const result = { translate: [0, 0], rotate: 0, scale: [1, 1] };
    
    // 解析 translate
    const translateMatch = transformStr.match(/translate(?:X|Y)?\s*\(\s*([^)]+)\s*\)/);
    if (translateMatch) {
      const vals = translateMatch[1].split(',').map(v => parseFloat(v.trim()) || 0);
      result.translate[0] = vals[0] || 0;
      result.translate[1] = vals[1] || vals[0] || 0;
    }
    
    // 解析 rotate
    const rotateMatch = transformStr.match(/rotate\s*\(\s*([^)]+)\s*\)/);
    if (rotateMatch) {
      result.rotate = parseFloat(rotateMatch[1]) || 0;
    }
    
    // 解析 scale
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
}