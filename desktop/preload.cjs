// Ponte segura entre a interface e o processo principal (sem Node no renderer).
const { contextBridge, ipcRenderer } = require("electron");

const call = (channel, ...args) => ipcRenderer.invoke(channel, ...args);

contextBridge.exposeInMainWorld("assistlab", {
  getState: () => call("state"),
  start: () => call("start"),
  stop: () => call("stop"),
  save: (settings) => call("save", settings),
  newToken: () => call("new-token"),
  openRadar: () => call("open-radar"),
  openBrowser: () => call("open-browser"),
  copyCfg: () => call("copy-cfg"),
  saveCfg: () => call("save-cfg"),
  openLogs: () => call("open-logs"),
  onState: (cb) => {
    const listener = (_e, s) => cb(s);
    ipcRenderer.on("state", listener);
    return () => ipcRenderer.removeListener("state", listener);
  },
});
