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
let rawCheckinData = [];
for (let index = 1; index <= 100000; index++) {
  const apiUrl = `${HANET_API_BASE_URL}/person/getCheckinByPlaceIdInTimestamp`;
  const requestData = {
    token: accessToken,
    placeID: placeId,
    from: dateFrom,
    to: dateTo,
    ...(devices && { devices: devices }),
    size: 500,
    page: index,
  };
  const config = {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    timeout: 15000,
  };

  try {
    console.log(`Đang gọi HANET API cho placeID=${placeId}...`);
    const response = await axios.post(
      apiUrl,
      qs.stringify(requestData),
      config
    );
    if (response.data && typeof response.data.returnCode !== "undefined") {
      if (response.data.returnCode === 1 || response.data.returnCode === 0) {
        console.log(`Gọi HANET API thành công cho placeID=${placeId}.`);
        if (Array.isArray(response.data.data)) {
          if (response.data.data.length === 0) {
            // Nếu trang không có dữ liệu, thoát vòng lặp
            console.log(`Không còn dữ liệu ở trang ${index}, dừng truy vấn.`);
            break;
          }
          rawCheckinData = [...rawCheckinData, ...response.data.data];
          console.log(
            `Đã nhận tổng cộng ${rawCheckinData.length} bản ghi check-in.`
          );
        } else {
          console.warn(
            `Dữ liệu trả về cho placeID ${placeId} không phải mảng hoặc không có.`
          );
          break;
        }
      } else {
        console.error(
          `Lỗi logic từ HANET cho placeID=${placeId}: Mã lỗi ${
            response.data.returnCode
          }, Thông điệp: ${response.data.returnMessage || "N/A"}`
        );
      }
    } else {
      console.error(
        `Response không hợp lệ từ HANET cho placeID=${placeId}:`,
        response.data
      );
    }
  } catch (error) {
    if (error.code === "ECONNABORTED") {
      console.error(`Lỗi timeout khi gọi API cho placeID=${placeId}.`);
    } else {
      console.error(
        `Lỗi mạng/request khi gọi ${apiUrl} cho placeID=${placeId}:`,
        error.response?.data || error.message
      );
    }
    console.warn(
      `Không lấy được dữ liệu cho địa điểm ${placeId} do lỗi request.`
    );
  }
}

return filterCheckinsByDay({ data: rawCheckinData });
// Trả về mảng JSON thay vì đối tượng phân theo ngày
}

module.exports = {
getPeopleListByMethod,
};