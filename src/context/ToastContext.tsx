import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

type ToastContextValue = {
  message: string;
  showToast: (message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState("");

  const value = useMemo(
    () => ({
      message,
      showToast: (nextMessage: string) => {
        setMessage(nextMessage);
        window.setTimeout(() => setMessage(""), 2400);
      }
    }),
    [message]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className={message ? "toast show" : "toast"}>{message}</div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const value = useContext(ToastContext);
  if (!value) throw new Error("useToast must be used inside ToastProvider");
  return value;
}
