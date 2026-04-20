"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("api", {
  getClaims: () => electron.ipcRenderer.invoke("get-claims"),
  createClaim: (data) => electron.ipcRenderer.invoke("create-claim", data),
  updateClaim: (id, data) => electron.ipcRenderer.invoke("update-claim", id, data),
  deleteClaim: (id) => electron.ipcRenderer.invoke("delete-claim", id)
});
