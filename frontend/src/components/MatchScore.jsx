/**
 * MatchScore component — placeholder for Phase 3.
 * Will render the gap analysis output from the Resume Comparator agent.
 *
 * @param {{ score?: number }} props
 */
export default function MatchScore({ score }) {
  if (score == null) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-gray-400 text-sm">
        Match Score — implemented in Phase 3
      </div>
    )
  }

  const color = score >= 75 ? 'text-green-600' : score >= 50 ? 'text-yellow-600' : 'text-red-600'

  return (
    <div className="rounded-xl border border-gray-200 p-6 text-center">
      <p className="text-xs uppercase tracking-wider text-gray-400 mb-1">Match Score</p>
      <p className={`text-5xl font-bold ${color}`}>{score}</p>
      <p className="text-xs text-gray-400 mt-1">out of 100</p>
    </div>
  )
}
