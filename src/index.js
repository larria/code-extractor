import path from 'path';
import fs from 'fs-extra';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { Detector } from './core/Detector.js';
import { Scanner } from './core/Scanner.js';

/**
 * 主程序入口
 * @param {string} targetDir 
 * @param {string[]} extraExcludes 额外排除
 * @param {string[]} extraIncludes ✨ 额外包含 (白名单)
 */
export async function run(targetDir, extraExcludes = [], extraIncludes = []) {
  const absolutePath = path.resolve(targetDir);

  if (!fs.existsSync(absolutePath)) {
    console.error(chalk.red(`错误: 目录不存在 -> ${absolutePath}`));
    process.exit(1);
  }

  console.log(chalk.blue(`正在分析项目: ${absolutePath} ...`));
  
  if (extraExcludes.length > 0) {
    console.log(chalk.yellow(`已应用自定义排除规则: ${JSON.stringify(extraExcludes)}`));
  }
  // ✨ 提示包含规则
  if (extraIncludes.length > 0) {
    console.log(chalk.cyan(`已应用自定义包含规则 (白名单): ${JSON.stringify(extraIncludes)}`));
  }

  // 1. 自动检测类型
  const detector = new Detector();
  let strategy = await detector.detect(absolutePath);
  let projectType = strategy ? strategy.type : 'unknown';

  console.log(chalk.green(`自动识别结果: [ ${projectType.toUpperCase()} ]`));

  // 2. 用户确认交互
  const confirmResult = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'isCorrect',
      message: `检测到项目类型为 ${chalk.yellow(projectType)}，是否准确?`,
      default: true
    }
  ]);

  // 3. 如果用户不认可，手动选择
  if (!confirmResult.isCorrect) {
    const manualSelect = await inquirer.prompt([
      {
        type: 'list',
        name: 'type',
        message: '请手动选择项目类型:',
        choices: [
          'generic-web',
          'nodejs',
          'vue',
          'react',
          'flutter',
          'electron',
          'unknown'
        ]
      }
    ]);
    projectType = manualSelect.type;

    // 重新获取策略
    const allStrategies = detector.strategies;
    strategy = allStrategies.find(s => s.type === projectType);

    if (!strategy) {
      const { default: BaseStrategy } = await import('./strategies/BaseStrategy.js');
      strategy = new BaseStrategy();
      // 动态修改 type 属性用于展示
      Object.defineProperty(strategy, 'type', { get: () => projectType });
    }
  } else if (!strategy) {
    const { default: BaseStrategy } = await import('./strategies/BaseStrategy.js');
    strategy = new BaseStrategy();
    if (projectType === 'unknown') {
      Object.defineProperty(strategy, 'type', { get: () => 'unknown' });
    }
  }

  console.log(chalk.blue(`\n准备开始扫描 (${projectType})...`));

  // 4. 启动扫描 (传入 extraIncludes)
  const scanner = new Scanner(absolutePath, strategy, extraExcludes, extraIncludes);
  await scanner.run();
}