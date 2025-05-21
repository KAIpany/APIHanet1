// tokenManager.js
require("dotenv").config();
const axios = require("axios");
const qs = require("qs");

// Lưu trữ thông tin token hiện tại
let cachedTokenData = {
  accessToken: null,
  refreshToken: process.env.HANET_REFRESH_TOKEN,
  expiresAt: null,
};

// Lưu trữ cấu hình động từ client
let dynamicConfig = null;

// Thiết lập cấu hình động từ client
function setDynamicConfig(config) {
  dynamicConfig = config;
  
  // Cập nhật token từ cấu hình
  if (config.refreshToken) {
    cachedTokenData.refreshToken = config.refreshToken;
  }
  
  // Reset access token để buộc refresh lại
  cachedTokenData.accessToken = null;
  cachedTokenData.expiresAt = null;
  
  return true;
}

// Lấy cấu hình hiện tại
function getCurrentConfig() {
  return dynamicConfig || {
    clientId: process.env.HANET_CLIENT_ID,
    clientSecret: process.env.HANET_CLIENT_SECRET,
    baseUrl: process.env.HANET_API_BASE_URL || "https://partner.hanet.ai",
  };
}

// Kiểm tra và refresh token khi cần
async function getValidHanetToken() {
  const now = Date.now();
  // Nếu token còn hạn thì dùng tiếp
  if (cachedTokenData.accessToken && cachedTokenData.expiresAt && now < cachedTokenData.expiresAt) {
    return cachedTokenData.accessToken;
  }

  try {
    const config = getCurrentConfig();
    const refreshToken = cachedTokenData.refreshToken || config.refreshToken;
    
    if (!refreshToken) {
      throw new Error("Không có refresh token để làm mới access token");
    }

    if (!config.clientId || !config.clientSecret) {
      throw new Error("Thiếu thông tin Client ID hoặc Client Secret");
    }

    const url = `${config.baseUrl}/oauth2/token`;
    const data = {
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
    };

    console.log(`[${new Date().toISOString()}] Đang làm mới Access Token...`);
    
    const response = await axios({
      method: "post",
      url: url,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      data: qs.stringify(data),
      timeout: 10000,
    });

    if (response.data && response.data.access_token) {
      console.log(`[${new Date().toISOString()}] Làm mới Access Token thành công.`);
      
      // Cập nhật token trong cache
      cachedTokenData.accessToken = response.data.access_token;
      cachedTokenData.expiresAt = Date.now() + (response.data.expires_in * 1000 * 0.9); // 90% thời gian để dự phòng
      
      // Cập nhật refresh token nếu được cấp mới
      if (response.data.refresh_token) {
        cachedTokenData.refreshToken = response.data.refresh_token;
        
        // Cập nhật cấu hình động nếu có
        if (dynamicConfig) {
          dynamicConfig.refreshToken = response.data.refresh_token;
        }
      }
      
      return cachedTokenData.accessToken;
    } else {
      throw new Error("Phản hồi không chứa access token hợp lệ");
    }
  } catch (error) {
    const errorMessage = error.response?.data?.error_description || error.message;
    console.error(`[${new Date().toISOString()}] Lỗi khi làm mới token: ${errorMessage}`);
    
    // Reset token để tránh dùng token lỗi
    cachedTokenData.accessToken = null;
    cachedTokenData.expiresAt = null;
    
    throw new Error(`Không thể làm mới token: ${errorMessage}`);
  }
}

// Xử lý authorization code để lấy token mới
async function exchangeCodeForToken(code, redirectUri) {
  try {
    const config = getCurrentConfig();
    
    if (!config.clientId || !config.clientSecret) {
      throw new Error("Thiếu thông tin Client ID hoặc Client Secret");
    }

    const url = `${config.baseUrl}/oauth2/token`;
    const data = {
      grant_type: "authorization_code",
      code: code,
      redirect_uri: redirectUri,
      client_id: config.clientId,
      client_secret: config.clientSecret,
    };

    console.log(`[${new Date().toISOString()}] Đang trao đổi code lấy token...`);
    
    const response = await axios({
      method: "post",
      url: url,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      data: qs.stringify(data),
      timeout: 10000,
    });

    if (response.data && response.data.access_token) {
      console.log(`[${new Date().toISOString()}] Trao đổi code lấy token thành công.`);
      
      // Cập nhật token trong cache
      cachedTokenData.accessToken = response.data.access_token;
      cachedTokenData.expiresAt = Date.now() + (response.data.expires_in * 1000 * 0.9);
      
      if (response.data.refresh_token) {
        cachedTokenData.refreshToken = response.data.refresh_token;
        
        // Cập nhật cấu hình động nếu có
        if (dynamicConfig) {
          dynamicConfig.refreshToken = response.data.refresh_token;
        }
      }
      
      return {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        expiresIn: response.data.expires_in
      };
    } else {
      throw new Error("Phản hồi không chứa access token hợp lệ");
    }
  } catch (error) {
    const errorMessage = error.response?.data?.error_description || error.message;
    console.error(`[${new Date().toISOString()}] Lỗi khi trao đổi code: ${errorMessage}`);
    throw new Error(`Không thể trao đổi code: ${errorMessage}`);
  }
}

module.exports = {
  getValidHanetToken,
  setDynamicConfig,
  getCurrentConfig,
  exchangeCodeForToken,
};
