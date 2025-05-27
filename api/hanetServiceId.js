function filterCheckinsByDay(data) {
  try {
    if (!data || !data.data || !Array.isArray(data.data)) {
      console.error("Dữ liệu đầu vào không hợp lệ!");
      return [];
    }

    const validCheckins = data.data.filter(
      (item) =>
        item.personID &&
        item.personID !== "" &&
        item.personName &&
        item.personName !== ""
    );

    // Tạo một đối tượng tạm để theo dõi check-in và check-out của mỗi người theo ngày
    const checksByPerson = {};

    // Sắp xếp các lần check theo thời gian
    validCheckins.sort((a, b) => a.checkinTime - b.checkinTime);

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
  const date = new Date(timestamp);
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const seconds = date.getSeconds().toString().padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
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
  const MAX_PAGES = 5; // Giới hạn số trang tối đa mỗi lần truy vấn
  
  // Hàm thực hiện một lần truy vấn API trong khoảng thời gian nhỏ
  const fetchSegment = async (startTime, endTime) => {
    let segmentData = [];
    
    for (let index = 1; index <= MAX_PAGES; index++) {
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
      const config = {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        timeout: 8000, // Giảm timeout để đảm bảo serverless function có thể phản hồi
      };

      try {
        console.log(`Đang gọi HANET API cho placeID=${placeId}, khoảng ${new Date(parseInt(startTime)).toISOString()} - ${new Date(parseInt(endTime)).toISOString()}, trang ${index}/${MAX_PAGES}...`);
        const response = await axios.post(
          apiUrl,
          qs.stringify(requestData),
          config
        );
        if (response.data && typeof response.data.returnCode !== "undefined") {
          if (response.data.returnCode === 1 || response.data.returnCode === 0) {
            if (Array.isArray(response.data.data)) {
              if (response.data.data.length === 0) {
                console.log(`Không còn dữ liệu ở trang ${index}, dừng truy vấn.`);
                break;
              }
              segmentData = [...segmentData, ...response.data.data];
              console.log(
                `Đã nhận ${response.data.data.length} bản ghi check-in cho khoảng thời gian ${new Date(parseInt(startTime)).toLocaleString()} - ${new Date(parseInt(endTime)).toLocaleString()}.`
              );
            } else {
              console.warn(`Dữ liệu trả về không phải mảng hoặc không có.`);
              break;
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
        if (error.code === "ECONNABORTED") {
          console.error(`Lỗi timeout khi gọi API.`);
        } else {
          console.error(
            `Lỗi mạng/request:`, error.response?.data || error.message
          );
        }
        console.warn(`Không lấy được dữ liệu do lỗi request.`);
        break;
      }
    }
    
    return segmentData;
  };
  
  // Nếu khoảng thời gian nhỏ hơn hoặc bằng 24 giờ, thực hiện bình thường
  if (diffInHours <= MAX_HOURS) {
    console.log(`Khoảng thời gian nhỏ hơn ${MAX_HOURS} giờ, thực hiện truy vấn trực tiếp.`);
    const rawCheckinData = await fetchSegment(dateFrom, dateTo);
    return filterCheckinsByDay({ data: rawCheckinData });
  }
  
  // Nếu khoảng thời gian lớn hơn 24 giờ, chia nhỏ thành nhiều lần truy vấn
  console.log(`Khoảng thời gian lớn (${diffInHours.toFixed(1)} giờ), chia nhỏ thành nhiều lần truy vấn.`);
  
  // Tính số lần cần chia
  const segmentCount = Math.ceil(diffInHours / MAX_HOURS);
  const segmentMs = Math.floor((toDate - fromDate) / segmentCount);
  
  console.log(`Sẽ thực hiện ${segmentCount} lần truy vấn để lấy dữ liệu.`);
  
  // Thực hiện nhiều lần truy vấn và kết hợp kết quả
  let allCheckinData = [];
  
  // Lưu trữ các bản ghi duy nhất bằng Map
  const uniqueRecords = new Map();
  
  for (let i = 0; i < segmentCount; i++) {
    const segmentStart = fromDate.getTime() + (i * segmentMs);
    const segmentEnd = (i === segmentCount - 1) 
      ? toDate.getTime() 
      : fromDate.getTime() + ((i + 1) * segmentMs) - 1;
    
    console.log(`Đang xử lý phần ${i+1}/${segmentCount}: ${new Date(segmentStart).toLocaleString()} - ${new Date(segmentEnd).toLocaleString()}`);
    
    try {
      const segmentData = await fetchSegment(segmentStart.toString(), segmentEnd.toString());
      
      // Lưu trữ các bản ghi duy nhất dựa trên personID và checkinTime
      for (const record of segmentData) {
        if (record.personID && record.checkinTime) {
          const key = `${record.personID}_${record.checkinTime}`;
          if (!uniqueRecords.has(key)) {
            uniqueRecords.set(key, record);
          }
        }
      }
      
      console.log(`Đã xử lý xong phần ${i+1}/${segmentCount}, tổng số bản ghi duy nhất: ${uniqueRecords.size}`);
    } catch (error) {
      console.error(`Lỗi khi xử lý phần ${i+1}/${segmentCount}:`, error.message);
    }
  }
  
  // Chuyển Map thành mảng
  allCheckinData = Array.from(uniqueRecords.values());
  
  console.log(`Hoàn tất! Đã lấy tổng cộng ${allCheckinData.length} bản ghi duy nhất.`);
  
  return filterCheckinsByDay({ data: allCheckinData });
}
// Trả về mảng JSON thay vì đối tượng phân theo ngày

module.exports = {
getPeopleListByMethod,
};