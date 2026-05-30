/**
 * Node.js 测试运行器
 * 在 Node 环境中测试 SEL-TM 引擎的各个模块
 */

// 先加载浏览器环境模拟
import './browser-mock.js';

// 导入测试模块
import { HTMLDocumentParser } from '../src/core/html-parser.js';
import { ColorParser } from '../src/core/color-parser.js';
import { StyleParser } from '../src/core/style-parser.js';
import { SELColdPath } from '../src/core/layout-engine.js';
import { SEL_TM } from '../src/core/sel-tm.js';

// 测试结果统计
const results = {
  total: 0,
  passed: 0,
  failed: 0,
  tests: []
};

// 颜色输出
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

// 测试断言函数
function assert(condition, message) {
  results.total++;
  if (condition) {
    results.passed++;
    results.tests.push({ name: message, passed: true });
    console.log(`${colors.green}✓ ${message}${colors.reset}`);
  } else {
    results.failed++;
    results.tests.push({ name: message, passed: false });
    console.log(`${colors.red}✗ ${message}${colors.reset}`);
  }
}

// 深度比较函数
function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((val, i) => {
      if (typeof val === 'number' && typeof b[i] === 'number') {
        return Math.abs(val - b[i]) < 0.01;
      }
      return deepEqual(val, b[i]);
    });
  }
  if (typeof a === 'object' && typeof b === 'object') {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    return keysA.every(key => deepEqual(a[key], b[key]));
  }
  return false;
}

// HTML 解析器测试
async function testHTMLParser() {
  console.log(`\n${colors.blue}=== HTML 解析器测试 ===${colors.reset}`);
  
  const parser = new HTMLDocumentParser();
  
  // 测试1: 简单HTML解析
  const html1 = '<div><p>Hello</p></div>';
  const result1 = parser.parse(html1);
  assert(
    result1.html.body.children.length === 1 && 
    result1.html.body.children[0].tag === 'div' &&
    result1.html.body.children[0].children[0].tag === 'p',
    '简单HTML解析'
  );
  
  // 测试2: 带属性的元素
  const html2 = '<div class="test" id="main" style="color:red;"></div>';
  const result2 = parser.parse(html2);
  const attrs = result2.html.body.children[0].attrs;
  assert(
    attrs.class === 'test' && attrs.id === 'main' && attrs.style === 'color:red;',
    '带属性元素解析'
  );
  
  // 测试3: 自闭合标签
  const html3 = '<img src="test.jpg"/><br/>';
  const result3 = parser.parse(html3);
  assert(result3.html.body.children.length === 2, '自闭合标签解析');
  
  // 测试4: 注释跳过
  const html4 = '<!-- comment --><div>Content</div>';
  const result4 = parser.parse(html4);
  assert(result4.html.body.children.length === 1, '注释跳过');
  
  // 测试5: 深层嵌套
  const html5 = '<div><ul><li>1</li><li>2</li></ul></div>';
  const result5 = parser.parse(html5);
  assert(
    result5.html.body.children[0].children[0].children.length === 2,
    '深层嵌套解析'
  );
  
  // 测试6: 混合内容
  const html6 = '<div>Text<span>Nested</span>More</div>';
  const result6 = parser.parse(html6);
  assert(
    result6.html.body.children[0].children.length === 1 &&
    result6.html.body.children[0].text.includes('Text'),
    '混合内容解析'
  );
}

