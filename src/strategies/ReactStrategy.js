import BaseStrategy from './BaseStrategy.js';

export default class ReactStrategy extends BaseStrategy {
  get type() { return 'react'; }

  match(files, pkg) {
    const hasReact = this.hasDependency(pkg, ['react', 'react-dom', 'next']);
    const hasRN = this.hasDependency(pkg, ['react-native']);
    // 排除 React Native，防止误判 (RN 应该有自己的策略，或者被 Node 兜底)
    return hasReact && !hasRN;
  }

  getIgnoreList() {
    return [
      // Next.js 构建缓存 (非常重要，体积巨大)
      '.next',
      
      // Gatsby 缓存
      '.cache', // Gatsby cache
      
      // Docusaurus 缓存
      '.docusaurus',
      
      // 静态导出目录
      'out',       // Next.js export
      'build',     // Create React App
      'storybook-static' // Storybook build
    ];
  }
}