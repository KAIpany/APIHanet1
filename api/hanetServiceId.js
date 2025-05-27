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
    
    // Tiền xử lý dữ liệu: chuyển đổi timestamp sang múi giờ Việt Nam
    validData.forEach(item => {
      if (item.checkinTime) {
        const checkinMs = typeof item.checkinTime === 'string' ? parseInt(item.checkinTime) : item.checkinTime;
        const checkinDate = new Date(checkinMs);
        const vietnamDate = convertToVietnamTime(checkinDate);
        
        // Cập nhật trường date theo định dạng yyyy-mm-dd
        item.date = `${vietnamDate.getFullYear()}-${String(vietnamDate.getMonth() + 1).padStart(2, '0')}-${String(vietnamDate.getDate()).padStart(2, '0')}`;
      }
    });
    
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

    // Nhóm bản ghi theo người và ngày
    const checksByPersonDate = {};
    
    // Nhóm các bản ghi theo personID và ngày
    validCheckins.forEach(check => {
      const personDateKey = `${check.date}_${check.personID}`;
      
      if (!checksByPersonDate[personDateKey]) {
        checksByPersonDate[personDateKey] = [];
      }
      
      // Thêm bản ghi vào nhóm
      checksByPersonDate[personDateKey].push(check);
    });
    
    // Cấu hình phân tích ca làm việc
    const WORK_SHIFT_THRESHOLD_MS = 60 * 60 * 1000; // 1 giờ là ngưỡng để tách ca làm việc
    
    // Kết quả cuối cùng - danh sách tất cả ca làm việc
    const workShifts = [];
    
    // Phân tích từng nhóm người theo ngày để tìm ca làm việc
    for (const [personDateKey, checks] of Object.entries(checksByPersonDate)) {
      // Sắp xếp theo thời gian check-in
      checks.sort((a, b) => {
        const timeA = typeof a.checkinTime === 'string' ? parseInt(a.checkinTime) : a.checkinTime;
        const timeB = typeof b.checkinTime === 'string' ? parseInt(b.checkinTime) : b.checkinTime;
        return timeA - timeB;
      });
      
      // Nếu chỉ có một bản ghi cho ngày này, coi như là check-in không có check-out
      if (checks.length === 1) {
        const singleRecord = { ...checks[0] };
        singleRecord.formattedCheckinTime = formatTimestampWithVietnamTime(singleRecord.checkinTime);
        singleRecord.checkoutTime = null;
        singleRecord.formattedCheckoutTime = null;
        singleRecord.workingTime = null;
        workShifts.push(singleRecord);
        continue;
      }
      
      // Phân tích các ca làm việc từ chuỗi check-in
      let currentShiftStart = null;
      let currentShiftEnd = null;
      
      for (let i = 0; i < checks.length; i++) {
        const currentCheck = checks[i];
        const currentCheckTime = typeof currentCheck.checkinTime === 'string' ? 
                                 parseInt(currentCheck.checkinTime) : currentCheck.checkinTime;
        
        // Nếu đây là bản ghi đầu tiên hoặc thời gian giữa các lần check > ngưỡng
        if (currentShiftStart === null) {
          // Bắt đầu ca mới
          currentShiftStart = currentCheck;
          currentShiftEnd = currentCheck;
        } else {
          const prevCheckTime = typeof currentShiftEnd.checkinTime === 'string' ? 
                               parseInt(currentShiftEnd.checkinTime) : currentShiftEnd.checkinTime;
          
          const timeDiff = currentCheckTime - prevCheckTime;
          
          if (timeDiff > WORK_SHIFT_THRESHOLD_MS) {
            // Nếu thời gian giữa lần check hiện tại và lần check trước > ngưỡng
            // Kết thúc ca hiện tại và tạo bản ghi
            const shiftRecord = { ...currentShiftStart };
            shiftRecord.checkoutTime = currentShiftEnd.checkinTime;
            shiftRecord.formattedCheckinTime = formatTimestampWithVietnamTime(shiftRecord.checkinTime);
            shiftRecord.formattedCheckoutTime = formatTimestampWithVietnamTime(shiftRecord.checkoutTime);
            
            // Tính thời gian làm việc
            const checkinMs = typeof shiftRecord.checkinTime === 'string' ? 
                              parseInt(shiftRecord.checkinTime) : shiftRecord.checkinTime;
            const checkoutMs = typeof shiftRecord.checkoutTime === 'string' ? 
                               parseInt(shiftRecord.checkoutTime) : shiftRecord.checkoutTime;
            const workingTimeMs = checkoutMs - checkinMs;
            
            if (workingTimeMs > 0) {
              const workingHours = Math.floor(workingTimeMs / (1000 * 60 * 60));
              const workingMinutes = Math.floor((workingTimeMs % (1000 * 60 * 60)) / (1000 * 60));
              shiftRecord.workingTime = `${workingHours}h ${workingMinutes}m`;
            } else {
              shiftRecord.workingTime = "0h 0m";
            }
            
            // Thêm vào danh sách ca làm việc
            workShifts.push(shiftRecord);
            
            // Bắt đầu ca mới
            currentShiftStart = currentCheck;
            currentShiftEnd = currentCheck;
          } else {
            // Cập nhật thời gian kết thúc ca hiện tại
            currentShiftEnd = currentCheck;
          }
        }
        
        // Nếu đây là bản ghi cuối cùng và đang có ca làm việc
        if (i === checks.length - 1 && currentShiftStart !== null) {
          const shiftRecord = { ...currentShiftStart };
          
          // Nếu không phải ca có một bản ghi duy nhất
          if (currentShiftStart !== currentShiftEnd) {
            shiftRecord.checkoutTime = currentShiftEnd.checkinTime;
            shiftRecord.formattedCheckinTime = formatTimestampWithVietnamTime(shiftRecord.checkinTime);
            shiftRecord.formattedCheckoutTime = formatTimestampWithVietnamTime(shiftRecord.checkoutTime);
            
            // Tính thời gian làm việc
            const checkinMs = typeof shiftRecord.checkinTime === 'string' ? 
                              parseInt(shiftRecord.checkinTime) : shiftRecord.checkinTime;
            const checkoutMs = typeof shiftRecord.checkoutTime === 'string' ? 
                               parseInt(shiftRecord.checkoutTime) : shiftRecord.checkoutTime;
            const workingTimeMs = checkoutMs - checkinMs;
            
            if (workingTimeMs > 0) {
              const workingHours = Math.floor(workingTimeMs / (1000 * 60 * 60));
              const workingMinutes = Math.floor((workingTimeMs % (1000 * 60 * 60)) / (1000 * 60));
              shiftRecord.workingTime = `${workingHours}h ${workingMinutes}m`;
            } else {
              shiftRecord.workingTime = "0h 0m";
            }
          } else {
            // Nếu chỉ có một bản ghi trong ca
            shiftRecord.formattedCheckinTime = formatTimestampWithVietnamTime(shiftRecord.checkinTime);
            shiftRecord.checkoutTime = null;
            shiftRecord.formattedCheckoutTime = null;
            shiftRecord.workingTime = null;
          }
          
          // Thêm vào danh sách ca làm việc
          workShifts.push(shiftRecord);
        }
      }
    }
    
    // Định dạng thời gian check-in/check-out với ngày tháng đầy đủ
    workShifts.forEach(record => {
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
    
    // Sắp xếp kết quả theo thời gian check-in
    workShifts.sort((a, b) => {
      const timeA = typeof a.checkinTime === 'string' ? parseInt(a.checkinTime) : a.checkinTime;
      const timeB = typeof b.checkinTime === 'string' ? parseInt(b.checkinTime) : b.checkinTime;
      return timeA - timeB;
    });
    
    console.log(`Kết quả cuối cùng: ${workShifts.length} bản ghi.`);
    return workShifts;
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

// Hàm lấy danh sách check-in từ API Hanet và xử lý kết quả
async function getPeopleListByMethod(placeId, dateFrom, dateTo, devices = '') {
  try {
    // Cần có token để truy cập API
    const token = await tokenManager.getValidHanetToken();
    if (!token) {
      throw new Error("Không có token xác thực hợp lệ");
    }
    
    // Tạo URL truy vấn
    let apiUrl = `${HANET_API_BASE_URL}/devicehistory?type=checkin&placeID=${placeId}`;
    
    // Thêm thời gian bắt đầu và kết thúc nếu có
    if (dateFrom) {
      apiUrl += `&date_from=${dateFrom}`;
    }
    if (dateTo) {
      apiUrl += `&date_to=${dateTo}`;
    }
    
    // Thêm danh sách thiết bị nếu có
    if (devices && devices.trim() !== '') {
      apiUrl += `&deviceID=${devices}`;
    }
    
    console.log(`Gọi API: ${apiUrl}`);
    
    // Gọi API Hanet
    const response = await axios.get(apiUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    
    // Kiểm tra kết quả trả về
    if (response.status === 200 && response.data) {
      console.log(`Đã nhận ${response.data.length || 0} bản ghi thô từ API.`);
      
      // Lọc trùng các bản ghi dựa trên personID và thời gian check-in
      const uniqueRecords = [];
      const recordKeys = new Set();
      
      if (Array.isArray(response.data)) {
        for (const record of response.data) {
          // Tạo khóa duy nhất cho mỗi bản ghi
          const recordKey = `${record.personID}_${record.checkinTime}`;
          
          if (!recordKeys.has(recordKey)) {
            recordKeys.add(recordKey);
            uniqueRecords.push(record);
          }
        }
      }
      
      // Sắp xếp các bản ghi theo thời gian check-in
      uniqueRecords.sort((a, b) => a.checkinTime - b.checkinTime);
      
      console.log(`Hoàn tất! Sau khi lọc trùng còn ${uniqueRecords.length} bản ghi duy nhất.`);
      
      // Sử dụng hàm filterCheckinsByDay để xử lý dữ liệu
      console.log(`Gọi filterCheckinsByDay với ${uniqueRecords.length} bản ghi.`);
      const result = filterCheckinsByDay(uniqueRecords);
      
      console.log(`Kết quả cuối cùng sau khi xử lý: ${result.length} bản ghi.`);
      return result;
    }
    
    // Trả về mảng rỗng nếu không có dữ liệu
    return [];
  } catch (error) {
    console.error("Lỗi khi lấy danh sách check-in:", error.message);
    throw error;
  }
}

// Xuất các hàm cần thiết
module.exports = {
  getPeopleListByMethod,
  filterCheckinsByDay
};
