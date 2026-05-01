export interface ClaimMisc {
  imei_number?: string
  airline?: string
  aon_event?: string
  travel_sum_insured?: number
  catastrophe_code?: string
  claimant_count?: number
  last_diary_entry?: string
  diary_description?: string
}

export interface Claim {
  id: string
  policy_number: string
  card_number: string
  client_name: string
  client_age: number
  client_gender: string
  location_of_residence: string

  pet_name: string
  pedigree_number: string
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
  deleted_at?: string | null

  // Policy & Branch
  line_of_business?: string
  branch_code?: string
  branch?: string
  external_policy?: string
  date_issued?: string
  date_of_loss?: string
  date_reported?: string
  date_registered?: string
  inception_date?: string
  expiry_date?: string
  local_global?: string
  country?: string
  original_currency?: string
  year?: number

  // People & Agents
  client_no?: string
  master_client?: string
  claimant?: string
  payee?: string
  handler_code?: string
  handler_name?: string
  agent_code?: string
  agent_name?: string
  sub_agent_code?: string
  adj_provider_code?: string
  adj_provider_name?: string
  birthday?: string

  // Financials
  basic_premium?: number
  sum_insured?: number
  net_reserve?: number
  ri_reserve?: number
  total_reserve?: number
  insured_net_payment?: number
  adj_provider_net_payment?: number
  tp_claim_payment?: number
  ri_payment?: number
  total_payment?: number
  total_net?: number
  total_ri?: number
  total_claim?: number
  date_first_payment?: string
  date_last_payment?: string

  // Filterable extras
  claim_reason?: string
  catastrophe?: string
  narrative?: string

  // Misc JSON blob
  misc?: string
}

export interface Client {
  id: string
  name: string
  card_number: string
  age: number
  gender: string
  location: string
  created_at: string
  updated_at: string
  deleted_at?: string | null
}

export interface Pet {
  id: string
  client_id?: string | null
  name: string
  pedigree_number: string
  species: string
  breed: string
  breed_type: string
  gender: string
  neutering_status: string
  color: string
  age: number
  weight: number
  created_at: string
  updated_at: string
  deleted_at?: string | null
}

export type ClaimStatus = 'Open' | 'Pending' | 'Approved' | 'Denied'

export interface ClaimImage {
  id: string
  claim_id: string
  filename: string
  filepath: string
  doc_type?: 'Prescription' | 'Birthcertificate/Pedigree' | 'Client Health Card ID' | 'Other'
  created_at: string
  deleted_at?: string | null
  dataUrl?: string | null
}

