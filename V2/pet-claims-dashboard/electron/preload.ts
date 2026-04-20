import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  getClaims: () => ipcRenderer.invoke('get-claims'),
  createClaim: (data: unknown) => ipcRenderer.invoke('create-claim', data),
  updateClaim: (id: string, data: unknown) => ipcRenderer.invoke('update-claim', id, data),
  deleteClaim: (id: string) => ipcRenderer.invoke('delete-claim', id)
})
