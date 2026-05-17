/**
 * KanbanBoard page — the application pipeline tracker.
 *
 * Wraps the KanbanBoard component with a page header.
 * Accessible via /kanban and also rendered inside /applications.
 */
import KanbanBoard from '../components/KanbanBoard.jsx'

export default function KanbanBoardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Kanban Board</h1>
        <p className="text-sm text-gray-500 mt-1">
          Drag cards between columns to update application status. Click any card to view details.
        </p>
      </div>
      <KanbanBoard />
    </div>
  )
}
