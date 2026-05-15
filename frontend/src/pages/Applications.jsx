/**
 * Applications page — Kanban board for tracking application status.
 * Full drag-and-drop implementation in Phase 5; currently shows placeholder.
 */
import KanbanBoard from '../components/KanbanBoard.jsx'

export default function Applications() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Applications</h1>
        <p className="text-sm text-gray-500 mt-1">
          Track your applications through each stage of the pipeline.
        </p>
      </div>
      <KanbanBoard />
    </div>
  )
}
