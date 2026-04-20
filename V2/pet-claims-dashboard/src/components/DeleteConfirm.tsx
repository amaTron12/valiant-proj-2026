import React from 'react'
import { AlertTriangle } from 'lucide-react'
import { Claim } from '../types'

interface Props {
  claim: Claim
  onConfirm: () => void
  onCancel: () => void
}

export default function DeleteConfirm({ claim, onConfirm, onCancel }: Props) {
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-800">Delete Claim</h2>
            <p className="text-xs text-slate-500">{claim.id}</p>
          </div>
        </div>
        <p className="text-sm text-slate-600 mb-6">
          Delete claim for <strong>{claim.client_name}</strong> ({claim.pet_name})? This cannot be undone.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}
