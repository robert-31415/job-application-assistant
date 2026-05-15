/**
 * Custom hook for application CRUD operations.
 * Uses React Query for list caching and optimistic updates.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createApplication,
  deleteApplication,
  listApplications,
  updateApplication,
} from '../api/client.js'

export const APPLICATIONS_QUERY_KEY = ['applications']

/**
 * Returns the application list and mutation helpers.
 *
 * @param {string} [statusFilter] - Optional Kanban status to filter by.
 * @returns {{
 *   applications: object[],
 *   isLoading: boolean,
 *   create: (payload: object) => Promise<object>,
 *   update: (args: { id: number, payload: object }) => Promise<object>,
 *   remove: (id: number) => Promise<void>,
 * }}
 */
export function useApplications(statusFilter) {
  const queryClient = useQueryClient()

  const { data: applications = [], isLoading } = useQuery({
    queryKey: [...APPLICATIONS_QUERY_KEY, statusFilter],
    queryFn: () => listApplications(statusFilter),
  })

  const { mutateAsync: create } = useMutation({
    mutationFn: createApplication,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: APPLICATIONS_QUERY_KEY }),
  })

  const { mutateAsync: update } = useMutation({
    mutationFn: ({ id, payload }) => updateApplication(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: APPLICATIONS_QUERY_KEY }),
  })

  const { mutateAsync: remove } = useMutation({
    mutationFn: deleteApplication,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: APPLICATIONS_QUERY_KEY }),
  })

  return { applications, isLoading, create, update, remove }
}
