// tokenManager.js
const axios = require("axios");
const qs = require("qs");

let currentAccessToken = null;
let tokenExpiresAt = null;

// Kiểm tra và log biến môi trường khi khởi động
const checkEnvironmentVariables = () => {
  const requiredVars = {
    HANET_TOKEN_URL: process.env.HANET_TOKEN_URL || 'https://oauth.hanet.com/token',
    HANET_CLIENT_ID: process.env.HANET_CLIENT_ID,
    HANET_CLIENT_SECRET: process.env.HANET_CLIENT_SECRET,
    HANET_REFRESH_TOKEN: process.env.HANET_REFRESH_TOKEN,
    HANET_API_BASE_URL: process.env.HANET_API_BASE_URL || 'https://partner.hanet.ai'
  };

  const missingVars = Object.entries(requiredVars)
    .filter(([key, value]) => !value)
    .map(([key]) => key);

  if (missingVars.length > 0) {
    const missingVarsStr = missingVars.join(', ');
    console.error(`[tokenManager] Thiếu các biến môi trường: ${missingVarsStr}`);
    console.error('[tokenManager] Vui lòng cấu hình các biến môi trường trên Vercel Dashboard');
    return false;
  }

  console.log('[tokenManager] Đã tải đầy đủ cấu hình môi trường');
  return true;
}

async function refreshAccessToken() {
  console.log('[tokenManager] Bắt đầu làm mới Access Token...');

  // Kiểm tra và lấy các biến môi trường với giá trị mặc định
  const tokenUrl = process.env.HANET_TOKEN_URL || 'https://oauth.hanet.com/token';
  const clientId = process.env.HANET_CLIENT_ID;
  const clientSecret = process.env.HANET_CLIENT_SECRET;
  const refreshToken = process.env.HANET_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    console.error('[tokenManager] Thiếu thông tin xác thực:', {
      hasClientId: !!clientId,
      hasClientSecret: !!clientSecret,
      hasRefreshToken: !!refreshToken
    });
    throw new Error("Thiếu thông tin xác thực OAuth (kiểm tra cấu hình trên Vercel)");
  }

  try {
    console.log("[tokenManager] Đang yêu cầu làm mới Access Token từ HANET...");
    const response = await axios.post(
      tokenUrl,
      qs.stringify({
        grant_type: "refresh_token",
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
      }),
      {
        headers: { 
          "Content-Type": "application/x-www-form-urlencoded",
          "Accept": "application/json"
        },
        timeout: 10000,
      }
    );

    if (!response.data) {
      throw new Error("Không nhận được phản hồi từ server Hanet");
    }

    const { access_token, expires_in } = response.data;
    if (!access_token) {
      console.error('[tokenManager] Phản hồi không hợp lệ:', response.data);
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
      status: error.response?.status,
      config: {
        url: error.config?.url,
        method: error.config?.method,
        headers: error.config?.headers
      }
    });
    throw new Error(`Lỗi làm mới token: ${error.message}`);
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
