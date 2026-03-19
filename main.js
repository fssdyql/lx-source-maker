const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const http = require('http');

let mainWindow;
let sandboxes = {};
let httpServer = null;
let activeSubRequests = new Map();

const QUALITY_WEIGHTS = { 'master': 70, 'atmos': 60, 'hires': 50, 'flac24bit': 40, 'flac': 30, '320k': 20, '128k': 10 };
const ALL_QUALITIES =['master', 'atmos', 'hires', 'flac24bit', 'flac', '320k', '128k'];

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1200, height: 800,
    webPreferences: { nodeIntegration: true, contextIsolation: false }
  });
  mainWindow.loadFile('index.html');
}

app.whenReady().then(createMainWindow);

ipcMain.on('run-script', (event, scriptId, scriptName, scriptCode) => {
  if (sandboxes[scriptId]) sandboxes[scriptId].window.destroy();
  
  let sb = new BrowserWindow({
    show: false, 
    webPreferences: { 
      preload: path.join(__dirname, 'sandbox-preload.js'), 
      contextIsolation: true,
      sandbox: false
    }
  });
  
  sandboxes[scriptId] = { window: sb, name: scriptName, sources: {} };
  
  sb.loadURL('about:blank').then(() => {
    sb.webContents.executeJavaScript(`window.__SCRIPT_ID__ = "${scriptId}";\n${scriptCode}`)
      .then(() => mainWindow.webContents.send('log', `✅ [${scriptName}] 挂载成功`, 'success'))
      .catch(err => mainWindow.webContents.send('log', `❌ [${scriptName}] 挂载失败: ${err.message}`, 'error'));
  });
});

ipcMain.on('destroy-script', (event, scriptId) => {
  if (sandboxes[scriptId]) {
    sandboxes[scriptId].window.destroy();
    delete sandboxes[scriptId];
  }
});

ipcMain.on('sandbox-event', (event, type, data) => {
  let scriptId = Object.keys(sandboxes).find(id => sandboxes[id].window && sandboxes[id].window.webContents === event.sender);
  if (scriptId && type === 'inited') {
    sandboxes[scriptId].sources = data.sources || {};
    mainWindow.webContents.send('update-scripts', getScriptsState());
    mainWindow.webContents.send('log', `✅ [${sandboxes[scriptId].name}] 初始化完毕，装载音源: ${Object.keys(data.sources).join(', ')}`, 'success');
  }
});

ipcMain.on('sandbox-response', (event, reqId, success, data) => {
  if (activeSubRequests.has(reqId)) {
    activeSubRequests.get(reqId)({ success, data });
    activeSubRequests.delete(reqId);
  }
});

function getScriptsState() {
  return Object.keys(sandboxes).map(id => ({ id, name: sandboxes[id].name, sources: Object.keys(sandboxes[id].sources) }));
}

function askPlugin(pluginId, source, action, info) {
  return new Promise((resolve) => {
    const subReqId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    
    let timeout = setTimeout(() => {
      if (activeSubRequests.has(subReqId)) {
        activeSubRequests.delete(subReqId);
        resolve({ success: false, data: '插件内部响应硬超时' });
      }
    }, 10000);

    activeSubRequests.set(subReqId, (res) => {
      clearTimeout(timeout);
      resolve(res);
    });
    
    if (sandboxes[pluginId] && sandboxes[pluginId].window && !sandboxes[pluginId].window.isDestroyed()) {
      sandboxes[pluginId].window.webContents.send('trigger-request', subReqId, { source, action, info });
    } else {
      clearTimeout(timeout);
      activeSubRequests.delete(subReqId);
      resolve({ success: false, data: '沙盒已丢失' });
    }
  });
}

