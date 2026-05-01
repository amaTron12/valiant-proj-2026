import React, { useMemo } from 'react'
import {
  BarChart, Bar, PieChart, Pie, Cell, Treemap,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts'
import { Claim } from '../types'

function Card({ title, sub, children, className = '' }: { title: string; sub?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-xl border border-slate-100 shadow-sm p-5 ${className}`}>
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
      {children}
    </div>
  )
}

const COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#f43f5e', '#8b5cf6', '#06b6d4', '#84cc16', '#ec4899']

function bucket(values: number[], buckets: { label: string; min: number; max: number }[]) {
  const counts: Record<string, number> = {}
  buckets.forEach(b => { counts[b.label] = 0 })
  values.forEach(v => {
    const b = buckets.find(b => v >= b.min && v < b.max)
    if (b) counts[b.label]++
  })
  return buckets.map(b => ({ name: b.label, value: counts[b.label] }))
}

const CustomTreemapContent = (props: any) => {
  const { x, y, width, height, name, value } = props
  if (width < 30 || height < 20) return null
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={props.fill} rx={4} />
      {width > 60 && <text x={x + width / 2} y={y + height / 2 - 4} textAnchor="middle" fill="#fff" fontSize={11} fontWeight={600}>{name}</text>}
      {width > 60 && <text x={x + width / 2} y={y + height / 2 + 10} textAnchor="middle" fill="rgba(255,255,255,0.8)" fontSize={10}>{value}</text>}
    </g>
  )
}

export default function PetAnalyticsPage({ claims }: { claims: Claim[] }) {
  const data = useMemo(() => {
    // Species
    const specMap: Record<string, number> = {}
    claims.forEach(c => { specMap[c.species] = (specMap[c.species] || 0) + 1 })
    const species = Object.entries(specMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)

    // Gender split
    const genderMap: Record<string, number> = {}
    claims.forEach(c => { genderMap[c.gender] = (genderMap[c.gender] || 0) + 1 })
    const gender = Object.entries(genderMap).map(([name, value]) => ({ name, value }))

    // Top breeds
    const breedMap: Record<string, number> = {}
    claims.forEach(c => { breedMap[c.breed] = (breedMap[c.breed] || 0) + 1 })
    const topBreeds = Object.entries(breedMap).sort((a, b) => b[1] - a[1]).slice(0, 10)
      .map(([name, value]) => ({ name, value }))

    // Breed treemap (all breeds for treemap)
    const breedTreemap = Object.entries(breedMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([name, value], i) => ({ name, value, fill: COLORS[i % COLORS.length] }))

    // Pet age distribution
    const petAges = claims.map(c => c.age).filter(v => v !== null && v !== undefined)
    const petAgeBuckets = [
      { label: 'Young (<1)', min: 0, max: 1 },
      { label: 'Adult (≥1)', min: 1, max: 7 },
      { label: 'Senior (≥7)', min: 7, max: 99 },
    ]
    const petAgeHist = bucket(petAges, petAgeBuckets)

    // Pet weight distribution
    const weights = claims.map(c => c.weight).filter(v => v !== null && v !== undefined)
    const weightBuckets = [
      { label: '0–5 kg',   min: 0,  max: 5  },
      { label: '5–10 kg',  min: 5,  max: 10 },
      { label: '10–20 kg', min: 10, max: 20 },
      { label: '20–30 kg', min: 20, max: 30 },
      { label: '30–40 kg', min: 30, max: 40 },
      { label: '40+ kg',   min: 40, max: 999 },
    ]
    const weightHist = bucket(weights, weightBuckets)

    // Client age distribution
    const clientAges = claims.map(c => c.client_age).filter(v => v)
    const clientAgeBuckets = [
      { label: '18–25', min: 18, max: 26 },
      { label: '26–35', min: 26, max: 36 },
      { label: '36–45', min: 36, max: 46 },
      { label: '46–55', min: 46, max: 56 },
      { label: '56–65', min: 56, max: 66 },
      { label: '65+',   min: 66, max: 999 },
    ]
    const clientAgeHist = bucket(clientAges, clientAgeBuckets)

    // Client gender
    const cGenderMap: Record<string, number> = {}
    claims.forEach(c => { cGenderMap[c.client_gender] = (cGenderMap[c.client_gender] || 0) + 1 })
    const clientGender = Object.entries(cGenderMap).map(([name, value]) => ({ name, value }))

    // Top locations
    const locMap: Record<string, number> = {}
    claims.forEach(c => { if (c.location_of_residence) locMap[c.location_of_residence] = (locMap[c.location_of_residence] || 0) + 1 })
    const topLocations = Object.entries(locMap).sort((a, b) => b[1] - a[1]).slice(0, 10)
      .map(([name, value]) => ({ name, value }))

    // Neutering status
    const neutMap: Record<string, number> = {}
    claims.forEach(c => { neutMap[c.neutering_status] = (neutMap[c.neutering_status] || 0) + 1 })
    const neutering = Object.entries(neutMap).map(([name, value]) => ({ name, value }))

    return { species, gender, topBreeds, breedTreemap, petAgeHist, weightHist, clientAgeHist, clientGender, topLocations, neutering }
  }, [claims])

  return (
    <div className="p-6 space-y-6">
      {/* Row 1: Species + Gender + Neutering */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Species Distribution" sub="Claims by animal type">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={data.species} cx="50%" cy="50%" outerRadius={75} paddingAngle={3} dataKey="value">
                {data.species.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Pet Gender" sub="Male vs Female">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={data.gender} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={4} dataKey="value">
                <Cell fill="#3b82f6" />
                <Cell fill="#ec4899" />
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Neutering Status" sub="Intact / Neutered / Spayed">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={data.neutering} cx="50%" cy="50%" outerRadius={75} paddingAngle={3} dataKey="value">
                {data.neutering.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Breed treemap */}
      <Card title="Breed Distribution" sub="Area size = number of claims">
        <ResponsiveContainer width="100%" height={200}>
          <Treemap data={data.breedTreemap} dataKey="value" aspectRatio={4 / 3} content={<CustomTreemapContent />}>
            <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
          </Treemap>
        </ResponsiveContainer>
      </Card>

      {/* Age + Weight distributions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Pet Age Distribution" sub="Years">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.petAgeHist}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
              <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} name="Pets" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Pet Weight Distribution" sub="Kilograms">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.weightHist}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
              <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} name="Pets" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Client demographics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Client Age Groups" sub="Years" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.clientAgeHist}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
              <Bar dataKey="value" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Clients" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Client Gender">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={data.clientGender} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={4} dataKey="value">
                <Cell fill="#3b82f6" />
                <Cell fill="#ec4899" />
                <Cell fill="#8b5cf6" />
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Locations */}
      <Card title="Top Client Locations" sub="Claims by city / area">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data.topLocations}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} />
            <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} />
            <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]} name="Claims">
              {data.topLocations.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  )
}
