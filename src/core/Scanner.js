import fs from 'fs-extra';
import path from 'path';
import ignore from 'ignore';
import chalk from 'chalk';
import { Processor } from './Processor.js';
import { MediaCollector } from './MediaCollector.js';

export class Scanner {
  /**
   * @param {string} rootDir 
   * @param {BaseStrategy} strategy 
   * @param {string[]} extraExcludes 
   * @param {string[]} extraIncludes 
   */
  constructor(rootDir, strategy, extraExcludes = [], extraIncludes = []) {
    this.rootDir = rootDir;
    this.strategy = strategy;
    this.extraExcludes = extraExcludes;
    this.extraIncludes = extraIncludes;

    this.processor = new Processor();
    this.mediaCollector = new MediaCollector();
    
    // 排除规则管理器 (Blacklist)
    this.ig = ignore();

    // 包含规则管理器 (White Knight / Force Include)
    this.includeMatcher = null;
    if (this.extraIncludes.length > 0) {
      this.includeMatcher = ignore().add(this.extraIncludes);
    }

    this.treeBuffer = ''; 
    this.mediaBuffer = ''; 
    this.contentBuffer = ''; 

    this.MAX_DIR_ITEMS = 100;
    this.KEEP_DIR_ITEMS = 3;
  }

  async run() {
    await this.initIgnore();
    this.appendHeader();

    this.treeBuffer += '================================================================================\n';
    this.treeBuffer += '目录结构树\n';
    this.treeBuffer += '================================================================================\n';
    this.treeBuffer += `/\n`;

    this.contentBuffer += '\n================================================================================\n';
    this.contentBuffer += '文件内容详情\n';
    this.contentBuffer += '================================================================================\n';

    console.log(chalk.blue('正在扫描文件并生成快照...'));
    await this.walk(this.rootDir, '');

    await this.saveOutput();
  }

  async initIgnore() {
    // 1. 加载策略默认忽略 (例如 bin, node_modules)
    this.ig.add(this.strategy.defaultIgnores);
    // 2. 加载策略特定忽略
    this.ig.add(this.strategy.getIgnoreList());

    // 3. 加载命令行传入的额外排除
    if (this.extraExcludes && this.extraExcludes.length > 0) {
      this.ig.add(this.extraExcludes);
    }

    // 4. 加载 .gitignore
    const gitIgnorePath = path.join(this.rootDir, '.gitignore');
    if (await fs.pathExists(gitIgnorePath)) {
      try {
        const gitIgnoreContent = await fs.readFile(gitIgnorePath, 'utf-8');
        this.ig.add(gitIgnoreContent);
        console.log(chalk.gray('已加载 .gitignore 规则'));
      } catch (e) {
        console.warn('读取 .gitignore 失败，已跳过');
      }
    }
  }

