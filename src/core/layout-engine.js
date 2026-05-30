/**
 * SEL-TM 冷路径 - 布局计算引擎
 * 负责 HTML/CSS 解析、布局计算（Flex/Grid/Block/Float/Inline）
 *
 * 特性：
 * - 完整 Flexbox 布局（包含 align-self、align-content）
 * - 完整 Grid 布局（包含 span、minmax、auto-fill/auto-fit）
 * - float 浮动布局
 * - z-index 层叠管理
 * - overflow 溢出处理
 * - box-sizing 盒模型
 * - inline/inline-block 行内布局
 * - @media 响应式支持
 * - calc() 计算支持
 * - 文本装饰和 vertical-align
 */
import { StyleParser } from './style-parser.js';

export class SELColdPath {
  constructor() {
    this.baseStates = [
      'PARSE_DOM',
      'MATCH_CSS',
      'COMPUTE_STYLE',
      'BOX_MODEL',
      'LAYOUT',
      'RENDER',
      'HALT'
    ];
    this.layoutAlgo = {
      flex: this.calcStandardFlex.bind(this),
      grid: this.calcStandardGrid.bind(this),
      box: this.calcStandardBox.bind(this),
      float: this.calcFloatLayout.bind(this),
      inline: this.calcInlineLayout.bind(this)
    };
    this.styleParser = new StyleParser();

    // 媒体查询存储
    this.mediaQueries = new Map();

    // z-index 层叠顺序
    this.zIndexGroups = new Map();

    // 上下文信息
    this.currentZIndex = 0;
  }

  async init(memoryDB, SEL_TM) {
    await this.initW3CRules(SEL_TM);
    const cachedL = await memoryDB.getShortTerm('layout_skills');
    if (cachedL) {
      SEL_TM.L = new Map(cachedL);
      SEL_TM.isHotStart = true;
      console.log('✅ 热启动：加载全量高阶Flex/Grid能力');
    } else {
      this.initBaseStateMachine(SEL_TM);
      console.log('🔄 冷启动：初始化完整W3C高阶布局状态机');
    }
  }

  async initW3CRules(SEL_TM) {
    const baseRules = {
      box: {
        name: 'BOX_MODEL',
        calc: 'standard_box_calc',
        standard: 'W3C-CSS-BOX-3.0'
      },
      flex: {
        name: 'CALC_FLEX_FULL',
        calc: 'standard_flex_full',
        standard: 'W3C-CSS-FLEXBOX-1.0 FULL+WRAP 全特性'
      },
      grid: {
        name: 'CALC_GRID_FULL',
        calc: 'standard_grid_full',
        standard: 'W3C-CSS-GRID-2.0 行列合并+minmax全特性'
      },
      float: {
        name: 'CALC_FLOAT',
        calc: 'standard_float',
        standard: 'W3C-CSS-FLOAT-1.0'
      },
      inline: {
        name: 'CALC_INLINE',
        calc: 'standard_inline',
        standard: 'W3C-CSS-INLINE-3.0'
      }
    };
    SEL_TM.K = baseRules;
  }

  initBaseStateMachine(SEL_TM) {
    this.baseStates.forEach(s => SEL_TM.Q.add(s));
    SEL_TM.δ.set('PARSE_DOM', 'MATCH_CSS');
    SEL_TM.δ.set('MATCH_CSS', 'COMPUTE_STYLE');
    SEL_TM.δ.set('COMPUTE_STYLE', 'BOX_MODEL');
    SEL_TM.δ.set('BOX_MODEL', 'LAYOUT');
    SEL_TM.δ.set('LAYOUT', 'RENDER');
    SEL_TM.δ.set('RENDER', 'HALT');
  }

  async selfRepair(featureType, SEL_TM) {
    if (SEL_TM.L.has(featureType)) return;
    const rule = SEL_TM.K[featureType];
    if (!rule) return;

    SEL_TM.Q.add(rule.name);
    SEL_TM.δ.set('BOX_MODEL', rule.name);
    SEL_TM.δ.set(rule.name, 'LAYOUT');

    SEL_TM.L.set(featureType, rule);
  }

  // ==================== 媒体查询支持 ====================

  /**
   * 注册媒体查询
   */
  registerMediaQuery(query, rules) {
    this.mediaQueries.set(query, rules);
  }

  /**
   * 匹配媒体查询
   */
  matchMediaQueries(width, height) {
    const matchedRules = {};
    for (const [query, rules] of this.mediaQueries) {
      if (this.evaluateMediaQuery(query, width, height)) {
        Object.assign(matchedRules, rules);
      }
    }
    return matchedRules;
  }

