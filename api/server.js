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

    const filteredCheckins = await hanetServiceId.getPeopleListByMethod(
      placeId,
      fromTimestamp,
      toTimestamp,
      devices
    );

    console.log(
      `[${new Date().toISOString()}] Trả về ${
        Array.isArray(filteredCheckins) ? filteredCheckins.length : "kết quả"
      } checkin.`
    );

    res.status(200).json(filteredCheckins);
  } catch (err) {
    next(err);
  }
});

// API cấu hình OAuth
app.post("/api/oauth/config", (req, res) => {
  try {
    console.log('[OAuth Config] Nhận yêu cầu cập nhật cấu hình:', {
      clientId: req.body.clientId ? '***' : 'không có',
      hasClientSecret: !!req.body.clientSecret,
      hasRefreshToken: !!req.body.refreshToken,
      baseUrl: req.body.baseUrl,
      tokenUrl: req.body.tokenUrl
    });

    const { clientId, clientSecret, refreshToken, baseUrl, tokenUrl } = req.body;
    
    if (!clientId || !clientSecret) {
      console.log('[OAuth Config] Thiếu thông tin bắt buộc');
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

    console.log('[OAuth Config] Đang cập nhật cấu hình với tokenManager...');
    const result = tokenManager.setDynamicConfig(config);
    console.log('[OAuth Config] Kết quả cập nhật:', result);
    
    return res.status(200).json({
      success: true,
      message: "Cấu hình OAuth đã được cập nhật",
    });
  } catch (error) {
    console.error("[OAuth Config] Lỗi chi tiết:", error);
    console.error("[OAuth Config] Stack trace:", error.stack);
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
    
    return res.status(200).json({
      success: true,
      message: "Xác thực thành công",
      data: {
        accessToken: tokenData.accessToken ? "******" : null,
        refreshToken: tokenData.refreshToken ? "******" : null,
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

if (process.env.PORT !== "production") {
  app.listen(PORT, () => {
    console.log(`Server đang lắng nghe trên cổng ${PORT}`);
    console.log(`Truy cập tại: http://localhost:${PORT}`);
  });
}

module.exports = app;
