/**
 * Axios instance pre-configured for the FastAPI backend.
 * All API functions are exported from this module so components never
 * construct URLs themselves.
 */
import axios from 'axios'

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8000',
  timeout: 60_000,
})

// ---------------------------------------------------------------------------
// Resume
// ---------------------------------------------------------------------------

/**
 * Upload a resume file (PDF or DOCX).
 * @param {File} file
 * @returns {Promise<import('../types').ResumeResponse>}
 */
export async function uploadResume(file) {
  const form = new FormData()
  form.append('file', file)
  const { data } = await apiClient.post('/api/resume/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

/**
 * Fetch the most recently uploaded resume.
 * @returns {Promise<import('../types').ResumeResponse>}
 */
export async function getCurrentResume() {
  const { data } = await apiClient.get('/api/resume/current')
  return data
}

// ---------------------------------------------------------------------------
// Applications
// ---------------------------------------------------------------------------

/**
 * Fetch all application records.
 * @param {string} [statusFilter]
 * @returns {Promise<import('../types').ApplicationResponse[]>}
 */
export async function listApplications(statusFilter) {
  const params = statusFilter ? { status_filter: statusFilter } : {}
  const { data } = await apiClient.get('/api/applications', { params })
  return data
}

/**
 * Create a new application record.
 * @param {{ company: string, role_title: string, jd_raw?: string }} payload
 * @returns {Promise<import('../types').ApplicationResponse>}
 */
export async function createApplication(payload) {
  const { data } = await apiClient.post('/api/applications', payload)
  return data
}

/**
 * Fetch a single application by ID.
 * @param {number} id
 * @returns {Promise<import('../types').ApplicationResponse>}
 */
export async function getApplication(id) {
  const { data } = await apiClient.get(`/api/applications/${id}`)
  return data
}

/**
 * Partially update an application (status, notes, etc.).
 * @param {number} id
 * @param {Partial<{ company: string, role_title: string, status: string, notes: string }>} payload
 * @returns {Promise<import('../types').ApplicationResponse>}
 */
export async function updateApplication(id, payload) {
  const { data } = await apiClient.patch(`/api/applications/${id}`, payload)
  return data
}

/**
 * Delete an application by ID.
 * @param {number} id
 * @returns {Promise<void>}
 */
export async function deleteApplication(id) {
  await apiClient.delete(`/api/applications/${id}`)
}

// ---------------------------------------------------------------------------
// JD Analysis
// ---------------------------------------------------------------------------

/**
 * Run the JD Analyzer agent on an application's stored job description.
 * @param {{ application_id: number }} payload
 * @returns {Promise<import('../types').JDAnalysisOutput>}
 */
export async function analyzeJD(payload) {
  const { data } = await apiClient.post('/api/analyze/jd', payload)
  return data
}

// ---------------------------------------------------------------------------
// Resume comparison
// ---------------------------------------------------------------------------

/**
 * Run the Resume Comparator agent for an application.
 * Requires the application to have an existing jd_analysis_json (run analyzeJD first).
 * @param {{ application_id: number }} payload
 * @returns {Promise<import('../types').GapAnalysisOutput>}
 */
export async function compareResume(payload) {
  const { data } = await apiClient.post('/api/compare/resume', payload)
  return data
}

// ---------------------------------------------------------------------------
// Cover letter
// ---------------------------------------------------------------------------

/**
 * Generate an initial cover letter for an application.
 * @param {{ application_id: number, tone: string }} payload
 * @returns {Promise<import('../types').CoverLetterOutput>}
 */
export async function generateCoverLetter(payload) {
  const { data } = await apiClient.post('/api/cover-letter/generate', payload)
  return data
}

/**
 * Refine an existing cover letter with a user instruction.
 * @param {{ application_id: number, instruction: string, tone: string }} payload
 * @returns {Promise<import('../types').CoverLetterOutput>}
 */
export async function refineCoverLetter(payload) {
  const { data } = await apiClient.post('/api/cover-letter/refine', payload)
  return data
}

// ---------------------------------------------------------------------------
// Interview prep
// ---------------------------------------------------------------------------

/**
 * Generate interview prep questions for an application.
 * @param {{ application_id: number }} payload
 * @returns {Promise<import('../types').InterviewPrepOutput>}
 */
export async function generateInterviewPrep(payload) {
  const { data } = await apiClient.post('/api/interview-prep/generate', payload)
  return data
}

// ---------------------------------------------------------------------------
// DOCX exports — fetch as blob and trigger browser download
// ---------------------------------------------------------------------------

/**
 * Download the cover letter for an application as a .docx file.
 * @param {number} id
 * @returns {Promise<void>}
 */
export async function exportCoverLetter(id) {
  const response = await apiClient.get(`/api/export/cover-letter/${id}`, {
    responseType: 'blob',
  })
  const url = URL.createObjectURL(response.data)
  const a = document.createElement('a')
  a.href = url
  a.download = 'cover_letter.docx'
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Download the interview prep sheet for an application as a .docx file.
 * @param {number} id
 * @returns {Promise<void>}
 */
export async function exportInterviewPrep(id) {
  const response = await apiClient.get(`/api/export/interview-prep/${id}`, {
    responseType: 'blob',
  })
  const url = URL.createObjectURL(response.data)
  const a = document.createElement('a')
  a.href = url
  a.download = 'interview_prep.docx'
  a.click()
  URL.revokeObjectURL(url)
}

export default apiClient
