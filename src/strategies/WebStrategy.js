import BaseStrategy from './BaseStrategy.js';
import fs from 'fs-extra';
import path from 'path';

export default class WebStrategy extends BaseStrategy {
  get type() { return 'generic-web'; }

  match(files, pkg) {
    // 1. 依赖特征 (jQuery, Bootstrap, Bundlers)
    if (pkg) {
      const webDeps = [
        'jquery', 'bootstrap', 'bulma', 'tailwindcss', 
        'webpack', 'parcel', 'vite', 'rollup', 'gulp', 'grunt'
      ];
      if (this.hasDependency(pkg, webDeps)) return true;
    }

    // 2. 目录/文件特征
    // 规则：根目录 index.html
    if (files.includes('index.html')) return true;

    // 规则：public/index.html 或 src/index.html (需要稍微探测一下深层，但为了性能只看一级子目录)
    // 这里我们假设 Detector 传入的 files 只有根目录文件名。
    // 我们需要自己稍微 check 一下子目录。
    // 注意：此时 this.rootDir 还没传进来，match 方法签名可能需要调整，或者 Detector 传进来 rootDir。
    // 修正：在 Detector.js 调用 match 时，虽然上面代码只传了 files，但我们可以让 match 接收 rootDir
    // 这里假设 Detector 已经修改为 match(files, pkg, rootDir)
    
    // *为了保持代码简单，我们假设 match 第三个参数是 rootDir，稍后我会在 Detector 补上*
    const rootDir = arguments[2]; 
    if (rootDir) {
        if (fs.existsSync(path.join(rootDir, 'public', 'index.html'))) return true;
        if (fs.existsSync(path.join(rootDir, 'src', 'index.html'))) return true;
        
        // 规则：存在典型的静态资源文件夹组合
        // 比如同时存在 css 和 js 文件夹
        const hasCss = files.includes('css') || files.includes('styles');
        const hasJs = files.includes('js') || files.includes('scripts');
        if (hasCss && hasJs) return true;
    }

    return false;
  }

  getIgnoreList() {
    return ['.sass-cache', 'bower_components'];
  }
}