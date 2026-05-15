/**
 * ResumeUpload component.
 *
 * Renders a drag-and-drop / click-to-upload zone for PDF and DOCX files.
 * On successful upload it displays a scrollable preview of the extracted text.
 *
 * @param {{ onUploadSuccess?: (resume: object) => void }} props
 */
import { Upload, FileText, CheckCircle, AlertCircle } from 'lucide-react'
import { useRef, useState } from 'react'
import { useResume } from '../hooks/useResume.js'

export default function ResumeUpload({ onUploadSuccess }) {
  const { resume, isLoading, upload, isUploading, uploadError } = useResume()
  const [dragOver, setDragOver] = useState(false)
  const [localError, setLocalError] = useState(null)
  const inputRef = useRef(null)

  const ACCEPTED = ['application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document']

  /** Handle a file being selected — either via drag-drop or the file input. */
  async function handleFile(file) {
    setLocalError(null)
    if (!ACCEPTED.includes(file.type)) {
      setLocalError('Only PDF and DOCX files are supported.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setLocalError('File exceeds the 5 MB size limit.')
      return
    }
    try {
      const result = await upload(file)
      onUploadSuccess?.(result)
    } catch {
      // uploadError from the hook surfaces the API error message
    }
  }

  function onDrop(e) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const displayError = localError ?? uploadError?.response?.data?.detail ?? uploadError?.message

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload resume — click or drag a PDF or DOCX file here"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors
          ${dragOver ? 'border-brand-500 bg-brand-50' : 'border-gray-300 hover:border-brand-500 hover:bg-gray-50'}
          ${isUploading ? 'opacity-60 pointer-events-none' : ''}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
        />
        <Upload className="mx-auto mb-3 text-gray-400" size={32} />
        <p className="text-sm font-medium text-gray-700">
          {isUploading ? 'Uploading…' : 'Drop your resume here or click to browse'}
        </p>
        <p className="text-xs text-gray-400 mt-1">PDF or DOCX · max 5 MB</p>
      </div>

      {/* Inline error */}
      {displayError && (
        <div className="flex items-start gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg p-3">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{displayError}</span>
        </div>
      )}

      {/* Success + text preview */}
      {!isLoading && resume && (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 bg-green-50 border-b border-gray-200">
            <CheckCircle size={16} className="text-green-600" />
            <span className="text-sm font-medium text-green-700">
              {resume.filename}
            </span>
            <FileText size={14} className="ml-auto text-gray-400" />
            <span className="text-xs text-gray-400">
              {resume.raw_text.split(/\s+/).length} words
            </span>
          </div>
          <pre className="p-4 text-xs text-gray-600 whitespace-pre-wrap max-h-64 overflow-y-auto leading-relaxed font-mono">
            {resume.raw_text}
          </pre>
        </div>
      )}
    </div>
  )
}
