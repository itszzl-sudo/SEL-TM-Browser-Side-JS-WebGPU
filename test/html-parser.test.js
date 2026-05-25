/**
 * HTML 解析器测试用例
 */
import { HTMLDocumentParser } from '../src/core/html-parser.js';

// 测试套件
const tests = [
  {
    name: '测试简单HTML解析',
    input: '<div><p>Hello</p></div>',
    expected: {
      doctype: '',
      html: {
        head: { styles: [], scripts: [], title: '' },
        body: { 
          children: [{
            tag: 'div',
            attrs: {},
            children: [{
              tag: 'p',
              attrs: {},
              children: [],
              text: 'Hello'
            }],
            text: ''
          }]
        }
      }
    }
  },
  {
    name: '测试带属性的元素',
    input: '<div class="container" id="main"><span style="color:red">Text</span></div>',
    expectedAttrs: { class: 'container', id: 'main' }
  },
  {
    name: '测试自闭合标签',
    input: '<img src="test.jpg"/><br>',
    expectedTags: ['img', 'br']
  },
  {
    name: '测试注释跳过',
    input: '<!-- comment --><div>Content</div>',
    expectedChildrenCount: 1
  },
  {
    name: '测试嵌套元素',
    input: '<div><ul><li>Item1</li><li>Item2</li></ul></div>',
    expectedNestedCount: 2
  }
];

// 运行测试
function runTests() {
  let passed = 0;
  let failed = 0;

  tests.forEach((test, index) => {
    try {
      const parser = new HTMLDocumentParser();
      const result = parser.parse(test.input);
      
      let isPassed = true;
      
      if (test.expected) {
        isPassed = JSON.stringify(result) === JSON.stringify(test.expected);
      } else if (test.expectedAttrs) {
        const attrs = result.html.body.children[0].attrs;
        isPassed = JSON.stringify(attrs) === JSON.stringify(test.expectedAttrs);
      } else if (test.expectedTags) {
        const tags = result.html.body.children.map(c => c.tag);
        isPassed = JSON.stringify(tags) === JSON.stringify(test.expectedTags);
      } else if (test.expectedChildrenCount !== undefined) {
        isPassed = result.html.body.children.length === test.expectedChildrenCount;
      } else if (test.expectedNestedCount !== undefined) {
        const nestedCount = result.html.body.children[0].children[0].children.length;
        isPassed = nestedCount === test.expectedNestedCount;
      }
      
      if (isPassed) {
        console.log(`✅ 测试 ${index + 1}: ${test.name}`);
        passed++;
      } else {
        console.log(`❌ 测试 ${index + 1}: ${test.name}`);
        console.log('  结果:', JSON.stringify(result, null, 2));
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