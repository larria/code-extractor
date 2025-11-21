// src/core/Scanner.js
import fs from 'fs-extra';
import path from 'path';
import ignore from 'ignore';
import chalk from 'chalk';
import { Processor } from './Processor.js';

export class Scanner {
  /**
   * @param {string} rootDir 
   * @param {BaseStrategy} strategy 
   */
  constructor(rootDir, strategy) {
    this.rootDir = rootDir;
    this.strategy = strategy;
    this.processor = new Processor();
    this.ig = ignore();
    
    // 输出相关
    this.treeBuffer = ''; // 存储目录树字符串
    this.contentBuffer = ''; // 存储文件内容字符串
    
    // 阈值
    this.MAX_DIR_ITEMS = 100; // 目录内超过100项触发折叠
    this.KEEP_DIR_ITEMS = 3;  // 折叠后保留3项
  }

  async run() {
    // 1. 初始化忽略规则
    await this.initIgnore();

    // 2. 生成标头
    this.appendHeader();

    // 3. 递归遍历生成树和内容
    this.treeBuffer += '================================================================================\n';
    this.treeBuffer += '目录结构树\n';
    this.treeBuffer += '================================================================================\n';
    this.treeBuffer += `/\n`; // 根节点

    this.contentBuffer += '\n================================================================================\n';
    this.contentBuffer += '文件内容详情\n';
    this.contentBuffer += '================================================================================\n';

    console.log(chalk.blue('正在扫描文件并生成快照...'));
    await this.walk(this.rootDir, '');

    // 4. 写入文件
    await this.saveOutput();
  }

  async initIgnore() {
    // 添加策略默认忽略
    this.ig.add(this.strategy.defaultIgnores);
    // 添加策略特定忽略
    this.ig.add(this.strategy.getIgnoreList());
    
    // 尝试读取 .gitignore
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

  /**
   * 递归遍历
   * @param {string} currentDir 当前绝对路径
   * @param {string} prefix 树状图的前缀 (如 "│   ")
   */
  async walk(currentDir, prefix) {
    let entries;
    try {
      entries = await fs.readdir(currentDir, { withFileTypes: true });
    } catch (e) {
      this.treeBuffer += `${prefix}└── [读取失败: ${e.message}]\n`;
      return;
    }

    // 1. 过滤 (根据 ignore 规则)
    // ignore 库需要相对路径
    const filteredEntries = entries.filter(entry => {
      const absolutePath = path.join(currentDir, entry.name);
      const relativePath = path.relative(this.rootDir, absolutePath);
      // ignore 库对于目录通常需要以 / 结尾或者不需要，取决于配置，但通常直接传相对路径即可
      // 为了稳妥，如果是目录，我们在判断时可以尝试两种形式
      if (entry.isDirectory()) {
          return !this.ig.ignores(relativePath) && !this.ig.ignores(relativePath + '/');
      }
      return !this.ig.ignores(relativePath);
    });

    // 2. 排序：目录在前，文件在后，按名称排序
    filteredEntries.sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

    // 3. 检查是否需要裁剪 (目录项过多)
    const totalCount = filteredEntries.length;
    let displayEntries = filteredEntries;
    let isPruned = false;

    if (totalCount > this.MAX_DIR_ITEMS) {
      displayEntries = filteredEntries.slice(0, this.KEEP_DIR_ITEMS);
      isPruned = true;
    }

    // 4. 遍历处理
    for (let i = 0; i < displayEntries.length; i++) {
      const entry = displayEntries[i];
      const isLast = (i === displayEntries.length - 1) && !isPruned; // 如果被裁剪了，最后一个不是真最后
      const suffix = isLast ? '└── ' : '├── ';
      const nextPrefix = prefix + (isLast ? '    ' : '│   ');
      
      const absolutePath = path.join(currentDir, entry.name);
      
      // 写入树结构
      this.treeBuffer += `${prefix}${suffix}${entry.name}`;
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
          this.contentBuffer += `\n----------- [文件] ${relativePath} -----------\n`;
          this.contentBuffer += content + '\n';
        }
      }
    }

    // 5. 如果被裁剪，添加省略提示
    if (isPruned) {
      this.treeBuffer += `${prefix}└── ... (共 ${totalCount} 项，剩余 ${totalCount - this.KEEP_DIR_ITEMS} 项已省略)\n`;
    }
  }

  appendHeader() {
    const projectName = path.basename(this.rootDir);
    const parentDir = path.basename(path.dirname(this.rootDir));
    const date = new Date().toLocaleString();

    let header = '================================================================================\n';
    header += '项目扫描报告\n';
    header += '================================================================================\n';
    header += `项目名称: ${projectName}\n`;
    header += `上级目录: ${parentDir}\n`;
    header += `项目类型: ${this.strategy.type}\n`;
    header += `生成时间: ${date}\n`;
    header += `\n`;
    
    this.header = header;
  }

  async saveOutput() {
    const projectName = path.basename(this.rootDir);
    const parentDir = path.basename(path.dirname(this.rootDir));
    const typeName = this.strategy.type;

    // 构造输出文件名: output/项目名-项目类型-上级目录名.txt
    const fileName = `${projectName}-${typeName}-${parentDir}.txt`;
    const outputDir = path.join(process.cwd(), 'output');
    const outputPath = path.join(outputDir, fileName);

    const finalData = this.header + this.treeBuffer + this.contentBuffer;

    await fs.ensureDir(outputDir);
    await fs.writeFile(outputPath, finalData, 'utf-8');

    console.log(chalk.green(`\n✅ 扫描完成！`));
    console.log(chalk.white(`结果已保存至: `) + chalk.underline(outputPath));
  }
}