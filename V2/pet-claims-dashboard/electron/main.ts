import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import { fileURLToPath } from 'url'
import { initDB, getClaims, createClaim, updateClaim, deleteClaim, restoreClaim, addClaimImage, getClaimImages, deleteClaimImage, deleteClaimImagesByClaim, restoreClaimImage, getClients, createClient, updateClient, deleteClient, restoreClient, getPets, createPet, updatePet, deletePet, restorePet, addDriveLink, getDriveLinks, removeDriveLink, getDiagnosisTypes, createDiagnosisType, updateDiagnosisType, deleteDiagnosisType, restoreDiagnosisType, getDeletedDiagnosisTypes, getPremiumPlans, createPremiumPlan, updatePremiumPlan, deletePremiumPlan, restorePremiumPlan, getDeletedPremiumPlans } from './db'
import { saveCreds, getStatus, startAuth, disconnect, listFiles, openFile, listFolders, listFilesInFolder, downloadFileAsBase64, saveFolderConfig, getFolderConfig } from './gdrive'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function createWindow() {
  const preloadMjs = path.join(__dirname, 'preload.mjs')
  const preloadJs = path.join(__dirname, 'preload.js')
  const preloadPath = fs.existsSync(preloadMjs) ? preloadMjs : preloadJs

  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false
    },
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#f8fafc'
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(() => {
  initDB()

  ipcMain.handle('get-claims', () => getClaims())
  ipcMain.handle('create-claim', (_e, data) => createClaim(data))
  ipcMain.handle('update-claim', (_e, id, data) => updateClaim(id, data))
  ipcMain.handle('delete-claim', (_e, id) => {
    deleteClaim(id)
  })
  ipcMain.handle('restore-claim', (_e, id) => {
    console.log('[ipc] restore-claim', id)
    return restoreClaim(id)
  })

  ipcMain.handle('get-clients', () => getClients())
  ipcMain.handle('create-client', (_e, data) => createClient(data))
  ipcMain.handle('update-client', (_e, id, data, prevMatch) => updateClient(id, data, prevMatch))
  ipcMain.handle('delete-client', (_e, id) => deleteClient(id))
  ipcMain.handle('restore-client', (_e, id) => {
    console.log('[ipc] restore-client', id)
    return restoreClient(id)
  })

  ipcMain.handle('get-pets', () => {
    const pets = getPets()
    console.log('[ipc] get-pets ->', Array.isArray(pets) ? pets.length : 'n/a')
    return pets
  })
  ipcMain.handle('create-pet', (_e, data) => createPet(data))
  ipcMain.handle('update-pet', (_e, id, data, prevMatch) => updatePet(id, data, prevMatch))
  ipcMain.handle('delete-pet', (_e, id) => deletePet(id))
  ipcMain.handle('restore-pet', (_e, id) => {
    console.log('[ipc] restore-pet', id)
    return restorePet(id)
  })

  ipcMain.handle('get-claim-images', (_e, claimId: string) => {
    const images = getClaimImages(claimId)
    return images.map(img => {
      try {
        const buf = fs.readFileSync(img.filepath)
        const ext = path.extname(img.filename).toLowerCase().replace('.', '')
        const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : ext === 'gif' ? 'image/gif' : 'image/jpeg'
        return { ...img, dataUrl: `data:${mime};base64,${buf.toString('base64')}` }
      } catch {
        return { ...img, dataUrl: null }
      }
    })
  })

  ipcMain.handle('pick-claim-images', async (_e, claimId: string, docType: string | undefined) => {
    const win = BrowserWindow.getFocusedWindow()!
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'] }]
    })
    if (result.canceled || result.filePaths.length === 0) return []

    const imagesDir = path.join(app.getPath('userData'), 'claim-images', claimId)
    fs.mkdirSync(imagesDir, { recursive: true })

    return result.filePaths.map(srcPath => {
      const id = crypto.randomUUID()
      const filename = path.basename(srcPath)
      const destPath = path.join(imagesDir, `${id}-${filename}`)
      fs.copyFileSync(srcPath, destPath)
      addClaimImage({ id, claim_id: claimId, filename, filepath: destPath, doc_type: docType })
      const buf = fs.readFileSync(destPath)
      const ext = path.extname(filename).toLowerCase().replace('.', '')
      const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : ext === 'gif' ? 'image/gif' : 'image/jpeg'
      return { id, claim_id: claimId, filename, filepath: destPath, doc_type: docType, dataUrl: `data:${mime};base64,${buf.toString('base64')}` }
    })
  })

  ipcMain.handle('delete-claim-image', (_e, id: string) => {
    deleteClaimImage(id)
  })
  ipcMain.handle('restore-claim-image', (_e, id: string) => {
    console.log('[ipc] restore-claim-image', id)
    return restoreClaimImage(id)
  })

  ipcMain.handle('gdrive-list-folders', (_e, query?: string) => listFolders(query))
  ipcMain.handle('gdrive-list-folder-files', (_e, folderId: string) => listFilesInFolder(folderId))
  ipcMain.handle('gdrive-download-file', (_e, fileId: string) => downloadFileAsBase64(fileId))
  ipcMain.handle('gdrive-save-folder', (_e, folderId: string, folderName: string) => saveFolderConfig(folderId, folderName))
  ipcMain.handle('gdrive-get-folder', () => getFolderConfig())
  ipcMain.handle('gdrive-save-creds', (_e, clientId: string, clientSecret: string) => saveCreds(clientId, clientSecret))
  ipcMain.handle('gdrive-status', () => getStatus())
  ipcMain.handle('gdrive-connect', () => startAuth())
  ipcMain.handle('gdrive-disconnect', () => disconnect())
  ipcMain.handle('gdrive-list-files', (_e, query?: string) => listFiles(query))
  ipcMain.handle('gdrive-open-file', (_e, webViewLink: string) => openFile(webViewLink))
  ipcMain.handle('gdrive-link-file', (_e, data: { id: string; claim_id: string; file_id: string; file_name: string; web_view_link: string; mime_type?: string }) => addDriveLink(data))
  ipcMain.handle('gdrive-get-links', (_e, claimId: string) => getDriveLinks(claimId))
  ipcMain.handle('gdrive-unlink-file', (_e, id: string) => removeDriveLink(id))

  ipcMain.handle('get-diagnosis-types', () => getDiagnosisTypes())
  ipcMain.handle('get-deleted-diagnosis-types', () => getDeletedDiagnosisTypes())
  ipcMain.handle('create-diagnosis-type', (_e, data) => createDiagnosisType(data))
  ipcMain.handle('update-diagnosis-type', (_e, id, data) => updateDiagnosisType(id, data))
  ipcMain.handle('delete-diagnosis-type', (_e, id) => deleteDiagnosisType(id))
  ipcMain.handle('restore-diagnosis-type', (_e, id) => restoreDiagnosisType(id))

  ipcMain.handle('get-premium-plans', () => getPremiumPlans())
  ipcMain.handle('get-deleted-premium-plans', () => getDeletedPremiumPlans())
  ipcMain.handle('create-premium-plan', (_e, data) => createPremiumPlan(data))
  ipcMain.handle('update-premium-plan', (_e, id, data) => updatePremiumPlan(id, data))
  ipcMain.handle('delete-premium-plan', (_e, id) => deletePremiumPlan(id))
  ipcMain.handle('restore-premium-plan', (_e, id) => restorePremiumPlan(id))

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
