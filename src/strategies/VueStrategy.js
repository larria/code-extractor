import BaseStrategy from './BaseStrategy.js';

export default class VueStrategy extends BaseStrategy {
  get type() { return 'vue'; }

  match(files, pkg) {
    // 检查依赖中是否有 vue 或 nuxt
    return this.hasDependency(pkg, ['vue', 'nuxt']);
  }

  getIgnoreList() {
    return ['.nuxt', 'dist', 'dist-ssr'];
  }
}