// src/core/Detector.js
import fs from 'fs-extra';
import path from 'path';

// 导入所有具体策略 (稍后我们会逐一创建这些文件)
// 这里先用 import 占位，实际开发中要确保文件存在
import FlutterStrategy from '../strategies/FlutterStrategy.js';
import ElectronStrategy from '../strategies/ElectronStrategy.js';
import VueStrategy from '../strategies/VueStrategy.js';
import ReactStrategy from '../strategies/ReactStrategy.js';
// import AndroidStrategy from '../strategies/AndroidStrategy.js';
// import IosStrategy from '../strategies/IosStrategy.js';
import NodeStrategy from '../strategies/NodeStrategy.js';
import WebStrategy from '../strategies/WebStrategy.js';

export class Detector {
  constructor() {
    // 策略顺序非常重要，按修正后的优先级排列
    this.strategies = [
      new FlutterStrategy(),
    //   new AndroidStrategy(),
    //   new IosStrategy(),
      new ElectronStrategy(), // 放在 Vue/React 之前，因为 Electron 经常包裹它们
      new VueStrategy(),
      new ReactStrategy(),
      new NodeStrategy(),     // Node 后端框架特征检测
      new WebStrategy(),      // 通用 Web (包括 jQuery, 静态网页, 或其他框架)
    ];
  }

  /**
   * 执行检测
   * @param {string} rootDir 
   */
  async detect(rootDir) {
    // 1. 获取根目录文件列表 (浅层扫描)
    let files = [];
    try {
      files = await fs.readdir(rootDir);
    } catch (e) {
      throw new Error(`无法读取目录: ${rootDir}, 错误: ${e.message}`);
    }

    // 2. 尝试读取 package.json (这对后续很多判断至关重要)
    let packageJson = null;
    if (files.includes('package.json')) {
      try {
        packageJson = await fs.readJson(path.join(rootDir, 'package.json'));
      } catch (e) {
        console.warn('警告: 存在 package.json 但读取失败，将忽略依赖判断。');
      }
    }

    // 3. 遍历策略进行匹配
    for (const strategy of this.strategies) {
      // 传入 files, packageJson, 以及 rootDir
      if (strategy.match(files, packageJson, rootDir)) {
        return strategy;
      }
    }

    // 4. 兜底：如果只有 package.json 但没匹配到 NodeStrategy (说明没明显后端特征)
    // 也没匹配到 WebStrategy (说明没明显前端特征)，
    // 此时根据常识，如果有 package.json，通常默认视为 Node 环境工具或库
    if (packageJson) {
        // 返回一个基础的 Node 策略实例，但类型标记为 'generic-node'
        const fallbackNode = new NodeStrategy();
        fallbackNode.customType = 'generic-node'; 
        return fallbackNode;
    }

    return null; // 完全无法识别
  }
}