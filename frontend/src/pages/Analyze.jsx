/**
 * Analyze page — job description analysis workspace.
 * Full implementation in Phase 2; currently shows JDAnalysis placeholder.
 */
import JDAnalysis from '../components/JDAnalysis.jsx'

export default function Analyze() {
  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analyze Job Description</h1>
        <p className="text-sm text-gray-500 mt-1">
          Paste a job description to extract skills, seniority, and company research.
        </p>
      </div>
      <JDAnalysis />
    </div>
  )
}
