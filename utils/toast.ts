import { toast } from 'sonner'

export const notify = {
  loading: (title: string, description?: string) => {
    return toast.loading(title, {
      description,
    })
  },
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
  dismiss: (toastId?: string | number) => {
    toast.dismiss(toastId)
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
