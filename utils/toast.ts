import { toast } from 'sonner'

export const notify = {
  success: (title: string, description?: string) => {
    toast.success(title, {
      description,
    })
  },
  error: (title: string, description?: string) => {
    toast.error(title, {
      description,
    })
  },
  info: (title: string, description?: string) => {
    toast.info(title, {
      description,
    })
  },
  warning: (title: string, description?: string) => {
    toast.warning(title, {
      description,
    })
  },
  promise: (
    promise: Promise<unknown>,
    messages: { loading: string; success: string; error: string }
  ) => {
    toast.promise(promise, {
      loading: messages.loading,
      success: messages.success,
      error: messages.error,
    })
  },
}
