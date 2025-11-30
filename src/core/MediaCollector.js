import path from 'path';
import fs from 'fs-extra';
import sizeOf from 'image-size';

export class MediaCollector {
  constructor() {
    // 定义支持的媒体类型扩展名
    this.IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico', '.tiff']);
    this.AUDIO_EXTS = new Set(['.mp3', '.wav', '.aac', '.ogg', '.flac', '.m4a']);
    this.VIDEO_EXTS = new Set(['.mp4', '.avi', '.mov', '.mkv', '.webm', '.flv', '.wmv']);
  }

  /**
   * 判断是否为媒体文件
   * @param {string} filePath 
   */
  isMedia(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return this.IMAGE_EXTS.has(ext) || this.AUDIO_EXTS.has(ext) || this.VIDEO_EXTS.has(ext);
  }

  /**
   * 处理目录下的媒体文件
   * @param {string} dirPath 目录绝对路径
   * @param {string} relativeDirPath 目录相对路径（用于显示）
   * @param {fs.Dirent[]} entries 目录下的所有文件项
   * @returns {Promise<string|null>} 返回格式化后的媒体信息字符串，如果没有媒体文件则返回 null
   */
  async processDirectory(dirPath, relativeDirPath, entries) {
    // 1. 筛选媒体文件
    const mediaEntries = entries.filter(e => !e.isDirectory() && this.isMedia(path.join(dirPath, e.name)));

    if (mediaEntries.length === 0) return null;

    // 2. 收集信息 (并行处理)
    const mediaItems = await Promise.all(mediaEntries.map(async (entry) => {
      const filePath = path.join(dirPath, entry.name);
      const ext = path.extname(entry.name).toLowerCase();

      let stats;
      try {
        stats = await fs.stat(filePath);
      } catch (e) {
        return null; // 获取文件信息失败则跳过
      }

      const item = {
        name: entry.name,
        size: stats.size,
        type: 'Unknown',
        details: ''
      };

      if (this.IMAGE_EXTS.has(ext)) {
        item.type = 'Image';
        try {
          // 获取图片尺寸
          // image-size 在某些环境下直接传路径会报错，改用读取 buffer 方式
          // 只读取前 512KB，通常足够获取头部信息
          const bufferSize = Math.min(stats.size, 512 * 1024);
          const buffer = Buffer.alloc(bufferSize);
          const fd = await fs.open(filePath, 'r');
          try {
            await fs.read(fd, buffer, 0, bufferSize, 0);
          } finally {
            await fs.close(fd);
          }

          const dim = sizeOf(buffer);
          item.details = `${dim.width}x${dim.height}`;
        } catch (e) {
          item.details = '';
        }
      } else if (this.AUDIO_EXTS.has(ext)) {
        item.type = 'Audio';
      } else if (this.VIDEO_EXTS.has(ext)) {
        item.type = 'Video';
      }

      return item;
    }));

    // 过滤掉失败的项
    const validItems = mediaItems.filter(i => i !== null);
    if (validItems.length === 0) return null;

    // 3. 排序与截取
    // 按大小从大到小排序
    validItems.sort((a, b) => b.size - a.size);

    const totalCount = validItems.length;
    const limit = 200;
    const displayItems = validItems.slice(0, limit);
    const isTruncated = totalCount > limit;

    // 4. 生成输出字符串 (Markdown 格式)
    // 使用引用块 > 和 [CE] 标记
    let output = `\n> 📂 [CE] 目录: ${relativeDirPath || '/'}\n`;

    if (isTruncated) {
      output += `> (⚠️ 共 ${totalCount} 项资源，仅显示体积最大的前 ${limit} 项)\n`;
    } else {
      // 可选：如果不需要显示总数，可以省略这行，保持简洁
      // output += `> (共 ${totalCount} 项)\n`;
    }

    displayItems.forEach((item) => {
      const sizeStr = this.formatSize(item.size);
      
      // 格式: - filename.png [Image, 12KB, 500x500]
      let meta = `${item.type}, ${sizeStr}`;
      if (item.details) {
        meta += `, ${item.details}`;
      }
      
      output += `- ${item.name} [${meta}]\n`;
    });

    return output;
  }

  /**
   * 格式化文件大小
   * @param {number} bytes 
   */
  formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}