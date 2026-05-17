/**
 * Kanban column definitions.
 * Column-to-status mapping: display label → API value (Application.status).
 */
export const COLUMNS = [
  { id: 'saved',     label: 'Saved',        accent: 'bg-slate-500',  border: 'border-slate-200',  header: 'bg-slate-50'  },
  { id: 'applied',   label: 'Applied',      accent: 'bg-indigo-500', border: 'border-indigo-200', header: 'bg-indigo-50' },
  { id: 'screen',    label: 'Phone Screen', accent: 'bg-amber-500',  border: 'border-amber-200',  header: 'bg-amber-50'  },
  { id: 'interview', label: 'Interview',    accent: 'bg-orange-500', border: 'border-orange-200', header: 'bg-orange-50' },
  { id: 'offer',     label: 'Offer',        accent: 'bg-green-500',  border: 'border-green-200',  header: 'bg-green-50'  },
  { id: 'rejected',  label: 'Rejected',     accent: 'bg-red-500',    border: 'border-red-200',    header: 'bg-red-50'    },
]
