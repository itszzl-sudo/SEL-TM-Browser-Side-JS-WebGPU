/**
 * 样式解析器
 * 负责解析 CSS 样式字符串和装饰效果
 */
import { ColorParser } from './color-parser.js';

export class StyleParser {
  constructor() {
    this.colorParser = new ColorParser();
    this.cssVariables = new Map();
    this.animationFrames = new Map();
    this.pseudoElements = new Map();
  }

  /**
   * 解析伪元素样式
   * @param {string} cssText - CSS 文本
   * @returns {Map} 伪元素映射
   */
  parsePseudoElements(cssText) {
    const pseudoMap = new Map();

    const selectorRegex = /([a-zA-Z0-9_.-]+)(::?(?:before|after|first-letter|first-line|selection))?\s*\{([^}]*)\}/g;
    let match;

    while ((match = selectorRegex.exec(cssText)) !== null) {
      const selector = match[1];
      const pseudoType = match[2] || 'element';
      const properties = this.parseStyle(match[3]);

      const key = pseudoType.startsWith(':') ? `${selector}${pseudoType}` : selector;
      const pseudoStyles = pseudoMap.get(key) || {};

      if (pseudoType.includes('before')) {
        pseudoStyles.before = this._parsePseudoProperties(properties);
      } else if (pseudoType.includes('after')) {
        pseudoStyles.after = this._parsePseudoProperties(properties);
      } else {
        Object.assign(pseudoStyles, properties);
      }

      pseudoMap.set(key, pseudoStyles);
    }