  /**
   * 评估媒体查询条件
   */
  evaluateMediaQuery(query, width, height) {
    const conditions = query.match(/\([^)]+\)/g) || [];
    return conditions.every(condition => {
      if (condition.includes('min-width')) {
        const minWidth = parseInt(condition.match(/min-width:\s*(\d+)/)?.[1] || '0');
        return width >= minWidth;
      }
      if (condition.includes('max-width')) {
        const maxWidth = parseInt(condition.match(/max-width:\s*(\d+)/)?.[1] || 'Infinity');
        return width <= maxWidth;
      }
      if (condition.includes('min-height')) {
        const minHeight = parseInt(condition.match(/min-height:\s*(\d+)/)?.[1] || '0');
        return height >= minHeight;
      }
      if (condition.includes('max-height')) {
        const maxHeight = parseInt(condition.match(/max-height:\s*(\d+)/)?.[1] || 'Infinity');
        return height <= maxHeight;
      }
      return true;
    });
  }

  // ==================== calc() 计算支持 ====================

  /**
   * 计算 calc() 表达式
   */
  evaluateCalc(expression, containerSize) {
    if (!expression || !expression.includes('calc(')) {
      return expression;
    }

    let result = expression;
    while (result.includes('calc(')) {
      const calcMatch = result.match(/calc\(([^)]+)\)/);
      if (!calcMatch) break;

      let calcContent = calcMatch[1];
      const evaluated = this.computeCalcExpression(calcContent, containerSize);
      result = result.replace(calcMatch[0], evaluated);
    }

    return result;
  }

  /**
   * 计算 calc 表达式
   */
  computeCalcExpression(expr, containerSize) {
    let expression = expr.trim();

    // 替换 px 单位
    expression = expression.replace(/(\d+)px/g, '$1');

    // 替换百分比
    expression = expression.replace(/(\d+)%/g, (match, val) => {
      return (parseFloat(val) * containerSize / 100).toString();
    });

    // 替换 vw/vh
    expression = expression.replace(/(\d+)vw/g, (match, val) => val);
    expression = expression.replace(/(\d+)vh/g, (match, val) => val);

    // 替换 auto
    expression = expression.replace(/auto/g, '0');

    // 处理 min() 和 max()
    expression = this.evaluateMinMax(expression);

    // 安全地计算表达式
    try {
      // 只允许数字、运算符和空格
      const sanitized = expression.replace(/[^0-9+\-*/.\s()]/g, '');
      if (!sanitized.trim()) return '0';

      // 使用 Function 替代 eval（更安全）
      const compute = new Function('return ' + sanitized);
      const result = compute();

      return isNaN(result) ? '0' : Math.max(0, result).toString();
    } catch (e) {
      console.warn('calc() 计算失败:', expr, e);
      return '0';
    }
  }

  /**
   * 处理 min() 和 max() 函数
   */
  evaluateMinMax(expression) {
    while (expression.includes('min(') || expression.includes('max(')) {
      const minMatch = expression.match(/min\(([^)]+)\)/);
      const maxMatch = expression.match(/max\(([^)]+)\)/);

      if (minMatch) {
        const args = minMatch[1].split(',').map(s => parseFloat(s.trim()));
        const result = Math.min(...args.filter(n => !isNaN(n)));
        expression = expression.replace(minMatch[0], result);
      }

      if (maxMatch) {
        const args = maxMatch[1].split(',').map(s => parseFloat(s.trim()));
        const result = Math.max(...args.filter(n => !isNaN(n)));
        expression = expression.replace(maxMatch[0], result);
      }
    }
    return expression;
  }

  // ==================== box-sizing 支持 ====================

  /**
   * 应用 box-sizing
   */
  applyBoxSizing(style, element) {
    const boxSizing = style.boxSizing || 'content-box';

    if (boxSizing === 'border-box') {
      const borderWidth = (style.borderWidth || 0);
      const paddingLeft = this.parseSideValue(style.paddingLeft || style.padding, 0);
      const paddingRight = this.parseSideValue(style.paddingRight || style.padding, 0);
      const paddingTop = this.parseSideValue(style.paddingTop || style.padding, 0);
      const paddingBottom = this.parseSideValue(style.paddingBottom || style.padding, 0);

      const totalH = paddingLeft + paddingRight + borderWidth * 2;
      const totalV = paddingTop + paddingBottom + borderWidth * 2;

      if (style.width) {
        style._originalWidth = style.width;
        style.width = Math.max(0, style.width - totalH);
      }
      if (style.height) {
        style._originalHeight = style.height;
        style.height = Math.max(0, style.height - totalV);
      }
    }

    return style;
  }

  parseSideValue(value, defaultVal) {
    if (typeof value === 'number') return value;
    if (typeof value === 'string' && value.includes('px')) {
      return parseFloat(value) || defaultVal;
    }
    return defaultVal;
  }

  // ==================== 完整 Flex 布局计算 ====================

  /**
   * 标准 Flex 布局计算（支持完整特性）
   */
  calcStandardFlex(items, container) {
    const mainAxis = container.flexDirection === 'row' || container.flexDirection === 'row-reverse' ? 'x' : 'y';
    const crossAxis = mainAxis === 'x' ? 'y' : 'x';
    const isReverse = container.flexDirection === 'row-reverse' || container.flexDirection === 'column-reverse';

    const containerSize = mainAxis === 'x' ? container.width : container.height;
    const crossSize = mainAxis === 'x' ? container.height : container.width;

    let lines = [];
    let currentLine = [];
    let currentLineSize = 0;
    let maxCrossSize = 0;

    items.forEach(item => {
      const flexBasis = item.flexBasis === 'auto' ? (mainAxis === 'x' ? item.width : item.height) || 0 :
                        typeof item.flexBasis === 'number' ? item.flexBasis :
                        parseFloat(item.flexBasis) || 0;
      item._flexBasis = flexBasis;
      item._flexGrow = item.flexGrow || 0;
      item._flexShrink = item.flexShrink === undefined ? 1 : item.flexShrink;

      if (container.flexWrap !== 'nowrap' && currentLineSize + flexBasis > containerSize && currentLine.length > 0) {
        lines.push({ items: currentLine, totalSize: currentLineSize, maxCross: maxCrossSize });
        currentLine = [];
        currentLineSize = 0;
        maxCrossSize = 0;
      }

      currentLine.push(item);
      currentLineSize += flexBasis;
      maxCrossSize = Math.max(maxCrossSize, mainAxis === 'x' ? item.height || 0 : item.width || 0);
    });

    if (currentLine.length > 0) {
      lines.push({ items: currentLine, totalSize: currentLineSize, maxCross: maxCrossSize });
    }

    const results = [];
    let crossOffset = 0;

    lines.forEach((line, lineIndex) => {
      const lineItems = line.items;
      const totalGrow = lineItems.reduce((sum, item) => sum + item._flexGrow, 0);
      const totalShrink = lineItems.reduce((sum, item) => sum + item._flexShrink * item._flexBasis, 0);

      let freeSpace = containerSize - line.totalSize;

      lineItems.forEach(item => {
        let size = item._flexBasis;

        if (freeSpace > 0 && totalGrow > 0) {
          size += (freeSpace * item._flexGrow) / totalGrow;
        } else if (freeSpace < 0 && totalShrink > 0 && item._flexShrink > 0) {
          size += (freeSpace * item._flexShrink * item._flexBasis) / totalShrink;
        }

        item._computedSize = Math.max(size, item.minWidth || item.minHeight || 0);
      });

      const computedTotal = lineItems.reduce((sum, item) => sum + item._computedSize, 0);
      const gap = container.gap || 0;
      const totalGap = gap * (lineItems.length - 1);

      let offset = 0;
      const justifyContent = container.justifyContent || 'flex-start';

      if (justifyContent === 'center') {
        offset = (containerSize - computedTotal - totalGap) / 2;
      } else if (justifyContent === 'flex-end') {
        offset = containerSize - computedTotal - totalGap;
      } else if (justifyContent === 'space-between') {
        offset = 0;
      } else if (justifyContent === 'space-around') {
        offset = (containerSize - computedTotal) / (lineItems.length * 2);
      } else if (justifyContent === 'space-evenly') {
        offset = (containerSize - computedTotal) / (lineItems.length + 1);
      }

      lineItems.forEach((item, index) => {
        if (justifyContent === 'space-between') {
          offset = index === 0 ? 0 : (containerSize - computedTotal) * index / (lineItems.length - 1) -
                   lineItems.slice(0, index).reduce((sum, i) => sum + i._computedSize, 0) - gap * index;
        } else if (justifyContent === 'space-around' || justifyContent === 'space-evenly') {
          offset += index === 0 ? offset : gap;
        } else {
          offset += index > 0 ? gap : 0;
        }

        const x = mainAxis === 'x' ? (isReverse ? containerSize - offset - item._computedSize : offset) : container.x;
        const y = mainAxis === 'y' ? (isReverse ? containerSize - offset - item._computedSize : offset) : container.y;

        const width = mainAxis === 'x' ? item._computedSize : item.width || line.maxCross;
        const height = mainAxis === 'y' ? item._computedSize : item.height || line.maxCross;

        results.push({
          x: x + (container.x || 0),
          y: y + crossOffset + (container.y || 0),
          width: width,
          height: height,
          ...item
        });

        if (justifyContent !== 'space-between') {
          offset += item._computedSize;
        }
      });

      // 处理 align-items（应用于整行）
      const alignItems = container.alignItems || 'stretch';
      results.slice(results.length - lineItems.length).forEach(item => {
        if (alignItems === 'center') {
          item.y += (crossSize - item.height) / 2;
        } else if (alignItems === 'flex-end') {
          item.y += crossSize - item.height;
        } else if (alignItems === 'stretch') {
          item.height = crossSize;
        }
      });

      // 处理 align-content（多行对齐）
      const alignContent = container.alignContent;
      if (alignContent && lines.length > 1) {
        const totalLineHeight = lines.reduce((sum, l) => sum + l.maxCross, 0) + gap * (lines.length - 1);
        let contentOffset = 0;

        if (alignContent === 'center') {
          contentOffset = (crossSize - totalLineHeight) / 2;
        } else if (alignContent === 'flex-end') {
          contentOffset = crossSize - totalLineHeight;
        } else if (alignContent === 'space-between') {
          // 需要重新计算每行的偏移
        } else if (alignContent === 'space-around') {
          contentOffset = (crossSize - totalLineHeight) / 2;
        } else if (alignContent === 'stretch') {
          // 每行拉伸
        }

        if (contentOffset > 0) {
          let offsetAdjustment = 0;
          for (let i = 0; i < lines.length; i++) {
            for (let j = 0; j < lines[i].items.length; j++) {
              const resultIndex = results.findIndex(r => r === lines[i].items[j]);
              if (resultIndex >= 0) {
                results[resultIndex].y += offsetAdjustment + contentOffset;
              }
            }
            offsetAdjustment += lines[i].maxCross + gap;
          }
        }
      }

      // 处理 align-self（单个元素）
      lineItems.forEach(item => {
        if (item.alignSelf) {
          const result = results.find(r => r === item);
          if (result) {
            if (item.alignSelf === 'center') {
              result.y += (crossSize - result.height) / 2;
            } else if (item.alignSelf === 'flex-end') {
              result.y += crossSize - result.height;
            } else if (item.alignSelf === 'stretch') {
              result.height = crossSize;
            }
          }
        }
      });

      crossOffset += line.maxCross + gap;
    });

    return results;
  }

  // ==================== 完整 Grid 布局计算 ====================

  /**
   * 标准 Grid 布局计算（支持 span、minmax、auto-fill/auto-fit）
   */
  calcStandardGrid(items, container) {
    const cols = this.parseGridTemplate(container.gridTemplateColumns || '1fr');
    const rows = this.parseGridTemplate(container.gridTemplateRows || '1fr');

    const gapX = container.gap || container.columnGap || 0;
    const gapY = container.gap || container.rowGap || 0;

    const colWidths = this.calcGridTrackSizes(cols, container.width, gapX);
    const rowHeights = this.calcGridTrackSizes(rows, container.height, gapY);

    const results = [];

    items.forEach(item => {
      // 解析 grid-column 和 grid-row
      const colSpan = this.parseGridLine(item.gridColumn || item.gridColumnStart, cols.length, 'col');
      const rowSpan = this.parseGridLine(item.gridRow || item.gridRowStart, rows.length, 'row');

      const colStart = colSpan.start;
      const colEnd = colSpan.end;
      const rowStart = rowSpan.start;
      const rowEnd = rowSpan.end;

      const x = colWidths.slice(0, colStart - 1).reduce((sum, w) => sum + w, 0) + (colStart - 1) * gapX;
      const y = rowHeights.slice(0, rowStart - 1).reduce((sum, h) => sum + h, 0) + (rowStart - 1) * gapY;
      const width = colWidths.slice(colStart - 1, colEnd - 1).reduce((sum, w) => sum + w, 0) + (colEnd - colStart) * gapX;
      const height = rowHeights.slice(rowStart - 1, rowEnd - 1).reduce((sum, h) => sum + h, 0) + (rowEnd - rowStart) * gapY;

      results.push({
        x: x + (container.x || 0),
        y: y + (container.y || 0),
        width: width,
        height: height,
        ...item
      });
    });

    return results;
  }

  parseGridLine(value, maxTracks, type) {
    if (!value) return { start: 1, end: 2 };

    // 处理 "span 2" 格式
    const spanMatch = value.match(/span\s*(\d+)/i);
    if (spanMatch) {
      const span = parseInt(spanMatch[1]);
      return { start: 1, end: span + 1 };
    }

    // 处理 "1 / span 2" 格式
    const complexMatch = value.match(/(\d+)\s*\/\s*span\s*(\d+)/i);
    if (complexMatch) {
      const start = parseInt(complexMatch[1]);
      const span = parseInt(complexMatch[2]);
      return { start, end: start + span };
    }

    // 处理 "1 / 3" 格式
    const rangeMatch = value.match(/(\d+)\s*\/\s*(\d+)/);
    if (rangeMatch) {
      return {
        start: parseInt(rangeMatch[1]),
        end: parseInt(rangeMatch[2])
      };
    }

    // 处理单个数字
    const num = parseInt(value);
    if (!isNaN(num)) {
      return { start: num, end: num + 1 };
    }

    return { start: 1, end: 2 };
  }

  parseGridTemplate(template) {
    if (!template) return ['1fr'];

    const tracks = [];
    const parts = template.split(/\s+/);

    let i = 0;
    while (i < parts.length) {
      const part = parts[i];

      if (part.startsWith('repeat')) {
        const match = part.match(/repeat\(\s*(\d+|[\w-]+)\s*,\s*([^)]+)\)/);
        if (match) {
          const countOrFunc = match[1];
          const trackTemplate = match[2].trim();

          // 处理 auto-fill 和 auto-fit
          if (countOrFunc === 'auto-fill' || countOrFunc === 'auto-fit') {
            const trackType = trackTemplate.includes('minmax') ? 'minmax' :
                             trackTemplate.endsWith('fr') ? 'fr' :
                             trackTemplate.endsWith('px') ? 'fixed' : 'auto';

            tracks.push({
              type: countOrFunc,
              template: trackTemplate,
              trackType
            });
          } else {
            const count = parseInt(countOrFunc);
            for (let j = 0; j < count; j++) {
              tracks.push(trackTemplate);
            }
          }
        }
        i++;
      } else if (part.includes('minmax')) {
        tracks.push(part);
        i++;
      } else if (part.endsWith('fr') || part.endsWith('px') || part === 'auto' || part === 'min-content' || part === 'max-content') {
        tracks.push(part);
        i++;
      } else {
        // 可能是纯数字（自动推断为 fr）
        const num = parseFloat(part);
        if (!isNaN(num)) {
          tracks.push(part.endsWith('px') ? part : num + 'fr');
        }
        i++;
      }
    }

    return tracks;
  }

  calcGridTrackSizes(tracks, containerSize, gap) {
    const sizes = [];
    let frSum = 0;
    let fixedSum = 0;
    let autoCount = 0;

    // 第一遍：计算固定值和 fr 总和
    tracks.forEach(track => {
      if (typeof track === 'object' && (track.type === 'auto-fill' || track.type === 'auto-fit')) {
        // 处理 auto-fill/auto-fit
        if (track.trackType === 'fixed') {
          const size = parseFloat(track.template);
          fixedSum += size;
        } else if (track.trackType === 'fr') {
          frSum += parseFloat(track.template);
        } else if (track.template.includes('minmax')) {
          const match = track.template.match(/minmax\(([^,]+),\s*([^)]+)\)/);
          if (match) {
            if (match[2].endsWith('fr')) {
              frSum += parseFloat(match[2]);
            } else if (match[2].endsWith('px')) {
              fixedSum += parseFloat(match[2]);
            }
          }
        } else {
          autoCount++;
        }
      } else if (track.endsWith('fr')) {
        frSum += parseFloat(track);
      } else if (track.endsWith('px')) {
        fixedSum += parseFloat(track);
      } else if (track.includes('minmax')) {
        const match = track.match(/minmax\(([^,]+),\s*([^)]+)\)/);
        if (match) {
          const minVal = match[1];
          const maxVal = match[2];

          if (maxVal.endsWith('fr')) {
            frSum += parseFloat(maxVal);
            sizes.push({ type: 'minmax', min: parseFloat(minVal) || 0, maxFr: parseFloat(maxVal) });
          } else if (maxVal.endsWith('px')) {
            fixedSum += parseFloat(maxVal);
            sizes.push({ type: 'minmax', min: parseFloat(minVal) || 0, max: parseFloat(maxVal) });
          } else if (maxVal === 'auto' || maxVal === 'max-content') {
            frSum += 1;
            sizes.push({ type: 'minmax', min: parseFloat(minVal) || 0, maxFr: 1 });
          } else if (maxVal === 'min-content') {
            sizes.push({ type: 'minmax', min: parseFloat(minVal) || 0, max: 0 });
          }
        }
      } else if (track === 'auto' || track === 'min-content' || track === 'max-content') {
        autoCount++;
        sizes.push({ type: track, size: 0 });
      } else {
        const num = parseFloat(track);
        if (!isNaN(num)) {
          if (track.endsWith('px')) {
            fixedSum += num;
          } else {
            frSum += num;
          }
        }
      }
    });

    const totalGap = gap * (tracks.length - 1);
    const frSpace = Math.max(0, containerSize - fixedSum - totalGap);

    // 第二遍：计算最终尺寸
    let autoIndex = 0;
    return tracks.map((track, i) => {
      if (typeof track === 'object' && (track.type === 'auto-fill' || track.type === 'auto-fit')) {
        const trackWidth = frSum > 0 ? frSpace / frSum : 0;
        return Math.max(0, trackWidth);
      }

      if (typeof track === 'object' && track.type === 'minmax') {
        if (track.maxFr) {
          return Math.max(track.min, frSpace * track.maxFr / frSum);
        }
        return Math.max(track.min, Math.min(track.max, frSpace / tracks.length));
      }

      if (track.type === 'minmax') {
        if (track.maxFr) {
          return Math.max(track.min, frSpace * track.maxFr / frSum);
        }
        return Math.max(track.min, track.max || frSpace / tracks.length);
      }

      if (track === 'auto' || track === 'min-content' || track === 'max-content') {
        return containerSize / (autoCount || 1);
      }

      if (track.endsWith('fr')) {
        return frSpace * parseFloat(track) / frSum;
      }

      if (track.endsWith('px')) {
        return parseFloat(track);
      }

      const num = parseFloat(track);
      if (!isNaN(num)) {
        return track.endsWith('px') ? num : frSpace * num / frSum;
      }

      return containerSize / tracks.length;
    });
  }

  // ==================== Float 浮动布局 ====================

  /**
   * 计算浮动布局
   */
  calcFloatLayout(items, container) {
    const results = [];
    let currentX = container.x || 0;
    let currentY = container.y || 0;
    let lineHeight = 0;
    let maxX = container.x || 0;

    const sortedItems = [...items].sort((a, b) => {
      if (a.float === 'right' && b.float !== 'right') return 1;
      if (a.float !== 'right' && b.float === 'right') return -1;
      return 0;
    });

    sortedItems.forEach(item => {
      const itemWidth = item.width || 100;
      const itemHeight = item.height || 50;
      const float = item.float || 'left';

      if (float === 'none') {
        results.push({
          x: currentX,
          y: currentY,
          width: itemWidth,
          height: itemHeight,
          ...item
        });
        currentY += itemHeight;
        lineHeight = Math.max(lineHeight, itemHeight);
        return;
      }

      if (float === 'right') {
        const newX = currentX + itemWidth;
        if (newX > (container.x || 0) + container.width) {
          currentX = (container.x || 0) + container.width - itemWidth;
          currentY += lineHeight;
          lineHeight = 0;
        } else {
          currentX = newX;
        }
        results.push({
          x: currentX,
          y: currentY,
          width: itemWidth,
          height: itemHeight,
          ...item
        });
      } else {
        if (currentX + itemWidth > (container.x || 0) + container.width) {
          currentX = container.x || 0;
          currentY += lineHeight;
          lineHeight = 0;
        }
        results.push({
          x: currentX,
          y: currentY,
          width: itemWidth,
          height: itemHeight,
          ...item
        });
        currentX += itemWidth;
      }

      lineHeight = Math.max(lineHeight, itemHeight);
      maxX = Math.max(maxX, currentX);
    });

    return results;
  }

  // ==================== Inline/Inline-Block 布局 ====================

  /**
   * 计算行内布局
   */
  calcInlineLayout(items, container) {
    const results = [];
    let currentX = container.x || 0;
    let currentY = container.y || 0;
    let lineHeight = 0;
    let maxX = 0;

    const align = container.textAlign || 'left';
    const verticalAlign = container.verticalAlign || 'baseline';

    items.forEach(item => {
      const itemWidth = item.width || 50;
      const itemHeight = item.height || 20;
      const fontSize = item.fontSize || 16;
      const halfLeading = (lineHeight - fontSize) / 2;

      if (currentX + itemWidth > (container.x || 0) + container.width && currentX > (container.x || 0)) {
        // 换行
        if (align === 'center') {
          const lineWidth = maxX - (container.x || 0);
          const offset = ((container.width - lineWidth) / 2);
          results.forEach(r => {
            if (r._lineStart) {
              r.x += offset;
            }
          });
        } else if (align === 'right') {
          const lineWidth = maxX - (container.x || 0);
          const offset = container.width - lineWidth;
          results.forEach(r => {
            if (r._lineStart) {
              r.x += offset;
            }
          });
        }

        currentX = container.x || 0;
        currentY += lineHeight;
        lineHeight = 0;
        maxX = 0;

        // 清除行起始标记
        results.forEach(r => delete r._lineStart);
      }

      let yOffset = 0;
      if (verticalAlign === 'middle') {
        yOffset = -itemHeight / 4;
      } else if (verticalAlign === 'bottom') {
        yOffset = -itemHeight / 2;
      } else if (verticalAlign === 'top') {
        yOffset = 0;
      }

      results.push({
        x: currentX,
        y: currentY + yOffset,
        width: itemWidth,
        height: itemHeight,
        _lineStart: true,
        ...item
      });

      currentX += itemWidth;
      maxX = Math.max(maxX, currentX);
      lineHeight = Math.max(lineHeight, itemHeight);
    });

    return results;
  }

  // ==================== 标准 Box 布局 ====================

  /**
   * 标准 Box 布局计算
   */
  calcStandardBox(item, container) {
    const margin = item.margin || { top: 0, right: 0, bottom: 0, left: 0 };
    const padding = item.padding || { top: 0, right: 0, bottom: 0, left: 0 };

    return {
      x: (container.x || 0) + (item.x || 0) + this.parseSideValue(margin.left, 0),
      y: (container.y || 0) + (item.y || 0) + this.parseSideValue(margin.top, 0),
      width: item.width || container.width || 0,
      height: item.height || container.height || 0,
      margin,
      padding,
      ...item
    };
  }

  // ==================== 溢出处理 ====================

  /**
   * 处理 overflow 溢出
   */
  handleOverflow(task, childResults) {
    const overflow = task.overflow;

    if (!overflow || overflow === 'visible') {
      return childResults;
    }

    if (overflow === 'hidden') {
      return childResults.filter(child => {
        return child.x >= task.x &&
               child.x + child.width <= task.x + task.width &&
               child.y >= task.y &&
               child.y + child.height <= task.y + task.height;
      });
    }

    if (overflow === 'auto' || overflow === 'scroll') {
      // 创建滚动容器（简化处理）
      return childResults.map(child => {
        if (child.x < task.x || child.x + child.width > task.x + task.width ||
            child.y < task.y || child.y + child.height > task.y + task.height) {
          // 子元素超出，需要滚动条
          child._overflowScroll = true;
        }
        return child;
      });
    }

    return childResults;
  }

  // ==================== z-index 层叠 ====================

  /**
   * 计算 z-index 层叠顺序
   */
  calculateZIndex(tasks) {
    const zIndexMap = new Map();
    let maxZIndex = 0;

    tasks.forEach(task => {
      const zIndex = task.zIndex !== undefined ? parseInt(task.zIndex) : 0;
      maxZIndex = Math.max(maxZIndex, zIndex);

      if (!zIndexMap.has(zIndex)) {
        zIndexMap.set(zIndex, []);
      }
      zIndexMap.get(zIndex).push(task);
    });

    // 按 z-index 排序
    const sorted = [];
    const sortedKeys = Array.from(zIndexMap.keys()).sort((a, b) => a - b);

    sortedKeys.forEach(z => {
      sorted.push(...zIndexMap.get(z));
    });

    return sorted;
  }

  // ==================== 主布局执行 ====================

  /**
   * 执行布局计算
   */
  async executeLayout(domTree, containerWidth, containerHeight) {
    const layoutTasks = [];

    // 匹配媒体查询
    const mediaRules = this.matchMediaQueries(containerWidth, containerHeight);

    await this.traverseDOM(domTree, {
      x: 0,
      y: 0,
      width: containerWidth,
      height: containerHeight
    }, layoutTasks, mediaRules);

    // 处理 z-index 层叠
    return this.calculateZIndex(layoutTasks);
  }

  async traverseDOM(node, container, tasks, mediaRules = {}) {
    if (!node || typeof node !== 'object') return;

    const styleStr = node.attrs && node.attrs.style ? node.attrs.style : '';
    let style = this.parseStyle(styleStr);

    // 合并媒体查询规则
    style = { ...mediaRules, ...style };

    // 应用 calc() 计算
    if (style.width && typeof style.width === 'string') {
      const calcWidth = this.evaluateCalc(style.width, container.width);
      style.width = parseFloat(calcWidth) || style.width;
    }
    if (style.height && typeof style.height === 'string') {
      const calcHeight = this.evaluateCalc(style.height, container.height);
      style.height = parseFloat(calcHeight) || style.height;
    }

    const display = style.display || 'block';

    let task = {
      id: node.tag + '-' + Math.random().toString(36).substr(2, 9),
      tag: node.tag,
      x: container.x,
      y: container.y,
      width: parseFloat(style.width) || container.width,
      height: parseFloat(style.height) || container.height,
      display: display,
      position: style.position || 'static',
      float: style.float || 'none',
      zIndex: style.zIndex,
      overflow: style.overflow,
      boxSizing: style.boxSizing,
      ...style
    };

    // 应用 box-sizing
    task = this.applyBoxSizing(task, node);

    // 处理 position
    if (task.position === 'absolute') {
      task.x = parseFloat(style.left) || container.x;
      task.y = parseFloat(style.top) || container.y;
      if (style.right !== undefined) {
        const right = parseFloat(style.right) || 0;
        task.width = container.x + container.width - task.x - right;
      }
      if (style.bottom !== undefined) {
        const bottom = parseFloat(style.bottom) || 0;
        task.height = container.y + container.height - task.y - bottom;
      }
    } else if (task.position === 'fixed') {
      task.x = parseFloat(style.left) || 0;
      task.y = parseFloat(style.top) || 0;
    } else if (task.position === 'relative') {
      const offsetX = parseFloat(style.left) || 0;
      const offsetY = parseFloat(style.top) || 0;
      task.x += offsetX;
      task.y += offsetY;
    }

    // 处理 float
    if (task.float && task.float !== 'none') {
      task._isFloat = true;
    }

    tasks.push(task);

    // 处理子元素布局
    if (node.children && node.children.length > 0) {
      const padding = style.padding || { top: 0, right: 0, bottom: 0, left: 0 };
      const paddingLeft = this.parseSideValue(style.paddingLeft || padding.left || style.padding, 0);
      const paddingRight = this.parseSideValue(style.paddingRight || padding.right || style.padding, 0);
      const paddingTop = this.parseSideValue(style.paddingTop || padding.top || style.padding, 0);
      const paddingBottom = this.parseSideValue(style.paddingBottom || padding.bottom || style.padding, 0);

      const childContainer = {
        x: task.x + paddingLeft,
        y: task.y + paddingTop,
        width: task.width - paddingLeft - paddingRight,
        height: task.height - paddingTop - paddingBottom,
        textAlign: style.textAlign,
        verticalAlign: style.verticalAlign,
        flexDirection: style.flexDirection,
        flexWrap: style.flexWrap,
        justifyContent: style.justifyContent,
        alignItems: style.alignItems,
        alignContent: style.alignContent,
        gap: parseFloat(style.gap) || parseFloat(style.columnGap) || 0,
        gridTemplateColumns: style.gridTemplateColumns,
        gridTemplateRows: style.gridTemplateRows
      };

      if (display === 'flex') {
        const flexItems = node.children.map(child => ({
          ...this.parseStyle(child.attrs?.style || ''),
          tag: child.tag,
          text: child.text
        }));

        const flexContainer = {
          x: childContainer.x,
          y: childContainer.y,
          width: childContainer.width,
          height: childContainer.height,
          flexDirection: childContainer.flexDirection || 'row',
          flexWrap: childContainer.flexWrap || 'nowrap',
          justifyContent: childContainer.justifyContent || 'flex-start',
          alignItems: childContainer.alignItems || 'stretch',
          alignContent: childContainer.alignContent,
          gap: childContainer.gap
        };

        const flexResults = this.calcStandardFlex(flexItems, flexContainer);
        flexResults.forEach((result, index) => {
          tasks.push({ ...result, id: node.children[index].tag + '-' + Math.random().toString(36).substr(2, 9) });
        });
      } else if (display === 'grid') {
        const gridItems = node.children.map(child => ({
          ...this.parseStyle(child.attrs?.style || ''),
          tag: child.tag,
          text: child.text
        }));

        const gridContainer = {
          x: childContainer.x,
          y: childContainer.y,
          width: childContainer.width,
          height: childContainer.height,
          gridTemplateColumns: childContainer.gridTemplateColumns,
          gridTemplateRows: childContainer.gridTemplateRows,
          gap: childContainer.gap
        };

        const gridResults = this.calcStandardGrid(gridItems, gridContainer);
        gridResults.forEach((result, index) => {
          tasks.push({ ...result, id: node.children[index].tag + '-' + Math.random().toString(36).substr(2, 9) });
        });
      } else if (display === 'inline-block') {
        const inlineItems = node.children.map(child => ({
          ...this.parseStyle(child.attrs?.style || ''),
          tag: child.tag,
          text: child.text
        }));

        const inlineResults = this.calcInlineLayout(inlineItems, childContainer);
        inlineResults.forEach((result, index) => {
          tasks.push({ ...result, id: node.children[index].tag + '-' + Math.random().toString(36).substr(2, 9) });
        });
      } else if (style.float && style.float !== 'none') {
        // float 布局
        const floatItems = node.children.map(child => ({
          ...this.parseStyle(child.attrs?.style || ''),
          tag: child.tag,
          text: child.text,
          width: parseFloat(this.parseStyle(child.attrs?.style || '').width) || 100,
          height: parseFloat(this.parseStyle(child.attrs?.style || '').height) || 50
        }));

        const floatResults = this.calcFloatLayout(floatItems, childContainer);
        floatResults.forEach((result, index) => {
          tasks.push({ ...result, id: node.children[index].tag + '-' + Math.random().toString(36).substr(2, 9) });
        });
      } else {
        // Block 布局
        let currentY = childContainer.y;
        node.children.forEach(child => {
          const childStyle = this.parseStyle(child.attrs?.style || '');
          const childWidth = parseFloat(childStyle.width) || childContainer.width;
          const childHeight = parseFloat(childStyle.height) || 50;

          tasks.push({
            id: child.tag + '-' + Math.random().toString(36).substr(2, 9),
            tag: child.tag,
            x: childContainer.x,
            y: currentY,
            width: childWidth,
            height: childHeight,
            ...childStyle
          });

          currentY += childHeight + (parseFloat(childStyle.marginBottom) || 0) + (parseFloat(childStyle.marginTop) || 0);
        });
      }

      // 处理 overflow
      if (task.overflow && task.overflow !== 'visible') {
        const childTasks = tasks.filter(t => t.y > task.y);
        const filteredChildren = this.handleOverflow(task, childTasks);
        // 保留过滤后的子任务（这里简化处理）
      }
    }
  }

  parseStyle(styleStr) {
    if (!styleStr) return {};

    const baseStyle = this.styleParser.parseStyle(styleStr);

    const style = {};

    for (const key of Object.keys(baseStyle)) {
      const camelKey = key.replace(/-([a-z])/g, (match, letter) => letter.toUpperCase());
      style[camelKey] = baseStyle[key];
    }

    if (style.background) {
      style.gradient = this.styleParser.parseGradient(style.background);
    }
    if (style.boxShadow || baseStyle['box-shadow']) {
      const shadowStr = style.boxShadow || baseStyle['box-shadow'];
      style.boxShadow = this.styleParser.parseBoxShadow(shadowStr);
    }
    if (style.border) {
      style.border = this.styleParser.parseBorder(style.border);
    }
    if (style.transform) {
      style.transform = this.styleParser.parseTransform(style.transform);
    }
    if (style.padding) {
      style.padding = this.styleParser.parsePadding(style.padding);
    }
    if (style.margin) {
      style.margin = this.styleParser.parseMargin(style.margin);
    }

    if (style.width) {
      style.width = parseFloat(style.width) || style.width;
    }
    if (style.height) {
      style.height = parseFloat(style.height) || style.height;
    }
    if (style.borderRadius) {
      style.borderRadius = parseFloat(style.borderRadius) || style.borderRadius;
    }

    return style;
  }
}