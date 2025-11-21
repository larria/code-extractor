import BaseStrategy from './BaseStrategy.js';

export default class ReactStrategy extends BaseStrategy {
  get type() { return 'react'; }

  match(files, pkg) {
    // 检查依赖中是否有 react (且排除 react-native，如果有 react-native 应该由专门的 RN 策略处理，这里暂时简化)
    // 也可以包含 next
    const hasReact = this.hasDependency(pkg, ['react', 'react-dom', 'next']);
    const hasRN = this.hasDependency(pkg, ['react-native']);
    return hasReact && !hasRN;
  }

  getIgnoreList() {
    return ['.next', 'build', 'out'];
  }
}