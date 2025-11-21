import BaseStrategy from './BaseStrategy.js';

export default class NodeStrategy extends BaseStrategy {
  get type() { return this.customType || 'nodejs'; }

  match(files, pkg) {
    if (!pkg) return false;

    // 强特征：后端框架
    const backendFrameworks = [
      'express', 'koa', 'hapi', 'fastify', 'nestjs', '@nestjs/core', 'egg', 'thinkjs'
    ];
    if (this.hasDependency(pkg, backendFrameworks)) return true;

    // 特征：包含 bin 字段，通常是 CLI 工具
    if (pkg.bin) return true;

    // 负向特征：如果有明显的浏览器端构建工具，且没有后端框架，则大概率不是纯 Node 项目
    // 这部分逻辑交给 WebStrategy 去“抢”，NodeStrategy 在 Detector 列表里排在 Web 之前
    // 是为了优先捕获“混合了前端代码的 Node 全栈项目 (如 NestJS + React)”中的后端特征？
    // 不，通常全栈项目我们可能更希望识别为特定的全栈类型，或者按 Web 处理。
    // 这里的策略是：如果有 Express/Nest，哪怕有前端代码，也先视为 Node 项目(或需要扩展 Fullstack 类型)。
    // 为了简单，如果明确有后端库，就算 Node。
    
    return false;
  }

  getIgnoreList() {
    // Node 项目通常不需要忽略 dist，因为 dist 可能是编译后的 js
    // 但为了不输出重复代码，如果源码在 src，还是建议忽略 dist
    return ['test', 'tests', 'coverage']; 
  }
}