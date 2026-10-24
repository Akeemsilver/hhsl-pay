// Receives a spreadsheet shared to the app from another app (Google Sheets, Drive, Files, ...) on Android:
// the file is kept for a moment, then the app opens and picks it up.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "POST" || !url.pathname.endsWith("/share-target")) return;
  event.respondWith((async () => {
    try {
      const form = await event.request.formData();
      const file = form.get("file");
      if (file && typeof file !== "string" && file.size) {
        const cache = await caches.open("shared-files");
        await cache.put("shared-file", new Response(file, {
          headers: { "X-File-Name": encodeURIComponent(file.name || "shared.xlsx"), "Content-Type": file.type || "application/octet-stream" },
        }));
      }
    } catch (e) { /* the app opens anyway and shows nothing to import */ }
    return Response.redirect(url.pathname.replace(/share-target$/, "") + "?shared=1", 303);
  })());
});
