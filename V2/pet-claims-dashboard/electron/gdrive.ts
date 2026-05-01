import { app, shell } from 'electron'
import path from 'path'
import fs from 'fs'
import http from 'http'
import { URL } from 'url'
import { google } from 'googleapis'

const REDIRECT_PORT = 42813
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/oauth2callback`

function credsPath() { return path.join(app.getPath('userData'), 'gdrive-creds.json') }
function tokensPath() { return path.join(app.getPath('userData'), 'gdrive-tokens.json') }

function readJson(p: string): Record<string, string> | null {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch { return null }
}
function writeJson(p: string, data: object) {
  fs.writeFileSync(p, JSON.stringify(data, null, 2))
}

export function saveCreds(clientId: string, clientSecret: string) {
  writeJson(credsPath(), { clientId, clientSecret })
}

export function getStatus(): { hasCredentials: boolean; connected: boolean } {
  const creds = readJson(credsPath())
  const tokens = readJson(tokensPath())
  return {
    hasCredentials: !!(creds?.clientId),
    connected: !!(creds?.clientId && tokens?.access_token),
  }
}

export function disconnect() {
  try { fs.unlinkSync(tokensPath()) } catch {}
}

function makeClient() {
  const creds = readJson(credsPath())
  if (!creds) throw new Error('No credentials configured')
  return new google.auth.OAuth2(creds.clientId, creds.clientSecret, REDIRECT_URI)
}

export async function startAuth(): Promise<{ success: boolean; error?: string }> {
  let client: InstanceType<typeof google.auth.OAuth2>
  try { client = makeClient() } catch (e: unknown) {
    return { success: false, error: (e as Error).message }
  }

  const authUrl = client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/drive.readonly'],
    prompt: 'consent',
  })

  return new Promise((resolve) => {
    let resolved = false
    const done = (result: { success: boolean; error?: string }) => {
      if (!resolved) { resolved = true; resolve(result) }
    }

    const server = http.createServer(async (req, res) => {
      if (!req.url) { res.writeHead(404); res.end(); return }
      const url = new URL(req.url, `http://localhost:${REDIRECT_PORT}`)
      if (url.pathname !== '/oauth2callback') { res.writeHead(404); res.end(); return }

      const code = url.searchParams.get('code')
      const error = url.searchParams.get('error')
      res.writeHead(200, { 'Content-Type': 'text/html' })

      if (code) {
        res.end('<html><body style="font-family:sans-serif;padding:2rem;color:#1e293b"><h2>Connected to Google Drive</h2><p>You can close this tab and return to the app.</p></body></html>')
        server.close()
        try {
          const { tokens } = await client.getToken(code)
          writeJson(tokensPath(), tokens as Record<string, string>)
          done({ success: true })
        } catch (e: unknown) {
          done({ success: false, error: (e as Error).message })
        }
      } else {
        res.end(`<html><body style="font-family:sans-serif;padding:2rem;color:#1e293b"><h2>Authorization failed</h2><p>${error || 'Unknown error'}</p></body></html>`)
        server.close()
        done({ success: false, error: error || 'Authorization failed' })
      }
    })

    server.listen(REDIRECT_PORT, () => { shell.openExternal(authUrl) })
    server.on('error', (e) => done({ success: false, error: e.message }))
    setTimeout(() => { server.close(); done({ success: false, error: 'Timed out waiting for authorization' }) }, 300_000)
  })
}

export interface DriveFile {
  id: string
  name: string
  mimeType: string
  webViewLink?: string
  iconLink?: string
  modifiedTime?: string
  size?: string
}

export async function listFiles(query?: string): Promise<DriveFile[]> {
  const client = makeClient()
  const tokens = readJson(tokensPath())
  if (!tokens) throw new Error('Not connected to Google Drive')
  client.setCredentials(tokens)
  client.on('tokens', (newTokens) => writeJson(tokensPath(), { ...tokens, ...newTokens as Record<string, string> }))

  const drive = google.drive({ version: 'v3', auth: client })
  let q = "trashed = false and mimeType != 'application/vnd.google-apps.folder'"
  if (query?.trim()) {
    const safe = query.trim().replace(/'/g, "\\'")
    q += ` and name contains '${safe}'`
  }

  const res = await drive.files.list({
    q,
    pageSize: 50,
    fields: 'files(id,name,mimeType,webViewLink,iconLink,modifiedTime,size)',
    orderBy: 'modifiedTime desc',
  })

  return (res.data.files || []) as DriveFile[]
}

export function openFile(webViewLink: string) {
  shell.openExternal(webViewLink)
}

// ─── Folder config (persisted selection) ────────────────────────────────────

function folderConfigPath() { return path.join(app.getPath('userData'), 'gdrive-folder.json') }

export function saveFolderConfig(folderId: string, folderName: string) {
  writeJson(folderConfigPath(), { folderId, folderName })
}

export function getFolderConfig(): { folderId: string; folderName: string } | null {
  const cfg = readJson(folderConfigPath())
  if (cfg?.folderId) return cfg as unknown as { folderId: string; folderName: string }
  return null
}

// ─── Folder listing ──────────────────────────────────────────────────────────

function getAuthedDrive() {
  const client = makeClient()
  const tokens = readJson(tokensPath())
  if (!tokens) throw new Error('Not connected to Google Drive')
  client.setCredentials(tokens)
  client.on('tokens', (t) => writeJson(tokensPath(), { ...tokens, ...t as Record<string, string> }))
  return google.drive({ version: 'v3', auth: client })
}

export async function listFolders(query?: string): Promise<DriveFile[]> {
  const drive = getAuthedDrive()
  let q = "trashed = false and mimeType = 'application/vnd.google-apps.folder'"
  if (query?.trim()) {
    const safe = query.trim().replace(/'/g, "\\'")
    q += ` and name contains '${safe}'`
  }
  const res = await drive.files.list({
    q,
    pageSize: 30,
    fields: 'files(id,name,mimeType,modifiedTime)',
    orderBy: 'name',
  })
  return (res.data.files || []) as DriveFile[]
}

// ─── Files in folder (images + PDFs only) ───────────────────────────────────

export async function listFilesInFolder(folderId: string): Promise<DriveFile[]> {
  const drive = getAuthedDrive()
  const q = `'${folderId}' in parents and trashed = false and (mimeType contains 'image/')`
  const res = await drive.files.list({
    q,
    pageSize: 100,
    fields: 'files(id,name,mimeType,webViewLink,iconLink,modifiedTime,size)',
    orderBy: 'name',
  })
  return (res.data.files || []) as DriveFile[]
}

// ─── Download file as base64 data URL ───────────────────────────────────────

export async function downloadFileAsBase64(fileId: string): Promise<{ dataUrl: string; mimeType: string }> {
  const drive = getAuthedDrive()

  // Get mime type first
  const meta = await drive.files.get({ fileId, fields: 'mimeType,name' })
  const mimeType = meta.data.mimeType || 'application/octet-stream'

  // Download binary content
  const response = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'arraybuffer' }
  )
  const buffer = Buffer.from(response.data as ArrayBuffer)
  const dataUrl = `data:${mimeType};base64,${buffer.toString('base64')}`
  return { dataUrl, mimeType }
}
