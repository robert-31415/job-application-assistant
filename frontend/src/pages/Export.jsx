/**
 * Export page — DOCX downloads for cover letters and interview prep sheets.
 *
 * Flow:
 *  1. User selects an application from the dropdown.
 *  2. Status indicators show whether each document has been generated.
 *  3. Available download buttons call the respective export functions.
 */
import { CheckCircle2, Download, Loader2, Minus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { exportCoverLetter, exportInterviewPrep, getApplication, listApplications } from '../api/client.js'

const INPUT_CLS =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 ' +
  'placeholder-gray-400 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none transition'

function StatusBadge({ available }) {
  if (available) {
    return (
      <span className="flex items-center gap-1 text-xs font-medium text-green-600">
        <CheckCircle2 size={14} />
        Ready
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1 text-xs font-medium text-gray-400">
      <Minus size={14} />
      Not generated
    </span>
  )
}

function ExportRow({ label, description, available, downloading, onDownload, hint }) {
  return (
    <div className="flex items-center justify-between gap-4 py-4 border-b border-gray-100 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800">{label}</p>
        <p className="text-xs text-gray-400 mt-0.5">{description}</p>
        <div className="mt-1.5 flex items-center gap-2">
          <StatusBadge available={available} />
          {hint && <span className="text-xs text-gray-400">{hint}</span>}
        </div>
      </div>
      <button
        type="button"
        onClick={onDownload}
        disabled={!available || downloading}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition shrink-0
          ${available && !downloading
            ? 'border-gray-300 text-gray-600 hover:border-gray-400 hover:text-gray-800 bg-white'
            : 'border-gray-200 text-gray-300 cursor-not-allowed bg-gray-50'
          }`}
      >
        {downloading ? (
          <>
            <Loader2 size={14} className="animate-spin" />
            Downloading…
          </>
        ) : (
          <>
            <Download size={14} />
            Download DOCX
          </>
        )}
      </button>
    </div>
  )
}

export default function Export() {
  const [applications, setApplications] = useState([])
  const [selectedAppId, setSelectedAppId] = useState('')
  const [appsLoading, setAppsLoading] = useState(true)

  const [selectedApp, setSelectedApp] = useState(null)
  const [appLoading, setAppLoading] = useState(false)

  const [downloadingCover, setDownloadingCover] = useState(false)
  const [downloadingPrep, setDownloadingPrep] = useState(false)
  const [coverError, setCoverError] = useState(null)
  const [prepError, setPrepError] = useState(null)

  useEffect(() => {
    listApplications()
      .then((data) => setApplications(data))
      .catch(() => setApplications([]))
      .finally(() => setAppsLoading(false))
  }, [])

  useEffect(() => {
    if (!selectedAppId) {
      setSelectedApp(null)
      return
    }
    setAppLoading(true)
    setSelectedApp(null)
    setCoverError(null)
    setPrepError(null)
    getApplication(Number(selectedAppId))
      .then((app) => setSelectedApp(app))
      .catch(() => setSelectedApp(null))
      .finally(() => setAppLoading(false))
  }, [selectedAppId])

  async function handleDownloadCover() {
    if (!selectedAppId || downloadingCover) return
    setDownloadingCover(true)
    setCoverError(null)
    try {
      await exportCoverLetter(Number(selectedAppId))
    } catch (err) {
      const detail = err?.response?.data?.detail ?? err?.message ?? 'Download failed.'
      setCoverError(typeof detail === 'string' ? detail : JSON.stringify(detail))
    } finally {
      setDownloadingCover(false)
    }
  }

  async function handleDownloadPrep() {
    if (!selectedAppId || downloadingPrep) return
    setDownloadingPrep(true)
    setPrepError(null)
    try {
      await exportInterviewPrep(Number(selectedAppId))
    } catch (err) {
      const detail = err?.response?.data?.detail ?? err?.message ?? 'Download failed.'
      setPrepError(typeof detail === 'string' ? detail : JSON.stringify(detail))
    } finally {
      setDownloadingPrep(false)
    }
  }

  const hasCoverLetter = Boolean(selectedApp?.cover_letter_text)
  const hasInterviewPrep = Boolean(selectedApp?.interview_prep_json)

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Export</h1>
        <p className="text-sm text-gray-500 mt-1">
          Download cover letters and interview prep sheets as DOCX files.
        </p>
      </div>

      {/* Application selector */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
            Application
          </label>
          {appsLoading ? (
            <div className="h-9 bg-gray-100 rounded-lg animate-pulse" />
          ) : (
            <select
              className={INPUT_CLS}
              value={selectedAppId}
              onChange={(e) => setSelectedAppId(e.target.value)}
            >
              <option value="">Select an application…</option>
              {applications.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.company} — {a.role_title}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Export rows */}
        {appLoading && (
          <div className="space-y-2 animate-pulse pt-2">
            <div className="h-16 bg-gray-100 rounded-lg" />
            <div className="h-16 bg-gray-100 rounded-lg" />
          </div>
        )}

        {selectedApp && !appLoading && (
          <div className="pt-2">
            <ExportRow
              label="Cover Letter"
              description="Tailored cover letter generated from your resume and JD analysis"
              available={hasCoverLetter}
              downloading={downloadingCover}
              onDownload={handleDownloadCover}
              hint={hasCoverLetter ? 'Latest version will be downloaded' : null}
            />
            {coverError && (
              <p className="text-xs text-red-600 mt-1 mb-2">{coverError}</p>
            )}
            <ExportRow
              label="Interview Prep Sheet"
              description="10 role-specific questions with suggested answer frameworks"
              available={hasInterviewPrep}
              downloading={downloadingPrep}
              onDownload={handleDownloadPrep}
            />
            {prepError && (
              <p className="text-xs text-red-600 mt-1">{prepError}</p>
            )}
          </div>
        )}

        {!selectedAppId && !appsLoading && (
          <p className="text-sm text-gray-400 text-center py-4">
            Select an application to see available exports.
          </p>
        )}
      </div>
    </div>
  )
}
