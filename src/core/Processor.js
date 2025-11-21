// src/core/Processor.js
import fs from 'fs-extra';
import { isBinaryFile } from 'isbinaryfile';

export class Processor {
  constructor() {
    this.MAX_SIZE = 100 * 1024; // 100KB
    this.PREVIEW_SIZE = 5 * 1024; // 5KB
    this.MAX_ARRAY_ITEMS = 3; // 超过100项只保留3项 (阈值设为100，但保留数设为3)
    this.MAX_OBJ_KEYS = 3;
    this.PRUNE_THRESHOLD = 100; // 触发裁剪的阈值
  }

  /**
   * 处理单个文件
   * @param {string} filePath 文件绝对路径
   * @returns {Promise<string|null>} 返回处理后的内容字符串，如果是二进制或无需输出则返回 null
   */
  async process(filePath) {
    try {
      // 1. 检查是否为二进制文件 (图片、编译产物等)
      // isbinaryfile 需要读取文件头，这是异步的
      const isBinary = await isBinaryFile(filePath);
      if (isBinary) {
        return null; // 二进制文件不输出内容
      }

      const stats = await fs.stat(filePath);
      const fileSize = stats.size;

      // 2. 小文件直接读取
      if (fileSize <= this.MAX_SIZE) {
        return await fs.readFile(filePath, 'utf-8');
      }

      // 3. 大文件处理 (> 100KB)
      return await this.handleLargeFile(filePath, fileSize);

    } catch (error) {
      return `[读取文件出错: ${error.message}]`;
    }
  }

  async handleLargeFile(filePath, fileSize) {
    // 尝试解析为 JSON
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const json = JSON.parse(content);
      // 如果成功解析，进行结构化裁剪
      const pruned = this.pruneJson(json);
      const jsonStr = JSON.stringify(pruned, null, 2);
      
      return `/* [大文件处理] 检测到结构化 JSON (原始大小: ${(fileSize/1024).toFixed(2)}KB)\n` +
             ` * 已按规则裁剪: 数组/对象超过 ${this.PRUNE_THRESHOLD} 项仅保留前 ${this.MAX_ARRAY_ITEMS} 项\n` +
             ` */\n` +
             jsonStr;
    } catch (e) {
      // 不是 JSON，执行文本截断
      return await this.truncateText(filePath, fileSize);
    }
  }

  /**
   * 递归裁剪 JSON 对象/数组
   */
  pruneJson(data, depth = 0) {
    if (depth > 10) return '... (层级过深已省略)'; // 防止死循环或过深

    if (Array.isArray(data)) {
      if (data.length > this.PRUNE_THRESHOLD) {
        const subset = data.slice(0, this.MAX_ARRAY_ITEMS).map(item => this.pruneJson(item, depth + 1));
        // 添加一个特殊标记项说明被裁剪了
        subset.push(`... (共 ${data.length} 项，剩余 ${data.length - this.MAX_ARRAY_ITEMS} 项已省略)`);
        return subset;
      }
      return data.map(item => this.pruneJson(item, depth + 1));
    } 
    
    if (data !== null && typeof data === 'object') {
      const keys = Object.keys(data);
      if (keys.length > this.PRUNE_THRESHOLD) {
        const newObj = {};
        keys.slice(0, this.MAX_OBJ_KEYS).forEach(key => {
          newObj[key] = this.pruneJson(data[key], depth + 1);
        });
        newObj['...'] = `(共 ${keys.length} 个属性，剩余 ${keys.length - this.MAX_OBJ_KEYS} 个已省略)`;
        return newObj;
      }
      const newObj = {};
      for (const key of keys) {
        newObj[key] = this.pruneJson(data[key], depth + 1);
      }
      return newObj;
    }

    return data;
  }

  async truncateText(filePath, fileSize) {
    const fd = await fs.open(filePath, 'r');
    try {
      const startBuf = Buffer.alloc(this.PREVIEW_SIZE);
      const endBuf = Buffer.alloc(this.PREVIEW_SIZE);

      // 读取开头 5KB
      const startRead = await fs.read(fd, startBuf, 0, this.PREVIEW_SIZE, 0);
      const startText = startBuf.toString('utf-8', 0, startRead.bytesRead);

      // 读取结尾 5KB
      const endPos = Math.max(0, fileSize - this.PREVIEW_SIZE);
      const endRead = await fs.read(fd, endBuf, 0, this.PREVIEW_SIZE, endPos);
      const endText = endBuf.toString('utf-8', 0, endRead.bytesRead);

      return `/* [大文件处理] 非结构化文本 (原始大小: ${(fileSize/1024).toFixed(2)}KB)\n` +
             ` * 已截取前 ${this.PREVIEW_SIZE/1024}KB 和后 ${this.PREVIEW_SIZE/1024}KB\n` +
             ` */\n\n` +
             startText + 
             `\n\n\n... (中间 ${(fileSize - 2 * this.PREVIEW_SIZE)/1024}KB 内容已省略) ...\n\n\n` + 
             endText;
    } finally {
      await fs.close(fd);
    }
  }
}