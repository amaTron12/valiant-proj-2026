import React from 'react'
import { Claim } from '../types'

interface Props {
  claims: Claim[]
}

interface CardProps {
  label: string
  value: number | string
  color: string
  bg: string
  border: string
}

function Card({ label, value, color, bg, border }: CardProps) {
  return (
    <div className={`rounded-xl border ${border} ${bg} p-5 flex flex-col gap-1`}>
      <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</span>
      <span className={`text-3xl font-bold ${color}`}>{value}</span>
    </div>
  )
}

export default function KPICards({ claims }: Props) {
  const total = claims.length
  const open = claims.filter(c => c.status === 'Open').length
  const pending = claims.filter(c => c.status === 'Pending').length
  const approved = claims.filter(c => c.status === 'Approved').length
  const denied = claims.filter(c => c.status === 'Denied').length
  const totalPaid = claims.reduce((sum, c) => sum + (c.total_amount_paid || 0), 0)

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
      <Card label="Total Claims" value={total} color="text-slate-800" bg="bg-white" border="border-slate-200" />
      <Card label="Open" value={open} color="text-blue-600" bg="bg-blue-50" border="border-blue-200" />
      <Card label="Pending" value={pending} color="text-yellow-600" bg="bg-yellow-50" border="border-yellow-200" />
      <Card label="Approved" value={approved} color="text-green-600" bg="bg-green-50" border="border-green-200" />
      <Card label="Denied" value={denied} color="text-red-600" bg="bg-red-50" border="border-red-200" />
      <Card
        label="Total Paid"
        value={`₱${totalPaid.toLocaleString()}`}
        color="text-violet-600"
        bg="bg-violet-50"
        border="border-violet-200"
      />
    </div>
  )
}