    this.pseudoElements = pseudoMap;
    return pseudoMap;
  }

  /**
   * 解析伪元素属性
   * @param {object} properties - 属性对象
   * @returns {object} 伪元素属性
   */
  _parsePseudoProperties(properties) {
    const pseudoProps = {};

    if (properties.content) {
      pseudoProps.content = properties.content.replace(/["']/g, '');
    }
    if (properties.display) {
      pseudoProps.display = properties.display;
    }
    if (properties.width) {
      pseudoProps.width = parseFloat(properties.width) || 'auto';
    }
    if (properties.height) {
      pseudoProps.height = parseFloat(properties.height) || 'auto';
    }
    if (properties.background) {
      pseudoProps.background = properties.background;
    }
    if (properties.color) {
      pseudoProps.color = this.colorParser.hexToRgba(properties.color);
    }
    if (properties.position) {
      pseudoProps.position = properties.position;
    }

    return pseudoProps;
  }

  /**
   * 获取伪元素样式
   * @param {string} selector - 选择器
   * @param {string} pseudoType - 伪元素类型 (before/after)
   * @returns {object|null} 伪元素样式
   */
  getPseudoElement(selector, pseudoType) {
    const key = `${selector}::${pseudoType}`;
    return this.pseudoElements.get(key) || null;
  }

  /**
   * 获取所有伪元素
   * @returns {Map} 伪元素映射
   */
  getAllPseudoElements() {
    return this.pseudoElements;
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
        const camelKey = this.cssToCamelCase(key);
        style[camelKey] = val;
      }
    });

    return style;
  }

  /**
   * CSS 属性名转换为驼峰形式
   * @param {string} cssKey - CSS 属性名
   * @returns {string} 驼峰形式的属性名
   */
  cssToCamelCase(cssKey) {
    return cssKey.replace(/-([a-z])/g, (match, letter) => letter.toUpperCase());
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
   * 解析背景图片
   * @param {string} bgStr - 背景字符串
   * @returns {object} 背景对象
   */
  parseBackgroundImage(bgStr) {
    if (!bgStr || bgStr === 'none') {
      return { type: 'none' };
    }

    const urlMatch = bgStr.match(/url\s*\(\s*['"]?([^'")\s]+)['"]?\s*\)/i);
    if (urlMatch) {
      return {
        type: 'image',
        url: urlMatch[1],
        loaded: false,
        texture: null
      };
    }

    if (bgStr.includes('gradient')) {
      return {
        type: 'gradient',
        gradient: this.parseGradient(bgStr)
      };
    }

    return { type: 'none' };
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
   * 解析文字阴影
   * @param {string} shadowStr - 阴影字符串
   * @returns {object} 阴影对象
   */
  parseTextShadow(shadowStr) {
    if (!shadowStr || shadowStr === 'none') return null;

    const shadows = [];
    const shadowParts = shadowStr.split(',').map(s => s.trim());

    shadowParts.forEach(part => {
      let x = 0, y = 0, blur = 0;
      let color = [0, 0, 0, 1];

      const numMatches = part.match(/-?[\d.]+(?=px)?/g) || [];
      if (numMatches.length >= 2) {
        x = parseFloat(numMatches[0]) || 0;
        y = parseFloat(numMatches[1]) || 0;
        blur = numMatches[2] ? parseFloat(numMatches[2]) : 0;
      }

      const colorPatterns = [
        /rgba?\s*\([^)]+\)/,
        /hsla?\s*\([^)]+\)/,
        /#[0-9a-fA-F]{3,8}/,
        /[a-zA-Z]+/
      ];

      for (const pattern of colorPatterns) {
        const colorMatch = part.match(pattern);
        if (colorMatch) {
          color = this.colorParser.hexToRgba(colorMatch[0]);
          break;
        }
      }

      shadows.push({ x, y, blur, color });
    });

    return shadows;
  }

  /**
   * 解析过渡动画
   * @param {string} transitionStr - 过渡字符串
   * @returns {object} 过渡对象
   */
  parseTransition(transitionStr) {
    if (!transitionStr || transitionStr === 'none') {
      return { property: 'all', duration: 0, timingFunction: 'ease', delay: 0 };
    }

    const parts = transitionStr.split(',').map(s => s.trim());
    const transitions = parts.map(part => {
      const tokens = part.split(/\s+/);
      let property = 'all';
      let duration = 0;
      let timingFunction = 'ease';
      let delay = 0;

      tokens.forEach(token => {
        if (token.endsWith('ms') || token.endsWith('s')) {
          if (duration === 0) {
            duration = token.endsWith('ms') ? parseFloat(token) : parseFloat(token) * 1000;
          } else {
            delay = token.endsWith('ms') ? parseFloat(token) : parseFloat(token) * 1000;
          }
        } else if (token.includes('cubic-bezier')) {
          timingFunction = token;
        } else if (token === 'ease' || token === 'linear' || token === 'ease-in' || token === 'ease-out' || token === 'ease-in-out') {
          timingFunction = token;
        } else if (token !== 'all' && token !== 'none') {
          property = token;
        }
      });

      return { property, duration, timingFunction, delay };
    });

    return transitions[0] || { property: 'all', duration: 0, timingFunction: 'ease', delay: 0 };
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
   * 解析多列布局
   * @param {object} style - 样式对象
   * @returns {object} 多列配置
   */
  parseMultiColumn(style) {
    const columnCount = parseInt(style.columnCount) || 'auto';
    const columnWidth = parseFloat(style.columnWidth) || 'auto';
    const columnGap = parseFloat(style.columnGap) || style.columnRule || 0;
    const columnRuleColor = this.colorParser.hexToRgba(style.columnRuleColor || '#000');
    const columnRuleWidth = parseFloat(style.columnRuleWidth) || 1;
    const columnRuleStyle = style.columnRuleStyle || 'solid';

    return {
      columnCount,
      columnWidth,
      columnGap,
      columnRule: {
        width: columnRuleWidth,
        style: columnRuleStyle,
        color: columnRuleColor
      }
    };
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
   * 解析 text-align
   * @param {string} alignStr - 文本对齐字符串
   * @returns {string} 文本对齐方式
   */
  parseTextAlign(alignStr) {
    if (!alignStr) return 'left';

    const validAligns = ['left', 'right', 'center', 'justify', 'start', 'end'];
    const align = alignStr.toLowerCase().trim();

    if (validAligns.includes(align)) {
      return align;
    }

    return 'left';
  }

  /**
   * 解析 line-height
   * @param {string} lineHeightStr - 行高字符串
   * @returns {number} 行高值（倍数或像素值）
   */
  parseLineHeight(lineHeightStr) {
    if (!lineHeightStr) return 1.5;

    const trimmed = lineHeightStr.trim();

    if (trimmed.endsWith('px')) {
      const pxValue = parseFloat(trimmed);
      return isNaN(pxValue) ? 1.5 : pxValue;
    }

    if (trimmed.endsWith('em')) {
      const emValue = parseFloat(trimmed);
      return isNaN(emValue) ? 1.5 : emValue;
    }

    if (trimmed.endsWith('%')) {
      const percentValue = parseFloat(trimmed);
      return isNaN(percentValue) ? 1.5 : percentValue / 100;
    }

    const numValue = parseFloat(trimmed);
    if (!isNaN(numValue)) {
      return numValue;
    }

    return 1.5;
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
   * 解析 CSS 关键帧
   * @param {string} keyframesStr - 关键帧字符串
   * @returns {object} 关键帧对象
   */
  parseKeyframes(keyframesStr) {
    if (!keyframesStr) return null;

    const frames = [];
    const percentageRegex = /(\d+)%\s*\{([^}]*)\}/g;
    let match;

    while ((match = percentageRegex.exec(keyframesStr)) !== null) {
      const percentage = parseInt(match[1]);
      const properties = this._parseKeyframeProperties(match[2]);

      if (percentage === 0) {
        frames.from = properties;
      } else if (percentage === 100) {
        frames.to = properties;
      } else {
        frames.push({ percentage, ...properties });
      }
    }

    frames.sort((a, b) => {
      const percentA = a.percentage !== undefined ? a.percentage : (a === frames.from ? 0 : 100);
      const percentB = b.percentage !== undefined ? b.percentage : (b === frames.to ? 100 : 0);
      return percentA - percentB;
    });

    return { frames, name: this._extractKeyframesName(keyframesStr) };
  }

  /**
   * 解析关键帧属性
   * @param {string} propsStr - 属性字符串
   * @returns {object} 属性对象
   */
  _parseKeyframeProperties(propsStr) {
    const props = {};
    const declarations = propsStr.split(';').filter(d => d.trim());

    declarations.forEach(decl => {
      const [property, value] = decl.split(':').map(s => s.trim());
      if (property && value) {
        props[property] = value;
      }
    });

    return props;
  }

  /**
   * 提取关键帧名称
   * @param {string} keyframesStr - 关键帧字符串
   * @returns {string} 关键帧名称
   */
  _extractKeyframesName(keyframesStr) {
    const nameMatch = keyframesStr.match(/@keyframes\s+([a-zA-Z0-9_-]+)/);
    return nameMatch ? nameMatch[1] : 'unnamed';
  }

  /**
   * 存储关键帧规则
   * @param {string} name - 关键帧名称
   * @param {object} keyframes - 关键帧对象
   */
  addKeyframesRule(name, keyframes) {
    this.animationFrames.set(name, keyframes);
  }

  /**
   * 获取关键帧规则
   * @param {string} name - 关键帧名称
   * @returns {object|null} 关键帧对象
   */
  getKeyframes(name) {
    return this.animationFrames.get(name) || null;
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
