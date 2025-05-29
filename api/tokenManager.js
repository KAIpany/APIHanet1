// tokenManager.js
require("dotenv").config();
const axios = require("axios");
const qs = require("qs");

let currentAccessToken = null;
let tokenExpiresAt = null;

async function refreshAccessToken() {
  const {
    HANET_TOKEN_URL,
    HANET_CLIENT_ID,
    HANET_CLIENT_SECRET,
    HANET_REFRESH_TOKEN,
  } = process.env;

  if (!HANET_REFRESH_TOKEN || !HANET_CLIENT_ID || !HANET_CLIENT_SECRET || !HANET_TOKEN_URL) {
    throw new Error("Missing configuration (check .env)");
  }

  try {
    console.log("[tokenManager] Refreshing Access Token from HANET...");
    const response = await axios.post(
      HANET_TOKEN_URL,
      qs.stringify({
        grant_type: "refresh_token",
        client_id: HANET_CLIENT_ID,
        client_secret: HANET_CLIENT_SECRET,
        refresh_token: HANET_REFRESH_TOKEN,
      }),
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        timeout: 10000,
      }
    );

    const { access_token, expires_in } = response.data;
    currentAccessToken = access_token;
    tokenExpiresAt = Date.now() + (expires_in - 300) * 1000; // Refresh 5 minutes before expiry
    console.log("[tokenManager] Successfully refreshed Access Token");
    return access_token;
  } catch (error) {
    console.error("[tokenManager] Error refreshing token:", error.message);
    throw error;
  }
}

async function getValidHanetToken() {
  try {
    if (!currentAccessToken || !tokenExpiresAt || Date.now() >= tokenExpiresAt) {
      return await refreshAccessToken();
    }
    return currentAccessToken;
  } catch (error) {
    console.error("[tokenManager] Error getting valid token:", error.message);
    throw error;
  }
}

module.exports = {
  getValidHanetToken
};
