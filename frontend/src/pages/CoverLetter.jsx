/**
 * CoverLetter page — generate and iteratively refine a tailored cover letter.
 *
 * Flow:
 *  1. User picks an application from a dropdown (loaded from GET /api/applications).
 *  2. User selects a tone (professional / conversational / bold).
 *  3. "Generate Cover Letter" calls POST /api/cover-letter/generate.
 *  4. The generated letter is displayed with a live word count.
 *  5. The user types a refinement instruction and clicks "Refine" to call
 *     POST /api/cover-letter/refine; the view updates with the new version.
 *  6. Version history sidebar lists all past versions with timestamps.
 *  7. "Copy to Clipboard" and "Download as DOCX" are available after generation.
 */
import {
  AlignLeft,
  Clipboard,
  ClipboardCheck,
  Download,
  Loader2,
  RefreshCw,
  Sparkles,
  Zap,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
} from 'docx'
import { generateCoverLetter, listApplications, refineCoverLetter } from '../api/client.js'

// ---------------------------------------------------------------------------
// Tone config
// ---------------------------------------------------------------------------

const TONES = [
  { id: 'professional', label: 'Professional', icon: AlignLeft, description: 'Formal and precise' },
  { id: 'conversational', label: 'Conversational', icon: RefreshCw, description: 'Warm and personable' },
  { id: 'bold', label: 'Bold', icon: Zap, description: 'Confident and punchy' },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const INPUT_CLS =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 ' +
  'placeholder-gray-400 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none transition'

function formatTimestamp(iso) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Build paragraphs from plain text (split on blank lines).
 * Returns an array of Paragraph objects for the docx library.
 */
function textToParagraphs(text) {
  return text
    .split(/\n\n+/)
    .map((block) =>
      new Paragraph({
        children: [new TextRun({ text: block.trim(), size: 24 })],
        spacing: { after: 240 },
      })
    )
}

/**
 * Download the letter text as a DOCX file using the docx npm package.
 */
async function downloadAsDocx(text, filename = 'cover-letter.docx') {
  const doc = new Document({
    sections: [{ children: textToParagraphs(text) }],
  })
  const blob = await Packer.toBlob(doc)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ToneSelector({ value, onChange, disabled }) {
  return (
    <div className="flex gap-2">
      {TONES.map(({ id, label, icon: Icon, description }) => (
        <button
          key={id}
          type="button"
          disabled={disabled}
          onClick={() => onChange(id)}
          title={description}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition
            ${value === id
              ? 'bg-brand-600 border-brand-600 text-white'
              : 'bg-white border-gray-300 text-gray-600 hover:border-brand-400 hover:text-brand-700'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <Icon size={14} />
          {label}
        </button>
      ))}
    </div>
  )
}

function VersionSidebar({ versions, activeVersion, onSelect }) {
  if (versions.length === 0) return null

  return (
    <aside className="w-52 shrink-0">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
        Version History
      </h3>
      <ul className="space-y-1.5">
        {[...versions].reverse().map((v) => (
          <li key={v.version}>
            <button
              type="button"
              onClick={() => onSelect(v)}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs transition
                ${v.version === activeVersion
                  ? 'bg-brand-50 border border-brand-200 text-brand-800'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
            >
              <span className="font-semibold">v{v.version}</span>
              <span className="ml-1.5 capitalize text-gray-400">{v.tone}</span>
              <div className="text-gray-400 mt-0.5">{formatTimestamp(v.generated_at)}</div>
              <div className="text-gray-400">{v.word_count} words</div>
            </button>
          </li>
        ))}
      </ul>
    </aside>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CoverLetter() {
  // Application selection
  const [applications, setApplications] = useState([])
  const [selectedAppId, setSelectedAppId] = useState('')
  const [appsLoading, setAppsLoading] = useState(true)

  // Generation state
  const [tone, setTone] = useState('professional')
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState(null)

  // Letter state
  const [versions, setVersions] = useState([])
  const [activeVersion, setActiveVersion] = useState(null)

  // Refinement state
  const [instruction, setInstruction] = useState('')
  const [refining, setRefining] = useState(false)
  const [refineError, setRefineError] = useState(null)

  // Copy state
  const [copied, setCopied] = useState(false)
  const copyTimeoutRef = useRef(null)

  useEffect(() => {
    listApplications()
      .then((data) => setApplications(data))
      .catch(() => setApplications([]))
      .finally(() => setAppsLoading(false))
  }, [])

  const currentLetter = activeVersion?.text ?? null

  async function handleGenerate() {
    if (!selectedAppId || generating) return
    setGenerating(true)
    setGenerateError(null)

    try {
      const result = await generateCoverLetter({
        application_id: Number(selectedAppId),
        tone,
      })
      const updated = [...versions, result]
      setVersions(updated)
      setActiveVersion(result)
    } catch (err) {
      const detail = err?.response?.data?.detail ?? err?.message ?? 'An unexpected error occurred.'
      setGenerateError(typeof detail === 'string' ? detail : JSON.stringify(detail))
    } finally {
      setGenerating(false)
    }
  }

  async function handleRefine() {
    if (!selectedAppId || !instruction.trim() || refining) return
    setRefining(true)
    setRefineError(null)

    try {
      const result = await refineCoverLetter({
        application_id: Number(selectedAppId),
        instruction: instruction.trim(),
        tone,
      })
      const updated = [...versions, result]
      setVersions(updated)
      setActiveVersion(result)
      setInstruction('')
    } catch (err) {
      const detail = err?.response?.data?.detail ?? err?.message ?? 'An unexpected error occurred.'
      setRefineError(typeof detail === 'string' ? detail : JSON.stringify(detail))
    } finally {
      setRefining(false)
    }
  }

  function handleCopy() {
    if (!currentLetter) return
    navigator.clipboard.writeText(currentLetter).then(() => {
      setCopied(true)
      clearTimeout(copyTimeoutRef.current)
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000)
    })
  }

  function handleDownload() {
    if (!currentLetter) return
    const app = applications.find((a) => a.id === Number(selectedAppId))
    const slug = app
      ? `${app.company}-${app.role_title}`.toLowerCase().replace(/\s+/g, '-')
      : 'cover-letter'
    downloadAsDocx(currentLetter, `${slug}-v${activeVersion.version}.docx`)
  }

  const isWorking = generating || refining

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Cover Letter</h1>
        <p className="text-sm text-gray-500 mt-1">
          Generate a tailored cover letter and refine it iteratively until it&apos;s perfect.
        </p>
      </div>

      {/* Controls card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        {/* Application picker */}
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
                setVersions([])
                setActiveVersion(null)
                setGenerateError(null)
                setRefineError(null)
              }}
              disabled={isWorking}
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

        {/* Tone selector */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
            Tone
          </label>
          <ToneSelector value={tone} onChange={setTone} disabled={isWorking} />
        </div>

        {/* Generate button + error */}
        {generateError && (
          <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg p-3">
            {generateError}
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          <p className="text-xs text-gray-400">Requires completed JD analysis and gap analysis</p>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={!selectedAppId || isWorking}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition
              ${selectedAppId && !isWorking
                ? 'bg-brand-600 hover:bg-brand-700 text-white'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
          >
            {generating ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Sparkles size={15} />
                {versions.length > 0 ? 'Regenerate' : 'Generate Cover Letter'}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Letter + sidebar */}
      {activeVersion && (
        <div className="flex gap-5 items-start">
          {/* Letter display */}
          <div className="flex-1 space-y-3">
            {/* Action bar */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">
                {activeVersion.word_count} words · v{activeVersion.version} · {activeVersion.tone}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                    border border-gray-300 text-gray-600 hover:border-gray-400 transition"
                >
                  {copied ? (
                    <><ClipboardCheck size={13} className="text-green-500" /> Copied</>
                  ) : (
                    <><Clipboard size={13} /> Copy</>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleDownload}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                    border border-gray-300 text-gray-600 hover:border-gray-400 transition"
                >
                  <Download size={13} />
                  Download DOCX
                </button>
              </div>
            </div>

            {/* Letter text */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 text-sm text-gray-800 leading-relaxed space-y-4">
              {activeVersion.text.split(/\n\n+/).map((para, i) => (
                <p key={i}>{para.trim()}</p>
              ))}
            </div>

            {/* Refinement section */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
              <h3 className="text-sm font-semibold text-gray-700">Refine this letter</h3>
              <textarea
                className={`${INPUT_CLS} resize-none`}
                rows={3}
                placeholder="e.g. Make the opening more specific. Shorten the body paragraph. Add a quantified achievement."
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                disabled={isWorking}
              />
              {refineError && (
                <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg p-3">
                  {refineError}
                </div>
              )}
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleRefine}
                  disabled={!instruction.trim() || isWorking}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition
                    ${instruction.trim() && !isWorking
                      ? 'bg-brand-600 hover:bg-brand-700 text-white'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    }`}
                >
                  {refining ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Refining…
                    </>
                  ) : (
                    <>
                      <RefreshCw size={14} />
                      Refine
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Version sidebar */}
          <VersionSidebar
            versions={versions}
            activeVersion={activeVersion.version}
            onSelect={setActiveVersion}
          />
        </div>
      )}

      {/* Generating skeleton */}
      {generating && !activeVersion && (
        <div className="space-y-3 animate-pulse">
          {[90, 75, 85, 60, 80, 70].map((w, i) => (
            <div key={i} className="h-4 bg-gray-200 rounded" style={{ width: `${w}%` }} />
          ))}
        </div>
      )}
    </div>
  )
}
