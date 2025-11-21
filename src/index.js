// src/index.js
import path from 'path';
import fs from 'fs-extra';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { Detector } from './core/Detector.js';
// 暂时导入一个空的 Scanner，下一步我们再具体实现它
import { Scanner } from './core/Scanner.js'; 

export async function run(targetDir) {
  const absolutePath = path.resolve(targetDir);
  
  if (!fs.existsSync(absolutePath)) {
    console.error(chalk.red(`错误: 目录不存在 -> ${absolutePath}`));
    process.exit(1);
  }

  console.log(chalk.blue(`正在分析项目: ${absolutePath} ...`));

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
          'android',
          'ios',
          'unknown' // 允许用户选未知，即全部扫描
        ]
      }
    ]);
    projectType = manualSelect.type;
    
    // 如果用户手动切换了类型，我们需要重新获取对应的策略实例
    // 简单起见，这里我们重新实例化一个 Detector 来查找对应的策略
    // (实际工程中可以将 strategy map 暴露出来直接获取)
    const allStrategies = detector.strategies;
    strategy = allStrategies.find(s => s.type === projectType);
    
    // 如果手动选的类型没有对应的策略类（比如 'unknown' 或尚未实现的），则使用 BaseStrategy 兜底
    if (!strategy) {
        const { default: BaseStrategy } = await import('./strategies/BaseStrategy.js');
        strategy = new BaseStrategy();
        // 强行覆盖 type 以便输出文件名正确
        Object.defineProperty(strategy, 'type', { get: () => projectType });
    }
  }

  console.log(chalk.blue(`\n准备开始扫描 (${projectType})...`));
  
  // 4. 启动扫描 (Scanner 部分将在下一步详细实现)
  const scanner = new Scanner(absolutePath, strategy);
  await scanner.run();
}