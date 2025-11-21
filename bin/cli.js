#!/usr/bin/env node

import { Command } from 'commander';
import { run } from '../src/index.js';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

// 获取 package.json 版本号 (ESM 模式下读取 json 的一种方式)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = fs.readJsonSync(path.join(__dirname, '../package.json'));

const program = new Command();

program
  .name('code-extractor')
  .description('自动识别项目类型并提取代码结构与内容')
  .version(pkg.version)
  .argument('[dir]', '项目根目录路径', '.') // 默认为当前目录
  .action((dir) => {
    run(dir).catch(err => {
      console.error('运行出错:', err);
      process.exit(1);
    });
  });

program.parse();