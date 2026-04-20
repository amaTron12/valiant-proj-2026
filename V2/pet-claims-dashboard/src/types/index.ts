export interface Claim {
  id: string
  client_name: string
  client_age: number
  client_gender: string
  location_of_residence: string

  pet_name: string
  species: string
  breed: string
  breed_type: string
  gender: string
  neutering_status: string
  color: string
  age: number
  weight: number

  place_of_loss: string
  diagnosis: string
  medications: string
  medicine_cost: number
  veterinary_services: string
  service_cost: number

  vet_clinic: string
  claim_type: string
  status: 'Open' | 'Pending' | 'Approved' | 'Denied'
  missing_documents: string
  stage: string

  total_amount_paid: number
  created_at: string
  updated_at: string
}

export type ClaimStatus = 'Open' | 'Pending' | 'Approved' | 'Denied'

export interface Window {
  api: {
    getClaims(): Promise<Claim[]>
    createClaim(data: Omit<Claim, 'id' | 'created_at' | 'updated_at'>): Promise<string>
    updateClaim(id: string, data: Omit<Claim, 'id' | 'created_at' | 'updated_at'>): Promise<void>
    deleteClaim(id: string): Promise<void>
  }
}

declare global {
  interface Window {
    api: {
      getClaims(): Promise<Claim[]>
      createClaim(data: Omit<Claim, 'id' | 'created_at' | 'updated_at'>): Promise<string>
      updateClaim(id: string, data: Omit<Claim, 'id' | 'created_at' | 'updated_at'>): Promise<void>
      deleteClaim(id: string): Promise<void>
    }
  }
}
