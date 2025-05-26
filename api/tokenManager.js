// tokenManager.js
require("dotenv").config();
const axios = require("axios");
const qs = require("qs");

// Lưu trữ thông tin token hiện tại
let cachedTokenData = {
  accessToken: null,
  refreshToken: process.env.HANET_REFRESH_TOKEN,
  expiresAt: null,
  lastSync: Date.now() // Thêm timestamp cho lần đồng bộ cuối
};

// Lưu trữ cấu hình động từ client
let dynamicConfig = null;

// Thiết lập cấu hình động từ client
function setDynamicConfig(config) {
  dynamicConfig = config;
  
  // Cập nhật token từ cấu hình
  if (config.refreshToken) {
    cachedTokenData.refreshToken = config.refreshToken;
    cachedTokenData.lastSync = Date.now();
    
    // Lưu refresh token vào file hoặc DB để dự phòng khi server restart
    try {
      // Lưu vào process.env cho phiên hiện tại
      process.env.HANET_REFRESH_TOKEN = config.refreshToken;
      console.log('Đã cập nhật refresh token từ cấu hình client và lưu vào env');
    } catch (error) {
      console.error('Lỗi khi lưu refresh token:', error.message);
    }
  }
  
  // Reset access token để buộc refresh lại
  cachedTokenData.accessToken = null;
  cachedTokenData.expiresAt = null;
  
  return true;
}

// Lấy cấu hình hiện tại
function getCurrentConfig() {
  // Trả về cả refresh token để client có thể lưu nếu cần
  return dynamicConfig || {
    clientId: process.env.HANET_CLIENT_ID,
    clientSecret: process.env.HANET_CLIENT_SECRET,
    refreshToken: cachedTokenData.refreshToken,
    baseUrl: process.env.HANET_API_BASE_URL || "https://partner.hanet.ai",
    tokenUrl: process.env.HANET_TOKEN_URL || "https://oauth.hanet.com/token"
  };
}

// Kiểm tra và refresh token khi cần
async function getValidHanetToken() {
  const now = Date.now();
  
  // Kiểm tra xem đã quá lâu chưa sync lại (10 phút)
  if (now - cachedTokenData.lastSync > 10 * 60 * 1000) {
    console.log(`[${new Date().toISOString()}] Đã quá 10 phút kể từ lần đồng bộ token cuối, đang kiểm tra cấu hình...`);
    // Nếu có dynamic config, cập nhật lại refresh token từ đó
    if (dynamicConfig && dynamicConfig.refreshToken) {
      cachedTokenData.refreshToken = dynamicConfig.refreshToken;
      cachedTokenData.lastSync = now;
      console.log(`[${new Date().toISOString()}] Đã đồng bộ lại refresh token từ dynamic config`);
    } else if (process.env.HANET_REFRESH_TOKEN) {
      // Nếu không có dynamic config, thử lấy từ env
      cachedTokenData.refreshToken = process.env.HANET_REFRESH_TOKEN;
      cachedTokenData.lastSync = now;
      console.log(`[${new Date().toISOString()}] Đã đồng bộ lại refresh token từ env`);
    }
  }
  
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

    // Sử dụng tokenUrl thay vì tạo URL từ baseUrl
    const url = config.tokenUrl || "https://oauth.hanet.com/token";
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
        cachedTokenData.lastSync = Date.now();
        
        // Lưu vào process.env
        process.env.HANET_REFRESH_TOKEN = response.data.refresh_token;
        
        // Cập nhật cấu hình động nếu có
        if (dynamicConfig) {
          dynamicConfig.refreshToken = response.data.refresh_token;
          
          // Gửi thông báo tới client để cập nhật refresh token nếu cần
          console.log(`[${new Date().toISOString()}] Đã nhận refresh token mới và cập nhật cấu hình`);
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

    // Sử dụng tokenUrl thay vì tạo URL từ baseUrl
    const url = config.tokenUrl || "https://oauth.hanet.com/token";
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
        console.log(`[${new Date().toISOString()}] Đã nhận được refresh token mới.`);
        cachedTokenData.refreshToken = response.data.refresh_token;
        cachedTokenData.lastSync = Date.now();
        
        // Lưu vào process.env
        process.env.HANET_REFRESH_TOKEN = response.data.refresh_token;
        
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
