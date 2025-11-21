import BaseStrategy from './BaseStrategy.js';

export default class FlutterStrategy extends BaseStrategy {
  get type() { return 'flutter'; }

  match(files) {
    return files.includes('pubspec.yaml');
  }

  getIgnoreList() {
    return [
      // Flutter 构建/工具缓存
      '.dart_tool',
      '.idea',
      'build',
      
      // 锁文件 (通常分析业务逻辑不需要具体的包版本锁定信息)
      'pubspec.lock',

      // ❌ 核心优化：忽略平台原生工程目录
      // 这些目录通常由 flutter create 生成，除非涉及原生混合开发，否则不包含业务逻辑
      'android',
      'ios',
      'web',
      'macos',
      'windows',
      'linux',
      
      // 其他杂项
      'coverage',
      'doc' // 文档通常也不需要提取
    ];
  }
}