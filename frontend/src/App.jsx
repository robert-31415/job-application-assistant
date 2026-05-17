/**
 * Root component — sets up React Router and the top-level navigation shell.
 * Each route maps to a full-page view component.
 */
import { BrowserRouter, Link, NavLink, Route, Routes } from 'react-router-dom'
import { BriefcaseBusiness, FileText, Kanban, LayoutDashboard, ListChecks, MessageSquare, PenLine } from 'lucide-react'
import Dashboard from './pages/Dashboard.jsx'
import Analyze from './pages/Analyze.jsx'
import Applications from './pages/Applications.jsx'
import CoverLetter from './pages/CoverLetter.jsx'
import InterviewPrep from './pages/InterviewPrep.jsx'
import KanbanBoardPage from './pages/KanbanBoard.jsx'
import Export from './pages/Export.jsx'

/** Navigation items rendered in the sidebar. */
const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/analyze', label: 'Analyze JD', icon: FileText },
  { to: '/kanban', label: 'Kanban Board', icon: Kanban },
  { to: '/applications', label: 'Applications', icon: BriefcaseBusiness },
  { to: '/cover-letter', label: 'Cover Letter', icon: PenLine },
  { to: '/interview-prep', label: 'Interview Prep', icon: MessageSquare },
  { to: '/export', label: 'Export', icon: ListChecks },
]

/**
 * Sidebar navigation component.
 * Uses NavLink so the active route is visually highlighted.
 */
function Sidebar() {
  return (
    <aside className="w-60 min-h-screen bg-gray-900 text-white flex flex-col">
      <div className="px-6 py-5 border-b border-gray-700">
        <Link to="/" className="text-lg font-semibold tracking-tight">
          Job Assistant
        </Link>
        <p className="text-xs text-gray-400 mt-0.5">AI-powered applications</p>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-brand-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`
            }
          >
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}

/**
 * App — mounts the router, sidebar, and page content area.
 */
export default function App() {
  return (
    <BrowserRouter>
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <main className="flex-1 p-8 overflow-y-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/analyze" element={<Analyze />} />
            <Route path="/kanban" element={<KanbanBoardPage />} />
            <Route path="/applications" element={<Applications />} />
            <Route path="/cover-letter" element={<CoverLetter />} />
            <Route path="/interview-prep" element={<InterviewPrep />} />
            <Route path="/export" element={<Export />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
