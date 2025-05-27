function filterCheckinsByDay(data) {
  try {
    // Kiểm tra xem dữ liệu đầu vào có hợp lệ không
    let validData = [];
    
    // Xử lý trường hợp data là mảng trực tiếp (khi gọi trực tiếp API)
    if (Array.isArray(data)) {
      console.log('Nhận dữ liệu dạng mảng trực tiếp, số lượng: ' + data.length);
      validData = data;
    }
    // Xử lý trường hợp data có cấu trúc {data: [...]} (từ một số nguồn khác)
    else if (data && data.data && Array.isArray(data.data)) {
      console.log('Nhận dữ liệu dạng {data: [...]}, số lượng: ' + data.data.length);
      validData = data.data;
    } 
    // Nếu không phải cả hai dạng trên, trả về mảng rỗng
    else {
      console.error("Dữ liệu đầu vào không hợp lệ!", typeof data, data);
      return [];
    }
    
    // Sao chép dữ liệu để tránh thay đổi dữ liệu gốc
    validData = JSON.parse(JSON.stringify(validData));
    
    // Xử lý lọc và nhóm dữ liệu - tương tự cách frontend xử lý
    console.log(`Xử lý ${validData.length} bản ghi thô...`);
    
    // Lọc bỏ các bản ghi không hợp lệ
    const validCheckins = validData.filter(
      (item) =>
        item.personID &&
        item.personID !== "" &&
        item.personName &&
        item.personName !== ""
    );
    
    console.log(`Sau khi lọc, còn lại ${validCheckins.length} bản ghi hợp lệ.`);

    // Đảm bảo các bản ghi được sắp xếp theo thời gian
    validCheckins.sort((a, b) => {
      const timeA = typeof a.checkinTime === 'string' ? parseInt(a.checkinTime) : a.checkinTime;
      const timeB = typeof b.checkinTime === 'string' ? parseInt(b.checkinTime) : b.checkinTime;
      return timeA - timeB;
    });

    // Nhóm bản ghi theo person_date dựa trên ngày Việt Nam (UTC+7)
    const checksByPersonDate = {};
    const dailyFirstLastChecks = {};

    // Bước 1: Nhóm tất cả bản ghi theo personID và ngày (Vietnam time)
    validCheckins.forEach(check => {
      // Đảm bảo timestamp là số
      const checkinMs = typeof check.checkinTime === 'string' ? parseInt(check.checkinTime) : check.checkinTime;
      
      // Chuyển đổi sang múi giờ Việt Nam
      const checkinDate = new Date(checkinMs);
      const vietnamDate = convertToVietnamTime(checkinDate);
      
      // Tạo khóa ngày theo định dạng yyyy-mm-dd
      const dateStr = `${vietnamDate.getFullYear()}-${String(vietnamDate.getMonth() + 1).padStart(2, '0')}-${String(vietnamDate.getDate()).padStart(2, '0')}`;
      const personDateKey = `${dateStr}_${check.personID}`;
      
      // Lưu trữ ngày vào bản ghi
      check.date = dateStr;
      
      // Kiểm tra xem đã có bản ghi cho person+date này chưa
      if (!checksByPersonDate[personDateKey]) {
        checksByPersonDate[personDateKey] = [];
      }
      
      // Thêm bản ghi vào nhóm
      checksByPersonDate[personDateKey].push(check);
    });

    // Bước 2: Tìm check-in đầu tiên và check-out cuối cùng trong mỗi ngày
    for (const [personDateKey, checks] of Object.entries(checksByPersonDate)) {
      // Sắp xếp theo thời gian
      checks.sort((a, b) => {
        const timeA = typeof a.checkinTime === 'string' ? parseInt(a.checkinTime) : a.checkinTime;
        const timeB = typeof b.checkinTime === 'string' ? parseInt(b.checkinTime) : b.checkinTime;
        return timeA - timeB;
      });
      
      // Lấy bản ghi đầu tiên và cuối cùng
      const firstCheck = checks[0];
      const lastCheck = checks[checks.length - 1];
      
      // Tạo bản ghi mới cho ngày này
      dailyFirstLastChecks[personDateKey] = {
        personName: firstCheck.personName,
        personID: firstCheck.personID,
        aliasID: firstCheck.aliasID || "",
        placeID: firstCheck.placeID || "",
        title: firstCheck.title ? (typeof firstCheck.title === "string" ? firstCheck.title.trim() : "N/A") : "Khách hàng",
        type: firstCheck.type !== undefined ? firstCheck.type : null,
        deviceID: firstCheck.deviceID || "",
        deviceName: firstCheck.deviceName || "",
        date: firstCheck.date,
        checkinTime: firstCheck.checkinTime,
        formattedCheckinTime: formatTimestampWithVietnamTime(firstCheck.checkinTime)
      };
      
      // Nếu có nhiều hơn 1 bản ghi trong ngày, thì bản ghi cuối cùng là check-out
      if (checks.length > 1 && firstCheck.checkinTime !== lastCheck.checkinTime) {
        dailyFirstLastChecks[personDateKey].checkoutTime = lastCheck.checkinTime;
        dailyFirstLastChecks[personDateKey].formattedCheckoutTime = formatTimestampWithVietnamTime(lastCheck.checkinTime);
      } else {
        // Nếu chỉ có 1 bản ghi hoặc tất cả bản ghi có cùng thời gian, thì không có check-out
        dailyFirstLastChecks[personDateKey].checkoutTime = null;
        dailyFirstLastChecks[personDateKey].formattedCheckoutTime = null;
      }
    }

    // Bước 3: Tính toán thời gian làm việc và định dạng hiển thị
    Object.values(dailyFirstLastChecks).forEach(record => {
      // Tính thời gian làm việc nếu có cả check-in và check-out
      if (record.checkinTime && record.checkoutTime) {
        const checkinMs = typeof record.checkinTime === 'string' ? parseInt(record.checkinTime) : record.checkinTime;
        const checkoutMs = typeof record.checkoutTime === 'string' ? parseInt(record.checkoutTime) : record.checkoutTime;
        
        const workingTimeMs = checkoutMs - checkinMs;
        
        if (workingTimeMs > 0) {
          // Tính thời gian làm việc theo giờ và phút
          const workingHours = Math.floor(workingTimeMs / (1000 * 60 * 60));
          const workingMinutes = Math.floor((workingTimeMs % (1000 * 60 * 60)) / (1000 * 60));
          record.workingTime = `${workingHours}h ${workingMinutes}m`;
        } else {
          // Nếu thời gian làm việc quá ngắn (dưới 1 phút)
          record.workingTime = "0h 0m";
        }
      } else {
        record.workingTime = null;
      }
      
      // Thêm thông tin ngày tháng vào thời gian check-in/check-out
      if (record.formattedCheckinTime) {
        const checkinDate = new Date(parseInt(record.checkinTime));
        const vietnamDate = convertToVietnamTime(checkinDate);
        const checkinDay = vietnamDate.getDate().toString().padStart(2, '0');
        const checkinMonth = (vietnamDate.getMonth() + 1).toString().padStart(2, '0');
        const checkinYear = vietnamDate.getFullYear();
        record.formattedCheckinTime = `${record.formattedCheckinTime} ${checkinDay}/${checkinMonth}/${checkinYear}`;
      }
      
      if (record.formattedCheckoutTime) {
        const checkoutDate = new Date(parseInt(record.checkoutTime));
        const vietnamDate = convertToVietnamTime(checkoutDate);
        const checkoutDay = vietnamDate.getDate().toString().padStart(2, '0');
        const checkoutMonth = (vietnamDate.getMonth() + 1).toString().padStart(2, '0');
        const checkoutYear = vietnamDate.getFullYear();
        record.formattedCheckoutTime = `${record.formattedCheckoutTime} ${checkoutDay}/${checkoutMonth}/${checkoutYear}`;
      }
    });
    
    // Chuyển kết quả thành mảng và sắp xếp theo thời gian check-in
    const result = Object.values(dailyFirstLastChecks).sort((a, b) => {
      const timeA = typeof a.checkinTime === 'string' ? parseInt(a.checkinTime) : a.checkinTime;
      const timeB = typeof b.checkinTime === 'string' ? parseInt(b.checkinTime) : b.checkinTime;
      return timeA - timeB;
    });
    
    console.log(`Kết quả cuối cùng: ${result.length} bản ghi.`);
    return result;
  } catch (error) {
    console.error("Lỗi khi xử lý dữ liệu:", error);
    return [];
  }
}

