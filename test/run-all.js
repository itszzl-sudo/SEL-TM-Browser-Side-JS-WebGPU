/**
 * 测试运行器 - 运行所有测试
 */

async function runAllTests() {
  console.log('🚀 开始运行 SEL-TM 引擎测试套件\n');
  
  try {
    // 运行 HTML 解析器测试
    console.log('='.repeat(50));
    console.log('运行 HTML 解析器测试...');
    console.log('='.repeat(50));
    await import('./html-parser.test.js');
    
    // 等待一下让输出完成
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // 运行颜色解析器测试
    console.log('\n' + '='.repeat(50));
    console.log('运行颜色解析器测试...');
    console.log('='.repeat(50));
    await import('./color-parser.test.js');
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // 运行样式解析器测试
    console.log('\n' + '='.repeat(50));
    console.log('运行样式解析器测试...');
    console.log('='.repeat(50));
    await import('./style-parser.test.js');
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // 运行布局引擎测试
    console.log('\n' + '='.repeat(50));
    console.log('运行布局引擎测试...');
    console.log('='.repeat(50));
    await import('./layout-engine.test.js');
    
    console.log('\n🎉 所有测试运行完成！');
    
  } catch (error) {
    console.error('❌ 测试运行器异常:', error.message);
    console.error(error.stack);
  }
}

runAllTests();