export interface Window {
  api: {
    getClaims(): Promise<Claim[]>
    createClaim(data: Omit<Claim, 'id' | 'created_at' | 'updated_at'> & Partial<Pick<Claim, 'created_at' | 'updated_at'>>): Promise<string>
    updateClaim(id: string, data: Partial<Omit<Claim, 'id' | 'created_at' | 'updated_at'>>): Promise<void>
    deleteClaim(id: string): Promise<void>
    restoreClaim(id: string): Promise<void>
    getClients(): Promise<Client[]>
    createClient(data: Omit<Client, 'id' | 'created_at' | 'updated_at'>): Promise<string>
    updateClient(
      id: string,
      data: Omit<Client, 'id' | 'created_at' | 'updated_at'>,
      prevMatch?: Pick<Client, 'name' | 'location'>
    ): Promise<void>
    deleteClient(id: string): Promise<void>
    restoreClient(id: string): Promise<void>
    getPets(): Promise<Pet[]>
    createPet(data: Omit<Pet, 'id' | 'created_at' | 'updated_at'>): Promise<string>
    updatePet(
      id: string,
      data: Omit<Pet, 'id' | 'created_at' | 'updated_at'>,
      prevMatch?: Pick<Pet, 'name' | 'species' | 'breed'>
    ): Promise<void>
    deletePet(id: string): Promise<void>
    restorePet(id: string): Promise<void>
    getClaimImages(claimId: string): Promise<ClaimImage[]>
    pickClaimImages(claimId: string, docType: ClaimImage['doc_type']): Promise<ClaimImage[]>
    deleteClaimImage(id: string): Promise<void>
    restoreClaimImage(id: string): Promise<void>
    gdriveSaveCreds(clientId: string, clientSecret: string): Promise<void>
    gdriveStatus(): Promise<{ hasCredentials: boolean; connected: boolean }>
    gdriveConnect(): Promise<{ success: boolean; error?: string }>
    gdriveDisconnect(): Promise<void>
    gdriveListFiles(query?: string): Promise<DriveFile[]>
    gdriveOpenFile(webViewLink: string): Promise<void>
    gdriveLinkFile(data: { id: string; claim_id: string; file_id: string; file_name: string; web_view_link: string; mime_type?: string }): Promise<void>
    gdriveGetLinks(claimId: string): Promise<DriveLink[]>
    gdriveUnlinkFile(id: string): Promise<void>
    gdriveListFolders(query?: string): Promise<DriveFile[]>
    gdriveListFolderFiles(folderId: string): Promise<DriveFile[]>
    gdriveDownloadFile(fileId: string): Promise<{ dataUrl: string; mimeType: string }>
    gdriveSaveFolder(folderId: string, folderName: string): Promise<void>
    gdriveGetFolder(): Promise<{ folderId: string; folderName: string } | null>
    getDiagnosisTypes(): Promise<DiagnosisType[]>
    getDeletedDiagnosisTypes(): Promise<DiagnosisType[]>
    createDiagnosisType(data: { name: string; category?: string; description?: string }): Promise<string>
    updateDiagnosisType(id: string, data: { name: string; category?: string; description?: string }): Promise<void>
    deleteDiagnosisType(id: string): Promise<void>
    restoreDiagnosisType(id: string): Promise<void>
    getPremiumPlans(): Promise<PremiumPlan[]>
    getDeletedPremiumPlans(): Promise<PremiumPlan[]>
    createPremiumPlan(data: { species: string; plan_name: string; price: number; coverage: number; sort_order?: number }): Promise<string>
    updatePremiumPlan(id: string, data: { species: string; plan_name: string; price: number; coverage: number; sort_order?: number }): Promise<void>
    deletePremiumPlan(id: string): Promise<void>
    restorePremiumPlan(id: string): Promise<void>
  }
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

export interface DriveLink {
  id: string
  claim_id: string
  file_id: string
  file_name: string
  web_view_link: string
  mime_type: string
  created_at: string
}

export interface DiagnosisType {
  id: string
  name: string
  category: string
  description: string
  created_at: string
  updated_at: string
  deleted_at?: string | null
}

export interface PremiumPlan {
  id: string
  species: 'Cat' | 'Dog'
  plan_name: string
  price: number
  coverage: number
  sort_order: number
  created_at: string
  updated_at: string
  deleted_at?: string | null
}

export interface DriveScanResult {
  policy_number?: string
  card_number?: string
  client_name?: string
  pet_name?: string
  species?: string
  breed?: string
  gender?: 'Male' | 'Female'
  age?: number
  vet_clinic?: string
  rawText: string
  foundFields: string[]
  missingFields: string[]
  [key: string]: unknown
}

declare global {
  interface Window {
    api: {
      getClaims(): Promise<Claim[]>
      createClaim(data: Omit<Claim, 'id' | 'created_at' | 'updated_at'> & Partial<Pick<Claim, 'created_at' | 'updated_at'>>): Promise<string>
      updateClaim(id: string, data: Partial<Omit<Claim, 'id' | 'created_at' | 'updated_at'>>): Promise<void>
      deleteClaim(id: string): Promise<void>
      restoreClaim(id: string): Promise<void>
      getClients(): Promise<Client[]>
      createClient(data: Omit<Client, 'id' | 'created_at' | 'updated_at'>): Promise<string>
      updateClient(
        id: string,
        data: Omit<Client, 'id' | 'created_at' | 'updated_at'>,
        prevMatch?: Pick<Client, 'name' | 'location'>
      ): Promise<void>
      deleteClient(id: string): Promise<void>
      restoreClient(id: string): Promise<void>
      getPets(): Promise<Pet[]>
      createPet(data: Omit<Pet, 'id' | 'created_at' | 'updated_at'>): Promise<string>
      updatePet(
        id: string,
        data: Omit<Pet, 'id' | 'created_at' | 'updated_at'>,
        prevMatch?: Pick<Pet, 'name' | 'species' | 'breed'>
      ): Promise<void>
      deletePet(id: string): Promise<void>
      restorePet(id: string): Promise<void>
      getClaimImages(claimId: string): Promise<ClaimImage[]>
      pickClaimImages(claimId: string, docType: ClaimImage['doc_type']): Promise<ClaimImage[]>
      deleteClaimImage(id: string): Promise<void>
      restoreClaimImage(id: string): Promise<void>
      gdriveSaveCreds(clientId: string, clientSecret: string): Promise<void>
      gdriveStatus(): Promise<{ hasCredentials: boolean; connected: boolean }>
      gdriveConnect(): Promise<{ success: boolean; error?: string }>
      gdriveDisconnect(): Promise<void>
      gdriveListFiles(query?: string): Promise<DriveFile[]>
      gdriveOpenFile(webViewLink: string): Promise<void>
      gdriveLinkFile(data: { id: string; claim_id: string; file_id: string; file_name: string; web_view_link: string; mime_type?: string }): Promise<void>
      gdriveGetLinks(claimId: string): Promise<DriveLink[]>
      gdriveUnlinkFile(id: string): Promise<void>
      gdriveListFolders(query?: string): Promise<DriveFile[]>
      gdriveListFolderFiles(folderId: string): Promise<DriveFile[]>
      gdriveDownloadFile(fileId: string): Promise<{ dataUrl: string; mimeType: string }>
      gdriveSaveFolder(folderId: string, folderName: string): Promise<void>
      gdriveGetFolder(): Promise<{ folderId: string; folderName: string } | null>
      getDiagnosisTypes(): Promise<DiagnosisType[]>
      getDeletedDiagnosisTypes(): Promise<DiagnosisType[]>
      createDiagnosisType(data: { name: string; category?: string; description?: string }): Promise<string>
      updateDiagnosisType(id: string, data: { name: string; category?: string; description?: string }): Promise<void>
      deleteDiagnosisType(id: string): Promise<void>
      restoreDiagnosisType(id: string): Promise<void>
      getPremiumPlans(): Promise<PremiumPlan[]>
      getDeletedPremiumPlans(): Promise<PremiumPlan[]>
      createPremiumPlan(data: { species: string; plan_name: string; price: number; coverage: number; sort_order?: number }): Promise<string>
      updatePremiumPlan(id: string, data: { species: string; plan_name: string; price: number; coverage: number; sort_order?: number }): Promise<void>
      deletePremiumPlan(id: string): Promise<void>
      restorePremiumPlan(id: string): Promise<void>
    }
  }
}
