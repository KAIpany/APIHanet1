require("dotenv").config();
const express = require("express");
const hanetService = require("./hanetService");
const getAllPlace = require("./getPlaceId");
const getDeviceById = require("./getDeviceByPlaceId");
const hanetServiceId = require("./hanetServiceId");
const cors = require("cors");
const tokenManager = require("./tokenManager");

const app = express();
const PORT = process.env.PORT || 3001;

// Thay đổi dòng 11-12 thành:
app.use(
  cors({
    origin: [
      "https://api-hanet.vercel.app",
      "http://localhost:3000",
      "https://client-hanet-re41.vercel.app"
    ],
  })
);
app.use(express.json());

// Middleware logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(
      `[${new Date().toISOString()}] ${req.method} ${req.originalUrl} - ${
        res.statusCode
      } (${duration}ms)`
    );
  });
  next();
});

// Middleware xử lý CORS
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// 2. Health check route
app.get("/api", (req, res) => {
  res.send("API Server is running!");
});

// 3. API Routes
app.get("/api/people", async (req, res, next) => {
  try {
    const peopleData = await hanetService.getPeopleListByPlace();
    res.status(200).json({ success: true, data: peopleData });
  } catch (error) {
    next(error);
  }
});

app.get("/api/place", async (req, res, next) => {
  try {
    const placeData = await getAllPlace.getAllPlace();
    res.status(200).json({ success: true, data: placeData });
  } catch (error) {
    next(error);
  }
});

app.get("/api/device", async (req, res, next) => {
  try {
    const placeId = req.query.placeId;
    if (!placeId) {
      return res.status(400).json({
        success: false,
        message: "Thiếu tham số bắt buộc: placeId",
      });
    }

    const deviceData = await getDeviceById.getDeviceById(placeId);
    res.status(200).json({ success: true, data: deviceData });
  } catch (error) {
    next(error);
  }
});

// Middleware kiểm tra tham số cho route checkins
const validateCheckinParams = (req, res, next) => {
  const { placeId, dateFrom, dateTo } = req.query;

  if (!placeId) {
    return res.status(400).json({
      success: false,
      message: "Thiếu tham số bắt buộc: placeId",
    });
  }

  if (!dateFrom) {
    return res.status(400).json({
      success: false,
      message: "Thiếu tham số bắt buộc: dateFrom",
    });
  }

  if (!dateTo) {
    return res.status(400).json({
      success: false,
      message: "Thiếu tham số bắt buộc: dateTo",
    });
  }

  const fromTimestamp = parseInt(dateFrom, 10);
  const toTimestamp = parseInt(dateTo, 10);

  if (isNaN(fromTimestamp) || isNaN(toTimestamp)) {
    return res.status(400).json({
      success: false,
      message: "dateFrom và dateTo phải là millisecond timestamp hợp lệ.",
    });
  }

  if (fromTimestamp > toTimestamp) {
    return res.status(400).json({
      success: false,
      message: "Thời gian bắt đầu không được muộn hơn thời gian kết thúc.",
    });
  }

  // Lưu timestamp đã được validate vào request object
  req.validatedParams = {
    placeId,
    fromTimestamp,
    toTimestamp,
    devices: req.query.devices,
  };

  next();
};

