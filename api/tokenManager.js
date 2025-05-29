// tokenManager.js
require("dotenv").config();
const axios = require("axios");
const qs = require("qs");
const tokenStorage = require("./tokenStorage");

let currentAccessToken = null;
let tokenExpiresAt = null;
let dynamicConfig = null;

async function refreshAccessToken() {
  const {
    HANET_TOKEN_URL,
    HANET_CLIENT_ID,
    HANET_CLIENT_SECRET,
    HANET_REFRESH_TOKEN,
  } = process.env;

  console.log("[tokenManager] Đang yêu cầu làm mới Access Token từ HANET...");
  if (
    !HANET_REFRESH_TOKEN ||
    !HANET_CLIENT_ID ||
    !HANET_CLIENT_SECRET ||
    !HANET_TOKEN_URL
  ) {
    throw new Error(
      "Thiếu thông tin cấu hình để làm mới token (kiểm tra .env)"
    );
  }

  const apiUrl = HANET_TOKEN_URL;
  const requestData = {
    grant_type: "refresh_token",
    client_id: HANET_CLIENT_ID,
    client_secret: HANET_CLIENT_SECRET,
    refresh_token: HANET_REFRESH_TOKEN,
  };
  const config = {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    timeout: 10000,
  };

  try {
    const response = await axios.post(
      apiUrl,
      qs.stringify(requestData),
      config
    );
    if (response.data && response.data.access_token) {
      console.log("[tokenManager] Làm mới Access Token thành công.");
      const expiresIn = response.data.expires_in || 3600;
      currentAccessToken = response.data.access_token;
      tokenExpiresAt = Date.now() + expiresIn * 1000 - 60 * 1000;
      if (
        response.data.refresh_token &&
        response.data.refresh_token !== HANET_REFRESH_TOKEN
      ) {
        console.warn("[tokenManager] Nhận được Refresh Token mới từ HANET! (Không tự động cập nhật .env)");
      }
      return currentAccessToken;
    } else {
      console.error(
        "[tokenManager] Lỗi khi làm mới token, response không chứa access_token:",
        response.data
      );
      throw new Error(
        `Lỗi làm mới token từ HANET: ${
          response.data?.returnMessage || "Phản hồi không hợp lệ"
        }`
      );
    }
  } catch (error) {
    console.error(
      "[tokenManager] Lỗi nghiêm trọng khi gọi API làm mới token:",
      error.response?.data || error.message
    );
    currentAccessToken = null;
    tokenExpiresAt = null;
    throw new Error(
      `Không thể làm mới Access Token: ${
        error.response?.data?.returnMessage || error.message
      }`
    );
  }
}

async function getValidHanetToken() {
  const now = Date.now();
  if (currentAccessToken && tokenExpiresAt && now < tokenExpiresAt - 10000) {
    console.log("[tokenManager] Sử dụng Access Token từ bộ nhớ.");
    return currentAccessToken;
  }
  console.log(
    "[tokenManager] Access Token trong bộ nhớ không hợp lệ hoặc hết hạn, đang làm mới..."
  );
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
