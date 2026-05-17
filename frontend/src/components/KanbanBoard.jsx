/**
 * KanbanBoard component.
 *
 * Full drag-and-drop application tracker using @hello-pangea/dnd.
 * 6 columns in pipeline order: Saved → Applied → Phone Screen → Interview → Offer → Rejected
 *
 * Column-to-status mapping (display label → API value):
 *   Saved → saved, Applied → applied, Phone Screen → screen,
 *   Interview → interview, Offer → offer, Rejected → rejected
 *
 * Drag-end fires PATCH /api/applications/{id} with the new status.
 * "Add Application" button appears only in the Saved column.
 */
import { useState } from 'react'
import { DragDropContext, Droppable } from '@hello-pangea/dnd'
import { Plus } from 'lucide-react'
import { COLUMNS } from '../constants/kanban.js'
import { useApplications } from '../hooks/useApplications.js'
import AddApplicationModal from './AddApplicationModal.jsx'
import ApplicationDrawer from './ApplicationDrawer.jsx'
import KanbanCard from './KanbanCard.jsx'

export default function KanbanBoard() {
  const { applications, isLoading, update, remove } = useApplications()
  const [drawerApp, setDrawerApp] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)

  function getColumnApps(statusId) {
    return applications.filter((a) => a.status === statusId)
  }

  async function handleDragEnd(result) {
    const { destination, source, draggableId } = result
    if (!destination) return
    if (destination.droppableId === source.droppableId) return

    const appId = Number(draggableId)
    await update({ id: appId, payload: { status: destination.droppableId } })
  }

  if (isLoading) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map((col) => (
          <div
            key={col.id}
            className="w-60 shrink-0 rounded-xl border border-gray-200 bg-white h-48 animate-pulse"
          />
        ))}
      </div>
    )
  }

  return (
    <>
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4 items-start">
          {COLUMNS.map((col) => {
            const colApps = getColumnApps(col.id)
            return (
              <div
                key={col.id}
                className={`w-64 shrink-0 rounded-xl border ${col.border} flex flex-col`}
              >
                {/* Column header */}
                <div className={`${col.header} px-3 py-2.5 rounded-t-xl flex items-center justify-between`}>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${col.accent}`} />
                    <span className="text-sm font-semibold text-gray-700">{col.label}</span>
                  </div>
                  <span className="text-xs font-medium text-gray-500 bg-white px-1.5 py-0.5 rounded-full border border-gray-200">
                    {colApps.length}
                  </span>
                </div>

                {/* Droppable zone */}
                <Droppable droppableId={col.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex-1 p-2 space-y-2 min-h-[120px] rounded-b-xl transition-colors
                        ${snapshot.isDraggingOver ? 'bg-gray-100' : 'bg-white'}`}
                    >
                      {colApps.map((app, index) => (
                        <KanbanCard
                          key={app.id}
                          application={app}
                          index={index}
                          onOpenDrawer={setDrawerApp}
                          onUpdate={update}
                          onDelete={remove}
                        />
                      ))}
                      {provided.placeholder}

                      {/* Add button — Saved column only */}
                      {col.id === 'saved' && (
                        <button
                          type="button"
                          onClick={() => setShowAddModal(true)}
                          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg
                            text-xs text-gray-400 border border-dashed border-gray-300
                            hover:border-brand-400 hover:text-brand-600 transition"
                        >
                          <Plus size={13} />
                          Add Application
                        </button>
                      )}
                    </div>
                  )}
                </Droppable>
              </div>
            )
          })}
        </div>
      </DragDropContext>

      {drawerApp && (
        <ApplicationDrawer
          application={drawerApp}
          onClose={() => setDrawerApp(null)}
        />
      )}

      {showAddModal && (
        <AddApplicationModal onClose={() => setShowAddModal(false)} />
      )}
    </>
  )
}
