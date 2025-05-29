require("dotenv").config();
const express = require("express");
const hanetService = require("./hanetService");
const getAllPlace = require("./getPlaceId");
const getDeviceById = require("./getDeviceByPlaceId");
const hanetServiceId = require("./hanetServiceId");
const cors = require("cors");
const tokenManager = require("./tokenManager");
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3001;

// Request ID middleware
app.use((req, res, next) => {
  req.id = crypto.randomBytes(16).toString('hex');
  next();
});

// Logging middleware with request ID
app.use((req, res, next) => {
  const start = Date.now();
  console.log(`[${new Date().toISOString()}] Request started - ID: ${req.id} ${req.method} ${req.originalUrl}`);
  
  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] Request completed - ID: ${req.id} ${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`);
  });
  
  next();
});

app.use(cors());
app.use(express.json());

// API endpoint for OAuth status check
app.get("/api/oauth/status", async (req, res) => {
  try {
    const token = await tokenManager.getValidHanetToken();
    
    if (token) {
      res.json({
        success: true,
        data: {
          status: "authenticated",
          message: "Access token is valid"
        }
      });
    } else {
      res.json({
        success: true,
        data: {
          status: "unauthenticated",
          message: "No valid access token"
        }
      });
    }
  } catch (error) {
    console.error("Error checking OAuth status:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message
    });
  }
});

// API endpoint để lấy danh sách địa điểm
app.get("/api/places", async (req, res) => {
  try {
    const token = await tokenManager.getValidHanetToken();
    if (!token) {
      return res.status(401).json({
        success: false,
        error: "Authentication failed",
        message: "Failed to obtain valid access token"
      });
    }
    const places = await getAllPlace.getData();
    res.json({
      success: true,
      data: places
    });
  } catch (error) {
    console.error("Error getting places:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message
    });
  }
});

// API endpoint để lấy thiết bị theo địa điểm
app.get("/api/devices/:placeId", async (req, res) => {
  try {
    const token = await tokenManager.getValidHanetToken();
    if (!token) {
      throw new Error('Failed to obtain valid access token');
    }
    const devices = await getDeviceById.getData(req.params.placeId);
    res.json(devices);
  } catch (error) {
    console.error("Error getting devices:", error);
    res.status(500).json({ error: error.message });
  }
});

// API endpoint để lấy danh sách người theo địa điểm và khoảng thời gian
app.post("/api/checkins", async (req, res) => {
  const { placeId, fromTimestamp, toTimestamp, devices } = req.body;

  if (!placeId || !fromTimestamp || !toTimestamp) {
    return res.status(400).json({
      success: false,
      error: "Missing required parameters",
      message: "Vui lòng cung cấp đầy đủ thông tin: placeId, fromTimestamp, toTimestamp"
    });
  }

  // Log request details
  console.log('API Request:', {
    placeId,
    fromTimestamp: new Date(parseInt(fromTimestamp)).toLocaleString(),
    toTimestamp: new Date(parseInt(toTimestamp)).toLocaleString(),
    devices,
    requestId: req.id
  });

  // Performance monitoring
  const startTime = process.hrtime();
  
  try {
    // Validate token before making the request
    const token = await tokenManager.getValidHanetToken();
    if (!token) {
      throw new Error('Failed to obtain valid access token');
    }

    const filteredCheckins = await hanetServiceId.getPeopleListByMethod(
      placeId,
      fromTimestamp,
      toTimestamp,
      devices
    );
    
    // Calculate execution time
    const endTime = process.hrtime(startTime);
    const timeInSeconds = endTime[0] + endTime[1] / 1e9;

    // Send success response with metadata
    res.status(200).json({
      success: true,
      metadata: {
        recordCount: filteredCheckins.length,
        timeRange: {
          from: new Date(parseInt(fromTimestamp)).toISOString(),
          to: new Date(parseInt(toTimestamp)).toISOString()
        },
        executionTime: timeInSeconds.toFixed(2) + 's'
      },
      data: filteredCheckins
    });
  } catch (error) {
    console.error('Error details:', {
      requestId: req.id,
      message: error.message,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Endpoint để cập nhật cấu hình OAuth
app.post("/api/oauth/config", (req, res) => {
  try {
    const { clientId, clientSecret, baseUrl, tokenUrl } = req.body;

    const config = {
      clientId: clientId || process.env.HANET_CLIENT_ID,
      clientSecret: clientSecret || process.env.HANET_CLIENT_SECRET,
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
      clientSecret: config.clientSecret ? "******" : null
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

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
