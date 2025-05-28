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
async function getPeopleListByMethod(placeId, dateFrom, dateTo, devices) {
  let accessToken;
  try {
    accessToken = await tokenManager.getValidHanetToken();
  } catch (refreshError) {
    console.error("Không thể lấy được token hợp lệ:", refreshError.message);
    throw new Error(`Lỗi xác thực với HANET: ${refreshError.message}`);
  }
  if (!accessToken) {
    throw new Error("Không lấy được Access Token hợp lệ.");
  }
  
  // Kiểm tra khoảng thời gian
  const fromDate = new Date(parseInt(dateFrom, 10));
  const toDate = new Date(parseInt(dateTo, 10));
  const diffInHours = (toDate - fromDate) / (1000 * 60 * 60);
  
  console.log(`Đã nhận yêu cầu truy vấn từ ${fromDate.toLocaleString()} đến ${toDate.toLocaleString()} (${diffInHours.toFixed(1)} giờ)`);

  // Giới hạn thời gian mỗi lần truy vấn API và số trang tối đa
  const MAX_HOURS = 12; // Giảm từ 24 xuống 12 giờ để tránh timeout
  const MAX_PAGES = 20;
  const MAX_RETRIES = 5; // Tăng số lần retry
  const BASE_TIMEOUT = 60000; // Tăng timeout cơ bản lên 60 giây
  
  // Hàm thử lại truy vấn với timeout tăng dần
  const fetchWithRetry = async (url, data, attempt = 0) => {
    const timeout = BASE_TIMEOUT * (attempt + 1); // Tăng timeout theo số lần thử
    let lastError;
    
    try {
      if (attempt > 0) {
        const delayMs = 2000 * (attempt + 1);
        console.log(`Chờ ${delayMs}ms trước khi thử lại lần ${attempt + 1}...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
      
      const config = {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        timeout: timeout,
      };
      
      console.log(`Thực hiện request với timeout ${timeout}ms`);
      const response = await axios.post(url, qs.stringify(data), config);
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < MAX_RETRIES - 1) {
        if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
          console.log(`Request timeout sau ${timeout}ms, sẽ thử lại với timeout dài hơn...`);
          return fetchWithRetry(url, data, attempt + 1);
        }
      }
      throw lastError;
    }
  };

  // Hàm thực hiện một lần truy vấn API trong khoảng thời gian nhỏ
  const fetchSegment = async (startTime, endTime, recursionDepth = 0) => {
    const MAX_RECURSION = 3;
    if (recursionDepth > MAX_RECURSION) {
      console.warn(`Đã đạt giới hạn đệ quy (${MAX_RECURSION}), dừng phân chia.`);
      return [];
    }

    let segmentData = [];
    let totalRecords = 0;
    let hasMorePages = true;
    let encounteredTimeout = false;
    
    // Thiết lập số lần thử lại cố định cho mỗi trang
    const PAGE_RETRIES = 3;
    
    for (let index = 1; index <= MAX_PAGES && hasMorePages; index++) {
      const apiUrl = `${HANET_API_BASE_URL}/person/getCheckinByPlaceIdInTimestamp`;
      const requestData = {
        token: accessToken,
        placeID: placeId,
        from: startTime,
        to: endTime,
        ...(devices && { devices: devices }),
        size: 500,
        page: index,
      };

      let pageSuccess = false;
      let pageData = [];
      
      for (let attempt = 0; attempt <= PAGE_RETRIES && !pageSuccess; attempt++) {
        try {
          console.log(`Đang gọi HANET API cho placeID=${placeId}, khoảng ${new Date(parseInt(startTime)).toLocaleString()} - ${new Date(parseInt(endTime)).toLocaleString()}, trang ${index}/${MAX_PAGES}...`);
        
          const response = await fetchWithRetry(apiUrl, requestData);                if (response.data && typeof response.data.returnCode !== "undefined") {
            if (response.data.returnCode === 1 || response.data.returnCode === 0) {
              if (Array.isArray(response.data.data)) {
                pageData = response.data.data;
                pageSuccess = true;
              
                if (pageData.length === 0) {
                  console.log(`Không còn dữ liệu ở trang ${index}, dừng truy vấn.`);
                  hasMorePages = false;
                  break;
                }
                
                if (pageData.length < 500) {
                  hasMorePages = false;
                  console.log(`Đã nhận ${pageData.length} bản ghi < 500, có thể đã hết dữ liệu.`);
                }
              } else {
                console.warn(`Dữ liệu trả về không phải mảng.`);
              }
            } else {
              console.error(
                `Lỗi logic từ HANET: Mã lỗi ${response.data.returnCode}, Thông điệp: ${response.data.returnMessage || "N/A"}`
              );
            }
          } else {
            console.error(`Response không hợp lệ từ HANET:`, response.data);
          }
        } catch (error) {
          console.error(`Không thể lấy dữ liệu cho trang ${index} (lần thử ${attempt + 1}):`, error.message);
          if (error.code === 'ECONNABORTED' || (error.message && error.message.includes('timeout'))) {
            encounteredTimeout = true;
          }
        }
      }
      
      if (pageSuccess && pageData.length > 0) {
        segmentData = [...segmentData, ...pageData];
        totalRecords += pageData.length;
        console.log(`Đã nhận ${pageData.length} bản ghi từ trang ${index}, tổng cộng: ${totalRecords}`);
      }
    }
    
    if (encounteredTimeout && totalRecords === 0 && recursionDepth < MAX_RECURSION) {
      console.log(`Chia nhỏ khoảng thời gian do timeout (độ sâu đệ quy: ${recursionDepth})`);
      const startTs = parseInt(startTime, 10);
      const endTs = parseInt(endTime, 10);
      const midTs = Math.floor((startTs + endTs) / 2);
      
      console.log(`Chia khoảng thời gian ${new Date(startTs).toLocaleString()} - ${new Date(endTs).toLocaleString()} thành 2 phần`);
      
      const firstHalfData = await fetchSegment(startTs.toString(), midTs.toString(), recursionDepth + 1);
      const secondHalfData = await fetchSegment(midTs.toString(), endTs.toString(), recursionDepth + 1);
      
      return [...firstHalfData, ...secondHalfData];
    }
    
    return segmentData;
  };
  
  let allData = [];
  
  if (diffInHours <= MAX_HOURS) {
    console.log(`Khoảng thời gian nhỏ hơn ${MAX_HOURS} giờ, thực hiện truy vấn trực tiếp.`);
    allData = await fetchSegment(dateFrom, dateTo);
  } else {
    console.log(`Khoảng thời gian lớn (${diffInHours.toFixed(1)} giờ), chia nhỏ thành nhiều lần truy vấn.`);
    
    const segmentCount = Math.ceil(diffInHours / (MAX_HOURS * 0.95));
    const segmentMs = Math.floor((toDate - fromDate) / segmentCount);
    const overlap = Math.floor(segmentMs * 0.05);
    
    console.log(`Sẽ thực hiện ${segmentCount} lần truy vấn với chồng lấp để đảm bảo độ phủ.`);
    
    let rawCheckinData = [];
    for (let i = 0; i < segmentCount; i++) {
      let segmentStart = fromDate.getTime() + (i * segmentMs);
      if (i > 0) {
        segmentStart -= overlap;
      }
      
      let segmentEnd = i === segmentCount - 1 ? toDate.getTime() : fromDate.getTime() + ((i + 1) * segmentMs);
      
      console.log(`Đang xử lý phần ${i+1}/${segmentCount}: ${new Date(segmentStart).toLocaleString()} - ${new Date(segmentEnd).toLocaleString()}`);
      
      try {
        const segmentData = await fetchSegment(segmentStart.toString(), segmentEnd.toString());
        console.log(`Đã nhận ${segmentData.length} bản ghi từ phần ${i+1}/${segmentCount}`);
        rawCheckinData = [...rawCheckinData, ...segmentData];
      } catch (error) {
        console.error(`Lỗi khi xử lý phần ${i+1}/${segmentCount}:`, error.message);
      }
    }
    
    allData = rawCheckinData;
  }
  
  console.log(`Đã nhận tổng cộng ${allData.length} bản ghi chưa xử lý.`);
  
  const uniqueMap = {};
  const uniqueRecords = [];
  
  for (const record of allData) {
    if (record && record.personID) {
      const key = record.checkinTime ? 
        `${record.personID}_${record.checkinTime}` : 
        `${record.personID}_notime_${Date.now()}`;
        
      if (!uniqueMap[key]) {
        uniqueMap[key] = true;
        uniqueRecords.push(record);
      }
    }
  }
  
  uniqueRecords.sort((a, b) => {
    const timeA = a.checkinTime ? parseInt(a.checkinTime, 10) : 0;
    const timeB = b.checkinTime ? parseInt(b.checkinTime, 10) : 0;
    return timeA - timeB;
  });
  
  console.log(`Sau khi lọc trùng còn ${uniqueRecords.length} bản ghi duy nhất.`);
  
  console.log(`Gọi filterCheckinsByDay với ${uniqueRecords.length} bản ghi.`);
  const result = filterCheckinsByDay(uniqueRecords);
  
  console.log(`Kết quả cuối cùng sau khi xử lý: ${result.length} bản ghi.`);
  return result;
}

module.exports = {
  getPeopleListByMethod,
};
