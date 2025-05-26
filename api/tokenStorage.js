// tokenStorage.js - Module lưu trữ token liên tục vào file
const fs = require('fs');
const path = require('path');

// Đường dẫn đến file lưu trữ token
const TOKEN_STORAGE_PATH = path.join(__dirname, 'data', 'tokens.json');

// Đảm bảo thư mục data tồn tại
function ensureDirectoryExists() {
  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) {
    try {
      fs.mkdirSync(dataDir, { recursive: true });
      console.log(`[${new Date().toISOString()}] Đã tạo thư mục data để lưu trữ token`);
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Lỗi khi tạo thư mục data:`, error.message);
    }
  }
}

// Lưu token vào file
function saveTokens(tokens) {
  try {
    ensureDirectoryExists();
    
    // Mã hóa đơn giản cho dữ liệu nhạy cảm (không an toàn cho production)
    const encodedData = Buffer.from(JSON.stringify(tokens)).toString('base64');
    
    fs.writeFileSync(TOKEN_STORAGE_PATH, encodedData);
    console.log(`[${new Date().toISOString()}] Đã lưu token vào file thành công`);
    return true;
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Lỗi khi lưu token vào file:`, error.message);
    return false;
  }
}

// Đọc token từ file
function loadTokens() {
  try {
    ensureDirectoryExists();
    
    if (!fs.existsSync(TOKEN_STORAGE_PATH)) {
      console.log(`[${new Date().toISOString()}] Chưa có file token, trả về đối tượng mặc định`);
      return null;
    }
    
    const encodedData = fs.readFileSync(TOKEN_STORAGE_PATH, 'utf8');
    const decodedData = Buffer.from(encodedData, 'base64').toString('utf8');
    const tokens = JSON.parse(decodedData);
    
    console.log(`[${new Date().toISOString()}] Đã đọc token từ file thành công`);
    return tokens;
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Lỗi khi đọc token từ file:`, error.message);
    return null;
  }
}

// Lưu một cấu hình OAuth cụ thể
function saveOAuthConfig(configName, config) {
  try {
    ensureDirectoryExists();
    
    let storedConfigs = {};
    if (fs.existsSync(TOKEN_STORAGE_PATH)) {
      try {
        const encodedData = fs.readFileSync(TOKEN_STORAGE_PATH, 'utf8');
        const decodedData = Buffer.from(encodedData, 'base64').toString('utf8');
        storedConfigs = JSON.parse(decodedData);
      } catch (e) {
        // Nếu file hiện tại không hợp lệ, tạo mới
        storedConfigs = {};
      }
    }
    
    // Lưu cấu hình với tên
    storedConfigs[configName] = config;
    
    // Lưu lại vào file
    const encodedData = Buffer.from(JSON.stringify(storedConfigs)).toString('base64');
    fs.writeFileSync(TOKEN_STORAGE_PATH, encodedData);
    
    console.log(`[${new Date().toISOString()}] Đã lưu cấu hình OAuth '${configName}' vào file thành công`);
    return true;
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Lỗi khi lưu cấu hình OAuth vào file:`, error.message);
    return false;
  }
}

// Đọc một cấu hình OAuth cụ thể
function loadOAuthConfig(configName) {
  try {
    ensureDirectoryExists();
    
    if (!fs.existsSync(TOKEN_STORAGE_PATH)) {
      console.log(`[${new Date().toISOString()}] Chưa có file cấu hình OAuth`);
      return null;
    }
    
    const encodedData = fs.readFileSync(TOKEN_STORAGE_PATH, 'utf8');
    const decodedData = Buffer.from(encodedData, 'base64').toString('utf8');
    const configs = JSON.parse(decodedData);
    
    if (configs[configName]) {
      console.log(`[${new Date().toISOString()}] Đã đọc cấu hình OAuth '${configName}' từ file thành công`);
      return configs[configName];
    }
    
    console.log(`[${new Date().toISOString()}] Không tìm thấy cấu hình OAuth '${configName}' trong file`);
    return null;
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Lỗi khi đọc cấu hình OAuth từ file:`, error.message);
    return null;
  }
}

// Lấy danh sách tên các cấu hình đã lưu
function getStoredConfigNames() {
  try {
    ensureDirectoryExists();
    
    if (!fs.existsSync(TOKEN_STORAGE_PATH)) {
      console.log(`[${new Date().toISOString()}] Chưa có file cấu hình OAuth`);
      return [];
    }
    
    const encodedData = fs.readFileSync(TOKEN_STORAGE_PATH, 'utf8');
    const decodedData = Buffer.from(encodedData, 'base64').toString('utf8');
    const configs = JSON.parse(decodedData);
    
    return Object.keys(configs);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Lỗi khi đọc danh sách cấu hình OAuth từ file:`, error.message);
    return [];
  }
}

module.exports = {
  saveTokens,
  loadTokens,
  saveOAuthConfig,
  loadOAuthConfig,
  getStoredConfigNames
};
