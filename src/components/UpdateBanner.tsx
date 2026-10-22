import { useRegisterSW } from "virtual:pwa-register/react";

const HOUR = 60 * 60 * 1000;

/** Shows an Update button when a newer version of the app has been downloaded in the background. */
export function UpdateBanner() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      if (!reg) return;
      const check = () => { void reg.update().catch(() => {}); };
      setInterval(check, HOUR);
      document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") check(); });
    },
  });
  if (!needRefresh) return null;
  return (
    <div className="update-banner" role="status">
      <span>A new version is ready.</span>
      <button className="primary" onClick={() => { void updateServiceWorker(true); setTimeout(() => window.location.reload(), 1500); }}>Update</button>
    </div>
  );
}
