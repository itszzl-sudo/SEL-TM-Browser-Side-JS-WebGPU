/**
 * 布局引擎测试用例
 */
import { SELColdPath } from '../src/core/layout-engine.js';

// Mock memoryDB
const mockMemoryDB = {
  getShortTerm: async () => null
};

// Mock SEL_TM
const mockSEL_TM = {
  Q: new Set(),
  δ: new Map(),
  K: null,
  L: new Map(),
  isHotStart: false
};

// 测试套件
const tests = [
  {
    name: '测试Block布局',
    domTree: {
      tag: 'body',
      attrs: { style: '' },
      children: [
        { tag: 'div', attrs: { style: 'width: 100px; height: 50px;' }, children: [] },
        { tag: 'div', attrs: { style: 'width: 200px; height: 80px;' }, children: [] }
      ]
    },
    expected: {
      taskCount: 3, // body + 2 divs
      widths: [undefined, 100, 200],
      heights: [undefined, 50, 80]
    }
  },
  {
    name: '测试Flex布局',
    domTree: {
      tag: 'body',
      attrs: { style: 'display: flex; width: 500px;' },
      children: [
        { tag: 'div', attrs: { style: 'flex: 1;' }, children: [] },
        { tag: 'div', attrs: { style: 'flex: 2;' }, children: [] }
      ]
    },
    expected: {
      hasFlex: true
    }
  },
  {
    name: '测试绝对定位',
    domTree: {
      tag: 'body',
      attrs: { style: '' },
      children: [
        { tag: 'div', attrs: { style: 'position: absolute; top: 10px; left: 20px;' }, children: [] }
      ]
    },
    expected: {
      positions: ['absolute'],
      positionsY: [10],
      positionsX: [20]
    }
  },
  {
    name: '测试Fixed定位',
    domTree: {
      tag: 'body',
      attrs: { style: '' },
      children: [
        { tag: 'div', attrs: { style: 'position: fixed; top: 50px; right: 30px;' }, children: [] }
      ]
    },
    expected: {
      positions: ['fixed'],
      positionsY: [50]
    }
  },
  {
    name: '测试Relative定位',
    domTree: {
      tag: 'body',
      attrs: { style: '' },
      children: [
        { tag: 'div', attrs: { style: 'position: relative; top: 15px; left: 25px;' }, children: [] }
      ]
    },
    expected: {
      positions: ['relative']
    }
  }
];

// 运行测试
async function runTests() {
  let passed = 0;
  let failed = 0;

  const coldPath = new SELColdPath();
  await coldPath.init(mockMemoryDB, mockSEL_TM);

  console.log('=== 布局引擎测试 ===');
  
  for (let index = 0; index < tests.length; index++) {
    const test = tests[index];
    try {
      const tasks = await coldPath.executeLayout(test.domTree, 800, 600);
      
      let isPassed = true;
      let errorMsg = '';
      
      if (test.expected.taskCount !== undefined && tasks.length !== test.expected.taskCount) {
        isPassed = false;
        errorMsg = `任务数期望 ${test.expected.taskCount}，实际 ${tasks.length}`;
      }
      
      if (test.expected.widths && !test.expected.widths.every((w, i) => {
        const task = tasks[i + 1]; // 跳过body
        return w === undefined || parseFloat(task.width) === w;
      })) {
        isPassed = false;
        errorMsg = '宽度不匹配';
      }
      
      if (test.expected.heights && !test.expected.heights.every((h, i) => {
        const task = tasks[i + 1];
        return h === undefined || parseFloat(task.height) === h;
      })) {
        isPassed = false;
        errorMsg = '高度不匹配';
      }
      
      if (test.expected.positions && tasks.slice(1).every((task, i) => task.position === test.expected.positions[i])) {
        isPassed = isPassed && true;
      } else if (test.expected.positions) {
        isPassed = false;
        errorMsg = '定位类型不匹配';
      }
      
      if (test.expected.hasFlex && !tasks.some(t => t.display === 'flex')) {
        isPassed = false;
        errorMsg = 'Flex布局未检测到';
      }
      
      if (test.expected.positionsY && !test.expected.positionsY.every((y, i) => {
        const task = tasks[i + 1];
        return parseFloat(task.y) === y;
      })) {
        isPassed = false;
        errorMsg = 'Y坐标不匹配';
      }
      
      if (isPassed) {
        console.log(`✅ 测试 ${index + 1}: ${test.name}`);
        passed++;
      } else {
        console.log(`❌ 测试 ${index + 1}: ${test.name}`);
        if (errorMsg) console.log(`  错误: ${errorMsg}`);
        console.log(`  任务: ${JSON.stringify(tasks.map(t => ({tag: t.tag, position: t.position, x: t.x, y: t.y, width: t.width, height: t.height})), null, 2)}`);
        failed++;
      }
    } catch (error) {
      console.log(`❌ 测试 ${index + 1}: ${test.name} - 异常: ${error.message}`);
      console.log(error.stack);
      failed++;
    }
  }

  console.log(`\n📊 测试结果: ${passed}/${tests.length} 通过`);
  if (failed > 0) {
    console.log(`   ❌ ${failed} 个测试失败`);
  }
}

runTests();