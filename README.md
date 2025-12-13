# Code Extractor - 智能项目代码提取工具

**Code Extractor** 是一个基于 Node.js 开发的命令行工具，旨在将复杂的项目目录结构和核心代码内容“扁平化”输出为一个单一的 **Markdown 文件 (`.md`)**。

该工具主要用于**整理项目上下文**，方便开发者将整个项目的核心逻辑一次性投喂给 ChatGPT、Claude 等大语言模型 (LLM) 进行代码分析、重构或文档编写。

## ✨ 核心特性

*   **⚡️ Token 极致优化**：摒弃了繁琐的 ASCII 分隔符，全面采用 **Markdown 格式**。利用 LLM 对 Markdown 语法的天然理解能力，大幅减少 Token 占用（相比旧版减少约 20% 的无效字符）。
*   **🤖 LLM 友好型结构**：
    *   **[CE] 语义标记**：所有生成的元数据（目录树、文件名、统计信息）均带有 `[CE]` (Code Extractor) 标记，帮助 AI 精准区分“工具生成的描述”与“用户实际的代码”。
    *   **安全围栏 (Safe Fencing)**：使用 **4 个反引号** (` ``` `) 包裹代码块，完美解决扫描 Markdown 文件本身时出现的格式嵌套冲突问题。
*   **🧠 智能类型推断**：根据文件特征（如 `package.json` 依赖）自动识别 Vue, React, Node.js, Flutter 等项目类型，并应用特定的扫描策略。
*   **🌳 目录树生成**：生成清晰的目录结构树。针对大文件夹（>100 个文件），自动进行折叠处理。
*   **📄 智能内容提取**：
    *   自动忽略 `.gitignore` 规则及 `node_modules`, `dist` 等目录。
    *   **大文件处理**：超过 100KB 的文件自动截断（保留首尾），并以注释形式提示。
    *   **JSON 结构化裁剪**：保留超大 JSON 的层级结构，但自动裁剪过长的数组和对象，节省 Token。
    *   **二进制过滤**：自动跳过图片、编译产物等二进制文件。
*   **🖼️ 媒体资源统计**：自动识别项目中的媒体文件，统计尺寸与体积，不输出乱码内容。

## 🚀 支持的项目类型

目前支持的自动识别类型如下：

| 项目类型 | 关键词/特征 | 策略备注 |
| :--- | :--- | :--- |
| **Vue** | `vue`, `nuxt` | 自动忽略 `.nuxt`, `dist`, `dist-ssr` |
| **React** | `react`, `next` | 自动忽略 `.next`, `build`, `.docusaurus` |
| **Electron** | `electron` | 优先识别，支持包裹 Web 框架 |
| **Flutter** | `pubspec.yaml` | 自动忽略 `.dart_tool`, `android`, `ios` 等原生目录 |
| **Node.js** | 后端框架 (`express`等) | 区分纯后端与通用 Web |
| **Generic Web** | `index.html`, Webpack/Vite | 兜底策略 |

## 🛠 环境要求

*   **Node.js**: v14.0.0 或更高版本 (推荐 v16+)
*   **系统**: macOS / Linux / Windows

## 📦 安装

在项目根目录下执行安装依赖：

```bash
npm install
```

建立全局链接（推荐）：

```bash
npm link
```
之后即可在任意位置直接使用 `code-extractor` 命令。

## 💻 使用方法

### 基本用法

**注意**：必须指定项目路径（支持相对路径或绝对路径）。

```bash
# 扫描当前目录下的 demo 项目
code-extractor ./demo-project


# 或者使用绝对路径
code-extractor /Users/username/workspace/my-app
```

### 可视化 Web 界面 (✨ New)

通过图形化界面进行更直观的操作，支持拖拽识别路径和历史记录功能。

```bash
code-extractor ui
```
启动后浏览器将自动打开 `http://localhost:3000`。


### 进阶选项

#### 1. 添加额外排除规则 (`-e` / `--exclude`)
在默认策略和 `.gitignore` 的基础上，额外排除某些目录或文件。

```bash
# 排除所有测试文件和 logs 目录
code-extractor ./my-project -e "test" "*.spec.js" "logs"
```

#### 2. 强制包含/反向忽略 (`-i` / `--include`)
强制扫描被默认策略忽略的重要目录（如 Node 项目的 `bin` 目录）。

```bash
# 正常扫描，但强制包含 bin 目录（即使默认策略忽略了它）
code-extractor ./my-project -i "bin"
```

### 命令行参数说明

| 选项 | 简写 | 说明 |
| :--- | :--- | :--- |
| `--exclude` | `-e` | 额外排除的文件或目录模式 (空格分隔) |
| `--include` | `-i` | 强制包含的文件或目录模式 (优先级最高) |
| `--help` | `-h` | 显示帮助信息 |

## 📂 输出结果

扫描完成后，结果将保存在当前目录的 `output/` 文件夹下，文件名为：
`项目名-项目类型-上级目录名.md`

**输出文件片段示例：**

```markdown
# 🛡️ [CE] 项目扫描报告: my-app

- **项目类型**: vue
- **生成时间**: 2025-11-30 20:45:00

#### 🌳 [CE] 目录结构树

````text
/
├── bin/
│   └── cli.js
├── src/
│   ├── App.vue
│   └── main.js
...
````

#### 📚 [CE] 文件内容详情

#### 📝 [CE] 文件: bin/cli.js
````js
#!/usr/bin/env node
console.log('Hello World');
````

#### 📝 [CE] 文件: src/App.vue
````vue
<template>
  <div id="app">...</div>
</template>
````
```

## 🏗 二次开发指南

本项目采用**策略模式 (Strategy Pattern)** 构建。

### 目录结构

```text
src/
├── core/
│   ├── Scanner.js     # 核心扫描逻辑 (负责 Markdown 格式化)
│   ├── Processor.js   # 文件读取 (负责大文件裁剪、安全围栏计算)
│   └── ...
├── strategies/        # 策略模块 (定义默认忽略规则)
└── index.js           # 入口
```

### 提示词 (Prompting) 建议

将生成的 `.md` 文件发给 AI 时，可以配合以下提示词获得最佳效果：

> "这是一个项目的完整代码扫描报告。请忽略所有以 [CE] 开头的标记和结构信息，它们只是元数据。请重点分析 '文件内容详情' 部分的代码，并回答我关于 xxx 的问题。"

---
License: ISC