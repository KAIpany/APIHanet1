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
  const MAX_HOURS = 6; // Giảm xuống 6 giờ để tránh timeout
  const MAX_PAGES = 10; // Giảm số trang mỗi lần truy vấn
  const MAX_RETRIES = 3; // Số lần thử lại cho mỗi request
  const BASE_TIMEOUT = 30000; // Timeout cơ bản 30 giây
  const MAX_SEGMENT_SIZE = 10000; // Số bản ghi tối đa mỗi phân đoạn
  
  // Hàm thử lại truy vấn với timeout tăng dần và exponential backoff
  const fetchWithRetry = async (url, data, attempt = 0) => {
    const timeout = Math.min(BASE_TIMEOUT * Math.pow(2, attempt), 120000); // Max 120s
    const delayMs = attempt > 0 ? Math.min(1000 * Math.pow(2, attempt - 1), 10000) : 0; // Max 10s delay
    
    try {
      if (delayMs > 0) {
        console.log(`Chờ ${delayMs}ms trước khi thử lại lần ${attempt + 1}...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
      
      const config = {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Accept": "application/json"
        },
        timeout: timeout,
        validateStatus: status => status === 200 // Chỉ chấp nhận status 200
      };
      
      console.log(`Thực hiện request với timeout ${timeout}ms (lần thử ${attempt + 1}/${MAX_RETRIES})`);
      const response = await axios.post(url, qs.stringify(data), config);
      
      if (!response.data || typeof response.data.returnCode === "undefined") {
        throw new Error("Invalid response format from HANET API");
      }
      
      return response;
    } catch (error) {
      if (attempt < MAX_RETRIES - 1) {
        console.log(`Lỗi request (${error.message}), sẽ thử lại...`);
        return fetchWithRetry(url, data, attempt + 1);
      }
      throw error;
    }
  };

  // Hàm thực hiện một lần truy vấn API trong khoảng thời gian nhỏ
  const fetchSegment = async (startTime, endTime, recursionDepth = 0) => {
    const MAX_RECURSION = 2; // Giảm độ sâu đệ quy
    if (recursionDepth > MAX_RECURSION) {
      console.warn(`Đã đạt giới hạn đệ quy (${MAX_RECURSION}), dừng phân chia.`);
      return [];
    }

    let segmentData = [];
    let consecutiveErrors = 0;
    const MAX_CONSECUTIVE_ERRORS = 3;
    
    for (let index = 1; index <= MAX_PAGES; index++) {
      const apiUrl = `${HANET_API_BASE_URL}/person/getCheckinByPlaceIdInTimestamp`;
      const requestData = {
        token: accessToken,
        placeID: placeId,
        from: startTime,
        to: endTime,
        ...(devices && { devices: devices }),
        size: 200, // Giảm kích thước mỗi trang
        page: index,
      };

      try {
        console.log(`Đang gọi HANET API: ${new Date(parseInt(startTime)).toLocaleString()} - ${new Date(parseInt(endTime)).toLocaleString()}, trang ${index}/${MAX_PAGES}`);
        
        const response = await fetchWithRetry(apiUrl, requestData);
        
        if (response.data.returnCode === 1 || response.data.returnCode === 0) {
          const pageData = response.data.data || [];
          
          if (pageData.length === 0) {
            console.log(`Không còn dữ liệu ở trang ${index}, dừng truy vấn.`);
            break;
          }
          
          segmentData = [...segmentData, ...pageData];
          console.log(`Nhận được ${pageData.length} bản ghi từ trang ${index}`);
          
          if (pageData.length < 200) {
            console.log(`Đã nhận đủ dữ liệu cho phân đoạn này.`);
            break;
          }
          
          // Kiểm tra kích thước của segmentData
          if (segmentData.length >= MAX_SEGMENT_SIZE) {
            console.log(`Đạt giới hạn ${MAX_SEGMENT_SIZE} bản ghi, chia nhỏ phân đoạn.`);
            const midTs = Math.floor((parseInt(startTime) + parseInt(endTime)) / 2);
            const firstHalf = await fetchSegment(startTime, midTs.toString(), recursionDepth + 1);
            const secondHalf = await fetchSegment(midTs.toString(), endTime, recursionDepth + 1);
            return [...firstHalf, ...secondHalf];
          }
          
          consecutiveErrors = 0; // Reset đếm lỗi khi thành công
        } else {
          throw new Error(`HANET API error: ${response.data.returnMessage || 'Unknown error'}`);
        }
      } catch (error) {
        console.error(`Lỗi khi lấy dữ liệu trang ${index}:`, error.message);
        consecutiveErrors++;
        
        if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          console.log(`Đã gặp ${consecutiveErrors} lỗi liên tiếp, thử chia nhỏ khoảng thời gian...`);
          if (recursionDepth < MAX_RECURSION) {
            const midTs = Math.floor((parseInt(startTime) + parseInt(endTime)) / 2);
            const firstHalf = await fetchSegment(startTime, midTs.toString(), recursionDepth + 1);
            const secondHalf = await fetchSegment(midTs.toString(), endTime, recursionDepth + 1);
            return [...firstHalf, ...secondHalf];
          }
          break;
        }
        
        // Tạm dừng trước khi thử trang tiếp theo
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    return segmentData;
  };

  // Phân chia khoảng thời gian thành nhiều phân đoạn nhỏ hơn nếu cần thiết
  const fetchAllSegments = async (placeId, dateFrom, dateTo, devices) => {
    const segments = [];
    const fromDate = new Date(parseInt(dateFrom, 10));
    const toDate = new Date(parseInt(dateTo, 10));
    const diffInHours = (toDate - fromDate) / (1000 * 60 * 60);
    
    if (diffInHours <= MAX_HOURS) {
      // Nếu khoảng thời gian nhỏ hơn hoặc bằng MAX_HOURS, chỉ cần một lần truy vấn
      console.log(`Khoảng thời gian nhỏ hơn hoặc bằng ${MAX_HOURS} giờ, thực hiện một lần truy vấn.`);
      const data = await fetchSegment(dateFrom, dateTo, 0);
      segments.push(...data);
    } else {
      // Chia nhỏ khoảng thời gian thành các phân đoạn
      console.log(`Chia nhỏ khoảng thời gian thành các phân đoạn ${MAX_HOURS} giờ.`);
      let currentStart = fromDate;
      while (currentStart < toDate) {
        const currentEnd = new Date(currentStart.getTime() + MAX_HOURS * 60 * 60 * 1000);
        const segmentData = await fetchSegment(currentStart.getTime().toString(), currentEnd.getTime().toString());
        segments.push(...segmentData);
        currentStart = currentEnd;
      }
    }
    
    return segments;
  };

  // Gọi hàm fetchAllSegments để lấy dữ liệu
  const allData = await fetchAllSegments(placeId, dateFrom, dateTo, devices);
  
  // Lọc và định dạng dữ liệu trước khi trả về
  const filteredData = filterCheckinsByDay(allData);
  
  return filteredData;
}
