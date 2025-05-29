// tokenManager.js
require("dotenv").config();
const axios = require("axios");
const qs = require("qs");

let currentAccessToken = null;
let tokenExpiresAt = null;

// Kiểm tra và log biến môi trường khi khởi động
const checkEnvironmentVariables = () => {
  const requiredVars = {
    HANET_TOKEN_URL: process.env.HANET_TOKEN_URL,
    HANET_CLIENT_ID: process.env.HANET_CLIENT_ID,
    HANET_CLIENT_SECRET: process.env.HANET_CLIENT_SECRET,
    HANET_REFRESH_TOKEN: process.env.HANET_REFRESH_TOKEN
  };

  const missingVars = Object.entries(requiredVars)
    .filter(([key, value]) => !value)
    .map(([key]) => key);

  if (missingVars.length > 0) {
    console.error('[tokenManager] Thiếu các biến môi trường:', missingVars.join(', '));
    return false;
  }

  console.log('[tokenManager] Đã tải đầy đủ cấu hình môi trường');
  return true;
}

async function refreshAccessToken() {
  console.log('[tokenManager] Bắt đầu làm mới Access Token...');

  if (!checkEnvironmentVariables()) {
    throw new Error("Thiếu thông tin cấu hình để làm mới token (kiểm tra .env)");
  }

  const {
    HANET_TOKEN_URL,
    HANET_CLIENT_ID,
    HANET_CLIENT_SECRET,
    HANET_REFRESH_TOKEN,
  } = process.env;

  try {
    console.log("[tokenManager] Đang yêu cầu làm mới Access Token từ HANET...");
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
    if (!access_token) {
      throw new Error("Không nhận được access token từ response");
    }

    currentAccessToken = access_token;
    tokenExpiresAt = Date.now() + (expires_in - 300) * 1000; // Refresh 5 minutes before expiry
    console.log("[tokenManager] Làm mới Access Token thành công");
    return access_token;
  } catch (error) {
    console.error("[tokenManager] Lỗi làm mới token:", {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    throw error;
  }
}

async function getValidHanetToken() {
  try {
    if (!currentAccessToken || !tokenExpiresAt || Date.now() >= tokenExpiresAt) {
      console.log('[tokenManager] Access Token trong bộ nhớ không hợp lệ hoặc hết hạn, đang làm mới...');
      return await refreshAccessToken();
    }
    return currentAccessToken;
  } catch (error) {
    console.error("[tokenManager] Lỗi lấy token hợp lệ:", error.message);
    throw error;
  }
}

// Kiểm tra biến môi trường khi module được load
checkEnvironmentVariables();

module.exports = {
  getValidHanetToken,
  refreshAccessToken
};