app.get("/api/checkins", validateCheckinParams, async (req, res, next) => {
  try {
    const { placeId, fromTimestamp, toTimestamp, devices } =
      req.validatedParams;

    console.log(
      `[${new Date().toISOString()}] Nhận yêu cầu lấy checkin cho placeId: ${placeId}, từ: ${fromTimestamp}, đến: ${toTimestamp}, devices: ${
        devices || "Tất cả"
      }`
    );

    // Tính thời gian thực hiện
    const startTime = process.hrtime();
    
    try {
      const filteredCheckins = await hanetServiceId.getPeopleListByMethod(
        placeId,
        fromTimestamp,
        toTimestamp,
        devices
      );
      
      // Tính thời gian đã thực hiện
      const endTime = process.hrtime(startTime);
      const timeInSeconds = endTime[0] + endTime[1] / 1e9;
      
      console.log(
        `[${new Date().toISOString()}] Trả về ${
          Array.isArray(filteredCheckins) ? filteredCheckins.length : "kết quả"
        } checkin, thực hiện trong ${timeInSeconds.toFixed(2)}s.`
      );

      res.status(200).json(filteredCheckins);
    } catch (error) {
      // Kiểm tra lỗi timeout
      if (error.code === 'ECONNABORTED' || (error.message && error.message.includes('timeout'))) {
        console.error(`[${new Date().toISOString()}] Lỗi timeout khi truy vấn dữ liệu:`, error.message);
        return res.status(504).json({
          success: false,
          message: "Yêu cầu mất quá nhiều thời gian để xử lý. Vui lòng thử với khoảng thời gian nhỏ hơn hoặc thử lại sau.",
          error: "TIMEOUT_ERROR",
          details: error.message
        });
      }
      
      throw error;
    }
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Lỗi khi xử lý yêu cầu checkins:`, err.message);
    next(err);
  }
});

// API cấu hình OAuth
app.post("/api/oauth/config", (req, res) => {
  try {
    const { clientId, clientSecret, refreshToken, baseUrl, tokenUrl } = req.body;
    
    if (!clientId || !clientSecret) {
      return res.status(400).json({
        success: false,
        message: "Cần cung cấp Client ID và Client Secret",
      });
    }
    
    const config = {
      clientId,
      clientSecret,
      refreshToken: refreshToken || null,
      baseUrl: baseUrl || "https://partner.hanet.ai",
      tokenUrl: tokenUrl || "https://oauth.hanet.com/token"
    };
    
    tokenManager.setDynamicConfig(config);
    
    return res.status(200).json({
      success: true,
      message: "Cấu hình OAuth đã được cập nhật",
    });
  } catch (error) {
    console.error("Lỗi khi cập nhật cấu hình OAuth:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi cập nhật cấu hình: " + error.message,
    });
  }
});

// API lấy cấu hình hiện tại
app.get("/api/oauth/config", (req, res) => {
  try {
    const config = tokenManager.getCurrentConfig();
    
    // Ẩn client secret khi trả về client
    const safeConfig = {
      ...config,
      clientSecret: config.clientSecret ? "******" : null,
      refreshToken: config.refreshToken ? "******" : null,
    };
    
    return res.status(200).json({
      success: true,
      data: safeConfig,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Lỗi khi lấy cấu hình: " + error.message,
    });
  }
});

// API xử lý OAuth callback
app.get("/api/oauth/callback", async (req, res) => {
  try {
    const { code, redirect_uri } = req.query;
    
    if (!code) {
      return res.status(400).json({
        success: false,
        message: "Thiếu code xác thực",
      });
    }
    
    const tokenData = await tokenManager.exchangeCodeForToken(code, redirect_uri);
    
    console.log("[OAuth Callback] Đã nhận token data:", {
      hasAccessToken: !!tokenData.accessToken,
      hasRefreshToken: !!tokenData.refreshToken,
      expiresIn: tokenData.expiresIn
    });
    
    return res.status(200).json({
      success: true,
      message: "Xác thực thành công",
      data: {
        accessToken: tokenData.accessToken,
        refreshToken: tokenData.refreshToken,
        expiresIn: tokenData.expiresIn,
      },
    });
  } catch (error) {
    console.error("Lỗi xử lý OAuth callback:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi xử lý OAuth callback: " + error.message,
    });
  }
});

// API kiểm tra trạng thái xác thực
app.get("/api/oauth/status", async (req, res) => {
  try {
    const config = tokenManager.getCurrentConfig();
    let status = "unconfigured";
    let message = "Chưa cấu hình OAuth";
    
    if (config.clientId && config.clientSecret) {
      status = "configured";
      message = "Đã cấu hình OAuth";
      
      try {
        const token = await tokenManager.getValidHanetToken();
        if (token) {
          status = "authenticated";
          message = "Đã xác thực thành công";
        }
      } catch (tokenError) {
        status = "error";
        message = "Lỗi xác thực: " + tokenError.message;
      }
    }
    
    return res.status(200).json({
      success: true,
      data: {
        status,
        message,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Lỗi kiểm tra trạng thái: " + error.message,
    });
  }
});

// API lấy thông tin người dùng
app.get("/api/user/info", async (req, res) => {
  try {
    console.log("[USER INFO] Bắt đầu truy vấn thông tin người dùng");
    const token = await tokenManager.getValidHanetToken();
    const config = tokenManager.getCurrentConfig();
    
    console.log(`[USER INFO] Gọi API Hanet: ${config.baseUrl}/api/v3/account/info`);
    const response = await fetch(`${config.baseUrl}/api/v3/account/info`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const userData = await response.json();
    console.log("[USER INFO] Dữ liệu nhận được từ Hanet:", JSON.stringify(userData));
    
    if (userData.code === '1' && userData.data) {
      const userInfo = {
        username: userData.data.username,
        name: userData.data.name || userData.data.username,
        email: userData.data.email
      };
      console.log("[USER INFO] Dữ liệu trả về cho client:", JSON.stringify(userInfo));
      
      return res.status(200).json({
        success: true,
        data: userInfo
      });
    } else {
      console.log("[USER INFO] Lỗi định dạng dữ liệu:", userData);
      throw new Error('Không thể lấy thông tin người dùng');
    }
  } catch (error) {
    console.error("[USER INFO] Lỗi:", error.message);
    return res.status(500).json({
      success: false,
      message: "Lỗi khi lấy thông tin người dùng: " + error.message
    });
  }
});

// 4. Error Handling Middleware
const handleApiError = (err, req, res, next) => {
  console.error(`Lỗi trong route ${req.path}:`, err.message);
  console.error(err.stack);

  if (err.message && err.message.startsWith("HANET Error 401")) {
    return res.status(401).json({
      success: false,
      message: "Lỗi xác thực với HANET API",
    });
  }

  if (err.message && err.message.includes("place not found")) {
    return res.status(404).json({
      success: false,
      message: "Không tìm thấy địa điểm",
    });
  }

  if (err.message && err.message.startsWith("HANET API Error")) {
    return res.status(502).json({
      success: false,
      message: "Lỗi từ HANET API khi lấy dữ liệu",
      error: process.env.NODE_ENV === "production" ? undefined : err.message,
    });
  }

  res.status(500).json({
    success: false,
    message: "Lỗi máy chủ nội bộ",
    error: process.env.NODE_ENV === "production" ? undefined : err.message,
  });
};

app.use(handleApiError);

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error('[Error Handler]', {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    body: req.body,
    query: req.query
  });

  // Nếu lỗi là do timeout
  if (err.message && (
    err.message.includes('timeout') || 
    err.message.includes('FUNCTION_INVOCATION_TIMEOUT') ||
    err.message.includes('Gateway Timeout')
  )) {
    return res.status(504).json({
      error: 'Gateway Timeout',
      message: 'Yêu cầu mất quá nhiều thời gian để xử lý'
    });
  }

  // Lỗi xác thực từ Hanet API
  if (err.message && err.message.includes('authentication failed')) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Lỗi xác thực với Hanet API'
    });
  }

  // Lỗi mặc định
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production' 
      ? 'Đã xảy ra lỗi hệ thống' 
      : err.message
  });
});

if (process.env.PORT !== "production") {
  app.listen(PORT, () => {
    console.log(`Server đang lắng nghe trên cổng ${PORT}`);
    console.log(`Truy cập tại: http://localhost:${PORT}`);
  });
}

module.exports = app;
