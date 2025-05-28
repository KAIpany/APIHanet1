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
  // Kiểm tra trạng thái xác thực trước khi gửi yêu cầu
  await checkAuthStatus();
  
  try {
    // Gửi yêu cầu
    const response = await fetch(url, options);
    
    // Nếu yêu cầu thành công, trả về kết quả
    if (response.ok) {
      return await response.json();
    }
    
    // Nếu lỗi xác thực (401 hoặc 403)
    if (response.status === 401 || response.status === 403) {
      console.log(`[apiService] Lỗi xác thực: ${response.status}, thử làm mới xác thực`);
      
      // Thử làm mới xác thực
      const refreshSuccessful = await refreshAuthentication();
      
      if (refreshSuccessful) {
        console.log('[apiService] Làm mới xác thực thành công, thử lại yêu cầu');
        
        // Thử lại yêu cầu
        const retryResponse = await fetch(url, options);
        if (retryResponse.ok) {
          return await retryResponse.json();
        } else {
          const errorData = await retryResponse.json().catch(() => ({}));
          throw new Error(`Lỗi ${retryResponse.status} sau khi làm mới xác thực: ${errorData.message || 'Lỗi không xác định'}`);
        }
      } else {
        throw new Error('Không thể làm mới xác thực. Vui lòng vào trang cấu hình API để xác thực lại.');
      }
    }
    
    // Xử lý các lỗi khác
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Lỗi ${response.status}: ${errorData.message || 'Lỗi không xác định'}`);
  } catch (error) {
    console.error('[apiService] Lỗi khi gửi yêu cầu API:', error);
    throw error;
  }
};

// Hàm sleep helper
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Hàm tính thời gian chờ theo exponential backoff
const calculateBackoff = (attempt, baseDelay = 2000, maxDelay = 30000) => {
  const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
  // Thêm jitter để tránh thundering herd
  return delay + Math.random() * 1000;
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
    const MAX_HOURS = 24; // Giới hạn mỗi lần truy vấn
    
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
          
          // Kiểm tra kết quả
          if (!result || (Array.isArray(result) && result.length === 0)) {
            console.warn('Nhận được kết quả rỗng từ API');
          }
          
          return result;
        } catch (error) {
          lastError = error;
          console.warn(`Lỗi lần thử ${attempt + 1}/${maxRetries}:`, error.message);
          
          // Kiểm tra các loại lỗi khác nhau
          if (error.message) {
            // Lỗi xác thực - không cần thử lại
            if (error.message.includes('401') || error.message.includes('403')) {
              throw error;
            }
            
            // Lỗi timeout hoặc gateway - có thể thử lại
            if (error.message.includes('timeout') || 
                error.message.includes('504') ||
                error.message.includes('Gateway')) {
              // Tiếp tục vòng lặp để thử lại
              continue;
            }
            
            // Lỗi server (500) - thử lại với thời gian chờ dài hơn
            if (error.message.includes('500')) {
              await sleep(calculateBackoff(attempt, 5000)); // Tăng thời gian chờ base lên 5s
              continue;
            }
          }
        }
      }
      
      // Nếu đã thử hết số lần mà vẫn lỗi
      throw lastError || new Error('Không thể kết nối đến máy chủ sau nhiều lần thử');
    };
    
    // Nếu khoảng thời gian nhỏ hơn 24 giờ, thực hiện truy vấn bình thường
    if (diffInHours <= MAX_HOURS) {
      let url = `${API_URL}/api/checkins?placeId=${placeId}&dateFrom=${fromTimestamp}&dateTo=${toTimestamp}`;
      if (deviceId) {
        url += `&devices=${deviceId}`;
      }
      
      try {
        return await fetchWithRetry(url);
      } catch (error) {
        if (error.message && (error.message.includes('timeout') || 
            error.message.includes('FUNCTION_INVOCATION_TIMEOUT') ||
            error.message.includes('Gateway Timeout'))) {
          throw new Error('Yêu cầu mất quá nhiều thời gian để xử lý. Vui lòng thử với khoảng thời gian ngắn hơn.');
        }
        throw error;
      }
    }
    
    // Nếu khoảng thời gian lớn hơn, chia nhỏ thành nhiều lần truy vấn
    console.log(`Khoảng thời gian lớn (${diffInHours.toFixed(1)} giờ), chia nhỏ thành nhiều lần truy vấn`);
    
    // Tính số lần cần chia
    const segmentCount = Math.ceil(diffInHours / MAX_HOURS);
    // Chia khoảng thời gian thành các đoạn bằng nhau
    const segmentMs = Math.floor((toTimestamp - fromTimestamp) / segmentCount);
    
    // Lưu trữ các đoạn thời gian cần truy vấn
    const segments = [];
    for (let i = 0; i < segmentCount; i++) {
      const start = fromTimestamp + (i * segmentMs);
      const end = (i === segmentCount - 1) ? toTimestamp : fromTimestamp + ((i + 1) * segmentMs) - 1;
      segments.push({ start, end, index: i + 1 });
    }
    
    // Hiển thị thông báo cho người dùng
    console.log(`Đang thực hiện ${segmentCount} lần truy vấn để lấy dữ liệu từ ${new Date(fromTimestamp).toLocaleString()} đến ${new Date(toTimestamp).toLocaleString()}`);
    
    // Thực hiện nhiều lần truy vấn và kết hợp kết quả
    let allResults = [];
    let errors = [];
    let processedCount = 0;
    
    // Khử sử dụng cho trường hợp trùng dữ liệu
    const uniqueRecords = new Map();
    
    // Xử lý từng đoạn thời gian
    for (const segment of segments) {
      console.log(`Đang lấy dữ liệu phần ${segment.index}/${segmentCount}: ${new Date(segment.start).toLocaleString()} - ${new Date(segment.end).toLocaleString()}`);
      
      let url = `${API_URL}/api/checkins?placeId=${placeId}&dateFrom=${segment.start}&dateTo=${segment.end}`;
      if (deviceId) {
        url += `&devices=${deviceId}`;
      }
      
      try {
        // Sử dụng hàm thử lại
        const segmentResult = await fetchWithRetry(url);
        processedCount++;
        
        if (Array.isArray(segmentResult)) {
          console.log(`Đã nhận ${segmentResult.length} bản ghi từ phần ${segment.index}/${segmentCount}`);
          
          // Thêm các bản ghi duy nhất (lọc trùng bằng ID hoặc thời gian check-in)
          for (const record of segmentResult) {
            // Tạo khóa duy nhất cho mỗi bản ghi
            const recordKey = `${record.personID}_${record.checkinTime}`;
            if (!uniqueRecords.has(recordKey)) {
              uniqueRecords.set(recordKey, record);
            }
          }
        }
      } catch (error) {
        console.error(`Lỗi khi lấy dữ liệu phần ${segment.index}/${segmentCount}:`, error.message);
        errors.push(`Phần ${segment.index}: ${error.message}`);
      }
      
      // Cập nhật tiến trình
      console.log(`Tiến trình: ${processedCount}/${segmentCount} phần (${Math.round(processedCount/segmentCount*100)}%)`);
    }
    
    // Chuyển Map thành mảng kết quả
    allResults = Array.from(uniqueRecords.values());
    
    // Kiểm tra nếu không có kết quả nào và có lỗi
    if (allResults.length === 0 && errors.length > 0) {
      throw new Error(`Không thể lấy dữ liệu. Lỗi: ${errors.join(', ')}`);
    }
    
    // Sắp xếp kết quả theo thời gian check-in
    allResults.sort((a, b) => a.checkinTime - b.checkinTime);
    
    console.log(`Hoàn tất! Đã lấy tổng cộng ${allResults.length} bản ghi duy nhất.`);
    return allResults;
  },
  
  async getCheckins(placeId, dateFrom, dateTo, deviceId = null) {
    const SEGMENT_SIZE = 12 * 60 * 60 * 1000; // 12 giờ mỗi phân đoạn
    const segments = [];
    let start = parseInt(dateFrom);
    const end = parseInt(dateTo);

    // Chia thành các phân đoạn nhỏ hơn
    while (start < end) {
      segments.push({
        start: start,
        end: Math.min(start + SEGMENT_SIZE, end),
        index: segments.length + 1
      });
      start += SEGMENT_SIZE;
    }

    const segmentCount = segments.length;
    console.log(`Chia thành ${segmentCount} phân đoạn để xử lý`);

    const uniqueRecords = new Map();
    let failedSegments = [];

    // Xử lý từng phân đoạn
    for (const segment of segments) {
      const url = `${API_URL}/api/checkins?placeId=${placeId}&dateFrom=${segment.start}&dateTo=${segment.end}${deviceId ? `&devices=${deviceId}` : ''}`;
      
      try {
        console.log(`Đang xử lý phân đoạn ${segment.index}/${segmentCount}: ${new Date(segment.start).toLocaleString()} - ${new Date(segment.end).toLocaleString()}`);
        
        const segmentResult = await fetchWithRetry(url);
        
        if (Array.isArray(segmentResult)) {
          console.log(`Nhận được ${segmentResult.length} bản ghi từ phân đoạn ${segment.index}`);
          
          // Xử lý và loại bỏ trùng lặp
          for (const record of segmentResult) {
            if (!record.person_id || !record.checkin_time) continue;
            
            const key = `${record.person_id}_${record.checkin_time}`;
            if (!uniqueRecords.has(key)) {
              uniqueRecords.set(key, record);
            }
          }
        } else {
          console.warn(`Phân đoạn ${segment.index} trả về dữ liệu không hợp lệ:`, segmentResult);
          failedSegments.push(segment);
        }
      } catch (error) {
        console.error(`Lỗi khi xử lý phân đoạn ${segment.index}:`, error);
        failedSegments.push(segment);
      }
      
      // Thêm độ trễ nhỏ giữa các request để tránh quá tải
      await sleep(1000);
    }

    // Thử lại các phân đoạn thất bại với thời gian chờ dài hơn
    if (failedSegments.length > 0) {
      console.log(`Thử lại ${failedSegments.length} phân đoạn thất bại...`);
      
      for (const segment of failedSegments) {
        const url = `${API_URL}/api/checkins?placeId=${placeId}&dateFrom=${segment.start}&dateTo=${segment.end}${deviceId ? `&devices=${deviceId}` : ''}`;
        
        try {
          await sleep(5000); // Chờ lâu hơn trước khi thử lại
          const retryResult = await fetchWithRetry(url, 5); // Tăng số lần thử lại
          
          if (Array.isArray(retryResult)) {
            for (const record of retryResult) {
              if (!record.person_id || !record.checkin_time) continue;
              
              const key = `${record.person_id}_${record.checkin_time}`;
              if (!uniqueRecords.has(key)) {
                uniqueRecords.set(key, record);
              }
            }
          }
        } catch (error) {
          console.error(`Không thể khôi phục phân đoạn ${segment.index} sau khi thử lại:`, error);
        }
      }
    }

    const results = Array.from(uniqueRecords.values());
    console.log(`Tổng số bản ghi duy nhất: ${results.length}`);
    return results;
  }
};

export default apiService;
