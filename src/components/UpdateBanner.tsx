import { useEffect, useRef, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";

const HOUR = 60 * 60 * 1000;

/**
 * A new version installs and takes over by itself in the background. This banner then offers to reload so the
 * screen you are on switches to it. It also looks for a new version every hour and each time the app is reopened.
 */
export function UpdateBanner() {
  const [ready, setReady] = useState(false);
  // The very first install also fires "controllerchange"; only a change from an earlier version counts.
  const hadController = useRef(typeof navigator !== "undefined" && !!navigator.serviceWorker?.controller);

  useRegisterSW({
    onRegisteredSW(_url, reg) {
      if (!reg) return;
      const check = () => { void reg.update().catch(() => {}); };
      setInterval(check, HOUR);
      document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") check(); });
    },
  });

  useEffect(() => {
    const sw = navigator.serviceWorker;
    if (!sw) return;
    const changed = () => {
      if (hadController.current) setReady(true);
      else hadController.current = true; // the first install taking over; later changes are updates
    };
    sw.addEventListener("controllerchange", changed);
    return () => sw.removeEventListener("controllerchange", changed);
  }, []);

  if (!ready) return null;
  return (
    <div className="update-banner" role="status">
      <span>A new version is ready.</span>
      <button className="primary" onClick={() => window.location.reload()}>Update</button>
    </div>
  );
}
