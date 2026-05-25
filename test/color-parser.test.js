/**
 * 颜色解析器测试用例
 */
import { ColorParser } from '../src/core/color-parser.js';

const colorParser = new ColorParser();

// 测试套件
const tests = [
  {
    name: '测试十六进制颜色',
    input: '#ff5722',
    expected: [1, 0.341, 0.133, 1]
  },
  {
    name: '测试短十六进制颜色',
    input: '#f00',
    expected: [1, 0, 0, 1]
  },
  {
    name: '测试十六进制带透明度',
    input: '#ff572280',
    expected: [1, 0.341, 0.133, 0.502]
  },
  {
    name: '测试rgb颜色',
    input: 'rgb(255, 87, 34)',
    expected: [1, 0.341, 0.133, 1]
  },
  {
    name: '测试rgba颜色',
    input: 'rgba(255, 87, 34, 0.5)',
    expected: [1, 0.341, 0.133, 0.5]
  },
  {
    name: '测试rgb百分比',
    input: 'rgb(100%, 34%, 13%)',
    expected: [1, 0.34, 0.13, 1]
  },
  {
    name: '测试hsl颜色',
    input: 'hsl(14, 100%, 50%)',
    expected: [1, 0.233, 0, 1]
  },
  {
    name: '测试hsla颜色',
    input: 'hsla(14, 100%, 50%, 0.7)',
    expected: [1, 0.233, 0, 0.7]
  },
  {
    name: '测试颜色名称',
    input: 'red',
    expected: [1, 0, 0, 1]
  },
  {
    name: '测试颜色名称带透明度',
    input: 'transparent',
    expected: [0, 0, 0, 0]
  }
];

// 辅助函数：比较浮点数数组
function arraysEqual(arr1, arr2, tolerance = 0.001) {
  if (arr1.length !== arr2.length) return false;
  return arr1.every((val, i) => Math.abs(val - arr2[i]) < tolerance);
}

// 运行测试
function runTests() {
  let passed = 0;
  let failed = 0;

  tests.forEach((test, index) => {
    try {
      const result = colorParser.hexToRgba(test.input);
      
      if (arraysEqual(result, test.expected)) {
        console.log(`✅ 测试 ${index + 1}: ${test.name}`);
        passed++;
      } else {
        console.log(`❌ 测试 ${index + 1}: ${test.name}`);
        console.log(`  输入: ${test.input}`);
        console.log(`  期望: ${test.expected}`);
        console.log(`  实际: ${result}`);
        failed++;
      }
    } catch (error) {
      console.log(`❌ 测试 ${index + 1}: ${test.name} - 异常: ${error.message}`);
      failed++;
    }
  });

  console.log(`\n📊 测试结果: ${passed}/${tests.length} 通过`);
  if (failed > 0) {
    console.log(`   ❌ ${failed} 个测试失败`);
  }
}

runTests();