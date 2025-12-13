import path from 'path';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { detectProject, scanProject } from './core/Runner.js';

/**
 * 主程序入口
 * @param {string} targetDir 
 * @param {string[]} extraExcludes 额外排除
 * @param {string[]} extraIncludes ✨ 额外包含 (白名单)
 */
export async function run(targetDir, extraExcludes = [], extraIncludes = []) {
  try {
    const absolutePath = path.resolve(targetDir);
    console.log(chalk.blue(`正在分析项目: ${absolutePath} ...`));

    if (extraExcludes.length > 0) {
      console.log(chalk.yellow(`已应用自定义排除规则: ${JSON.stringify(extraExcludes)}`));
    }
    if (extraIncludes.length > 0) {
      console.log(chalk.cyan(`已应用自定义包含规则 (白名单): ${JSON.stringify(extraIncludes)}`));
    }

    // 1. 自动检测类型
    const { type: detectedType } = await detectProject(absolutePath);
    console.log(chalk.green(`自动识别结果: [ ${detectedType.toUpperCase()} ]`));

    // 2. 用户确认交互
    let projectType = detectedType;
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
    }

    console.log(chalk.blue(`\n准备开始扫描 (${projectType})...`));

    // 4. 启动扫描
    const outputPath = await scanProject(absolutePath, {
      type: projectType,
      extraExcludes,
      extraIncludes
    });

  } catch (err) {
    console.error(chalk.red(`执行失败: ${err.message}`));
    process.exit(1);
  }
}