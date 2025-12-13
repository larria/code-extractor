#!/usr/bin/env node

import { Command } from 'commander';
import { run } from '../src/index.js';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

// 获取 package.json 版本号
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = fs.readJsonSync(path.join(__dirname, '../package.json'));

const program = new Command();

program
  .name('code-extractor')
  .description('自动识别项目类型并提取代码结构与内容')
  .version(pkg.version)

program
  .command('ui')
  .description('启动可视化 Web 界面')
  .action(async () => {
    try {
      await import('../src/server/app.js');
    } catch (err) {
      console.error('无法启动服务器:', err);
      process.exit(1);
    }
  });

program
  .command('scan', { isDefault: true })
  .argument('<dir>', '项目根目录路径 (例如: . 或 /path/to/project)')
  .option('-e, --exclude <patterns...>', '添加额外的排除规则 (支持多个，用空格分隔)', [])
  .option('-i, --include <patterns...>', '指定必须包含的文件或目录 (白名单模式，支持多个)', [])
  .action((dir, options) => {
    run(dir, options.exclude, options.include).catch(err => {
      console.error('运行出错:', err);
      process.exit(1);
    });
  });

// 增加在这个位置，增强一下错误提示的友好度 (可选)
program.showHelpAfterError('(错误: 必须指定要扫描的项目目录路径)');

program.parse();