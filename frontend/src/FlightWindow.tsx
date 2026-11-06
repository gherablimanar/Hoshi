import { createContext, useContext, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
export const FlightDialogTarget = createContext<HTMLElement | null>(null);
export const FlightDialogError = createContext("");
export function FlightWindow({
  target,
  close,
  children,
  projectName,
}: {
  target: Window;
  close: () => void;
  children: React.ReactNode;
  projectName: string;
}) {
  const callback = useRef(close);
  callback.current = close;
  useEffect(() => {
    const closed = () => callback.current();
    target.addEventListener("beforeunload", closed);
    const mainClosing = () => target.close();
    window.addEventListener("beforeunload", mainClosing);
    return () => {
      target.removeEventListener("beforeunload", closed);
      window.removeEventListener("beforeunload", mainClosing);
    };
  }, [target]);
  return createPortal(
    <div className="app hoshi-flight-window" data-mode="flight">
      <header className="flight-window-heading">
        <div>
          <strong>Hoshi · Flight Simulation</strong>
          <small>
            {projectName} · Powered by OpenRocket 24.12 · shared connection
          </small>
        </div>
        <button
          onClick={() => {
            target.close();
            close();
          }}
        >
          Close simulation window
        </button>
      </header>
      {children}
    </div>,
    target.document.body,
  );
}
export function useFlightDialogTarget() {
  return useContext(FlightDialogTarget);
}
export function useFlightDialogError() {
  return useContext(FlightDialogError);
}
