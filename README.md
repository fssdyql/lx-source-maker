# lx-source-maker

[![Version](https://img.shields.io/badge/version-0.1.2-orange.svg)](https://github.com/fssdyql/lx-source-maker/releases)
[![Electron](https://img.shields.io/badge/framework-Electron-9456e0.svg)](https://www.electronjs.org/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

**lx-source-maker** 是一款功能强大的 **洛雪音乐 (LX Music) 自定义源聚合服务器**。它可以将多个独立的 `.js` 音源脚本导入，并在本地构建一个聚合代理服务器。你只需要在洛雪客户端填入**一个** URL，即可同时调用所有加载的脚本。

## 🌟 核心特性

-   **🔀 动态聚合**：支持同时拖入多个音源脚本，服务器会自动调度最优插件响应请求。
-   **🎭 双重运行模式**：
    -   🚀 **速度优先**：一旦有插件返回结果，立即响应客户端，适合日常流畅听歌。
    -   💎 **音质优先**：遍历所有插件及所有音质等级（Master > Hi-Res > FLAC...），确保获取到当前资源池中的最高规格音频。
-   **🛡 独立沙盒**：每个脚本都在独立的虚拟环境中运行，互不干扰，完全兼容 `lx.request`、`lx.utils.crypto` 等原生 API。
-   **📊 实时监控**：内置请求日志面板，清晰展示每次请求的命中插件、音质等级、响应延迟（ms）及状态。
-   **🕸 本地分发**：一键生成聚合脚本，支持局域网内多台设备（手机、电脑）共享同一个聚合源。

## 🚀 快速开始

### 使用构建版本 (推荐)
1. 前往 [Releases](https://github.com/fssdyql/lx-source-maker/releases) 页面。
2. 下载适用于 Windows 的压缩包。
3. 解压并运行 `lx-source-maker.exe`。

### 源码运行
```bash
# 安装依赖
npm install
# 启动程序
npm start
```

## 📖 使用指南

1.  **载入脚本**：将一个或多个 `.js` 自定义源文件直接拖入软件左侧列表。
2.  **配置参数**：
    *   **IP/端口**：默认 `127.0.0.1:3000`，如需手机访问请改为局域网 IP。
    *   **模式切换**：根据需求选择“速度优先”或“音质优先”。
3.  **启动服务**：点击右上角 `▶ 启动服务器`。
4.  **客户端配置**：
    *   复制软件显示的链接：`http://127.0.0.1:3000/source.js`。
    *   打开洛雪音乐 -> 设置 -> 自定义源 -> 导入。
5.  **开始享用**：在洛雪中播放歌曲，返回本软件查看实时请求命中情况。

## 🛠 技术实现
-   **后端**: Node.js HTTP Server 动态分发。
-   **前端**: Electron 渲染进程通信（IPC）。
-   **核心**: 模拟多实例 `BrowserWindow` 沙盒环境。

## ⚠️ 免责声明
本工具仅作为开发者调试及聚合脚本之用。工具本身不提供任何音源内容，所有音频解析逻辑均来源于用户自行加载的第三方脚本。请遵守相关法律法规，尊重版权。

## 🤝 贡献
如果你在使用中发现了 Bug 或者有新的功能建议，欢迎提交 Issue！

---

*如果您觉得这个工具有所帮助，请给仓库一个 **Star ⭐**！*
