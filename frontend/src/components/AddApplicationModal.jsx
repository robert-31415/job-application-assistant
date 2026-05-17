/**
 * AddApplicationModal component.
 *
 * Modal for quickly adding a new application from the Kanban board.
 * Fields: company name, role title, job description textarea.
 *
 * On submit: calls POST /api/applications then navigates to /analyze with
 * { state: { applicationId: newApp.id } } so the Analyze page can pre-populate.
 *
 * @param {{ onClose: () => void }} props
 */
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, X } from 'lucide-react'
import { useApplications } from '../hooks/useApplications.js'

const INPUT_CLS =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 ' +
  'placeholder-gray-400 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none transition'

export default function AddApplicationModal({ onClose }) {
  const navigate = useNavigate()
  const { create } = useApplications()

  const [company, setCompany] = useState('')
  const [roleTitle, setRoleTitle] = useState('')
  const [jdText, setJdText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const firstInputRef = useRef(null)

  // Focus company field on mount; close on Escape
  useEffect(() => {
    firstInputRef.current?.focus()
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const canSubmit = company.trim() && roleTitle.trim()

  async function handleSubmit(e) {
    e.preventDefault()
    if (!canSubmit || loading) return

    setLoading(true)
    setError(null)

    try {
      const newApp = await create({
        company: company.trim(),
        role_title: roleTitle.trim(),
        jd_raw: jdText.trim() || null,
      })
      onClose()
      navigate('/analyze', { state: { applicationId: newApp.id } })
    } catch (err) {
      const detail = err?.response?.data?.detail ?? err?.message ?? 'An unexpected error occurred.'
      setError(typeof detail === 'string' ? detail : JSON.stringify(detail))
      setLoading(false)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal panel */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-lg"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h2 className="text-base font-bold text-gray-900">Add Application</h2>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
            >
              <X size={18} />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Company Name <span className="text-red-500">*</span>
                </label>
                <input
                  ref={firstInputRef}
                  type="text"
                  className={INPUT_CLS}
                  placeholder="e.g. Stripe"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Role Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className={INPUT_CLS}
                  placeholder="e.g. Senior Engineer"
                  value={roleTitle}
                  onChange={(e) => setRoleTitle(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                Job Description <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea
                className={`${INPUT_CLS} resize-none`}
                rows={5}
                placeholder="Paste the job description here to enable analysis on the next page…"
                value={jdText}
                onChange={(e) => setJdText(e.target.value)}
                disabled={loading}
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg p-3">
                <AlertCircle size={15} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!canSubmit || loading}
                className={`px-5 py-2 rounded-lg text-sm font-medium transition
                  ${canSubmit && !loading
                    ? 'bg-brand-600 hover:bg-brand-700 text-white'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
              >
                {loading ? 'Creating…' : 'Create & Analyze →'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}
