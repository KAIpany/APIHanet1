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
    
    // Bổ sung trường date nếu chưa có
    validData.forEach(item => {
      if (!item.date && item.checkinTime) {
        const checkinDate = new Date(parseInt(item.checkinTime));
        item.date = `${checkinDate.getFullYear()}-${String(checkinDate.getMonth() + 1).padStart(2, '0')}-${String(checkinDate.getDate()).padStart(2, '0')}`;
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

    // In thông tin debug để kiểm tra
    console.log(`Danh sách bản ghi hợp lệ: ${validCheckins.length} bản ghi.`);
    
    // Tạo một đối tượng tạm để theo dõi check-in và check-out của mỗi người theo ngày
    const checksByPerson = {};

    // Đảm bảo các bản ghi được sắp xếp theo thời gian
    validCheckins.sort((a, b) => parseInt(a.checkinTime) - parseInt(b.checkinTime));

    // Xử lý từng bản ghi check-in
    validCheckins.forEach((check) => {
      if (!check.date) {
        const checkinDate = new Date(parseInt(check.checkinTime));
        check.date = `${checkinDate.getFullYear()}-${String(checkinDate.getMonth() + 1).padStart(2, '0')}-${String(checkinDate.getDate()).padStart(2, '0')}`;
      }
      
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
      
      // Thêm tính toán thời gian làm việc
      if (record.checkinTime && record.checkoutTime) {
        const checkinMs = parseInt(record.checkinTime);
        const checkoutMs = parseInt(record.checkoutTime);
        const workingTimeMs = checkoutMs - checkinMs;
        
        // Tính thời gian làm việc theo giờ và phút
        const workingHours = Math.floor(workingTimeMs / (1000 * 60 * 60));
        const workingMinutes = Math.floor((workingTimeMs % (1000 * 60 * 60)) / (1000 * 60));
        record.workingTime = `${workingHours}h ${workingMinutes}m`;
      } else {
        record.workingTime = null;
      }
      
      // Chuyển đổi dạng ngày tháng hợp lệ cho giao diện hiển thị
      if (record.formattedCheckinTime) {
        const checkinDate = new Date(parseInt(record.checkinTime));
        const checkinDay = checkinDate.getDate().toString().padStart(2, '0');
        const checkinMonth = (checkinDate.getMonth() + 1).toString().padStart(2, '0');
        const checkinYear = checkinDate.getFullYear();
        record.formattedCheckinTime = `${record.formattedCheckinTime} ${checkinDay}/${checkinMonth}/${checkinYear}`;
      }
      
      if (record.formattedCheckoutTime) {
        const checkoutDate = new Date(parseInt(record.checkoutTime));
        const checkoutDay = checkoutDate.getDate().toString().padStart(2, '0');
        const checkoutMonth = (checkoutDate.getMonth() + 1).toString().padStart(2, '0');
        const checkoutYear = checkoutDate.getFullYear();
        record.formattedCheckoutTime = `${record.formattedCheckoutTime} ${checkoutDay}/${checkoutMonth}/${checkoutYear}`;
      }
    });
    
    // Đảm bảo sắp xếp theo thời gian check-in
    const result = Object.values(checksByPerson).sort(
      (a, b) => parseInt(a.checkinTime) - parseInt(b.checkinTime)
    );
    
    console.log(`Kết quả cuối cùng: ${result.length} bản ghi.`);
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

// Hàm lấy dữ liệu thô từ API Hanet mà không qua bước xử lý phức tạp
async function getRawCheckinData(placeId, dateFrom, dateTo, devices) {
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
  
  // Kiểm tra khoảng thời gian
  const fromDate = new Date(parseInt(dateFrom, 10));
  const toDate = new Date(parseInt(dateTo, 10));
  const diffInHours = (toDate - fromDate) / (1000 * 60 * 60);
  
  // Nếu khoảng thời gian nhỏ hơn hoặc bằng 24 giờ, thực hiện bình thường
  if (diffInHours <= MAX_HOURS) {
    console.log(`Khoảng thời gian nhỏ hơn ${MAX_HOURS} giờ, lấy dữ liệu trực tiếp.`);
    
    let allRecords = [];
    
    for (let index = 1; index <= MAX_PAGES; index++) {
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
      
      try {
        // Gọi API
        console.log(`Đang gọi API Hanet, trang ${index}/${MAX_PAGES}...`);
        const response = await fetchWithRetry(apiUrl, requestData);
        
        if (response.data && Array.isArray(response.data.data)) {
          const pageData = response.data.data;
          
          if (pageData.length === 0) {
            console.log(`Không còn dữ liệu ở trang ${index}, dừng truy vấn.`);
            break;
          }
          
          allRecords = [...allRecords, ...pageData];
          console.log(`Đã nhận ${pageData.length} bản ghi từ trang ${index}, tổng cộng: ${allRecords.length}`);
          
          // Nếu số bản ghi nhỏ hơn kích thước trang, có thể đã hết dữ liệu
          if (pageData.length < 500) {
            console.log(`Đã nhận ${pageData.length} bản ghi < 500, có thể đã hết dữ liệu.`);
            break;
          }
        } else {
          console.warn(`Không phải dữ liệu mảng hoặc không có dữ liệu.`);
          break;
        }
      } catch (error) {
        console.error(`Lỗi khi lấy dữ liệu trang ${index}:`, error.message);
        break;
      }
    }
    
    return allRecords;
  }
  
  // Nếu khoảng thời gian lớn hơn 24 giờ, chia nhỏ thành nhiều lần truy vấn
  console.log(`Khoảng thời gian lớn (${diffInHours.toFixed(1)} giờ), chia nhỏ thành nhiều lần truy vấn.`);
  
  // Chia khoảng thời gian lớn hơn thành các đoạn nhỏ hơn
  // Chia nhỏ hơn với các phần chồng lấn để đảm bảo không bỏ sót dữ liệu
  const segmentCount = Math.ceil(diffInHours / (MAX_HOURS * 0.95)); // Giảm kích thước mỗi đoạn xuống 95% để có chồng lấp
  const segmentMs = Math.floor((toDate - fromDate) / segmentCount);
  const overlap = Math.floor(segmentMs * 0.05); // Chồng lấp 5% giữa các đoạn
  
  console.log(`Sẽ thực hiện ${segmentCount} lần truy vấn với chồng lấp để đảm bảo độ phủ.`);
  
  // Lưu trữ tất cả dữ liệu
  let allRecords = [];
  
  // Lưu bản ghi duy nhất để tránh trùng lặp
  const uniqueMap = {};
  
  // Xử lý từng đoạn thời gian
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
    
    // Lấy dữ liệu cho đoạn thời gian này
    for (let page = 1; page <= MAX_PAGES; page++) {
      const apiUrl = `${HANET_API_BASE_URL}/person/getCheckinByPlaceIdInTimestamp`;
      const requestData = {
        token: accessToken,
        placeID: placeId,
        from: segmentStart.toString(),
        to: segmentEnd.toString(),
        ...(devices && { devices: devices }),
        size: 500,
        page: page,
      };
      
      try {
        // Gọi API
        console.log(`Đang gọi API Hanet, đoạn ${i+1}/${segmentCount}, trang ${page}/${MAX_PAGES}...`);
        const response = await fetchWithRetry(apiUrl, requestData);
        
        if (response.data && Array.isArray(response.data.data)) {
          const pageData = response.data.data;
          
          if (pageData.length === 0) {
            console.log(`Không còn dữ liệu ở trang ${page} đoạn ${i+1}, chuyển sang đoạn tiếp theo.`);
            break;
          }
          
          // Thêm vào mảng kết quả và loại bỏ trùng lặp
          for (const record of pageData) {
            if (record.personID && record.checkinTime) {
              const key = `${record.personID}_${record.checkinTime}`;
              if (!uniqueMap[key]) {
                uniqueMap[key] = true;
                allRecords.push(record);
              }
            }
          }
          
          console.log(`Đã nhận ${pageData.length} bản ghi từ trang ${page}, tổng cộng hiện tại: ${allRecords.length}`);
          
          // Nếu số bản ghi nhỏ hơn kích thước trang, có thể đã hết dữ liệu
          if (pageData.length < 500) {
            console.log(`Đã nhận ${pageData.length} bản ghi < 500, chuyển sang đoạn tiếp theo.`);
            break;
          }
        } else {
          console.warn(`Không phải dữ liệu mảng hoặc không có dữ liệu.`);
          break;
        }
      } catch (error) {
        console.error(`Lỗi khi lấy dữ liệu trang ${page} đoạn ${i+1}:`, error.message);
        break;
      }
    }
  }
  
  console.log(`Hoàn tất! Đã lấy tổng cộng ${allRecords.length} bản ghi duy nhất.`);
  return allRecords;
}

module.exports = {
  getPeopleListByMethod,
  getRawCheckinData
};