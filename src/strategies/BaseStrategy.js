export default class BaseStrategy {
  constructor() {
    // 所有类型默认忽略的文件
    this.defaultIgnores = [
      // 依赖包
      'node_modules', 
      'jspm_packages',
      'bower_components',

      // 版本控制
      '.git', 
      '.svn',
      '.hg',

      // 系统文件
      '.DS_Store', 
      'Thumbs.db', 

      // 常见的构建输出目录
      'dist', 
      'build', 
      'out',
      'target', // Java/Maven
      'bin',    // C#/Java
      'obj',    // C#
      
      // 测试覆盖率报告
      'coverage', 
      
      // IDE 配置 (通常不含业务逻辑)
      '.idea', 
      '.vscode',
      '*.iml',

      // ❌ 新增：包管理锁文件 (非常重要，减少大量噪音)
      'package-lock.json',
      '.npm-cache',
      'yarn.lock',
      'pnpm-lock.yaml',
      'bun.lockb',
      'npm-debug.log',
      'yarn-error.log',

      // 文档生成
      'doc',
      'docs' // 如果项目文档很长，通常建议分离，看你需要保留还是忽略，这里作为代码提取工具建议忽略非代码文档
    ];
  }

  get type() {
    return 'base';
  }

  match(files, packageJson) {
    return false;
  }

  getIgnoreList() {
    return [];
  }

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