const express = require('express');
const cors = require('cors');
const tokenManager = require('./tokenManager');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Get authentication status
app.get('/api/oauth/status', async (req, res) => {
  try {
    const token = await tokenManager.getValidHanetToken();
    res.json({
      success: true,
      data: {
        status: token ? 'authenticated' : 'unauthenticated',
        message: token ? 'Access token is valid' : 'No valid access token'
      }
    });
  } catch (error) {
    console.error('Error checking OAuth status:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Proxy endpoint for Hanet API calls
app.post('/api/hanet/*', async (req, res) => {
  try {
    const token = await tokenManager.getValidHanetToken();
    const apiPath = req.path.replace('/api/hanet', '');
    const baseUrl = process.env.HANET_API_BASE_URL || 'https://partner.hanet.ai';
    
    const response = await fetch(`${baseUrl}${apiPath}`, {
      method: req.method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(req.body)
    });

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error proxying Hanet API request:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
