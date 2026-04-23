import type { ReactNode } from "react";
import { toast as sonnerToast } from "sonner";

type ToastVariant = "default" | "destructive";

type ToastProps = {
  title?: ReactNode;
  description?: ReactNode;
  variant?: ToastVariant;
  duration?: number;
};

type ToastActionElement = never;

type ToastOptions = ToastProps & {
  action?: ToastActionElement;
};

type ToastHandle = {
  id: string | number;
  dismiss: () => void;
  update: (props: ToastOptions) => void;
};

function showToast(props: ToastOptions): ToastHandle {
  const { title, description, variant, duration } = props;
  const message = title ?? description ?? "Notification";
  const options = {
    description,
    duration,
  };

  const id = variant === "destructive"
    ? sonnerToast.error(message, options)
    : sonnerToast(message, options);

  return {
    id,
    dismiss: () => sonnerToast.dismiss(id),
    update: (nextProps: ToastOptions) => {
      sonnerToast.dismiss(id);
      showToast(nextProps);
    },
  };
}

function useToast() {
  return {
    toast: showToast,
    dismiss: (toastId?: string | number) => sonnerToast.dismiss(toastId),
  };
}

export { useToast, showToast as toast };
