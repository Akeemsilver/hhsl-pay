/** Step by step: put the app on the home screen, on Android and on iPhone / iPad. */
export function InstallHelp({ open }: { open?: "android" | "iphone" }) {
  return (
    <div className="install-help">
      <details open={open === "android"}>
        <summary>Android (Chrome)</summary>
        <ol className="steps">
          <li>Open the app's link in <strong>Chrome</strong>. Do not use a private tab or a browser inside another app such as WhatsApp.</li>
          <li>Tap the <strong>Install app</strong> button on the Home screen. Or tap the three dots at the top right, then <strong>Install app</strong> (or <strong>Add to Home screen</strong>).</li>
          <li>Tap <strong>Install</strong> to confirm. The app icon appears on your home screen.</li>
          <li>Open it from the icon. It runs full screen like any other app.</li>
        </ol>
      </details>
      <details open={open === "iphone"}>
        <summary>iPhone or iPad (Safari)</summary>
        <ol className="steps">
          <li>Open the app's link in <strong>Safari</strong>. (Chrome on iPhone can also do it, from its Share menu, but Safari is the most reliable.)</li>
          <li>Tap the <strong>Share</strong> button, the square with an arrow pointing up, at the bottom of the screen (at the top on an iPad).</li>
          <li>Scroll down the list and tap <strong>Add to Home Screen</strong>. If you do not see it, scroll to the bottom and tap Edit Actions, or make sure you are in Safari.</li>
          <li>Tap <strong>Add</strong> at the top right. The icon appears on your home screen.</li>
          <li>Open the app from the icon, not from Safari.</li>
        </ol>
        <p className="muted small">On iPhone there is no Install button, because Apple does not allow it. Install it from the home screen so Safari keeps your data. Safari can clear the data of websites you have not opened for a while, so make a backup now and then in Settings, Backup &amp; restore.</p>
      </details>
    </div>
  );
}
