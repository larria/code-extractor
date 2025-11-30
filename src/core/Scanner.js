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
    this.header = '';

    this.MAX_DIR_ITEMS = 100;
    this.KEEP_DIR_ITEMS = 3;
  }

  /**
   * 计算安全的代码块围栏长度
   * 默认使用 4 个反引号 (````)，如果内容中含有反引号，则自动增加数量以避免冲突
   * @param {string} content 
   * @returns {string}
   */
  getSafeFence(content) {
    const matches = content.match(/`+/g) || [];
    const maxBackticks = matches.reduce((max, curr) => Math.max(max, curr.length), 0);
    // 始终比内容中最长的反引号序列多一个，且至少为 4 个
    const fenceLength = Math.max(4, maxBackticks + 1);
    return '`'.repeat(fenceLength);
  }

  async run() {
    await this.initIgnore();
    this.appendHeader();

    // 初始化目录树区域 (使用 Markdown 代码块包裹，防止特殊字符被解析)
    this.treeBuffer += '#### 🌳 [CE] 目录结构树\n\n';
    this.treeBuffer += '````text\n/\n'; 

    // 初始化文件内容区域
    this.contentBuffer += '\n#### 📚 [CE] 文件内容详情\n';

    console.log(chalk.blue('正在扫描文件并生成快照...'));
    await this.walk(this.rootDir, '');

    // 闭合目录树的代码块
    this.treeBuffer += '````\n'; 

    await this.saveOutput();
  }

  async initIgnore() {
    // 1. 加载策略默认忽略
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
      this.treeBuffer += `${prefix}└── [读取失败: ${e.message}]\n`;
      return;
    }

    // 过滤逻辑：优先包含，其次排除
    const filteredEntries = entries.filter(entry => {
      const absolutePath = path.join(currentDir, entry.name);
      const relativePath = path.relative(this.rootDir, absolutePath);
      
      // 1. 检查强制包含
      if (this.includeMatcher) {
        if (this.checkInclude(relativePath, entry.isDirectory())) {
          return true; 
        }
      }

      // 2. 检查排除规则
      let isIgnored = false;
      if (entry.isDirectory()) {
        isIgnored = this.ig.ignores(relativePath) || this.ig.ignores(relativePath + '/');
      } else {
        isIgnored = this.ig.ignores(relativePath);
      }
      
      if (isIgnored) return false; 

      return true;
    });

    // 处理媒体资源
    const relativeDirPath = path.relative(this.rootDir, currentDir);
    const mediaInfo = await this.mediaCollector.processDirectory(currentDir, relativeDirPath, filteredEntries);
    if (mediaInfo) {
      this.mediaBuffer += mediaInfo;
    }

    // 排序：文件夹在前，文件在后
    filteredEntries.sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

    // 目录树裁剪逻辑
    const totalCount = filteredEntries.length;
    let displayEntries = filteredEntries;
    let isPruned = false;

    if (totalCount > this.MAX_DIR_ITEMS) {
      displayEntries = filteredEntries.slice(0, this.KEEP_DIR_ITEMS);
      isPruned = true;
    }

    // 遍历处理
    for (let i = 0; i < displayEntries.length; i++) {
      const entry = displayEntries[i];
      const isLast = (i === displayEntries.length - 1) && !isPruned; 
      const suffix = isLast ? '└── ' : '├── ';
      const nextPrefix = prefix + (isLast ? '    ' : '│   ');

      const absolutePath = path.join(currentDir, entry.name);

      // 写入目录树 Buffer
      this.treeBuffer += `${prefix}${suffix}${entry.name} `;
      if (entry.isDirectory()) {
        this.treeBuffer += '/';
      }
      this.treeBuffer += '\n';

      if (entry.isDirectory()) {
        await this.walk(absolutePath, nextPrefix);
      } else {
        // 处理文件内容
        const content = await this.processor.process(absolutePath);
        if (content !== null) {
          const relativePath = path.relative(this.rootDir, absolutePath);
          // 移除扩展名前的点，作为 markdown 语言标识
          const ext = path.extname(absolutePath).replace('.', '') || 'txt';
          
          // 获取安全围栏 (防止内容中含有 ``` 导致截断)
          const fence = this.getSafeFence(content);
          
          // 写入内容 Buffer (Markdown 格式)
          this.contentBuffer += `\n#### 📝 [CE] 文件: ${relativePath}\n`;
          this.contentBuffer += `${fence}${ext}\n`;
          this.contentBuffer += content + '\n';
          this.contentBuffer += `${fence}\n`;
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
    if (this.includeMatcher.ignores(relPath)) {
      return true;
    }
    if (isDir) {
      return this.extraIncludes.some(pattern => {
        if (pattern.includes('*') || pattern.includes('?') || pattern.includes('[')) {
          return true; 
        }
        return pattern.startsWith(relPath + '/');
      });
    }
    return false;
  }

  appendHeader() {
    const projectName = path.basename(this.rootDir);
    const parentDir = path.basename(path.dirname(this.rootDir));
    const date = new Date().toLocaleString();

    // 使用 Markdown 格式生成头部，增加 [CE] 标记避免混淆
    let header = `# 🛡️ [CE] 项目扫描报告: ${projectName}\n\n`;
    header += `- **项目类型**: ${this.strategy.type}\n`;
    header += `- **上级目录**: ${parentDir}\n`;
    header += `- **生成时间**: ${date}\n`;
    header += `- 注: [CE] 代表 Code Extractor，即项目代码提取器提取的内容标记\n`;

    if (this.extraExcludes.length > 0) {
      header += `- **额外排除**: \`${this.extraExcludes.join(', ')}\`\n`;
    }
    if (this.extraIncludes.length > 0) {
      header += `- **强制包含**: \`${this.extraIncludes.join(', ')}\`\n`;
    }

    header += `\n`;

    this.header = header;
  }

  async saveOutput() {
    const projectName = path.basename(this.rootDir);
    const parentDir = path.basename(path.dirname(this.rootDir));
    const typeName = this.strategy.type;

    const fileName = `${projectName}-${typeName}-${parentDir}.md`;
    const outputDir = path.join(process.cwd(), 'output');
    const outputPath = path.join(outputDir, fileName);

    // 拼接最终结果，如果存在媒体资源，也加上对应的 Markdown 标题
    const finalData = this.header + 
      this.treeBuffer +
      (this.mediaBuffer ? '\n#### 🖼️ [CE] 媒体资源统计\n' + this.mediaBuffer : '') +
      this.contentBuffer;

    await fs.ensureDir(outputDir);
    await fs.writeFile(outputPath, finalData, 'utf-8');

    console.log(chalk.green(`\n✅ 扫描完成！`));
    console.log(chalk.white(`结果已保存至: `) + chalk.underline(outputPath));
  }
}