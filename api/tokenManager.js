// tokenManager.js
require("dotenv").config();
const axios = require("axios");
const qs = require("qs");
const tokenStorage = require("./tokenStorage");

let currentAccessToken = null;
let tokenExpiresAt = null;
let dynamicConfig = null;

async function refreshAccessToken() {
  const config = dynamicConfig || {
    clientId: process.env.HANET_CLIENT_ID,
    clientSecret: process.env.HANET_CLIENT_SECRET,
    tokenUrl: process.env.HANET_TOKEN_URL || "https://oauth.hanet.com/token",
    refreshToken: process.env.HANET_REFRESH_TOKEN,
  };

  if (!config.refreshToken || !config.clientId || !config.clientSecret || !config.tokenUrl) {
    throw new Error("Thiếu thông tin cấu hình để làm mới token (kiểm tra .env hoặc dynamicConfig)");
  }

  const requestData = {
    grant_type: "refresh_token",
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: config.refreshToken,
  };

  try {
    const response = await axios.post(
      config.tokenUrl,
      qs.stringify(requestData),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" }, timeout: 10000 }
    );
    if (response.data && response.data.access_token) {
      const expiresIn = response.data.expires_in || 3600;
      currentAccessToken = response.data.access_token;
      tokenExpiresAt = Date.now() + expiresIn * 1000 - 60 * 1000;

      // Nếu có refresh_token mới, lưu lại
      if (response.data.refresh_token && response.data.refresh_token !== config.refreshToken) {
        config.refreshToken = response.data.refresh_token;
        await tokenStorage.saveTokens({ refreshToken: config.refreshToken });
      }

      return currentAccessToken;
    } else {
      throw new Error("Làm mới token thất bại, không có access_token trong response");
    }
  } catch (error) {
    currentAccessToken = null;
    tokenExpiresAt = null;
    throw new Error("Không thể làm mới Access Token: " + (error.response?.data?.returnMessage || error.message));
  }
}

async function getValidHanetToken() {
  const now = Date.now();
  if (currentAccessToken && tokenExpiresAt && now < tokenExpiresAt - 10000) {
    return currentAccessToken;
  }
  // Nếu chưa có refreshToken trong config, thử load từ tokenStorage
  if (!dynamicConfig?.refreshToken && !process.env.HANET_REFRESH_TOKEN) {
    const tokens = await tokenStorage.loadTokens();
    if (tokens && tokens.refreshToken) {
      if (!dynamicConfig) dynamicConfig = {};
      dynamicConfig.refreshToken = tokens.refreshToken;
    }
  }
  return await refreshAccessToken();
}

async function setDynamicConfig(config) {
  dynamicConfig = config;
  return true;
}

function getCurrentConfig() {
  return dynamicConfig || {
    clientId: process.env.HANET_CLIENT_ID,
    clientSecret: process.env.HANET_CLIENT_SECRET,
    baseUrl: process.env.HANET_API_BASE_URL || "https://partner.hanet.ai",
    tokenUrl: process.env.HANET_TOKEN_URL || "https://oauth.hanet.com/token"
  };
}

module.exports = {
  getValidHanetToken,
  setDynamicConfig,
  getCurrentConfig
};