// 颜色解析器测试
async function testColorParser() {
  console.log(`\n${colors.blue}=== 颜色解析器测试 ===${colors.reset}`);
  
  const parser = new ColorParser();
  
  // 测试1: 十六进制颜色
  const hex1 = parser.hexToRgba('#ff5722');
  assert(deepEqual(hex1, [1, 0.341, 0.133, 1]), '十六进制颜色 #ff5722');
  
  // 测试2: 短十六进制
  const hex2 = parser.hexToRgba('#f00');
  assert(deepEqual(hex2, [1, 0, 0, 1]), '短十六进制 #f00');
  
  // 测试3: 带透明度十六进制
  const hex3 = parser.hexToRgba('#ff572280');
  assert(deepEqual(hex3, [1, 0.341, 0.133, 0.5]), '带透明度十六进制');
  
  // 测试4: RGB颜色
  const rgb1 = parser.hexToRgba('rgb(255, 87, 34)');
  assert(deepEqual(rgb1, [1, 0.341, 0.133, 1]), 'RGB颜色');
  
  // 测试5: RGBA颜色
  const rgba1 = parser.hexToRgba('rgba(255, 87, 34, 0.5)');
  assert(deepEqual(rgba1, [1, 0.341, 0.133, 0.5]), 'RGBA颜色');
  
  // 测试6: RGB百分比
  const rgbPercent = parser.hexToRgba('rgb(100%, 34%, 13%)');
  assert(deepEqual(rgbPercent, [1, 0.34, 0.13, 1]), 'RGB百分比');
  
  // 测试7: HSL颜色
  const hsl1 = parser.hexToRgba('hsl(14, 100%, 50%)');
  assert(deepEqual(hsl1, [1, 0.233, 0, 1]), 'HSL颜色');
  
  // 测试8: HSLA颜色
  const hsla1 = parser.hexToRgba('hsla(14, 100%, 50%, 0.7)');
  assert(deepEqual(hsla1, [1, 0.233, 0, 0.7]), 'HSLA颜色');
  
  // 测试9: 颜色名称
  const colorName = parser.hexToRgba('red');
  assert(deepEqual(colorName, [1, 0, 0, 1]), '颜色名称 red');
  
  // 测试10: transparent
  const transparent = parser.hexToRgba('transparent');
  assert(deepEqual(transparent, [0, 0, 0, 0]), 'transparent');
}

// 样式解析器测试
async function testStyleParser() {
  console.log(`\n${colors.blue}=== 样式解析器测试 ===${colors.reset}`);
  
  const parser = new StyleParser();
  
  // 测试1: 简单样式
  const style1 = parser.parseStyle('color: red; background: blue;');
  assert(style1.color === 'red' && style1.background === 'blue', '简单样式解析');
  
  // 测试2: 驼峰转换
  const style2 = parser.parseStyle('font-size: 16px; background-color: red;');
  assert(style2.fontSize === '16px' && style2.backgroundColor === 'red', '驼峰转换');
  
  // 测试3: 渐变解析 - linear
  const gradient = parser.parseGradient('linear-gradient(#1e88e5, #42a5f5)');
  assert(gradient && gradient.start && gradient.end && gradient.type === 'linear', '渐变解析 - linear');
  
  // 测试4: 渐变解析 - radial
  const radialGradient = parser.parseGradient('radial-gradient(circle, red, blue)');
  assert(radialGradient && radialGradient.type === 'radial', '渐变解析 - radial');
  
  // 测试5: 渐变解析 - conic
  const conicGradient = parser.parseGradient('conic-gradient(from 0deg, red, green)');
  assert(conicGradient && conicGradient.type === 'conic', '渐变解析 - conic');
  
  // 测试6: 阴影解析
  const shadow = parser.parseBoxShadow('0 4px 12px rgba(0,0,0,0.3)');
  assert(shadow.x === 0 && shadow.y === 4 && shadow.blur === 12, '阴影解析');
  
  // 测试7: 变换解析
  const transform = parser.parseTransform('translate(10px, 20px) rotate(15deg)');
  assert(
    deepEqual(transform.translate, [10, 20]) && 
    transform.rotate === 15,
    '变换解析'
  );
  
  // 测试8: 边框解析
  const border = parser.parseBorder('3px solid #e91e63');
  assert(border.width === 3 && border.style === 'solid', '边框解析');
  
  // 测试9: padding解析
  const padding = parser.parsePadding('10px 20px');
  assert(padding.top === 10 && padding.right === 20, 'padding解析');
  
  // 测试10: border-radius解析 - 四角独立
  const borderRadius4 = parser.parseBorderRadius('10px 20px 30px 40px');
  assert(
    borderRadius4.topLeft === 10 && borderRadius4.topRight === 20 &&
    borderRadius4.bottomRight === 30 && borderRadius4.bottomLeft === 40,
    'border-radius解析 - 四角独立'
  );
  
  // 测试11: border-radius解析 - 单值
  const borderRadius1 = parser.parseBorderRadius('15px');
  assert(
    borderRadius1.topLeft === 15 && borderRadius1.topRight === 15 &&
    borderRadius1.bottomRight === 15 && borderRadius1.bottomLeft === 15,
    'border-radius解析 - 单值'
  );
  
  // 测试12: text-decoration解析
  const deco = parser.parseTextDecoration('underline solid red 2px');
  assert(deco.line === 'underline' && deco.style === 'solid', 'text-decoration解析');
  
  // 测试13: CSS变量
  const varStyle = parser.parseStyle('--primary-color: #3498db; background: var(--primary-color);');
  assert(parser.cssVariables.has('--primary-color'), 'CSS变量定义');
  
  // 测试14: 解析 CSS 变量引用
  const varVal = parser.parseVar('var(--primary-color, #000)');
  assert(varVal === '#3498db' || varVal === '#000', 'CSS变量引用解析');
  
  // 测试15: animation解析
  const animation = parser.parseAnimation('pulse');
  assert(animation.name === 'pulse', 'animation解析');
  
  // 测试16: line-height解析
  const lh1 = parser.parseLineHeight('1.5');
  assert(lh1 === 1.5, 'line-height解析 - 数值');
  const lh2 = parser.parseLineHeight('24px');
  assert(lh2 === 24, 'line-height解析 - 像素值');
}

