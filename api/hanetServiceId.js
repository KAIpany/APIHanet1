function filterCheckinsByDay(data) {
  try {
    // Kiểm tra dữ liệu đầu vào
    if (!Array.isArray(data)) {
      console.error("Dữ liệu đầu vào của filter không phải là mảng.");
      return [];
    }

    // Khởi tạo đối tượng lưu trữ kết quả
    const checksByPerson = {};

    // Lọc ra các bản ghi hợp lệ
    const validCheckins = data.filter(
      (check) =>
        check.personID && check.checkinTime && check.personID.toString().trim() !== ""
    );

    // Xác định ngày cho mỗi bản ghi
    validCheckins.forEach((check) => {
      if (!check.date) {
        // Tính toán ngày từ timestamp nếu không có sẵn
        const checkDate = new Date(parseInt(check.checkinTime, 10));
        // Format: YYYY-MM-DD
        check.date = `${checkDate.getFullYear()}-${(checkDate.getMonth() + 1)
          .toString()
          .padStart(2, "0")}-${checkDate.getDate().toString().padStart(2, "0")}`;
      }
    });

    // Group by person_id và date
    validCheckins.forEach((check) => {
      const date = check.date;
      const personKey = `${date}_${check.personID}`;

      // Format thông tin người check
      const personInfo = {
        personName: check.personName !== undefined ? check.personName : "",
        personID: check.personID,
        aliasID: check.aliasID !== undefined ? check.aliasID : "",
        placeID: check.placeID !== undefined ? check.placeID : null,
        title: check.title
          ? typeof check.title === "string"
            ? check.title.trim()
            : "N/A"
          : "Khách hàng",
        type: check.type !== undefined ? check.type : null,
        deviceID: check.deviceID !== undefined ? check.deviceID : "",
        deviceName: check.deviceName !== undefined ? check.deviceName : "",
        date: check.date,
      };

      if (!checksByPerson[personKey]) {
        // Nếu chưa có thông tin cho người này trong ngày này
        checksByPerson[personKey] = {
          ...personInfo,
          checkinTime: check.checkinTime, // Lần check đầu tiên là check-in
          checkoutTime: check.checkinTime, // Khởi tạo checkout time bằng thời gian check-in
          formattedCheckinTime: formatTimestamp(check.checkinTime),
          formattedCheckoutTime: formatTimestamp(check.checkinTime)
        };
      } else {
        // Nếu đã có thông tin, luôn cập nhật checkout time là lần check cuối cùng
        checksByPerson[personKey].checkoutTime = check.checkinTime;
        checksByPerson[personKey].formattedCheckoutTime = formatTimestamp(check.checkinTime);
      }
    });

    // Xử lý các trường hợp checkout time trùng với checkin time
    Object.values(checksByPerson).forEach(record => {
      if (record.checkinTime === record.checkoutTime) {
        // Nếu chỉ có một lần check, đặt checkout time là null
        record.checkoutTime = null;
        record.formattedCheckoutTime = null;
      } else if (record.checkinTime && record.checkoutTime) {
        // Tính thời gian làm việc nếu có cả checkin và checkout
        const durationMinutes = (record.checkoutTime - record.checkinTime) / (1000 * 60);
        const hours = Math.floor(durationMinutes / 60);
        const minutes = Math.floor(durationMinutes % 60);
        record.workingTime = `${hours}h ${minutes}m`;
      }
    });

    const result = Object.values(checksByPerson).sort(
      (a, b) => a.checkinTime - b.checkinTime
    );

    return result;
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
  
  // Giới hạn thời gian mỗi lần truy vấn API
  const MAX_HOURS = 24;
  const MAX_PAGES = 20; // Tăng giới hạn số trang để lấy đầy đủ dữ liệu hơn
  
  // Hàm thử lại truy vấn khi gặp lỗi
  const fetchWithRetry = async (url, data, maxRetries = 3) => {
    let lastError;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          console.log(`Thử lại lần ${attempt} cho truy vấn API...`);
          // Chờ thêm thời gian giữa các lần thử lại, tăng dần theo số lần thử
          const delayMs = 2000 * (attempt + 1);
          console.log(`Chờ ${delayMs}ms trước khi thử lại...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
        
        const config = {
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          timeout: 30000, // Tăng timeout lên 30 giây
        };
        
        const response = await axios.post(url, qs.stringify(data), config);
        return response;
      } catch (error) {
        lastError = error;
        console.warn(`Lỗi lần thử ${attempt + 1}/${maxRetries}:`, error.message);
        
        if (error.code === 'ECONNABORTED' || (error.message && error.message.includes('timeout'))) {
          console.log(`Gặp lỗi timeout, sẽ thử lại với thời gian chờ dài hơn...`);
        }
      }
    }
    
    throw lastError;
  };

  // Hàm thực hiện một lần truy vấn API trong khoảng thời gian nhỏ với khả năng chia nhỏ thời gian khi timeout
  const fetchSegment = async (startTime, endTime, recursionDepth = 0) => {
    // Giới hạn độ sâu đệ quy để tránh vấn đề
    const MAX_RECURSION = 3;
    if (recursionDepth > MAX_RECURSION) {
      console.warn(`Đã đạt giới hạn đệ quy (${MAX_RECURSION}), dừng phân chia.`);
      return [];
    }
    
    let segmentData = [];
    let totalRecords = 0;
    let hasMorePages = true;
    let encounteredTimeout = false;
    
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

      try {
        console.log(`Đang gọi HANET API cho placeID=${placeId}, khoảng ${new Date(parseInt(startTime)).toISOString()} - ${new Date(parseInt(endTime)).toISOString()}, trang ${index}/${MAX_PAGES}...`);
        
        // Sử dụng hàm thử lại
        const response = await fetchWithRetry(apiUrl, requestData);
        
        if (response.data && typeof response.data.returnCode !== "undefined") {
          if (response.data.returnCode === 1 || response.data.returnCode === 0) {
            if (Array.isArray(response.data.data)) {
              const pageData = response.data.data;
              
              if (pageData.length === 0) {
                console.log(`Không còn dữ liệu ở trang ${index}, dừng truy vấn.`);
                hasMorePages = false;
                break;
              }
              
              // Lọc bỏ các bản ghi không hợp lệ (không có personID hoặc checkinTime)
              const validRecords = pageData.filter(record => record.personID && record.checkinTime);
              
              segmentData = [...segmentData, ...validRecords];
              totalRecords += validRecords.length;
              
              console.log(
                `Đã nhận ${validRecords.length} bản ghi hợp lệ từ trang ${index}, tổng cộng: ${totalRecords}`
              );
              
              // Nếu số bản ghi nhận được nhỏ hơn kích thước trang, có thể đã hết dữ liệu
              if (pageData.length < 500) {
                hasMorePages = false;
                console.log(`Đã nhận ${pageData.length} bản ghi < 500, có thể đã hết dữ liệu.`);
              }
            } else {
              console.warn(`Dữ liệu trả về không phải mảng hoặc không có.`);
              hasMorePages = false;
            }
          } else {
            console.error(
              `Lỗi logic từ HANET: Mã lỗi ${response.data.returnCode}, Thông điệp: ${response.data.returnMessage || "N/A"}`
            );
            // Vẫn tiếp tục với các trang tiếp theo nếu có lỗi lần này
          }
        } else {
          console.error(`Response không hợp lệ từ HANET:`, response.data);
        }
      } catch (error) {
        console.error(`Không thể lấy dữ liệu cho trang ${index}:`, error.message);
        
        // Xử lý lỗi timeout riêng biệt
        if (error.code === 'ECONNABORTED' || (error.message && error.message.includes('timeout'))) {
          console.warn(`Lỗi timeout cho trang ${index}, có thể dữ liệu quá lớn hoặc server đang bận.`);
          encounteredTimeout = true;
          
          // Nếu đã lấy được một số dữ liệu, có thể dừng truy vấn ở đây để trả về những gì đã có
          if (totalRecords > 0) {
            console.log(`Đã lấy được ${totalRecords} bản ghi, dừng truy vấn do timeout.`);
            hasMorePages = false;
            break;
          } else if (index === 1) {
            // Nếu timeout ở trang đầu tiên và chưa lấy được dữ liệu, 
            // có thể khoảng thời gian quá lớn - thử chia nhỏ
            console.log(`Timeout ở trang đầu tiên, thử chia nhỏ khoảng thời gian để xử lý...`);
            hasMorePages = false;
            break;
          }
        }
        
        // Vẫn tiếp tục với các trang tiếp theo nếu có lỗi lần này
      }
    }
    
    // Nếu gặp timeout ở trang đầu tiên và chưa lấy được dữ liệu, thử chia nhỏ khoảng thời gian
    if (encounteredTimeout && totalRecords === 0 && recursionDepth < MAX_RECURSION) {
      console.log(`Chia nhỏ khoảng thời gian do timeout (độ sâu đệ quy: ${recursionDepth})`);
      
      // Chia đôi khoảng thời gian
      const startTs = parseInt(startTime, 10);
      const endTs = parseInt(endTime, 10);
      const midTs = Math.floor((startTs + endTs) / 2);
      
      console.log(`Chia khoảng thời gian ${new Date(startTs).toLocaleString()} - ${new Date(endTs).toLocaleString()} thành 2 phần:`);
      console.log(`1. ${new Date(startTs).toLocaleString()} - ${new Date(midTs).toLocaleString()}`);
      console.log(`2. ${new Date(midTs).toLocaleString()} - ${new Date(endTs).toLocaleString()}`);
      
      // Truy vấn đệ quy cho mỗi nửa
      const firstHalfData = await fetchSegment(startTs.toString(), midTs.toString(), recursionDepth + 1);
      const secondHalfData = await fetchSegment(midTs.toString(), endTs.toString(), recursionDepth + 1);
      
      // Kết hợp kết quả
      return [...firstHalfData, ...secondHalfData];
    }
    
    // Sắp xếp dữ liệu theo thời gian trước khi trả về
    segmentData.sort((a, b) => a.checkinTime - b.checkinTime);
    console.log(`Tổng cộng đã lấy được ${segmentData.length} bản ghi cho khoảng thời gian.`);
    
    return segmentData;
  };
  
  // Nếu khoảng thời gian nhỏ hơn hoặc bằng 24 giờ, thực hiện bình thường
  if (diffInHours <= MAX_HOURS) {
    console.log(`Khoảng thời gian nhỏ hơn ${MAX_HOURS} giờ, thực hiện truy vấn trực tiếp.`);
    const rawCheckinData = await fetchSegment(dateFrom, dateTo);
    console.log(`Gọi filterCheckinsByDay với ${rawCheckinData.length} bản ghi trực tiếp.`);
    return filterCheckinsByDay(rawCheckinData);
  }
  
  // Nếu khoảng thời gian lớn hơn 24 giờ, chia nhỏ thành nhiều lần truy vấn
  console.log(`Khoảng thời gian lớn (${diffInHours.toFixed(1)} giờ), chia nhỏ thành nhiều lần truy vấn.`);
  
  // Chia khoảng thời gian lớn hơn thành các đoạn nhỏ hơn
  // Chia nhỏ hơn với các phần chồng lấn để đảm bảo không bỏ sót dữ liệu
  const segmentCount = Math.ceil(diffInHours / (MAX_HOURS * 0.95)); // Giảm kích thước mỗi đoạn xuống 95% để có chồng lấp
  const segmentMs = Math.floor((toDate - fromDate) / segmentCount);
  const overlap = Math.floor(segmentMs * 0.05); // Chồng lấp 5% giữa các đoạn
  
  console.log(`Sẽ thực hiện ${segmentCount} lần truy vấn với chồng lấp để đảm bảo độ phủ.`);
  
  // Truy vấn từng đoạn và kết hợp kết quả
  let rawCheckinData = [];
  
  for (let i = 0; i < segmentCount; i++) {
    // Tính toán điểm bắt đầu và kết thúc của mỗi đoạn
    let segmentStart = fromDate.getTime() + (i * segmentMs);
    if (i > 0) {
      segmentStart -= overlap; // Trừ đi phần chồng lấp cho các đoạn sau đoạn đầu tiên
    }
    
    let segmentEnd;
    if (i === segmentCount - 1) {
      segmentEnd = toDate.getTime(); // Đảm bảo đoạn cuối cùng bao gồm toàn bộ thời gian còn lại
    } else {
      segmentEnd = fromDate.getTime() + ((i + 1) * segmentMs);
    }
    
    console.log(`Đang xử lý phần ${i+1}/${segmentCount}: ${new Date(segmentStart).toLocaleString()} - ${new Date(segmentEnd).toLocaleString()}`);
    
    try {
      // Truy vấn dữ liệu cho đoạn này
      const segmentData = await fetchSegment(segmentStart.toString(), segmentEnd.toString());
      console.log(`Đã nhận ${segmentData.length} bản ghi từ phần ${i+1}/${segmentCount}`);
      
      // Thêm vào dữ liệu tổng hợp
      rawCheckinData = [...rawCheckinData, ...segmentData];
    } catch (error) {
      console.error(`Lỗi khi xử lý phần ${i+1}/${segmentCount}:`, error.message);
    }
  }
  
  console.log(`Đã nhận tổng cộng ${rawCheckinData.length} bản ghi chưa xử lý.`);
  
  // Lọc bỏ các bản ghi trùng lặp
  // Phương pháp lọc dựa trên tổ hợp personID và checkinTime
  const uniqueMap = {};
  const uniqueRecords = [];
  
  for (const record of rawCheckinData) {
    if (record.personID && record.checkinTime) {
      const key = `${record.personID}_${record.checkinTime}`;
      if (!uniqueMap[key]) {
        uniqueMap[key] = true;
        uniqueRecords.push(record);
      }
    }
  }
  
  // Sắp xếp các bản ghi theo thời gian
  uniqueRecords.sort((a, b) => a.checkinTime - b.checkinTime);
  
  console.log(`Hoàn tất! Sau khi lọc trùng còn ${uniqueRecords.length} bản ghi duy nhất.`);
  
  // Sử dụng hàm filterCheckinsByDay để xử lý dữ liệu
  console.log(`Gọi filterCheckinsByDay với ${uniqueRecords.length} bản ghi.`);
  const result = filterCheckinsByDay(uniqueRecords);
  
  console.log(`Kết quả cuối cùng sau khi xử lý: ${result.length} bản ghi.`);
  return result;
}
// Trả về mảng JSON thay vì đối tượng phân theo ngày

module.exports = {
getPeopleListByMethod,
};