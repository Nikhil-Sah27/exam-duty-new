// Backend base URL. Production is same-origin /api behind nginx on proctavo.com.
// Override for local testing with EXPO_PUBLIC_API_URL (e.g. http://192.168.1.10:5050/api).
export const API_URL = process.env.EXPO_PUBLIC_API_URL || "https://proctavo.com/api";

// The web app, for flows the phone app links out to (change requests, messages).
export const WEB_URL = API_URL.replace(/\/api\/?$/, "");
