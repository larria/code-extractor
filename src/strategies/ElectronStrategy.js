// src/strategies/ElectronStrategy.js
import BaseStrategy from './BaseStrategy.js';

export default class ElectronStrategy extends BaseStrategy {
  get type() {
    return 'electron';
  }

  /**
   * Electron 项目核心特征：依赖中包含 electron
   * 通常 electron 会安装在 devDependencies 中，BaseStrategy.hasDependency 会自动检查所有依赖字段
   */
  match(files, pkg) {
    return this.hasDependency(pkg, ['electron']);
  }

  getIgnoreList() {
    return [
      'dist',            // 常规构建目录
      'out',             // electron-forge 默认输出
      'release',         // electron-builder 默认输出
      'release-builds',  // 常见的自定义构建目录
      'build',           // 一些模板使用的构建目录
      'compile'          // 编译中间产物
    ];
  }
}