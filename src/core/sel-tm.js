/**
 * SEL-TM 全局核心状态（严格对齐SEL-TM理论）
 */
export const SEL_TM = {
  Q: new Set(),       // 状态集合
  δ: new Map(),       // 状态转移函数
  K: null,            // 长期记忆：完整W3C规范库
  L: new Map(),       // 短期记忆：习得能力缓存
  isHotStart: false,
  currentLayoutTasks: [],
  currentTextTasks: [],
  rawHtmlContent: '', // 原始DOM文本（用于动态重排）
  frameCount: 0,
  lastFpsTime: performance.now(),
  enableAnimation: true, // 全局动画开关
  animationTime: 0       // 全局动画时间轴
};

/**
 * W3C CSS 属性规范定义
 */
export const W3C_CSS_RULES = {
  'flex-direction': ['row', 'row-reverse', 'column', 'column-reverse'],
  'justify-content': ['flex-start', 'flex-end', 'center', 'space-between', 'space-around', 'space-evenly'],
  'align-items': ['flex-start', 'flex-end', 'center', 'stretch', 'baseline'],
  'align-content': ['flex-start', 'flex-end', 'center', 'stretch', 'space-between', 'space-around'],
  'flex-wrap': ['nowrap', 'wrap', 'wrap-reverse'],
  'grid-template-columns': ['repeat', 'fr', 'auto', 'minmax'],
  'grid-template-rows': ['repeat', 'fr', 'auto', 'minmax'],
  'grid-gap': ['px', '%', 'fr'],
  'position': ['static', 'relative', 'absolute', 'fixed', 'sticky'],
  'display': ['block', 'inline', 'inline-block', 'flex', 'grid', 'none', 'table'],
  'float': ['left', 'right', 'none'],
  'clear': ['left', 'right', 'both', 'none'],
  'overflow': ['visible', 'hidden', 'scroll', 'auto'],
  'z-index': ['auto'],
  'background': ['color', 'gradient', 'image', 'repeat', 'position', 'size'],
  'border': ['width', 'style', 'color', 'radius'],
  'box-shadow': ['x', 'y', 'blur', 'spread', 'color', 'inset'],
  'transform': ['translate', 'rotate', 'scale', 'skew'],
  'transition': ['property', 'duration', 'timing', 'delay'],
  'animation': ['name', 'duration', 'timing', 'delay', 'iteration', 'direction', 'fill'],
  'font': ['family', 'size', 'weight', 'style', 'variant', 'line-height'],
  'text': ['align', 'decoration', 'transform', 'indent', 'spacing', 'overflow'],
  'margin': ['top', 'right', 'bottom', 'left'],
  'padding': ['top', 'right', 'bottom', 'left'],
  'width': ['auto', 'px', '%', 'em', 'rem', 'vw', 'vh'],
  'height': ['auto', 'px', '%', 'em', 'rem', 'vw', 'vh'],
  'opacity': ['0', '1'],
  'visibility': ['visible', 'hidden', 'collapse'],
  'box-sizing': ['content-box', 'border-box'],
  'cursor': ['pointer', 'default', 'text', 'move', 'help', 'wait']
};