/**
 * SEL-TM 冷路径 - 布局计算引擎
 * 负责 HTML/CSS 解析、布局计算（Flex/Grid/Block）
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
      box: this.calcStandardBox.bind(this)
    };
    this.styleParser = new StyleParser();
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

  /**
   * 标准 Flex 布局计算（支持 flex-wrap）
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

    // 计算每个 item 的基础尺寸
    items.forEach(item => {
      const flexBasis = item.flexBasis === 'auto' ? (mainAxis === 'x' ? item.width : item.height) || 0 : 
                        typeof item.flexBasis === 'number' ? item.flexBasis : 
                        parseFloat(item.flexBasis) || 0;
      item._flexBasis = flexBasis;
      item._flexGrow = item.flexGrow || 0;
      item._flexShrink = item.flexShrink === undefined ? 1 : item.flexShrink;
      
      // 检查是否需要换行
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

    lines.forEach(line => {
      const lineItems = line.items;
      const totalGrow = lineItems.reduce((sum, item) => sum + item._flexGrow, 0);
      const totalShrink = lineItems.reduce((sum, item) => sum + item._flexShrink * item._flexBasis, 0);
      
      let freeSpace = containerSize - line.totalSize;
      
      // 计算实际尺寸
      lineItems.forEach(item => {
        let size = item._flexBasis;
        
        if (freeSpace > 0 && totalGrow > 0) {
          size += (freeSpace * item._flexGrow) / totalGrow;
        } else if (freeSpace < 0 && totalShrink > 0 && item._flexShrink > 0) {
          size += (freeSpace * item._flexShrink * item._flexBasis) / totalShrink;
        }
        
        item._computedSize = Math.max(size, item.minWidth || item.minHeight || 0);
      });

      // 重新计算总尺寸用于对齐
      const computedTotal = lineItems.reduce((sum, item) => sum + item._computedSize, 0);
      const gap = container.gap || 0;
      const totalGap = gap * (lineItems.length - 1);
      
      let offset = 0;
      const justifyContent = container.justifyContent || 'flex-start';
      
      // 计算起始偏移（justify-content）
      if (justifyContent === 'center') {
        offset = (containerSize - computedTotal - totalGap) / 2;
      } else if (justifyContent === 'flex-end') {
        offset = containerSize - computedTotal - totalGap;
      } else if (justifyContent === 'space-between') {
        offset = 0; // 特殊处理
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

      // 处理 align-items
      const alignItems = container.alignItems || 'stretch';
      results.forEach(item => {
        if (alignItems === 'center') {
          item.y += (crossSize - item.height) / 2;
        } else if (alignItems === 'flex-end') {
          item.y += crossSize - item.height;
        } else if (alignItems === 'stretch') {
          item.height = crossSize;
        }
      });

      crossOffset += line.maxCross + gap;
    });

    return results;
  }

  /**
   * 标准 Grid 布局计算（支持 minmax 和 span）
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
      const colStart = item.gridColumnStart || item.gridColumn ? this.parseGridSpan(item.gridColumn, cols.length) : 1;
      const colEnd = item.gridColumnEnd || colStart + 1;
      const rowStart = item.gridRowStart || item.gridRow ? this.parseGridSpan(item.gridRow, rows.length) : 1;
      const rowEnd = item.gridRowEnd || rowStart + 1;
      
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

  parseGridTemplate(template) {
    const tracks = [];
    const parts = template.split(/\s+/);
    
    parts.forEach(part => {
      if (part.startsWith('repeat')) {
        const match = part.match(/repeat\((\d+),\s*([^)]+)\)/);
        if (match) {
          const count = parseInt(match[1]);
          const track = match[2];
          for (let i = 0; i < count; i++) {
            tracks.push(track);
          }
        }
      } else if (part.includes('minmax')) {
        tracks.push(part);
      } else {
        tracks.push(part);
      }
    });
    
    return tracks;
  }

  calcGridTrackSizes(tracks, containerSize, gap) {
    const sizes = [];
    let frSum = 0;
    let fixedSum = 0;
    
    tracks.forEach(track => {
      if (track.endsWith('fr')) {
        frSum += parseFloat(track);
      } else if (track.includes('minmax')) {
        const match = track.match(/minmax\(([^,]+),\s*([^)]+)\)/);
        if (match) {
          const min = match[1].endsWith('px') ? parseFloat(match[1]) : 0;
          const max = match[2].endsWith('fr') ? parseFloat(match[2]) : (match[2].endsWith('px') ? parseFloat(match[2]) : containerSize);
          sizes.push({ type: 'minmax', min, max: max > 1 ? max : max * containerSize });
          if (match[2].endsWith('fr')) {
            frSum += max;
          } else {
            fixedSum += max;
          }
        }
      } else if (track.endsWith('px')) {
        const size = parseFloat(track);
        sizes.push({ type: 'fixed', size });
        fixedSum += size;
      } else {
        sizes.push({ type: 'auto', size: containerSize / tracks.length });
      }
    });
    
    const frSpace = Math.max(0, containerSize - fixedSum - gap * (tracks.length - 1));
    
    return sizes.map(size => {
      if (size.type === 'fixed') return size.size;
      if (size.type === 'minmax') {
        const frSize = typeof size.max === 'number' && size.max <= 1 ? (frSpace * size.max / frSum) : size.max;
        return Math.max(size.min, frSize);
      }
      if (size.type === 'auto') return containerSize / tracks.length;
      return size;
    });
  }

  parseGridSpan(spanStr, maxTracks) {
    if (!spanStr) return 1;
    const match = spanStr.match(/(\d+)/);
    return match ? Math.min(parseInt(match[1]), maxTracks) : 1;
  }

  /**
   * 标准 Box 布局计算
   */
  calcStandardBox(item, container) {
    const margin = item.margin || { top: 0, right: 0, bottom: 0, left: 0 };
    const padding = item.padding || { top: 0, right: 0, bottom: 0, left: 0 };
    
    return {
      x: (container.x || 0) + (item.x || 0) + margin.left,
      y: (container.y || 0) + (item.y || 0) + margin.top,
      width: item.width || container.width || 0,
      height: item.height || container.height || 0,
      margin,
      padding,
      ...item
    };
  }

  /**
   * 执行布局计算
   */
  async executeLayout(domTree, containerWidth, containerHeight) {
    const layoutTasks = [];
    await this.traverseDOM(domTree, { x: 0, y: 0, width: containerWidth, height: containerHeight }, layoutTasks);
    return layoutTasks;
  }

  async traverseDOM(node, container, tasks) {
    if (!node || typeof node !== 'object') return;

    const style = node.attrs && node.attrs.style ? this.parseStyle(node.attrs.style) : {};
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
      ...style
    };

    // 处理定位
    if (task.position === 'absolute') {
      task.x = parseFloat(style.left) || container.x;
      task.y = parseFloat(style.top) || container.y;
    } else if (task.position === 'fixed') {
      task.x = parseFloat(style.left) || 0;
      task.y = parseFloat(style.top) || 0;
    } else if (task.position === 'relative') {
      const offsetX = parseFloat(style.left) || 0;
      const offsetY = parseFloat(style.top) || 0;
      task.x += offsetX;
      task.y += offsetY;
    }

    tasks.push(task);

    // 处理子元素布局
    if (node.children && node.children.length > 0) {
      const padding = style.padding || { top: 0, right: 0, bottom: 0, left: 0 };
      const childContainer = {
        x: task.x + (parseFloat(padding.left) || parseFloat(style.paddingLeft) || 0),
        y: task.y + (parseFloat(padding.top) || parseFloat(style.paddingTop) || 0),
        width: task.width - (parseFloat(padding.left) || parseFloat(style.paddingLeft) || 0) - (parseFloat(padding.right) || parseFloat(style.paddingRight) || 0),
        height: task.height - (parseFloat(padding.top) || parseFloat(style.paddingTop) || 0) - (parseFloat(padding.bottom) || parseFloat(style.paddingBottom) || 0)
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
          flexDirection: style.flexDirection || 'row',
          flexWrap: style.flexWrap || 'nowrap',
          justifyContent: style.justifyContent || 'flex-start',
          alignItems: style.alignItems || 'stretch',
          gap: parseFloat(style.gap) || parseFloat(style.columnGap) || 0
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
          gridTemplateColumns: style.gridTemplateColumns,
          gridTemplateRows: style.gridTemplateRows,
          gap: parseFloat(style.gap) || 0
        };
        
        const gridResults = this.calcStandardGrid(gridItems, gridContainer);
        gridResults.forEach((result, index) => {
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
    }
  }

  parseStyle(styleStr) {
    if (!styleStr) return {};
    
    // 使用 StyleParser 解析基础样式
    const baseStyle = this.styleParser.parseStyle(styleStr);
    
    // 解析复杂属性并添加到样式对象中
    if (baseStyle.background) {
      baseStyle.gradient = this.styleParser.parseGradient(baseStyle.background);
    }
    if (baseStyle['box-shadow']) {
      baseStyle.boxShadow = this.styleParser.parseBoxShadow(baseStyle['box-shadow']);
    }
    if (baseStyle.border) {
      baseStyle.border = this.styleParser.parseBorder(baseStyle.border);
    }
    if (baseStyle.transform) {
      baseStyle.transform = this.styleParser.parseTransform(baseStyle.transform);
    }
    if (baseStyle.padding) {
      baseStyle.padding = this.styleParser.parsePadding(baseStyle.padding);
    }
    if (baseStyle.margin) {
      baseStyle.margin = this.styleParser.parseMargin(baseStyle.margin);
    }
    
    return baseStyle;
  }
}