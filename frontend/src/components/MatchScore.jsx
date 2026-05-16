/**
 * MatchScore component.
 *
 * Renders the full GapAnalysisOutput from the Resume Comparator agent:
 * - Circular SVG progress gauge showing the 0–100 match score
 * - Colour-coded: red < 50, yellow 50–74, green ≥ 75
 * - Score label and rubric tier below the gauge
 * - Reasoning paragraph
 * - Strengths as green checkmark list items
 * - Gaps as red X list items
 * - Suggestions as a numbered improvement list
 *
 * @param {{ gapAnalysis: object | null }} props
 */
import { CheckCircle2, Lightbulb, XCircle } from 'lucide-react'

// SVG gauge constants
const RADIUS = 52
const CIRCUMFERENCE = 2 * Math.PI * RADIUS  // ≈ 326.7

/**
 * Return Tailwind colour tokens for a given score.
 * @param {number} score
 * @returns {{ stroke: string, text: string, bg: string, badge: string }}
 */
function scoreColours(score) {
  if (score >= 75) {
    return {
      stroke: '#16a34a',   // green-600
      text: 'text-green-600',
      bg: 'bg-green-50',
      badge: 'bg-green-100 text-green-800',
    }
  }
  if (score >= 50) {
    return {
      stroke: '#ca8a04',   // yellow-600
      text: 'text-yellow-600',
      bg: 'bg-yellow-50',
      badge: 'bg-yellow-100 text-yellow-800',
    }
  }
  return {
    stroke: '#dc2626',     // red-600
    text: 'text-red-600',
    bg: 'bg-red-50',
    badge: 'bg-red-100 text-red-800',
  }
}

/**
 * Human-readable rubric tier for a score.
 * @param {number} score
 * @returns {string}
 */
function scoreTier(score) {
  if (score >= 90) return 'Exceptional match'
  if (score >= 75) return 'Strong match'
  if (score >= 50) return 'Meets minimum requirements'
  return 'Does not meet minimum requirements'
}

/**
 * Circular SVG progress gauge.
 *
 * @param {{ score: number, colours: object }} props
 */
function Gauge({ score, colours }) {
  const filled = CIRCUMFERENCE * (score / 100)
  const offset = CIRCUMFERENCE - filled

  return (
    <svg
      width="140"
      height="140"
      viewBox="0 0 120 120"
      className="mx-auto"
      aria-label={`Match score: ${score} out of 100`}
    >
      {/* Track ring */}
      <circle
        cx="60"
        cy="60"
        r={RADIUS}
        fill="none"
        stroke="#e5e7eb"
        strokeWidth="10"
      />
      {/* Progress arc — rotated so it starts at 12 o'clock */}
      <circle
        cx="60"
        cy="60"
        r={RADIUS}
        fill="none"
        stroke={colours.stroke}
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
        strokeDashoffset={offset}
        transform="rotate(-90 60 60)"
        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
      />
      {/* Score label */}
      <text
        x="60"
        y="56"
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="22"
        fontWeight="700"
        fill={colours.stroke}
      >
        {score}
      </text>
      <text
        x="60"
        y="74"
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="9"
        fill="#9ca3af"
      >
        out of 100
      </text>
    </svg>
  )
}

export default function MatchScore({ gapAnalysis }) {
  if (!gapAnalysis) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-gray-400 text-sm">
        Run &quot;Compare with My Resume&quot; to see your match score here.
      </div>
    )
  }

  const { match_score, match_reasoning, strengths, gaps, suggestions } = gapAnalysis
  const colours = scoreColours(match_score)

  return (
    <div className="space-y-4">
      {/* Gauge + tier */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <Gauge score={match_score} colours={colours} />
        <div className="mt-3 text-center">
          <span
            className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${colours.badge}`}
          >
            {scoreTier(match_score)}
          </span>
        </div>

        {/* Reasoning */}
        {match_reasoning && (
          <p className="mt-4 text-sm text-gray-600 leading-relaxed text-center max-w-md mx-auto">
            {match_reasoning}
          </p>
        )}
      </div>

      {/* Strengths */}
      {strengths?.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <CheckCircle2 size={15} className="text-green-500" />
            Strengths
          </h3>
          <ul className="space-y-2">
            {strengths.map((s, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-gray-700">
                <CheckCircle2
                  size={15}
                  className="text-green-500 mt-0.5 shrink-0"
                />
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Gaps */}
      {gaps?.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <XCircle size={15} className="text-red-500" />
            Gaps
          </h3>
          <ul className="space-y-2">
            {gaps.map((g, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-gray-700">
                <XCircle size={15} className="text-red-500 mt-0.5 shrink-0" />
                {g}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Suggestions */}
      {suggestions?.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Lightbulb size={15} className="text-amber-500" />
            How to Improve This Application
          </h3>
          <ol className="space-y-2">
            {suggestions.map((s, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-gray-700">
                <span className="shrink-0 w-5 h-5 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                {s}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}
