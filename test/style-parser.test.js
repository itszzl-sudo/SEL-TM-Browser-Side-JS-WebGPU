/**
 * 样式解析器测试用例
 */
import { parseStyle } from '../src/core/style-parser.js';
import { parseGradient } from '../src/core/style-parser.js';
import { parseShadow } from '../src/core/style-parser.js';

// 样式解析测试
const styleTests = [
  {
    name: '测试简单样式',
    input: 'color: red; background: blue;',
    expected: { color: 'red', background: 'blue' }
  },
  {
    name: '测试带单位的样式',
    input: 'width: 100px; height: 50%; font-size: 16px;',
    expected: { width: '100px', height: '50%', fontSize: '16px' }
  },
  {
    name: '测试复杂样式',
    input: 'display: flex; justify-content: space-between; align-items: center;',
    expected: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' }
  },
  {
    name: '测试带冒号的值',
    input: 'background: url("https://example.com/img.jpg");',
    expected: { background: 'url("https://example.com/img.jpg")' }
  },
  {
    name: '测试空样式',
    input: '',
    expected: {}
  }
];

// 渐变解析测试
const gradientTests = [
  {
    name: '测试线性渐变',
    input: 'linear-gradient(#ff5722, #ff9800)',
    expectedType: 'linear'
  },
  {
    name: '测试线性渐变带方向',
    input: 'linear-gradient(135deg, #ff5722, #ff9800)',
    expectedType: 'linear'
  },
  {
    name: '测试多色渐变',
    input: 'linear-gradient(to right, red, green, blue)',
    expectedColors: 3
  },
  {
    name: '测试径向渐变',
    input: 'radial-gradient(circle, #ff5722, #ff9800)',
    expectedType: 'radial'
  }
];

// 阴影解析测试
const shadowTests = [
  {
    name: '测试简单阴影',
    input: '0 4px 8px rgba(0,0,0,0.2)',
    expectedLength: 1
  },
  {
    name: '测试多重阴影',
    input: '0 4px 8px rgba(0,0,0,0.2), 0 8px 16px rgba(0,0,0,0.15)',
    expectedLength: 2
  },
  {
    name: '测试内阴影',
    input: 'inset 0 2px 4px rgba(0,0,0,0.3)',
    expectedInset: true
  }
];

// 运行测试
function runStyleTests() {
  let passed = 0;
  let failed = 0;

  console.log('=== 样式解析测试 ===');
  styleTests.forEach((test, index) => {
    try {
      const result = parseStyle(test.input);
      
      if (JSON.stringify(result) === JSON.stringify(test.expected)) {
        console.log(`✅ 测试 ${index + 1}: ${test.name}`);
        passed++;
      } else {
        console.log(`❌ 测试 ${index + 1}: ${test.name}`);
        console.log(`  期望: ${JSON.stringify(test.expected)}`);
        console.log(`  实际: ${JSON.stringify(result)}`);
        failed++;
      }
    } catch (error) {
      console.log(`❌ 测试 ${index + 1}: ${test.name} - 异常: ${error.message}`);
      failed++;
    }
  });

  console.log('\n=== 渐变解析测试 ===');
  gradientTests.forEach((test, index) => {
    try {
      const result = parseGradient(test.input);
      
      if (test.expectedType && result.type === test.expectedType) {
        console.log(`✅ 测试 ${index + 1}: ${test.name}`);
        passed++;
      } else if (test.expectedColors && result.colors && result.colors.length === test.expectedColors) {
        console.log(`✅ 测试 ${index + 1}: ${test.name}`);
        passed++;
      } else {
        console.log(`❌ 测试 ${index + 1}: ${test.name}`);
        console.log(`  结果: ${JSON.stringify(result)}`);
        failed++;
      }
    } catch (error) {
      console.log(`❌ 测试 ${index + 1}: ${test.name} - 异常: ${error.message}`);
      failed++;
    }
  });

  console.log('\n=== 阴影解析测试 ===');
  shadowTests.forEach((test, index) => {
    try {
      const result = parseShadow(test.input);
      
      if (test.expectedLength && result.length === test.expectedLength) {
        console.log(`✅ 测试 ${index + 1}: ${test.name}`);
        passed++;
      } else if (test.expectedInset && result[0] && result[0].inset) {
        console.log(`✅ 测试 ${index + 1}: ${test.name}`);
        passed++;
      } else {
        console.log(`❌ 测试 ${index + 1}: ${test.name}`);
        console.log(`  结果: ${JSON.stringify(result)}`);
        failed++;
      }
    } catch (error) {
      console.log(`❌ 测试 ${index + 1}: ${test.name} - 异常: ${error.message}`);
      failed++;
    }
  });

  console.log(`\n📊 测试结果: ${passed}/${styleTests.length + gradientTests.length + shadowTests.length} 通过`);
  if (failed > 0) {
    console.log(`   ❌ ${failed} 个测试失败`);
  }
}

runStyleTests();