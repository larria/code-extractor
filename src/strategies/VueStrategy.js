import BaseStrategy from './BaseStrategy.js';

export default class VueStrategy extends BaseStrategy {
  get type() { return 'vue'; }

  match(files, pkg) {
    return this.hasDependency(pkg, ['vue', 'nuxt']);
  }

  getIgnoreList() {
    return [
      // Nuxt.js 2/3 特有的构建/缓存目录
      '.nuxt',
      '.output', // Nuxt 3 Nitro build output
      
      // Vue CLI / Vite 常见的打包目录 (Base里虽然有dist，但这里强调一下)
      'dist-ssr',
      
      // 常见的端对端测试截图/录像
      'cypress/videos',
      'cypress/screenshots',
      
      // 临时文件
      '*.tmp'
    ];
  }
}