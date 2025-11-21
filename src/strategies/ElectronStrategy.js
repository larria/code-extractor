import BaseStrategy from './BaseStrategy.js';

export default class ElectronStrategy extends BaseStrategy {
  get type() { return 'electron'; }

  match(files, pkg) {
    return this.hasDependency(pkg, ['electron']);
  }

  getIgnoreList() {
    return [
      // 构建产物 (不同构建工具默认目录不同)
      'dist',
      'out',
      'release',
      'release-builds',
      'pack',
      'builder-debug.yml',
      
      // 本地编译的二进制模块 (Native Modules)
      'build', // node-gyp build output
      
      // 如果 Electron 只是包裹层，里面可能还有 web 源码的构建产物
      'app/dist',
      'src/dist'
    ];
  }
}