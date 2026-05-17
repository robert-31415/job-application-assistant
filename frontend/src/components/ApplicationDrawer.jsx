/**
 * ApplicationDrawer component.
 *
 * Right-side slide-in drawer showing full details for a selected application.
 * Sections:
 *  - Header: company name, role title, status badge, close button
 *  - JD Analysis: parsed from jd_analysis_json via JDAnalysis component
 *  - Match Score: gap analysis gauge via MatchScore component
 *  - Cover Letter preview: first 200 chars + link to Cover Letter editor
 *
 * All sections have graceful empty states when data is null.
 *
 * @param {{ application: object, onClose: () => void }} props
 */
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
import { COLUMNS } from '../constants/kanban.js'
import JDAnalysis from './JDAnalysis.jsx'
import MatchScore from './MatchScore.jsx'

function EmptyState({ message }) {
  return (
    <p className="text-sm text-gray-400 italic py-3">{message}</p>
  )
}

/** Return the display label for a status id. */
function statusLabel(statusId) {
  return COLUMNS.find((c) => c.id === statusId)?.label ?? statusId
}

export default function ApplicationDrawer({ application, onClose }) {
  const navigate = useNavigate()

  // Close on Escape key
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const jdAnalysis = application.jd_analysis_json
    ? (() => { try { return JSON.parse(application.jd_analysis_json) } catch { return null } })()
    : null

  const gapAnalysis = application.gap_analysis_json
    ? (() => { try { return JSON.parse(application.gap_analysis_json) } catch { return null } })()
    : null

  const coverPreview = application.cover_letter_text
    ? application.cover_letter_text.slice(0, 200) + (application.cover_letter_text.length > 200 ? '…' : '')
    : null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <div className="fixed right-0 top-0 h-full w-[480px] max-w-full bg-white shadow-2xl z-50
        flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-200 shrink-0">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-gray-900 truncate">{application.company}</h2>
            <p className="text-sm text-gray-500 truncate">{application.role_title}</p>
            <span className="inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
              {statusLabel(application.status)}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-4 shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">

          {/* JD Analysis section */}
          <section>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              JD Analysis
            </h3>
            {jdAnalysis
              ? <JDAnalysis analysis={jdAnalysis} />
              : <EmptyState message="No JD analysis yet — run Analyze JD first." />
            }
          </section>

          {/* Match Score section */}
          <section>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Resume Match
            </h3>
            {gapAnalysis
              ? <MatchScore gapAnalysis={gapAnalysis} />
              : <EmptyState message="No gap analysis yet — run Compare with My Resume first." />
            }
          </section>

          {/* Cover Letter preview section */}
          <section>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Cover Letter
            </h3>
            {coverPreview ? (
              <div className="space-y-3">
                <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 rounded-lg p-3 border border-gray-200">
                  {coverPreview}
                </p>
                <button
                  type="button"
                  onClick={() => { onClose(); navigate('/cover-letter') }}
                  className="text-sm font-medium text-brand-600 hover:text-brand-700 underline"
                >
                  Go to Cover Letter Editor →
                </button>
              </div>
            ) : (
              <EmptyState message="No cover letter yet — generate one from the Cover Letter page." />
            )}
          </section>
        </div>
      </div>
    </>
  )
}
