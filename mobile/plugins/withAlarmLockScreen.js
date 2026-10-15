/**
 * Lets a ringing duty alarm take over the LOCK SCREEN on Android — and nothing else.
 *
 * notify-kit launches MainActivity through the alarm's full-screen intent; we set
 * `fullScreenAction.mainComponent = "main"` (src/alarms/native.ts) purely so that
 * launch carries a "mainComponent" extra. MainActivity shows over the keyguard
 * and turns the screen on ONLY for that intent, and drops both flags again in
 * onStop, so the app is never reachable from a locked phone otherwise.
 */
const { withMainActivity } = require("expo/config-plugins");

const MARKER = "// proctavo:alarm-lock-screen";

const METHODS = `
  ${MARKER}
  // Duty alarm full-screen intents carry a "mainComponent" extra.
  private fun applyAlarmWindowFlags(launch: android.content.Intent?) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O_MR1) return
    val fromAlarm = launch?.hasExtra("mainComponent") == true
    setShowWhenLocked(fromAlarm)
    setTurnScreenOn(fromAlarm)
  }

  override fun onNewIntent(intent: android.content.Intent) {
    super.onNewIntent(intent)
    applyAlarmWindowFlags(intent)
  }

  override fun onStop() {
    super.onStop()
    // Never stay reachable from the lock screen once the alarm is out of view.
    applyAlarmWindowFlags(null)
  }
`;

module.exports = function withAlarmLockScreen(config) {
  return withMainActivity(config, (cfg) => {
    let src = cfg.modResults.contents;
    if (cfg.modResults.language !== "kt") throw new Error("withAlarmLockScreen expects a Kotlin MainActivity");
    if (src.includes(MARKER)) return cfg; // already applied

    const onCreate = /(\n(\s*)super\.onCreate\([^)]*\)\n)/;
    const methodsAnchor = /\n(\s*\/\*\*\s*\n\s*\* Returns the name of the main component)/;
    if (!onCreate.test(src) || !methodsAnchor.test(src)) {
      throw new Error("withAlarmLockScreen: MainActivity.kt layout changed — update the plugin anchors");
    }
    src = src.replace(onCreate, (_m, line, indent) => `${line}${indent}applyAlarmWindowFlags(intent)\n`);
    src = src.replace(methodsAnchor, (_m, doc) => `\n${METHODS}${doc}`);
    cfg.modResults.contents = src;
    return cfg;
  });
};
