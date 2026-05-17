/**
 * Analyze page — the job description analysis workspace.
 *
 * Flow:
 *  1. User enters company name, role title, and pastes a job description.
 *  2. "Run Analysis" creates an Application record (POST /api/applications)
 *     then calls the JD Analyzer agent (POST /api/analyze/jd).
 *  3. After analysis, a "Compare with My Resume" button appears.
 *  4. On click, POST /api/compare/resume runs the gap analysis agent.
 *  5. MatchScore renders the gap analysis below the JD analysis.
 *
 * The application record created here persists to the Kanban board automatically.
 */
import { AlertCircle, GitCompare, Loader2, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { analyzeJD, compareResume, createApplication, listApplications } from '../api/client.js'
import JDAnalysis from '../components/JDAnalysis.jsx'
import MatchScore from '../components/MatchScore.jsx'

/** Shared Tailwind classes for labelled form fields. */
function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
        {label}
      </label>
      {children}
    </div>
  )
}

const INPUT_CLS =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 ' +
  'placeholder-gray-400 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none transition'

export default function Analyze() {
  const { state: locationState } = useLocation()

  const [company, setCompany] = useState('')
  const [roleTitle, setRoleTitle] = useState('')
  const [jdText, setJdText] = useState('')

  // JD analysis state
  const [analysis, setAnalysis] = useState(null)
  const [applicationId, setApplicationId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Gap analysis state
  const [gapAnalysis, setGapAnalysis] = useState(null)
  const [comparing, setComparing] = useState(false)
  const [compareError, setCompareError] = useState(null)

  // Pre-populate fields when navigated from AddApplicationModal with an existing applicationId
  useEffect(() => {
    if (!locationState?.applicationId) return
    listApplications().then((apps) => {
      const app = apps.find((a) => a.id === locationState.applicationId)
      if (!app) return
      setCompany(app.company)
      setRoleTitle(app.role_title)
      setJdText(app.jd_raw ?? '')
      setApplicationId(app.id)
    })
  }, [locationState?.applicationId])

  const canSubmit = company.trim() && roleTitle.trim() && jdText.trim().length >= 50

  async function handleSubmit(e) {
    e.preventDefault()
    if (!canSubmit || loading) return

    setLoading(true)
    setError(null)
    setAnalysis(null)
    setApplicationId(null)
    setGapAnalysis(null)
    setCompareError(null)

    try {
      // Step 1: use existing applicationId (from navigation state) or create a new record
      let appId = applicationId
      if (!appId) {
        const application = await createApplication({
          company: company.trim(),
          role_title: roleTitle.trim(),
          jd_raw: jdText.trim(),
        })
        appId = application.id
        setApplicationId(appId)
      }

      // Step 2: run the JD analysis agent
      const result = await analyzeJD({ application_id: appId })
      setAnalysis(result)
      setApplicationId(appId)
    } catch (err) {
      const detail =
        err?.response?.data?.detail ?? err?.message ?? 'An unexpected error occurred.'
      setError(typeof detail === 'string' ? detail : JSON.stringify(detail))
    } finally {
      setLoading(false)
    }
  }

  async function handleCompare() {
    if (!applicationId || comparing) return

    setComparing(true)
    setCompareError(null)
    setGapAnalysis(null)

    try {
      const result = await compareResume({ application_id: applicationId })
      setGapAnalysis(result)
    } catch (err) {
      const detail =
        err?.response?.data?.detail ?? err?.message ?? 'An unexpected error occurred.'
      setCompareError(typeof detail === 'string' ? detail : JSON.stringify(detail))
    } finally {
      setComparing(false)
    }
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analyze Job Description</h1>
        <p className="text-sm text-gray-500 mt-1">
          Paste a job description to extract required skills, company research, and more.
          A new application card is created automatically.
        </p>
      </div>

      {/* Input form */}
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl border border-gray-200 p-6 space-y-4"
      >
        <div className="grid grid-cols-2 gap-4">
          <Field label="Company Name">
            <input
              type="text"
              className={INPUT_CLS}
              placeholder="e.g. Stripe"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              disabled={loading}
              required
            />
          </Field>
          <Field label="Role Title">
            <input
              type="text"
              className={INPUT_CLS}
              placeholder="e.g. Senior Software Engineer"
              value={roleTitle}
              onChange={(e) => setRoleTitle(e.target.value)}
              disabled={loading}
              required
            />
          </Field>
        </div>

        <Field label="Job Description">
          <textarea
            className={`${INPUT_CLS} resize-none leading-relaxed`}
            rows={12}
            placeholder="Paste the full job description here…"
            value={jdText}
            onChange={(e) => setJdText(e.target.value)}
            disabled={loading}
            required
          />
          <p className="text-xs text-gray-400">
            {jdText.trim().length < 50
              ? `${Math.max(0, 50 - jdText.trim().length)} more characters needed`
              : `${jdText.trim().split(/\s+/).filter(Boolean).length} words`}
          </p>
        </Field>

        {/* Inline error */}
        {error && (
          <div className="flex items-start gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg p-3">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          <p className="text-xs text-gray-400">
            Analysis uses Tavily web search + Claude AI · ~10–30 seconds
          </p>
          <button
            type="submit"
            disabled={!canSubmit || loading}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition
              ${canSubmit && !loading
                ? 'bg-brand-600 hover:bg-brand-700 text-white'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
          >
            {loading ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Analysing…
              </>
            ) : (
              <>
                <Sparkles size={15} />
                Run Analysis
              </>
            )}
          </button>
        </div>
      </form>

      {/* Analysis loading skeleton */}
      {loading && (
        <div className="space-y-3 animate-pulse">
          {[80, 60, 90, 50].map((w, i) => (
            <div key={i} className="h-4 bg-gray-200 rounded" style={{ width: `${w}%` }} />
          ))}
        </div>
      )}

      {/* JD Analysis results */}
      {!loading && analysis && (
        <>
          <JDAnalysis analysis={analysis} />

          {/* Compare button */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-gray-800">Compare with My Resume</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Score your fit and get specific gap analysis · requires an uploaded resume
              </p>
            </div>
            <button
              type="button"
              onClick={handleCompare}
              disabled={comparing}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition shrink-0
                ${comparing
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-brand-600 hover:bg-brand-700 text-white'
                }`}
            >
              {comparing ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Comparing…
                </>
              ) : (
                <>
                  <GitCompare size={15} />
                  {gapAnalysis ? 'Re-run Comparison' : 'Compare'}
                </>
              )}
            </button>
          </div>

          {/* Compare error */}
          {compareError && (
            <div className="flex items-start gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg p-3">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{compareError}</span>
            </div>
          )}

          {/* Gap analysis loading skeleton */}
          {comparing && (
            <div className="space-y-3 animate-pulse">
              {[50, 70, 40, 65].map((w, i) => (
                <div key={i} className="h-4 bg-gray-200 rounded" style={{ width: `${w}%` }} />
              ))}
            </div>
          )}

          {/* Match score results */}
          {!comparing && gapAnalysis && <MatchScore gapAnalysis={gapAnalysis} />}
        </>
      )}
    </div>
  )
}
