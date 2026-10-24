// Receives a spreadsheet shared to the app from another app (Google Sheets, Drive, Files, ...) on Android:
// the file is kept for a moment, then the app opens and picks it up. If no file came with the share, the app is told so.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "POST" || !url.pathname.endsWith("/share-target")) return;
  event.respondWith((async () => {
    let got = false;
    try {
      const form = await event.request.formData();
      let file = null;
      for (const [, value] of form.entries()) { if (typeof value !== "string" && value.size) { file = value; break; } }
      if (file) {
        const cache = await caches.open("shared-files");
        await cache.put("shared-file", new Response(file, {
          headers: { "X-File-Name": encodeURIComponent(file.name || "shared.xlsx"), "Content-Type": file.type || "application/octet-stream" },
        }));
        got = true;
      }
    } catch (e) { /* treated as no file */ }
    return Response.redirect(url.pathname.replace(/share-target$/, "") + (got ? "?shared=1" : "?shared=empty"), 303);
  })());
});