  async walk(currentDir, prefix) {
    let entries;
    try {
      entries = await fs.readdir(currentDir, { withFileTypes: true });
    } catch (e) {
      this.treeBuffer += `${prefix}└──[读取失败: ${e.message}]\n`;
      return;
    }

    // 🔴 核心逻辑修改：优先判断包含，再判断排除
    const filteredEntries = entries.filter(entry => {
      const absolutePath = path.join(currentDir, entry.name);
      const relativePath = path.relative(this.rootDir, absolutePath);
      
      // 1. 【优先】检查是否在 "强制包含" 列表中 (Force Include)
      // 如果用户指定了 -i bin，那么 bin 目录及其子文件将在这里被直接通过
      if (this.includeMatcher) {
        if (this.checkInclude(relativePath, entry.isDirectory())) {
          return true; // ✨ 直接放行，不走后面的排除检查
        }
      }

      // 2. 检查是否被排除 (Exclude)
      // 只有没被 "强制包含" 命中的文件，才检查是否需要忽略
      let isIgnored = false;
      if (entry.isDirectory()) {
        isIgnored = this.ig.ignores(relativePath) || this.ig.ignores(relativePath + '/');
      } else {
        isIgnored = this.ig.ignores(relativePath);
      }
      
      if (isIgnored) return false; // 被忽略，丢弃

      // 3. 默认保留
      return true;
    });

    // --- 以下逻辑保持不变 ---

    const relativeDirPath = path.relative(this.rootDir, currentDir);
    const mediaInfo = await this.mediaCollector.processDirectory(currentDir, relativeDirPath, filteredEntries);
    if (mediaInfo) {
      this.mediaBuffer += mediaInfo;
    }

    filteredEntries.sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

    const totalCount = filteredEntries.length;
    let displayEntries = filteredEntries;
    let isPruned = false;

    if (totalCount > this.MAX_DIR_ITEMS) {
      displayEntries = filteredEntries.slice(0, this.KEEP_DIR_ITEMS);
      isPruned = true;
    }

    for (let i = 0; i < displayEntries.length; i++) {
      const entry = displayEntries[i];
      const isLast = (i === displayEntries.length - 1) && !isPruned; 
      const suffix = isLast ? '└── ' : '├── ';
      const nextPrefix = prefix + (isLast ? '    ' : '│   ');

      const absolutePath = path.join(currentDir, entry.name);

      this.treeBuffer += `${prefix}${suffix}${entry.name} `;
      if (entry.isDirectory()) {
        this.treeBuffer += '/';
      }
      this.treeBuffer += '\n';

      if (entry.isDirectory()) {
        await this.walk(absolutePath, nextPrefix);
      } else {
        const content = await this.processor.process(absolutePath);
        if (content !== null) {
          const relativePath = path.relative(this.rootDir, absolutePath);
          this.contentBuffer += `\n----------- [文件] ${relativePath} -----------\n`;
          this.contentBuffer += content + '\n';
        }
      }
    }

    if (isPruned) {
      this.treeBuffer += `${prefix}└── ... (共 ${totalCount} 项，剩余 ${totalCount - this.KEEP_DIR_ITEMS} 项已省略) \n`;
    }
  }

  /**
   * 检查是否命中强制包含规则
   */
  checkInclude(relPath, isDir) {
    // 1. 如果完全匹配规则 (例如 -i bin 匹配了 bin 目录)
    if (this.includeMatcher.ignores(relPath)) {
      return true;
    }

    // 2. 如果是目录，检查它是否是某个包含规则的"必经之路" (父级)
    // 比如 -i bin/cli.js，当前目录是 bin，虽然 bin 本身不在规则里，但必须放行 bin 才能找到 cli.js
    if (isDir) {
      return this.extraIncludes.some(pattern => {
        if (pattern.includes('*') || pattern.includes('?') || pattern.includes('[')) {
          // 通配符情况，保守策略：只要不是完全无关，就允许进入
          return true; 
        }
        // 比如 pattern = 'bin/cli.js', relPath = 'bin' -> true
        return pattern.startsWith(relPath + '/');
      });
    }

    return false;
  }

  appendHeader() {
    const projectName = path.basename(this.rootDir);
    const parentDir = path.basename(path.dirname(this.rootDir));
    const date = new Date().toLocaleString();

    let header = '================================================================================\n';
    header += '项目扫描报告\n';
    header += '================================================================================\n';
    header += `项目名称: ${projectName} \n`;
    header += `上级目录: ${parentDir} \n`;
    header += `项目类型: ${this.strategy.type} \n`;
    header += `生成时间: ${date} \n`;

    if (this.extraExcludes.length > 0) {
      header += `额外排除: ${this.extraExcludes.join(', ')} \n`;
    }
    if (this.extraIncludes.length > 0) {
      // 现在的语义是 "强制包含 (Un-ignore)"
      header += `强制包含: ${this.extraIncludes.join(', ')} \n`;
    }

    header += `\n`;

    this.header = header;
  }

  // saveOutput 方法保持不变，省略
  async saveOutput() {
    const projectName = path.basename(this.rootDir);
    const parentDir = path.basename(path.dirname(this.rootDir));
    const typeName = this.strategy.type;

    const fileName = `${projectName} -${typeName} -${parentDir}.txt`;
    const outputDir = path.join(process.cwd(), 'output');
    const outputPath = path.join(outputDir, fileName);

    const finalData = this.header + this.treeBuffer +
      (this.mediaBuffer ? '\n================================================================================\n媒体资源统计\n================================================================================\n' + this.mediaBuffer : '') +
      this.contentBuffer;

    await fs.ensureDir(outputDir);
    await fs.writeFile(outputPath, finalData, 'utf-8');

    console.log(chalk.green(`\n✅ 扫描完成！`));
    console.log(chalk.white(`结果已保存至: `) + chalk.underline(outputPath));
  }
}