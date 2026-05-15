/**
 * Dashboard page — the home screen of the application.
 *
 * Shows:
 * - Resume upload widget (fully functional in Phase 1)
 * - Summary stats row (applications count by status)
 * - Quick-access cards for other sections
 */
import { Link } from 'react-router-dom'
import { ArrowRight, BriefcaseBusiness, FileText } from 'lucide-react'
import ResumeUpload from '../components/ResumeUpload.jsx'
import { useApplications } from '../hooks/useApplications.js'

/**
 * Stat card displayed in the summary row.
 *
 * @param {{ label: string, value: number, color: string }} props
 */
function StatCard({ label, value, color }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-1">
      <span className={`text-2xl font-bold ${color}`}>{value}</span>
      <span className="text-xs text-gray-500 uppercase tracking-wider">{label}</span>
    </div>
  )
}

export default function Dashboard() {
  const { applications, isLoading } = useApplications()

  const counts = {
    total: applications.length,
    active: applications.filter((a) => !['offer', 'rejected'].includes(a.status)).length,
    offers: applications.filter((a) => a.status === 'offer').length,
  }

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          Upload your resume to get started, then analyze job descriptions.
        </p>
      </div>

      {/* Stats row */}
      {!isLoading && (
        <div className="grid grid-cols-3 gap-4">
          <StatCard label="Total applications" value={counts.total} color="text-gray-800" />
          <StatCard label="In progress" value={counts.active} color="text-brand-600" />
          <StatCard label="Offers" value={counts.offers} color="text-green-600" />
        </div>
      )}

      {/* Resume upload */}
      <section>
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">
          Your Resume
        </h2>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <ResumeUpload />
        </div>
      </section>

      {/* Quick links */}
      <section>
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">
          Next Steps
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <Link
            to="/analyze"
            className="bg-white rounded-xl border border-gray-200 p-5 hover:border-brand-500 hover:shadow-sm transition group flex items-start justify-between"
          >
            <div>
              <FileText size={20} className="text-brand-600 mb-2" />
              <p className="font-medium text-gray-800 text-sm">Analyze a Job Description</p>
              <p className="text-xs text-gray-400 mt-1">Extract skills, seniority, and company research</p>
            </div>
            <ArrowRight size={16} className="text-gray-300 group-hover:text-brand-500 mt-1 transition" />
          </Link>

          <Link
            to="/applications"
            className="bg-white rounded-xl border border-gray-200 p-5 hover:border-brand-500 hover:shadow-sm transition group flex items-start justify-between"
          >
            <div>
              <BriefcaseBusiness size={20} className="text-brand-600 mb-2" />
              <p className="font-medium text-gray-800 text-sm">Track Applications</p>
              <p className="text-xs text-gray-400 mt-1">Kanban board — Saved → Offer</p>
            </div>
            <ArrowRight size={16} className="text-gray-300 group-hover:text-brand-500 mt-1 transition" />
          </Link>
        </div>
      </section>
    </div>
  )
}
