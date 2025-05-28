// apiService.js - Xử lý các yêu cầu API và tự động làm mới xác thực khi cần
const API_URL = process.env.REACT_APP_API_URL;

// Theo dõi thời gian kiểm tra xác thực cuối cùng
let lastAuthCheckTime = 0;
const AUTH_CHECK_INTERVAL = 5 * 60 * 1000; // 5 phút

// Theo dõi nếu đang trong quá trình làm mới xác thực
let isRefreshingAuth = false;
let refreshPromise = null;

// Kiểm tra trạng thái xác thực
const checkAuthStatus = async (forceCheck = false) => {
  const now = Date.now();
  
  // Nếu đã kiểm tra gần đây và không bắt buộc kiểm tra, bỏ qua
  if (!forceCheck && now - lastAuthCheckTime < AUTH_CHECK_INTERVAL) {
    return;
  }
  
  try {
    console.log('[apiService] Kiểm tra trạng thái xác thực');
    lastAuthCheckTime = now;
    
    const response = await fetch(`${API_URL}/api/oauth/status`);
    const result = await response.json();
    
    if (result.success && result.data) {
      console.log(`[apiService] Trạng thái xác thực: ${result.data.status}`);
      
      // Nếu chưa xác thực, thử tự động làm mới xác thực
      if (result.data.status !== 'authenticated') {
        console.log('[apiService] Không có xác thực hợp lệ, thử làm mới');
        await refreshAuthentication();
      }
      
      return result.data;
    } else {
      throw new Error('Kết quả kiểm tra xác thực không hợp lệ');
    }
  } catch (error) {
    console.error("[apiService] Lỗi kiểm tra trạng thái xác thực:", error);
    throw error;
  }
};

