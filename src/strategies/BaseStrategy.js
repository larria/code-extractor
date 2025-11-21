// src/strategies/BaseStrategy.js
export default class BaseStrategy {
  constructor() {
    // 所有类型默认忽略的文件
    this.defaultIgnores = [
      'node_modules', 
      '.git', 
      '.svn',
      '.DS_Store', 
      'Thumbs.db', 
      'dist', 
      'build', 
      'coverage', 
      '.idea', 
      '.vscode',
      '*.log',
      'yarn.lock',
      'package-lock.json',
      'pnpm-lock.yaml'
    ];
  }

  /**
   * 策略类型名称
   */
  get type() {
    return 'base';
  }

  /**
   * 核心检测逻辑
   * @param {string[]} files - 根目录下的文件/文件夹列表
   * @param {object} packageJson - package.json 内容 (如果存在)
   * @returns {boolean}
   */
  match(files, packageJson) {
    return false;
  }

  /**
   * 获取该类型特有的忽略规则
   * @returns {string[]}
   */
  getIgnoreList() {
    return [];
  }

  /**
   * 辅助方法：检查依赖是否存在
   */
  hasDependency(pkg, depNames) {
    if (!pkg) return false;
    const allDeps = { 
      ...pkg.dependencies, 
      ...pkg.devDependencies, 
      ...pkg.peerDependencies 
    };
    if (Array.isArray(depNames)) {
      return depNames.some(dep => allDeps[dep]);
    }
    return !!allDeps[depNames];
  }
}