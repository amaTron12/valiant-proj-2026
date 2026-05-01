import React, { useEffect, useMemo, useState } from 'react'
import { X, Trash2, Loader2, Image as ImageIcon } from 'lucide-react'
import { Claim, ClaimImage } from '../types'
import { useAuth } from '../auth/AuthContext'
import { addAuditEvent } from '../audit/audit'

interface Props {
  claim: Claim
  onClose: () => void
}

export default function ClaimImagesModal({ claim, onClose }: Props) {
  const { user } = useAuth()
  const [images, setImages] = useState<ClaimImage[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [lightbox, setLightbox] = useState<ClaimImage | null>(null)

  useEffect(() => {
    let alive = true
    setLoading(true)
    window.api.getClaimImages(claim.id)
      .then(imgs => { if (alive) setImages(imgs) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [claim.id])

  const selectedIds = useMemo(() => Object.keys(selected).filter(id => selected[id]), [selected])

  async function deleteOne(img: ClaimImage) {
    setDeleting(true)
    try {
      await window.api.deleteClaimImage(img.id)
      if (user) addAuditEvent(user, { action: 'delete', entity: 'claim_image', entityId: img.id, details: { claimId: claim.id, filename: img.filename } })
      setImages(prev => prev.filter(i => i.id !== img.id))
      setSelected(prev => {
        if (!prev[img.id]) return prev
        const next = { ...prev }
        delete next[img.id]
        return next
      })
    } finally {
      setDeleting(false)
    }
  }

  async function deleteSelected() {
    if (selectedIds.length === 0) return
    setDeleting(true)
    try {
      await Promise.all(selectedIds.map(id => window.api.deleteClaimImage(id)))
      if (user) addAuditEvent(user, { action: 'delete_images', entity: 'claim_image', details: { claimId: claim.id, count: selectedIds.length } })
      setImages(prev => prev.filter(i => !selectedIds.includes(i.id)))
      setSelected({})
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-slate-800 truncate">Images · {claim.id}</h2>
              <p className="text-xs text-slate-400 truncate">{claim.client_name} · {claim.pet_name}</p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-6 py-3 border-b border-slate-100 flex items-center justify-between gap-3">
            <span className="text-xs text-slate-500">
              {loading ? 'Loading…' : `${images.length} image${images.length !== 1 ? 's' : ''}`}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelected(Object.fromEntries(images.map(i => [i.id, true])))}
                disabled={loading || images.length === 0}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                Select all
              </button>
              <button
                type="button"
                onClick={() => setSelected({})}
                disabled={loading || selectedIds.length === 0}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={deleteSelected}
                disabled={loading || deleting || selectedIds.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                Delete selected ({selectedIds.length})
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
              </div>
            ) : images.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-16 text-slate-400">
                <ImageIcon className="w-8 h-8" />
                <p className="text-sm">No images attached</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {images.map(img => {
                  const isSel = !!selected[img.id]
                  return (
                    <div key={img.id} className="group relative rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                      <div className="absolute top-2 left-2 z-10">
                        <label className="flex items-center gap-2 bg-white/90 backdrop-blur px-2 py-1 rounded-lg border border-slate-200">
                          <input
                            type="checkbox"
                            checked={isSel}
                            onChange={e => setSelected(prev => ({ ...prev, [img.id]: e.target.checked }))}
                          />
                          <span className="text-[11px] text-slate-600">Select</span>
                        </label>
                      </div>

                      <div className="aspect-square">
                        {img.dataUrl ? (
                          <img
                            src={img.dataUrl}
                            alt={img.filename}
                            className="w-full h-full object-cover cursor-pointer"
                            onClick={() => setLightbox(img)}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">Error</div>
                        )}
                      </div>

                      <div className="p-2 flex items-center justify-between gap-2 border-t border-slate-200 bg-white">
                        <p className="text-xs text-slate-600 truncate" title={img.filename}>{img.filename}</p>
                        <button
                          type="button"
                          onClick={() => deleteOne(img)}
                          disabled={deleting}
                          className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {lightbox && (
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-6" onClick={() => setLightbox(null)}>
          <button
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={lightbox.dataUrl ?? ''}
            alt={lightbox.filename}
            className="max-w-full max-h-full rounded-xl object-contain"
            onClick={e => e.stopPropagation()}
          />
          <p className="absolute bottom-4 text-white/70 text-sm">{lightbox.filename}</p>
        </div>
      )}
    </>
  )
}

