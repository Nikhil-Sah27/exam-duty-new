const {
  api, setToken, clearToken, test,
  assert, assertStatus, summary, resetCounters,
} = require("./helpers");

/**
 * Android app download (proctavo.com/app):
 *
 *   - GET /mobile-app is public — teachers open the download page signed out
 *   - GET /mobile-app/android serves the APK uploaded to the server, or a 404
 *     until one exists (CI never has one; production does). Checked with HEAD so
 *     a run against production doesn't pull 100 MB.
 */
async function run(token) {
  console.log("\n📲 MOBILE APP DOWNLOAD TESTS\n");
  resetCounters();
  clearToken();

  let android = null;

  await test("App info is public and describes the Android build", async () => {
    const res = await api.get("/mobile-app");
    assertStatus(res, 200);
    android = res.data.data.android;
    assert(typeof android.available === "boolean", "android.available is a boolean");
    if (android.available) {
      assert(android.sizeBytes > 0, "an available APK has a size");
      assert(!Number.isNaN(Date.parse(android.updatedAt)), "an available APK has an updatedAt");
    }
  });

  await test("Download matches the info: the APK when available, 404 otherwise", async () => {
    if (android?.available) {
      const res = await api.head("/mobile-app/android");
      assertStatus(res, 200);
      assert(
        res.headers["content-type"].startsWith("application/vnd.android.package-archive"),
        `APK content type, got ${res.headers["content-type"]}`
      );
      assert(Number(res.headers["content-length"]) === android.sizeBytes, "length matches the advertised size");
      assert(/Proctavo\.apk/.test(res.headers["content-disposition"] || ""), "downloads as Proctavo.apk");
      return;
    }
    try {
      await api.get("/mobile-app/android");
    } catch (err) {
      assert(err.response && err.response.status === 404, `expected 404, got ${err.response?.status}`);
      return;
    }
    throw new Error("expected 404 with no APK uploaded, request succeeded");
  });

  if (token) setToken(token);
  return summary("MOBILE APP");
}

module.exports = run;
if (require.main === module) run();