// 布局引擎测试
async function testLayoutEngine() {
  console.log(`\n${colors.blue}=== 布局引擎测试 ===${colors.reset}`);
  
  const coldPath = new SELColdPath();
  
  // Mock memoryDB
  const mockMemoryDB = {
    getShortTerm: async () => null
  };
  
  await coldPath.init(mockMemoryDB, SEL_TM);
  
  // 测试1: parseStyle方法存在
  assert(typeof coldPath.parseStyle === 'function', 'parseStyle方法存在');
  
  // 测试2: executeLayout方法存在
  assert(typeof coldPath.executeLayout === 'function', 'executeLayout方法存在');
  
  // 测试3: 解析复杂样式
  const style = coldPath.parseStyle('background:linear-gradient(#1e88e5,#42a5f5); border-radius:12px; padding: 16px;');
  assert(style.gradient !== undefined, '复杂样式解析 - 渐变');
  assert(typeof style.borderRadius === 'object' && style.borderRadius.topLeft === 12, '复杂样式解析 - 圆角');
  assert(style.padding !== undefined, '复杂样式解析 - padding');
  
  // 测试4: 布局任务生成
  const dom = {
    tag: 'div',
    attrs: { style: 'width: 100px; height: 50px;' },
    children: []
  };
  
  const tasks = await coldPath.executeLayout(dom, 800, 600);
  assert(tasks.length > 0, '布局任务生成');
  assert(tasks[0].width === 100 && tasks[0].height === 50, '布局尺寸正确');
}

// 运行所有测试
async function runAllTests() {
  console.log(`${colors.yellow}🚀 开始运行 SEL-TM 引擎测试套件${colors.reset}`);
  
  await testHTMLParser();
  await testColorParser();
  await testStyleParser();
  await testLayoutEngine();
  
  // 输出测试结果
  console.log(`\n${colors.blue}=== 测试结果汇总 ===${colors.reset}`);
  console.log(`${colors.green}✓ 通过: ${results.passed}${colors.reset}`);
  console.log(`${colors.red}✗ 失败: ${results.failed}${colors.reset}`);
  console.log(`总计: ${results.total}`);
  
  if (results.failed > 0) {
    console.log(`\n${colors.yellow}失败的测试:`);
    results.tests.filter(t => !t.passed).forEach(t => console.log(`  - ${t.name}`));
    process.exit(1);
  } else {
    console.log(`\n${colors.green}🎉 所有测试通过!${colors.reset}`);
    process.exit(0);
  }
}

// 运行测试
runAllTests().catch(error => {
  console.error(`${colors.red}测试运行出错: ${error.message}${colors.reset}`);
  process.exit(1);
});