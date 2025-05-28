function filterCheckinsByDay(data) {
  try {
    // Kiểm tra dữ liệu đầu vào
    if (!Array.isArray(data)) {
      console.error("Dữ liệu đầu vào của filter không phải là mảng.");
      return [];
    }
    
    console.log(`Đang xử lý ${data.length} bản ghi từ API Hanet...`);

    // Lọc ra các bản ghi hợp lệ - chỉ cần personID
    const validCheckins = data.filter(check => check && check.personID);
    
    console.log(`Sau khi lọc ban đầu, còn lại ${validCheckins.length} bản ghi hợp lệ.`);

    // Thêm ngày cho mỗi bản ghi nếu chưa có
    validCheckins.forEach(check => {
      if (!check.date && check.checkinTime) {
        const checkDate = new Date(parseInt(check.checkinTime, 10));
        // Format: YYYY-MM-DD
        check.date = `${checkDate.getFullYear()}-${(checkDate.getMonth() + 1).toString().padStart(2, "0")}-${checkDate.getDate().toString().padStart(2, "0")}`;
      } else if (!check.date) {
        const now = new Date();
        check.date = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, "0")}-${now.getDate().toString().padStart(2, "0")}`;
      }
    });

    // Nhóm bản ghi theo personID và date
    const recordsByPersonDay = {};
    
    validCheckins.forEach(check => {
      const key = `${check.date}_${check.personID}`;
      if (!recordsByPersonDay[key]) {
        recordsByPersonDay[key] = {
          records: [],
          personInfo: {
            personName: check.personName || "",
            personID: check.personID,
            aliasID: check.aliasID || "",
            placeID: check.placeID || null,
            title: check.title ? (typeof check.title === "string" ? check.title.trim() : "N/A") : "Khách hàng",
            date: check.date,
          }
        };
      }
      recordsByPersonDay[key].records.push({
        time: check.checkinTime,
        formattedTime: formatTimestamp(check.checkinTime)
      });
    });

    // Xử lý mỗi nhóm để lấy check-in đầu tiên và check-out cuối cùng
    const results = [];
    Object.values(recordsByPersonDay).forEach(group => {
      // Sắp xếp các bản ghi theo thời gian
      group.records.sort((a, b) => parseInt(a.time) - parseInt(b.time));
      
      // Lấy bản ghi đầu tiên làm check-in và bản ghi cuối cùng làm check-out
      const checkinRecord = group.records[0];
      const checkoutRecord = group.records[group.records.length - 1];
      
      // Tính thời gian làm việc
      let workingTime = "N/A";
      if (checkinRecord && checkoutRecord) {
        const checkinTime = parseInt(checkinRecord.time);
        const checkoutTime = parseInt(checkoutRecord.time);
        
        if (checkinTime === checkoutTime) {
          workingTime = "0h 0m";
        } else {
          const durationMinutes = (checkoutTime - checkinTime) / (1000 * 60);
          const hours = Math.floor(durationMinutes / 60);
          const minutes = Math.floor(durationMinutes % 60);
          workingTime = `${hours}h ${minutes}m`;
        }
      }
      
      results.push({
        ...group.personInfo,
        checkinTime: checkinRecord ? checkinRecord.time : null,
        checkoutTime: checkoutRecord ? checkoutRecord.time : null,
        formattedCheckinTime: checkinRecord ? checkinRecord.formattedTime : null,
        formattedCheckoutTime: checkoutRecord ? checkoutRecord.formattedTime : null,
        workingTime: workingTime,
        totalRecords: group.records.length // Thêm số lượng bản ghi trong ngày
      });
    });

    // Sắp xếp kết quả theo ngày và thời gian check-in
    results.sort((a, b) => {
      if (a.date !== b.date) {
        return a.date.localeCompare(b.date);
      }
      return parseInt(a.checkinTime) - parseInt(b.checkinTime);
    });

    console.log(`Kết quả cuối cùng: ${results.length} bản ghi đã được xử lý.`);
    return results;
  } catch (error) {
    console.error("Lỗi khi xử lý dữ liệu:", error);
    return [];
  }
}

function formatTimestamp(timestamp) {
  // Đảm bảo timestamp là số
  const ts = parseInt(timestamp, 10);
  
  // Tạo đối tượng Date với timestamp
  const date = new Date(ts);
  
  // Chuyển đổi sang múi giờ Việt Nam (UTC+7)
  const vietnamTime = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  
  // Format các thành phần thời gian
  const hours = vietnamTime.getUTCHours().toString().padStart(2, "0");
  const minutes = vietnamTime.getUTCMinutes().toString().padStart(2, "0");
  const seconds = vietnamTime.getUTCSeconds().toString().padStart(2, "0");
  const day = vietnamTime.getUTCDate().toString().padStart(2, "0");
  const month = (vietnamTime.getUTCMonth() + 1).toString().padStart(2, "0");
  const year = vietnamTime.getUTCFullYear();
  
  // Trả về định dạng: HH:MM:SS DD/MM/YYYY
  return `${hours}:${minutes}:${seconds} ${day}/${month}/${year}`;
}

require("dotenv").config();
const axios = require("axios");
const qs = require("qs");
const tokenManager = require("./tokenManager");
const HANET_API_BASE_URL = process.env.HANET_API_BASE_URL;

if (!HANET_API_BASE_URL) {
  console.error("Lỗi: Biến môi trường HANET_API_BASE_URL chưa được thiết lập.");
}

// Constants
const MAX_TIME_RANGE = 6 * 60 * 60 * 1000; // 6 giờ mỗi phân đoạn
const MAX_RETRIES = 3;
const BASE_TIMEOUT = 30000; // 30 seconds
const RETRY_DELAY = 5000; // 5 seconds

// Helper functions
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const calculateBackoff = (attempt) => {
  return Math.min(BASE_TIMEOUT * Math.pow(2, attempt), 120000); // Max 2 minutes
};

// Hàm kiểm tra và làm mới token
async function ensureValidToken() {
  try {
    const token = await tokenManager.getValidHanetToken();
    if (!token) {
      throw new Error('Không có access token');
    }
    return token;
  } catch (error) {
    console.error('Lỗi khi lấy access token:', error);
    throw new Error('Lỗi xác thực với Hanet API');
  }
}

// Hàm xử lý response từ Hanet API
async function handleHanetResponse(response) {
  let responseText;
  try {
    responseText = await response.text();
    const data = JSON.parse(responseText);
    
    if (!data || typeof data.returnCode === 'undefined') {
      throw new Error('Invalid response format from Hanet API');
    }
    
    if (data.returnCode !== 1 && data.returnCode !== 0) {
      throw new Error(`Hanet API error: ${data.returnMessage || 'Unknown error'}`);
    }
    
    return data;
  } catch (error) {
    console.error('Lỗi khi xử lý response:', error);
    throw new Error(`Lỗi xử lý dữ liệu: ${responseText || error.message}`);
  }
}

// Hàm xử lý một phân đoạn
async function processSegment(placeId, fromTime, toTime, deviceId, accessToken, attempt = 0) {
  const MAX_RETRIES = 3;
  const BASE_DELAY = 5000;
  const MAX_DELAY = 30000;

  if (attempt >= MAX_RETRIES) {
    throw new Error(`Đã thử ${MAX_RETRIES} lần nhưng không thành công`);
  }

  const delay = Math.min(BASE_DELAY * Math.pow(2, attempt), MAX_DELAY);
  if (attempt > 0) {
    console.log(`Chờ ${delay}ms trước khi thử lại lần ${attempt + 1}`);
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  try {
    const url = `${process.env.HANET_API_URL}/person/getCheckinByPlaceIdInTimestamp`;
    const formData = new URLSearchParams({
      token: accessToken,
      placeID: placeId,
      from: fromTime.toString(),
      to: toTime.toString(),
      size: 200 // Giới hạn kích thước mỗi request
    });

    if (deviceId) {
      formData.append('devices', deviceId);
    }

    console.log('Gọi Hanet API với params:', {
      placeId,
      from: new Date(parseInt(fromTime)).toLocaleString(),
      to: new Date(parseInt(toTime)).toLocaleString(),
      attempt: attempt + 1
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
      timeout: 30000
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Hanet API error: ${response.status}`;
      
      try {
        const errorData = JSON.parse(errorText);
        errorMessage += ` - ${errorData.message || errorData.error || errorText}`;
      } catch {
        errorMessage += ` - ${errorText}`;
      }
      
      throw new Error(errorMessage);
    }

    const data = await response.json();
    
    if (!data || typeof data.returnCode === 'undefined') {
      throw new Error('Invalid response format from Hanet API');
    }

    if (data.returnCode !== 1 && data.returnCode !== 0) {
      throw new Error(`Hanet API error: ${data.returnMessage || 'Unknown error'}`);
    }

    return data.data || [];
  } catch (error) {
    console.error(`Lỗi trong lần thử ${attempt + 1}:`, error);
    
    // Nếu là lỗi xác thực, không thử lại
    if (error.message.includes('authentication') || 
        error.message.includes('401')) {
      throw error;
    }
    
    // Thử lại cho các lỗi khác
    return processSegment(placeId, fromTime, toTime, deviceId, accessToken, attempt + 1);
  }
}

