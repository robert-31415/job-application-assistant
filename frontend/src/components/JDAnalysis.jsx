/**
 * JDAnalysis component.
 *
 * Renders a structured JDAnalysisOutput object returned by the analysis agent.
 * - Company research in a highlighted callout box
 * - Required skills as solid chip/tag elements
 * - Nice-to-have skills as secondary chip list
 * - Seniority level as a coloured badge
 * - Key responsibilities as a bulleted list
 *
 * @param {{ analysis: object }} props
 */
import { BookOpen, Briefcase, Building2, DollarSign, MapPin, Star } from 'lucide-react'

/** Map seniority level strings to Tailwind colour classes. */
const SENIORITY_COLOURS = {
  junior: 'bg-green-100 text-green-800',
  mid: 'bg-blue-100 text-blue-800',
  senior: 'bg-purple-100 text-purple-800',
  staff: 'bg-orange-100 text-orange-800',
  exec: 'bg-red-100 text-red-800',
}

/**
 * A single chip/tag element for a skill.
 *
 * @param {{ label: string, variant?: 'primary' | 'secondary' }} props
 */
function SkillChip({ label, variant = 'primary' }) {
  const base = 'inline-block px-2.5 py-0.5 rounded-full text-xs font-medium'
  const colours =
    variant === 'primary'
      ? 'bg-brand-50 text-brand-700 border border-brand-200'
      : 'bg-gray-100 text-gray-600 border border-gray-200'
  return <span className={`${base} ${colours}`}>{label}</span>
}

/**
 * Labelled row used for metadata fields (location, salary, seniority).
 *
 * @param {{ icon: React.ComponentType, label: string, children: React.ReactNode }} props
 */
function MetaRow({ icon: Icon, label, children }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <Icon size={15} className="text-gray-400 mt-0.5 shrink-0" />
      <span className="text-gray-500 min-w-[90px] shrink-0">{label}</span>
      <span className="text-gray-800">{children}</span>
    </div>
  )
}

export default function JDAnalysis({ analysis }) {
  if (!analysis) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-gray-400 text-sm">
        Run an analysis to see results here.
      </div>
    )
  }

  const seniorityColour =
    SENIORITY_COLOURS[analysis.seniority_level?.toLowerCase()] ?? 'bg-gray-100 text-gray-700'

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{analysis.role_title}</h2>
            <p className="text-sm text-gray-500 mt-0.5">{analysis.company}</p>
          </div>
          <span
            className={`px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wide ${seniorityColour}`}
          >
            {analysis.seniority_level}
          </span>
        </div>

        <div className="mt-4 space-y-2">
          {analysis.location && (
            <MetaRow icon={MapPin} label="Location">{analysis.location}</MetaRow>
          )}
          {analysis.salary_hint && (
            <MetaRow icon={DollarSign} label="Salary">{analysis.salary_hint}</MetaRow>
          )}
        </div>
      </div>

      {/* Company research callout */}
      {analysis.company_research && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
          <Building2 size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">
              Company Research
            </p>
            <p className="text-sm text-amber-900 leading-relaxed">{analysis.company_research}</p>
          </div>
        </div>
      )}

      {/* Required skills */}
      {analysis.required_skills?.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Star size={15} className="text-brand-600" />
            <h3 className="text-sm font-semibold text-gray-700">Required Skills</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {analysis.required_skills.map((skill) => (
              <SkillChip key={skill} label={skill} variant="primary" />
            ))}
          </div>
        </div>
      )}

      {/* Nice-to-have skills */}
      {analysis.nice_to_have_skills?.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Star size={15} className="text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-700">Nice-to-Have Skills</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {analysis.nice_to_have_skills.map((skill) => (
              <SkillChip key={skill} label={skill} variant="secondary" />
            ))}
          </div>
        </div>
      )}

      {/* Key responsibilities */}
      {analysis.key_responsibilities?.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <BookOpen size={15} className="text-brand-600" />
            <h3 className="text-sm font-semibold text-gray-700">Key Responsibilities</h3>
          </div>
          <ul className="space-y-1.5">
            {analysis.key_responsibilities.map((resp, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-brand-500 shrink-0" />
                {resp}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Role metadata (Briefcase row at the bottom) */}
      <div className="flex items-center gap-2 text-xs text-gray-400 px-1">
        <Briefcase size={12} />
        <span>
          {analysis.required_skills?.length ?? 0} required skill
          {analysis.required_skills?.length !== 1 ? 's' : ''} ·{' '}
          {analysis.nice_to_have_skills?.length ?? 0} nice-to-have ·{' '}
          {analysis.key_responsibilities?.length ?? 0} responsibilities
        </span>
      </div>
    </div>
  )
}