// Hàm chuyển đổi thời gian sang múi giờ Việt Nam (UTC+7)
function convertToVietnamTime(date) {
  // Thời gian UTC
  const utcTime = date.getTime();
  // Chênh lệch múi giờ Việt Nam so với UTC: +7 giờ
  const vietnamOffset = 7 * 60 * 60 * 1000;
  // Thời gian Việt Nam
  return new Date(utcTime + vietnamOffset);
}

// Hàm định dạng timestamp sang định dạng giờ Việt Nam
function formatTimestampWithVietnamTime(timestamp) {
  const date = new Date(parseInt(timestamp));
  const vietnamDate = convertToVietnamTime(date);
  
  const hours = vietnamDate.getHours().toString().padStart(2, "0");
  const minutes = vietnamDate.getMinutes().toString().padStart(2, "0");
  const seconds = vietnamDate.getSeconds().toString().padStart(2, "0");
  
  return `${hours}:${minutes}:${seconds}`;
}

// Giữ lại hàm cũ để đảm bảo tương thích ngược nếu có nơi khác sử dụng
function formatTimestamp(timestamp) {
  return formatTimestampWithVietnamTime(timestamp);
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
  const fetchWithRetry = async (url, data, maxRetries = 2) => {
    let lastError;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          console.log(`Thử lại lần ${attempt} cho truy vấn API...`);
          // Chờ 1 giây trước khi thử lại
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        const config = {
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          timeout: 9000, // Tăng timeout cho phép trả về nhiều dữ liệu hơn
        };
        
        const response = await axios.post(url, qs.stringify(data), config);
        return response;
      } catch (error) {
        lastError = error;
        console.warn(`Lỗi lần thử ${attempt + 1}/${maxRetries}:`, error.message);
      }
    }
    
    throw lastError;
  };

  // Hàm thực hiện một lần truy vấn API trong khoảng thời gian nhỏ
  const fetchSegment = async (startTime, endTime) => {
    let segmentData = [];
    let totalRecords = 0;
    let hasMorePages = true;
    
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
        // Vẫn tiếp tục với các trang tiếp theo nếu có lỗi lần này
      }
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