// Hàm chính xử lý request đến Hanet API
async function getCheckinsByPlaceIdInTimestamp(placeId, fromTime, toTime, deviceId = null) {
  const accessToken = await ensureValidToken();
  
  if (!placeId || !fromTime || !toTime) {
    throw new Error('Missing required parameters');
  }
  
  // Convert to integers if they're strings
  const startTime = parseInt(fromTime);
  const endTime = parseInt(toTime);
  
  if (isNaN(startTime) || isNaN(endTime)) {
    throw new Error('Invalid timestamp format');
  }
  
  const timeRange = endTime - startTime;
  
  // Nếu khoảng thời gian lớn hơn MAX_TIME_RANGE, chia nhỏ
  if (timeRange > MAX_TIME_RANGE) {
    const segments = [];
    let currentTime = startTime;
    
    while (currentTime < endTime) {
      const segmentEnd = Math.min(currentTime + MAX_TIME_RANGE, endTime);
      segments.push({ start: currentTime, end: segmentEnd });
      currentTime = segmentEnd;
    }
    
    console.log(`Chia thành ${segments.length} phân đoạn để xử lý`);
    
    const results = new Map();
    const failedSegments = [];
    
    // Xử lý từng phân đoạn
    for (const segment of segments) {
      try {
        const segmentData = await processSegment(placeId, segment.start, segment.end, deviceId, accessToken);
        
        // Lọc và thêm dữ liệu không trùng lặp
        segmentData.forEach(record => {
          if (record.personID && record.checkinTime) {
            const key = `${record.personID}_${record.checkinTime}`;
            if (!results.has(key)) {
              results.set(key, record);
            }
          }
        });
        
        // Đợi giữa các request
        await sleep(1000);
      } catch (error) {
        console.error('Lỗi khi xử lý phân đoạn:', error);
        failedSegments.push(segment);
      }
    }
    
    // Thử lại các phân đoạn thất bại
    if (failedSegments.length > 0) {
      console.log(`Thử lại ${failedSegments.length} phân đoạn thất bại...`);
      
      for (const segment of failedSegments) {
        try {
          await sleep(RETRY_DELAY);
          const retryData = await processSegment(placeId, segment.start, segment.end, deviceId, accessToken);
          
          retryData.forEach(record => {
            if (record.personID && record.checkinTime) {
              const key = `${record.personID}_${record.checkinTime}`;
              if (!results.has(key)) {
                results.set(key, record);
              }
            }
          });
        } catch (error) {
          console.error('Không thể khôi phục phân đoạn sau khi thử lại:', error);
        }
      }
    }
    
    return Array.from(results.values());
  }
  
  // Xử lý request đơn lẻ
  return await processSegment(placeId, fromTime, toTime, deviceId, accessToken);
}
