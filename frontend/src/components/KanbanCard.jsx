/**
 * KanbanCard component.
 *
 * Renders a single application card inside a Kanban column.
 * - Company name (large) + role title
 * - Match score badge: red <50, yellow 50–74, green ≥75, grey if null
 * - Date created
 * - Notes icon: toggles an inline textarea; auto-saves on blur
 * - Delete icon: inline confirmation before calling DELETE
 * - Clicking the card body (not icons) opens the ApplicationDrawer
 *
 * Wrapped in @hello-pangea/dnd Draggable; drag handle is the grip area at the top.
 */
import { useState, useRef } from 'react'
import { Draggable } from '@hello-pangea/dnd'
import { FileText, GripVertical, Trash2 } from 'lucide-react'

/**
 * Return Tailwind classes for a match score badge.
 * @param {number|null} score
 */
function scoreBadgeClass(score) {
  if (score === null || score === undefined) return 'bg-gray-100 text-gray-500'
  if (score >= 75) return 'bg-green-100 text-green-700'
  if (score >= 50) return 'bg-yellow-100 text-yellow-700'
  return 'bg-red-100 text-red-700'
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export default function KanbanCard({ application, index, onOpenDrawer, onUpdate, onDelete }) {
  const [notesOpen, setNotesOpen] = useState(false)
  const [notesValue, setNotesValue] = useState(application.notes ?? '')
  const [lastSaved, setLastSaved] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const notesRef = useRef(null)

  async function handleNotesBlur() {
    if (notesValue === (application.notes ?? '')) return
    await onUpdate({ id: application.id, payload: { notes: notesValue } })
    setLastSaved(new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }))
  }

  function handleNotesIconClick(e) {
    e.stopPropagation()
    setNotesOpen((prev) => {
      if (!prev) {
        // Focus the textarea after it mounts
        setTimeout(() => notesRef.current?.focus(), 0)
      }
      return !prev
    })
  }

  function handleDeleteClick(e) {
    e.stopPropagation()
    setConfirmDelete(true)
  }

  async function handleConfirmDelete(e) {
    e.stopPropagation()
    await onDelete(application.id)
  }

  function handleCancelDelete(e) {
    e.stopPropagation()
    setConfirmDelete(false)
  }

  function handleCardClick() {
    if (!confirmDelete) onOpenDrawer(application)
  }

  return (
    <Draggable draggableId={String(application.id)} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          onClick={handleCardClick}
          className={`bg-white rounded-lg border border-gray-200 shadow-sm cursor-pointer
            transition-shadow select-none
            ${snapshot.isDragging ? 'shadow-lg rotate-1 border-brand-300' : 'hover:shadow-md'}`}
        >
          {/* Drag handle row */}
          <div
            {...provided.dragHandleProps}
            onClick={(e) => e.stopPropagation()}
            className="flex items-center justify-between px-3 pt-2.5 pb-1"
          >
            <GripVertical size={14} className="text-gray-300" />
            <div className="flex items-center gap-1.5">
              {/* Match score badge */}
              <span
                className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${scoreBadgeClass(application.match_score)}`}
              >
                {application.match_score !== null && application.match_score !== undefined
                  ? `${application.match_score}%`
                  : '—'}
              </span>
            </div>
          </div>

          {/* Card body */}
          <div className="px-3 pb-2">
            <p className="text-sm font-semibold text-gray-800 leading-tight">{application.company}</p>
            <p className="text-xs text-gray-500 mt-0.5 leading-tight">{application.role_title}</p>
            <p className="text-xs text-gray-400 mt-1.5">{formatDate(application.created_at)}</p>
          </div>

          {/* Notes area */}
          {notesOpen && (
            <div className="px-3 pb-2" onClick={(e) => e.stopPropagation()}>
              <textarea
                ref={notesRef}
                className="w-full text-xs text-gray-700 border border-gray-200 rounded-md p-2
                  resize-none focus:outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-400"
                rows={3}
                placeholder="Add notes…"
                value={notesValue}
                onChange={(e) => setNotesValue(e.target.value)}
                onBlur={handleNotesBlur}
              />
              {lastSaved && (
                <p className="text-xs text-gray-400 mt-0.5">Saved {lastSaved}</p>
              )}
            </div>
          )}

          {/* Action row */}
          {!confirmDelete ? (
            <div
              className="flex items-center justify-end gap-1 px-3 pb-2"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={handleNotesIconClick}
                title="Notes"
                className={`p-1 rounded transition ${
                  notesOpen ? 'text-brand-600 bg-brand-50' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <FileText size={13} />
              </button>
              <button
                type="button"
                onClick={handleDeleteClick}
                title="Delete"
                className="p-1 rounded text-gray-400 hover:text-red-500 transition"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ) : (
            <div
              className="flex items-center justify-end gap-2 px-3 pb-2 text-xs"
              onClick={(e) => e.stopPropagation()}
            >
              <span className="text-gray-500">Delete?</span>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="text-red-600 font-medium hover:underline"
              >
                Yes
              </button>
              <button
                type="button"
                onClick={handleCancelDelete}
                className="text-gray-500 hover:underline"
              >
                No
              </button>
            </div>
          )}
        </div>
      )}
    </Draggable>
  )
}
