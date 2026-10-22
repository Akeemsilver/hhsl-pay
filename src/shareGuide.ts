/** The message you can send a colleague together with the starter kit file. */
export function shareMessage(link: string, fileName: string): string {
  return [
    "Hi! This is the HHSL pay app. It tracks your days and works out your pay. Everything stays on your own phone.",
    "",
    "1. Open this link on your phone (in Chrome on Android, Safari on iPhone):",
    link,
    "",
    "2. Put it on your home screen. Android: tap Install app. iPhone: tap Share, then Add to Home Screen.",
    "",
    `3. I am sending you a file called ${fileName}. Save it on your phone.`,
    "",
    "4. Open the app from its icon. Type your name, tap Choose starter kit file and pick that file.",
    "",
    "That is it. Your days are only ever on your phone.",
  ].join("\n");
}