ipcMain.on('start-server', (event, ip, port, mode) => {
  if (httpServer) httpServer.close();
  
  httpServer = http.createServer((req, res) => {
    const url = new URL(req.url, `http://${ip}`);
    
    if (url.pathname === '/source.js') {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      res.end(`/**
 * @name LX聚合源 (Maker)
 * @description LX Source Maker 动态聚合代理源
 * @version 0.1.1
 * @author Source Maker
 */
const { EVENT_NAMES, request, on, send } = globalThis.lx;
on(EVENT_NAMES.request, ({ source, action, info }) => {
  return new Promise((resolve, reject) => {
    request('http://${ip}:${port}/api', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source, action, info })
    }, (err, resp) => {
      if (err) return reject(err);
      if (resp.body && resp.body.success) resolve(resp.body.data);
      else reject(new Error(resp.body ? resp.body.msg : '请求失败'));
    });
  });
});
const q =['128k', '320k', 'flac', 'flac24bit', 'hires', 'atmos', 'master'];
send(EVENT_NAMES.inited, {
  status: true, openDevTools: false,
  sources: {
    kw: { name: 'KW (聚合)', type: 'music', actions:['musicUrl', 'lyric', 'pic'], qualitys: q },
    kg: { name: 'KG (聚合)', type: 'music', actions:['musicUrl', 'lyric', 'pic'], qualitys: q },
    tx: { name: 'TX (聚合)', type: 'music', actions:['musicUrl', 'lyric', 'pic'], qualitys: q },
    wy: { name: 'WY (聚合)', type: 'music', actions:['musicUrl', 'lyric', 'pic'], qualitys: q },
    mg: { name: 'MG (聚合)', type: 'music', actions:['musicUrl', 'lyric', 'pic'], qualitys: q }
  }
});`);
      return;
    }

    if (url.pathname === '/api' && req.method === 'POST') {
      let body = '';
      req.on('data', c => body += c.toString());
      req.on('end', () => {
        try {
          const { source, action, info } = JSON.parse(body);
          handleLxRequest(res, source, action, info, mode);
        } catch (e) {
          res.end(JSON.stringify({ success: false, msg: '参数错误' }));
        }
      });
      return;
    }
    
    res.end('LX Maker Server is Running...');
  });

  httpServer.listen(port, ip, () => {
    mainWindow.webContents.send('log', `🚀 服务器启动成功!`, 'success');
    mainWindow.webContents.send('log', `🔗 请在洛雪音乐中填入: http://${ip}:${port}/source.js`, 'warn');
  }).on('error', (err) => {
    mainWindow.webContents.send('log', `❌ 服务器启动失败: ${err.message}`, 'error');
  });
});

ipcMain.on('stop-server', () => {
  if (httpServer) { httpServer.close(); httpServer = null; mainWindow.webContents.send('log', `⏹ 服务器已关闭`, 'warn'); }
});

function handleLxRequest(res, source, action, info, mode) {
  let capablePlugins = Object.keys(sandboxes).filter(id => {
    const srcObj = sandboxes[id].sources[source];
    if (!srcObj) return false;
    if (Array.isArray(srcObj.actions)) return srcObj.actions.includes(action);
    return false;
  });

  let songName = info.musicInfo ? info.musicInfo.name : '未知歌曲';
  let targetQ = info.type || '-';
  let startT = Date.now();

  const sendResponse = (success, data, usedQuality, pluginName, msg = '') => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success, data, msg }));
    let latency = Date.now() - startT;
    mainWindow.webContents.send('request-record', { time: new Date().toLocaleTimeString(), songName, action, targetQ, usedQuality, source, pluginName, status: success ? '成功' : '失败', latency, data: success ? data : msg });
  };

  if (capablePlugins.length === 0) return sendResponse(false, null, '-', '-', '无可用源插件支持该平台操作');

  if (action !== 'musicUrl' || mode === 'speed') {
    let isResolved = false;
    let active = capablePlugins.length;
    let timer = setTimeout(() => {
      if (!isResolved) { isResolved = true; sendResponse(false, null, '-', '-', '所有插件响应均超时(3000ms)'); }
    }, 3000);

    for (let pid of capablePlugins) {
      askPlugin(pid, source, action, info).then(r => {
        if (isResolved) return;
        if (r.success && r.data) {
          isResolved = true; clearTimeout(timer);
          sendResponse(true, r.data, action==='musicUrl'?targetQ:'-', sandboxes[pid].name);
        } else {
          active--;
          if (active === 0) { isResolved = true; clearTimeout(timer); sendResponse(false, null, '-', '-', '全部插件请求失败'); }
        }
      });
    }
  } 
  else {
    let bestWeight = -1;
    let bestData = null;
    let bestQuality = '';
    let bestPlugin = '';
    let isResolved = false;
    let active = capablePlugins.length * ALL_QUALITIES.length;

    let timer = setTimeout(() => {
      if (!isResolved) {
        isResolved = true;
        if (bestData) sendResponse(true, bestData, bestQuality, bestPlugin);
        else sendResponse(false, null, '-', '-', '所有插件寻址超时且无有效音质');
      }
    }, 3000);

    for (let pid of capablePlugins) {
      for (let q of ALL_QUALITIES) {
        let reqInfo = { ...info, type: q };
        askPlugin(pid, source, action, reqInfo).then(r => {
          if (isResolved) return;
          if (r.success && r.data) {
            let w = QUALITY_WEIGHTS[q] || 0;
            if (w > bestWeight) {
              bestWeight = w; bestData = r.data; bestQuality = q; bestPlugin = sandboxes[pid].name;
            }
            if (q === 'master') {
              isResolved = true; clearTimeout(timer);
              sendResponse(true, r.data, q, sandboxes[pid].name);
            }
          }
          active--;
          if (active === 0 && !isResolved) {
            isResolved = true; clearTimeout(timer);
            if (bestData) sendResponse(true, bestData, bestQuality, bestPlugin);
            else sendResponse(false, null, '-', '-', '该平台所有音质均解析失败');
          }
        });
      }
    }
  }
}