// Làm mới xác thực bằng cách kích hoạt cấu hình OAuth hiện tại
const refreshAuthentication = async () => {
  // Nếu đang làm mới, chờ hoàn thành
  if (isRefreshingAuth) {
    console.log('[apiService] Đang làm mới xác thực, chờ hoàn thành...');
    return refreshPromise;
  }
  
  try {
    isRefreshingAuth = true;
    refreshPromise = (async () => {
      console.log('[apiService] Bắt đầu làm mới xác thực');
      
      // Lấy thông tin cấu hình OAuth hiện tại
      const ACTIVE_CONFIG_KEY = 'hanet_oauth_active_config';
      const CONFIG_PREFIX = 'hanet_oauth_config_';
      
      const activeConfig = localStorage.getItem(ACTIVE_CONFIG_KEY);
      if (!activeConfig) {
        console.log('[apiService] Không tìm thấy cấu hình OAuth đang hoạt động');
        return false;
      }
      
      const configData = localStorage.getItem(CONFIG_PREFIX + activeConfig);
      if (!configData) {
        console.log(`[apiService] Không tìm thấy dữ liệu cấu hình OAuth: ${activeConfig}`);
        return false;
      }
      
      // Phân tích cấu hình
      const parsedConfig = JSON.parse(configData);
      
      // Đặt cấu hình này là mặc định (khả năng tương thích)
      localStorage.setItem('hanet_oauth_config', JSON.stringify(parsedConfig));
      
      // Gửi cấu hình lên server để làm mới
      console.log('[apiService] Gửi cấu hình lên server để làm mới xác thực:', parsedConfig.appName || activeConfig);
      
      const response = await fetch(`${API_URL}/api/oauth/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(parsedConfig)
      });
      
      const result = await response.json();
      
      if (result.success) {
        console.log('[apiService] Làm mới xác thực thành công');
        
        // Kiểm tra lại trạng thái xác thực
        const newStatus = await checkAuthStatus(true);
        return newStatus && newStatus.status === 'authenticated';
      } else {
        console.error('[apiService] Làm mới xác thực thất bại:', result.message);
        return false;
      }
    })();
    
    return await refreshPromise;
  } catch (error) {
    console.error('[apiService] Lỗi khi làm mới xác thực:', error);
    return false;
  } finally {
    isRefreshingAuth = false;
    refreshPromise = null;
  }
};

// Xử lý các yêu cầu API với tự động làm mới xác thực
const fetchWithAuth = async (url, options = {}) => {
  console.log('Calling API:', url);
  const response = await fetch(url, options);
  const data = await response.json();

  if (!response.ok) {
    console.error('API error:', data);
    throw new Error(data.message || 'API request failed');
  }

  if (data.success === false) {
    throw new Error(data.message || 'Request was not successful');
  }

  // Nếu response có cấu trúc metadata và data, trả về data
  if (data.metadata && Array.isArray(data.data)) {
    console.log('API response metadata:', data.metadata);
    return data.data;
  }

  // Nếu response là mảng trực tiếp, trả về nó
  if (Array.isArray(data)) {
    return data;
  }

  // Nếu response có data là mảng, trả về data
  if (data.data && Array.isArray(data.data)) {
    return data.data;
  }

  console.warn('Unexpected API response format:', data);
  return [];
};

// Hàm sleep helper
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Hàm tính thời gian chờ theo exponential backoff
const calculateBackoff = (attempt, baseDelay = 1000) => {
  return Math.min(baseDelay * Math.pow(2, attempt), 30000);
};

// API functions
const apiService = {
  // Kiểm tra trạng thái xác thực
  checkAuthStatus: checkAuthStatus,
  
  // Làm mới xác thực
  refreshAuthentication: refreshAuthentication,
  
  // Lấy danh sách địa điểm
  async getPlaces() {
    return await fetchWithAuth(`${API_URL}/api/place`);
  },
  
  // Lấy danh sách thiết bị theo địa điểm
  async getDevices(placeId) {
    if (!placeId) {
      throw new Error('Thiếu tham số placeId');
    }
    return await fetchWithAuth(`${API_URL}/api/device?placeId=${placeId}`);
  },
  
  // Lấy dữ liệu check-in
  async getCheckins(placeId, fromDateTime, toDateTime, deviceId = '') {
    if (!placeId || !fromDateTime || !toDateTime) {
      throw new Error('Thiếu tham số bắt buộc');
    }
    
    const fromTimestamp = new Date(fromDateTime).getTime();
    const toTimestamp = new Date(toDateTime).getTime();
    
    // Kiểm tra khoảng thời gian để phát hiện có cần chia nhỏ hay không
    const diffInHours = (toTimestamp - fromTimestamp) / (1000 * 60 * 60);
    const MAX_HOURS = 72; // Giới hạn theo server API
    
    // Hàm thử lại truy vấn khi gặp lỗi
    const fetchWithRetry = async (url, maxRetries = 3) => {
      let lastError = null;
      
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          if (attempt > 0) {
            const delay = calculateBackoff(attempt);
            console.log(`Thử lại lần ${attempt + 1}/${maxRetries} sau ${delay}ms cho URL: ${url}`);
            await sleep(delay);
          }
          
          const result = await fetchWithAuth(url);
          
          // Kiểm tra và log kết quả
          console.log(`Received ${result ? (Array.isArray(result) ? result.length : 'non-array') : 'no'} results`);
          
          return result;
        } catch (error) {
          lastError = error;
          console.warn(`Lỗi lần thử ${attempt + 1}/${maxRetries}:`, error.message);
          
          if (error.message.includes('401') || error.message.includes('403')) {
            throw error; // Lỗi xác thực - không thử lại
          }
          
          if (error.message.includes('429')) {
            await sleep(calculateBackoff(attempt, 10000)); // Rate limit - chờ lâu hơn
            continue;
          }
          
          if (error.message.includes('500')) {
            await sleep(calculateBackoff(attempt, 5000));
            continue;
          }
        }
      }
      
      throw lastError || new Error('Không thể kết nối đến máy chủ sau nhiều lần thử');
    };
    
    // Nếu khoảng thời gian vượt quá giới hạn
    if (diffInHours > MAX_HOURS) {
      throw new Error(`Khoảng thời gian truy vấn không được vượt quá ${MAX_HOURS} giờ`);
    }
    
    // Tạo URL API
    let url = `${API_URL}/api/checkins?placeId=${placeId}&dateFrom=${fromTimestamp}&dateTo=${toTimestamp}`;
    if (deviceId) {
      url += `&devices=${deviceId}`;
    }
    
    try {
      console.log('Fetching data:', {
        placeId,
        fromDateTime: new Date(fromTimestamp).toLocaleString(),
        toDateTime: new Date(toTimestamp).toLocaleString(),
        deviceId
      });
      
      const results = await fetchWithRetry(url);
      
      if (!Array.isArray(results)) {
        console.error('Invalid API response format:', results);
        throw new Error('Định dạng dữ liệu không hợp lệ từ API');
      }
      
      console.log(`Nhận được ${results.length} bản ghi từ API`);
      return results;
      
    } catch (error) {
      console.error('Error fetching checkins:', error);
      throw error;
    }
  }
};

export default apiService;
