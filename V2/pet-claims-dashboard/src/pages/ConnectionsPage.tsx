import React, { useState, useEffect, useRef } from 'react'
import {
  Cloud, ExternalLink, Shield, FileText, Search, Link2, Unlink, Loader2,
  CheckCircle2, ChevronDown, ChevronUp, X, FolderOpen, ScanText, AlertCircle,
  CheckCircle, RefreshCw,
} from 'lucide-react'
import { Claim, DriveFile, DriveScanResult } from '../types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mimeLabel(mime: string) {
  if (mime.includes('pdf')) return 'PDF'
  if (mime.includes('spreadsheet') || mime.includes('excel')) return 'Sheet'
  if (mime.includes('document') || mime.includes('word')) return 'Doc'
  if (mime.includes('image')) return 'Image'
  if (mime.includes('presentation')) return 'Slides'
  return 'File'
}

function formatDate(iso?: string) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
}

const FIELD_LABELS: Record<string, string> = {
  policy_number: 'Policy #',
  card_number: 'Card #',
  client_name: 'Client Name',
  pet_name: 'Pet Name',
  species: 'Species',
  breed: 'Breed',
  gender: 'Gender',
  age: 'Age',
  vet_clinic: 'Vet Clinic',
}

// ─── Claim picker modal ───────────────────────────────────────────────────────

