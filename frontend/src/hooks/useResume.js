/**
 * Custom hook for resume state — fetch current resume and upload a new one.
 * Uses React Query for caching and background refetching.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getCurrentResume, uploadResume } from '../api/client.js'

export const RESUME_QUERY_KEY = ['resume', 'current']

/**
 * Returns the current resume data, loading state, and upload mutation.
 *
 * @returns {{
 *   resume: object | undefined,
 *   isLoading: boolean,
 *   error: Error | null,
 *   upload: (file: File) => Promise<void>,
 *   isUploading: boolean,
 *   uploadError: Error | null,
 * }}
 */
export function useResume() {
  const queryClient = useQueryClient()

  const { data: resume, isLoading, error } = useQuery({
    queryKey: RESUME_QUERY_KEY,
    queryFn: getCurrentResume,
    retry: (failureCount, err) => err?.response?.status !== 404 && failureCount < 2,
  })

  const {
    mutateAsync: upload,
    isPending: isUploading,
    error: uploadError,
  } = useMutation({
    mutationFn: uploadResume,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RESUME_QUERY_KEY })
    },
  })

  return { resume, isLoading, error, upload, isUploading, uploadError }
}
