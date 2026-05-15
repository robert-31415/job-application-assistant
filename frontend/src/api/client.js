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

export default apiClient
