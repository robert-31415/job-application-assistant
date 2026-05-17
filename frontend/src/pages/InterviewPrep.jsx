/**
 * InterviewPrep page — generate role-specific interview questions.
 *
 * Flow:
 *  1. User selects an application from the dropdown.
 *  2. "Generate Prep Sheet" calls POST /api/interview-prep/generate.
 *  3. 10 questions are displayed grouped by category with expandable frameworks.
 *  4. "Download Prep Sheet" calls GET /api/export/interview-prep/{id} and
 *     triggers a DOCX file download.
 */
import { AlertCircle, ChevronDown, ChevronUp, Download, Loader2, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  exportInterviewPrep,
  generateInterviewPrep,
  getApplication,
  listApplications,
} from '../api/client.js'

// ---------------------------------------------------------------------------
// Category config
// ---------------------------------------------------------------------------

const CATEGORY_CONFIG = {
  behavioral:   { label: 'Behavioral',   badge: 'bg-indigo-100 text-indigo-700'  },
  technical:    { label: 'Technical',    badge: 'bg-purple-100 text-purple-700'  },
  situational:  { label: 'Situational',  badge: 'bg-amber-100  text-amber-700'   },
  culture_fit:  { label: 'Culture Fit',  badge: 'bg-green-100  text-green-700'   },
}

function categoryConfig(cat) {
  return CATEGORY_CONFIG[cat] ?? { label: cat, badge: 'bg-gray-100 text-gray-700' }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const INPUT_CLS =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 ' +
  'placeholder-gray-400 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none transition'

function QuestionCard({ q, index }) {
  const [open, setOpen] = useState(false)
  const { label, badge } = categoryConfig(q.category)

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-start gap-3 px-5 py-4 text-left hover:bg-gray-50 transition"
      >
        <span className="shrink-0 w-6 h-6 rounded-full bg-gray-100 text-gray-500 text-xs font-semibold flex items-center justify-center mt-0.5">
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badge}`}>
              {label}
            </span>
          </div>
          <p className="text-sm font-medium text-gray-800 leading-snug">{q.question}</p>
        </div>
        <span className="shrink-0 text-gray-400 mt-0.5">
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </button>

      {open && (
        <div className="px-5 pb-4 pt-0 border-t border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 mt-3">
            Suggested Framework
          </p>
          <p className="text-sm text-gray-700 leading-relaxed">{q.suggested_framework}</p>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function InterviewPrep() {
  const [applications, setApplications] = useState([])
  const [selectedAppId, setSelectedAppId] = useState('')
  const [appsLoading, setAppsLoading] = useState(true)

  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState(null)
  const [prepData, setPrepData] = useState(null)

  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState(null)

  useEffect(() => {
    listApplications()
      .then((data) => setApplications(data))
      .catch(() => setApplications([]))
      .finally(() => setAppsLoading(false))
  }, [])

  useEffect(() => {
    if (!selectedAppId) return
    getApplication(Number(selectedAppId)).then((app) => {
      if (app.interview_prep_json) {
        setPrepData(JSON.parse(app.interview_prep_json))
      }
    }).catch(() => {})
  }, [selectedAppId])

  async function handleGenerate() {
    if (!selectedAppId || generating) return
    setGenerating(true)
    setError(null)
    setPrepData(null)

    try {
      const result = await generateInterviewPrep({ application_id: Number(selectedAppId) })
      setPrepData(result)
    } catch (err) {
      const detail = err?.response?.data?.detail ?? err?.message ?? 'An unexpected error occurred.'
      setError(typeof detail === 'string' ? detail : JSON.stringify(detail))
    } finally {
      setGenerating(false)
    }
  }

  async function handleDownload() {
    if (!selectedAppId || downloading) return
    setDownloading(true)
    setDownloadError(null)

    try {
      await exportInterviewPrep(Number(selectedAppId))
    } catch (err) {
      const detail = err?.response?.data?.detail ?? err?.message ?? 'Download failed.'
      setDownloadError(typeof detail === 'string' ? detail : JSON.stringify(detail))
    } finally {
      setDownloading(false)
    }
  }

  // Group questions by category for display
  const categories = prepData
    ? [...new Set(prepData.questions.map((q) => q.category))]
    : []

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Interview Prep</h1>
        <p className="text-sm text-gray-500 mt-1">
          Generate 10 role-specific questions with answer frameworks. Requires completed JD analysis and gap analysis.
        </p>
      </div>

      {/* Controls card */}
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
              onChange={(e) => {
                setSelectedAppId(e.target.value)
                setPrepData(null)
                setError(null)
                setDownloadError(null)
              }}
              disabled={generating}
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

        {error && (
          <div className="flex items-start gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg p-3">
            <AlertCircle size={15} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          <p className="text-xs text-gray-400">~10–30 seconds · uses Claude AI</p>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={!selectedAppId || generating}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition
              ${selectedAppId && !generating
                ? 'bg-brand-600 hover:bg-brand-700 text-white'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
          >
            {generating ? (
              <><Loader2 size={15} className="animate-spin" />Generating…</>
            ) : (
              <><Sparkles size={15} />{prepData ? 'Regenerate' : 'Generate Prep Sheet'}</>
            )}
          </button>
        </div>
      </div>

      {/* Generating skeleton */}
      {generating && (
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 bg-gray-200 rounded-xl" />
          ))}
        </div>
      )}

      {/* Results */}
      {!generating && prepData && (
        <div className="space-y-6">
          {/* Header row with download button */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {prepData.questions.length} questions for{' '}
              <span className="font-medium text-gray-700">{prepData.role_title}</span>{' '}
              at <span className="font-medium text-gray-700">{prepData.company}</span>
            </p>
            <div className="flex flex-col items-end gap-1">
              <button
                type="button"
                onClick={handleDownload}
                disabled={downloading}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition
                  ${downloading
                    ? 'border-gray-200 text-gray-400 cursor-not-allowed'
                    : 'border-gray-300 text-gray-600 hover:border-gray-400 hover:text-gray-800'
                  }`}
              >
                {downloading ? (
                  <><Loader2 size={14} className="animate-spin" />Downloading…</>
                ) : (
                  <><Download size={14} />Download DOCX</>
                )}
              </button>
              {downloadError && (
                <p className="text-xs text-red-600">{downloadError}</p>
              )}
            </div>
          </div>

          {/* Questions grouped by category */}
          {categories.map((cat) => {
            const { label, badge } = categoryConfig(cat)
            const qs = prepData.questions.filter((q) => q.category === cat)
            return (
              <div key={cat} className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${badge}`}>
                    {label}
                  </span>
                  <span className="text-xs text-gray-400">{qs.length} question{qs.length !== 1 ? 's' : ''}</span>
                </div>
                {qs.map((q) => (
                  <QuestionCard
                    key={q.question}
                    q={q}
                    index={prepData.questions.indexOf(q)}
                  />
                ))}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