function ClaimPicker({
  claims,
  onPick,
  onClose,
}: {
  claims: Claim[]
  onPick: (claim: Claim) => void
  onClose: () => void
}) {
  const [q, setQ] = useState('')
  const filtered = claims.filter(c =>
    c.client_name.toLowerCase().includes(q.toLowerCase()) ||
    c.id.toLowerCase().includes(q.toLowerCase()) ||
    (c.pet_name || '').toLowerCase().includes(q.toLowerCase())
  )
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-800">Attach to Claim</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
        </div>
        <input
          autoFocus
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search by client name, claim ID, or pet…"
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
          {filtered.length === 0 && <p className="text-sm text-slate-400 py-4 text-center">No matching claims</p>}
          {filtered.map(c => (
            <button
              key={c.id}
              onClick={() => onPick(c)}
              className="w-full text-left px-2 py-2.5 hover:bg-slate-50 transition-colors"
            >
              <p className="text-sm font-medium text-slate-800">{c.client_name}</p>
              <p className="text-xs text-slate-500">{c.id} · {c.pet_name} · {c.status}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Browse Files ─────────────────────────────────────────────────────────────

function DriveFileBrowser() {
  const [query, setQuery] = useState('')
  const [files, setFiles] = useState<DriveFile[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [claims, setClaims] = useState<Claim[]>([])
  const [pickerFile, setPickerFile] = useState<DriveFile | null>(null)
  const [linking, setLinking] = useState<string | null>(null)
  const [linked, setLinked] = useState<Set<string>>(new Set())
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    window.api.getClaims().then(setClaims)
    fetchFiles()
  }, [])

  async function fetchFiles(q?: string) {
    setLoading(true)
    setError('')
    try {
      setFiles(await window.api.gdriveListFiles(q))
    } catch (e: unknown) {
      setError((e as Error).message || 'Failed to load files')
    } finally {
      setLoading(false)
    }
  }

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value
    setQuery(v)
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => fetchFiles(v), 400)
  }

  async function handleLink(file: DriveFile, claim: Claim) {
    setPickerFile(null)
    setLinking(file.id)
    try {
      const id = `DL-${Math.random().toString(36).slice(2, 8).toUpperCase()}${Date.now().toString(36).toUpperCase()}`
      await window.api.gdriveLinkFile({
        id, claim_id: claim.id, file_id: file.id,
        file_name: file.name, web_view_link: file.webViewLink || '', mime_type: file.mimeType,
      })
      setLinked(prev => new Set(prev).add(file.id))
    } catch (e: unknown) {
      alert((e as Error).message)
    } finally {
      setLinking(null)
    }
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          value={query}
          onChange={handleSearchChange}
          placeholder="Search Drive files…"
          className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      {loading ? (
        <div className="flex items-center justify-center py-10 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading files…
        </div>
      ) : (
        <div className="divide-y divide-slate-100 rounded-lg border border-slate-100 overflow-hidden">
          {files.length === 0 && <p className="text-sm text-slate-400 py-8 text-center">No files found</p>}
          {files.map(file => (
            <div key={file.id} className="flex items-center gap-3 px-4 py-3 bg-white hover:bg-slate-50 transition-colors">
              {file.iconLink ? <img src={file.iconLink} alt="" className="w-5 h-5 flex-shrink-0" /> : <FileText className="w-5 h-5 text-slate-400 flex-shrink-0" />}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-800 truncate">{file.name}</p>
                <p className="text-xs text-slate-400">{mimeLabel(file.mimeType)} · {formatDate(file.modifiedTime)}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {linked.has(file.id) && (
                  <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Linked
                  </span>
                )}
                <button
                  onClick={() => setPickerFile(file)}
                  disabled={linking === file.id}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
                >
                  {linking === file.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Link2 className="w-3 h-3" />}
                  Attach to Claim
                </button>
                {file.webViewLink && (
                  <button
                    onClick={() => window.api.gdriveOpenFile(file.webViewLink!)}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 transition-colors"
                    title="Open in Drive"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {pickerFile && (
        <ClaimPicker claims={claims} onPick={(c) => handleLink(pickerFile, c)} onClose={() => setPickerFile(null)} />
      )}
    </div>
  )
}

// ─── Folder Scanner ───────────────────────────────────────────────────────────

interface ScanState {
  status: 'idle' | 'downloading' | 'scanning' | 'done' | 'error'
  result?: DriveScanResult
  error?: string
  dataUrl?: string
}

function ScanResultBadges({ result }: { result: DriveScanResult }) {
  return (
    <div className="mt-2 space-y-1.5">
      {result.foundFields.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {result.foundFields.map(f => (
            <span key={f} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-green-100 text-green-700">
              <CheckCircle className="w-3 h-3" />
              {FIELD_LABELS[f] ?? f}
              {(result as Record<string, unknown>)[f] !== undefined && (
                <span className="font-normal opacity-80">: {String((result as Record<string, unknown>)[f])}</span>
              )}
            </span>
          ))}
        </div>
      )}
      {result.missingFields.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {result.missingFields.map(f => (
            <span key={f} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-500">
              <AlertCircle className="w-3 h-3" />
              {FIELD_LABELS[f] ?? f}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function FolderScanner() {
  const [folderSearch, setFolderSearch] = useState('')
  const [folders, setFolders] = useState<DriveFile[]>([])
  const [showFolderDropdown, setShowFolderDropdown] = useState(false)
  const [selectedFolder, setSelectedFolder] = useState<{ folderId: string; folderName: string } | null>(null)
  const [loadingFolders, setLoadingFolders] = useState(false)
  const [files, setFiles] = useState<DriveFile[]>([])
  const [loadingFiles, setLoadingFiles] = useState(false)
  const [filesError, setFilesError] = useState('')
  const [scanStates, setScanStates] = useState<Record<string, ScanState>>({})
  const [claims, setClaims] = useState<Claim[]>([])
  const [pickerFileId, setPickerFileId] = useState<string | null>(null)
  const [linking, setLinking] = useState<string | null>(null)
  const [linked, setLinked] = useState<Set<string>>(new Set())
  const folderTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    window.api.getClaims().then(setClaims)
    // Restore saved folder
    window.api.gdriveGetFolder().then(cfg => {
      if (cfg) setSelectedFolder(cfg)
    })
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowFolderDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function handleFolderSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value
    setFolderSearch(v)
    setShowFolderDropdown(true)
    if (folderTimeout.current) clearTimeout(folderTimeout.current)
    folderTimeout.current = setTimeout(() => fetchFolders(v), 350)
  }

  async function fetchFolders(q?: string) {
    setLoadingFolders(true)
    try {
      setFolders(await window.api.gdriveListFolders(q))
    } catch {}
    finally { setLoadingFolders(false) }
  }

  async function selectFolder(folder: DriveFile) {
    const cfg = { folderId: folder.id, folderName: folder.name }
    setSelectedFolder(cfg)
    setShowFolderDropdown(false)
    setFolderSearch('')
    await window.api.gdriveSaveFolder(folder.id, folder.name)
    loadFolderFiles(folder.id)
  }

  async function loadFolderFiles(folderId: string) {
    setLoadingFiles(true)
    setFilesError('')
    setFiles([])
    setScanStates({})
    try {
      const result = await window.api.gdriveListFolderFiles(folderId)
      setFiles(result)
      if (result.length === 0) setFilesError('No image files found in this folder.')
    } catch (e: unknown) {
      setFilesError((e as Error).message || 'Failed to load folder contents')
    } finally {
      setLoadingFiles(false)
    }
  }

  function setScan(fileId: string, state: ScanState) {
    setScanStates(prev => ({ ...prev, [fileId]: state }))
  }

  async function handleScan(file: DriveFile) {
    setScan(file.id, { status: 'downloading' })
    try {
      const { dataUrl } = await window.api.gdriveDownloadFile(file.id)
      setScan(file.id, { status: 'scanning', dataUrl })
      // Lazy-load OCR
      const { scanDriveImage } = await import('../ocr/ocr')
      const result = await scanDriveImage(dataUrl, { mimeType: file.mimeType, name: file.name })
      setScan(file.id, { status: 'done', result, dataUrl })
    } catch (e: unknown) {
      setScan(file.id, { status: 'error', error: (e as Error).message })
    }
  }

  async function handleScanAll() {
    const unscanned = files.filter(f => !scanStates[f.id] || scanStates[f.id].status === 'idle')
    for (const file of unscanned) {
      await handleScan(file)
    }
  }

  async function handleLink(fileId: string, fileName: string, webViewLink: string, mimeType: string, claim: Claim) {
    setPickerFileId(null)
    setLinking(fileId)
    try {
      const id = `DL-${Math.random().toString(36).slice(2, 8).toUpperCase()}${Date.now().toString(36).toUpperCase()}`
      await window.api.gdriveLinkFile({ id, claim_id: claim.id, file_id: fileId, file_name: fileName, web_view_link: webViewLink, mime_type: mimeType })
      setLinked(prev => new Set(prev).add(fileId))
    } catch (e: unknown) {
      alert((e as Error).message)
    } finally {
      setLinking(null)
    }
  }

  const pickerFile = pickerFileId ? files.find(f => f.id === pickerFileId) : null

  return (
    <div className="space-y-4">

      {/* Folder Picker */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-slate-600">Drive Folder to Scan</label>
        <div ref={dropdownRef} className="relative">
          <div className="relative">
            <FolderOpen className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={folderSearch}
              onChange={handleFolderSearchChange}
              onFocus={() => { setShowFolderDropdown(true); fetchFolders(folderSearch) }}
              placeholder="Search for a folder in Drive…"
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {loadingFolders && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-slate-400" />}
          </div>

          {showFolderDropdown && folders.length > 0 && (
            <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden max-h-52 overflow-y-auto">
              {folders.map(f => (
                <button
                  key={f.id}
                  onClick={() => selectFolder(f)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left hover:bg-slate-50 transition-colors"
                >
                  <FolderOpen className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                  <span className="truncate">{f.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {selectedFolder && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700 flex-1 min-w-0">
              <FolderOpen className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate font-medium">{selectedFolder.folderName}</span>
            </div>
            <button
              onClick={() => loadFolderFiles(selectedFolder.folderId)}
              disabled={loadingFiles}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingFiles ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        )}
      </div>

      {/* File list */}
      {loadingFiles && (
        <div className="flex items-center justify-center py-10 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading folder…
        </div>
      )}

      {filesError && !loadingFiles && (
        <p className="text-sm text-slate-400 text-center py-4">{filesError}</p>
      )}

      {!loadingFiles && files.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">{files.length} image{files.length !== 1 ? 's' : ''} in folder</p>
            <button
              onClick={handleScanAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition-colors"
            >
              <ScanText className="w-3.5 h-3.5" /> Scan All
            </button>
          </div>

          <div className="space-y-2">
            {files.map(file => {
              const scan = scanStates[file.id]
              const isLinked = linked.has(file.id)
              const isBusy = scan?.status === 'downloading' || scan?.status === 'scanning'

              return (
                <div key={file.id} className="bg-white border border-slate-100 rounded-xl p-4 space-y-2">
                  {/* Header row */}
                  <div className="flex items-start gap-3">
                    {/* Thumbnail if available */}
                    {scan?.dataUrl ? (
                      <img
                        src={scan.dataUrl}
                        alt={file.name}
                        className="w-12 h-12 rounded-lg object-cover border border-slate-100 flex-shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center flex-shrink-0">
                        <FileText className="w-5 h-5 text-slate-400" />
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{file.name}</p>
                      <p className="text-xs text-slate-400">{mimeLabel(file.mimeType)} · {formatDate(file.modifiedTime)}</p>

                      {/* Scan status inline */}
                      {scan?.status === 'downloading' && (
                        <p className="text-xs text-blue-500 flex items-center gap-1 mt-0.5">
                          <Loader2 className="w-3 h-3 animate-spin" /> Downloading…
                        </p>
                      )}
                      {scan?.status === 'scanning' && (
                        <p className="text-xs text-blue-500 flex items-center gap-1 mt-0.5">
                          <Loader2 className="w-3 h-3 animate-spin" /> Running OCR…
                        </p>
                      )}
                      {scan?.status === 'error' && (
                        <p className="text-xs text-red-500 mt-0.5">{scan.error}</p>
                      )}
                      {scan?.status === 'done' && scan.result && (
                        <p className="text-xs text-slate-500 mt-0.5">
                          <span className="text-green-600 font-medium">{scan.result.foundFields.length} field{scan.result.foundFields.length !== 1 ? 's' : ''} found</span>
                          {scan.result.missingFields.length > 0 && (
                            <span className="text-slate-400"> · {scan.result.missingFields.length} missing</span>
                          )}
                        </p>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {isLinked && (
                        <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Linked
                        </span>
                      )}
                      <button
                        onClick={() => handleScan(file)}
                        disabled={isBusy}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                      >
                        {isBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <ScanText className="w-3 h-3" />}
                        {scan?.status === 'done' ? 'Re-scan' : 'Scan'}
                      </button>
                      <button
                        onClick={() => setPickerFileId(file.id)}
                        disabled={linking === file.id}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                      >
                        {linking === file.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Link2 className="w-3 h-3" />}
                        Attach
                      </button>
                      {file.webViewLink && (
                        <button
                          onClick={() => window.api.gdriveOpenFile(file.webViewLink!)}
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100"
                          title="Open in Drive"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Scan results */}
                  {scan?.status === 'done' && scan.result && (
                    <ScanResultBadges result={scan.result} />
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Claim picker modal */}
      {pickerFile && (
        <ClaimPicker
          claims={claims}
          onPick={(claim) => handleLink(pickerFile.id, pickerFile.name, pickerFile.webViewLink || '', pickerFile.mimeType, claim)}
          onClose={() => setPickerFileId(null)}
        />
      )}
    </div>
  )
}

// ─── Google Drive Card ────────────────────────────────────────────────────────

type DriveView = 'browse' | 'scan'

function GoogleDriveCard() {
  const [status, setStatus] = useState<{ hasCredentials: boolean; connected: boolean } | null>(null)
  const [showCreds, setShowCreds] = useState(false)
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [savingCreds, setSavingCreds] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [connectError, setConnectError] = useState('')
  const [view, setView] = useState<DriveView>('scan')

  useEffect(() => { refreshStatus() }, [])

  async function refreshStatus() {
    const s = await window.api.gdriveStatus()
    setStatus(s)
    if (!s.hasCredentials) setShowCreds(true)
  }

  async function handleSaveCreds() {
    if (!clientId.trim() || !clientSecret.trim()) return
    setSavingCreds(true)
    await window.api.gdriveSaveCreds(clientId.trim(), clientSecret.trim())
    await refreshStatus()
    setSavingCreds(false)
    setShowCreds(false)
  }

  async function handleConnect() {
    setConnecting(true)
    setConnectError('')
    const result = await window.api.gdriveConnect()
    await refreshStatus()
    setConnecting(false)
    if (!result.success) setConnectError(result.error || 'Authorization failed')
  }

  async function handleDisconnect() {
    await window.api.gdriveDisconnect()
    await refreshStatus()
  }

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Cloud className="w-4 h-4 text-blue-500" />
            <h2 className="font-semibold text-slate-800">Google Drive</h2>
          </div>
          <p className="text-sm text-slate-500 mt-1">Scan a Drive folder with OCR and match documents to claims.</p>
        </div>
        <span className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${status?.connected ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
          {status?.connected ? 'Connected' : 'Not connected'}
        </span>
      </div>

      {/* Credentials */}
      <div>
        <button
          onClick={() => setShowCreds(v => !v)}
          className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700"
        >
          {showCreds ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {status?.hasCredentials ? 'OAuth credentials (saved)' : 'Step 1: Enter OAuth credentials'}
        </button>
        {showCreds && (
          <div className="mt-2 space-y-2 p-3 bg-slate-50 rounded-lg">
            <p className="text-xs text-slate-500">
              Create a <strong>Desktop app</strong> OAuth 2.0 client in{' '}
              <button onClick={() => window.api.gdriveOpenFile('https://console.cloud.google.com/apis/credentials')} className="text-blue-600 underline">Google Cloud Console</button>
              , enable the Drive API, then paste below.
            </p>
            <input value={clientId} onChange={e => setClientId(e.target.value)} placeholder="Client ID"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <input value={clientSecret} onChange={e => setClientSecret(e.target.value)} placeholder="Client Secret" type="password"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <button onClick={handleSaveCreds} disabled={savingCreds || !clientId.trim() || !clientSecret.trim()}
              className="px-3 py-1.5 rounded-lg bg-slate-700 text-white text-xs font-medium hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed">
              {savingCreds ? 'Saving…' : 'Save credentials'}
            </button>
          </div>
        )}
      </div>

      {/* Connect / Disconnect */}
      {status?.hasCredentials && (
        <div className="flex items-center gap-2">
          {status.connected ? (
            <button onClick={handleDisconnect}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50">
              <Unlink className="w-3.5 h-3.5" /> Disconnect
            </button>
          ) : (
            <button onClick={handleConnect} disabled={connecting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 disabled:opacity-50">
              {connecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Cloud className="w-3.5 h-3.5" />}
              {connecting ? 'Waiting for browser…' : 'Connect Google Drive'}
            </button>
          )}
          {connectError && <p className="text-xs text-red-500">{connectError}</p>}
        </div>
      )}

      {/* View tabs + content */}
      {status?.connected && (
        <>
          <div className="flex gap-1 border-b border-slate-100 -mx-5 px-5">
            {([['scan', 'Folder Scanner'], ['browse', 'Browse Files']] as [DriveView, string][]).map(([v, label]) => (
              <button key={v} onClick={() => setView(v)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                  view === v ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}>
                {label}
              </button>
            ))}
          </div>

          <div className="pt-1">
            {view === 'scan' ? <FolderScanner /> : <DriveFileBrowser />}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ConnectionsPage() {
  return (
    <div className="p-6 space-y-4">
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm px-5 py-4">
        <h1 className="text-lg font-semibold text-slate-800">Connections</h1>
        <p className="text-sm text-slate-500 mt-1">Connect to external apps to access and attach documents to claims.</p>
      </div>

      <div className="space-y-4">
        <GoogleDriveCard />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { icon: <Shield className="w-4 h-4 text-slate-400" />, title: 'I-insure', desc: 'Sync policy and coverage information.' },
            { icon: <FileText className="w-4 h-4 text-slate-400" />, title: 'I-claims', desc: 'Sync claims status and notes.' },
          ].map(c => (
            <div key={c.title} className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-center gap-2">
                {c.icon}
                <h2 className="font-semibold text-slate-800">{c.title}</h2>
                <span className="ml-auto px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">Coming soon</span>
              </div>
              <p className="text-sm text-slate-500 mt-2">{c.desc}</p>

              <div className="mt-4 flex items-center justify-end">
                <button
                  type="button"
                  disabled
                  title="Demo only (not wired up yet)"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium opacity-60 cursor-not-allowed"
                >
                  <Link2 className="w-3.5 h-3.5" />
                  Connect
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
