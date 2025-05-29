// tokenManager.js
require("dotenv").config();
const axios = require("axios");
const qs = require("qs");
const tokenStorage = require("./tokenStorage");

// Store current token information
let cachedTokenData = {
  accessToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Ijg3NjU5MzM2NjE3MjQ5OTEzMTkiLCJlbWFpbCI6IkNFT0hOOEBnbWFpbC5jb20iLCJjbGllbnRfaWQiOiJmMGJlODc3MzM0NzkyNDBlNmJjZDE0Njk3NGRhOTg3NSIsInR5cGUiOiJhdXRob3JpemF0aW9uX2NvZGUiLCJpYXQiOjE3NDg1MTkzNzUsImV4cCI6MTc4MDA1NTM3NX0.DcqCgw-T_AGMoMIbQ8JCF-VrbhPkKQ0rEufWX8T8gTE",
  expiresAt: 1780055375000, // This is the exp time from your token converted to milliseconds
  lastSync: Date.now()
};

// Initialize tokens from storage
const initializeTokens = async () => {
  console.log(`[${new Date().toISOString()}] Using direct access token`);
};

// Initialize when module is loaded
initializeTokens();

// Store dynamic config from client
let dynamicConfig = null;

// Set dynamic config from client
async function setDynamicConfig(config) {
  dynamicConfig = config;
  return true;
}

// Get current config
function getCurrentConfig() {
  return dynamicConfig || {
    clientId: process.env.HANET_CLIENT_ID,
    clientSecret: process.env.HANET_CLIENT_SECRET,
    baseUrl: process.env.HANET_API_BASE_URL || "https://partner.hanet.ai",
    tokenUrl: process.env.HANET_TOKEN_URL || "https://oauth.hanet.com/token"
  };
}

// Get valid token - now just returns the fixed access token
async function getValidHanetToken() {
  return cachedTokenData.accessToken;
}

module.exports = {
  getValidHanetToken,
  setDynamicConfig,
  getCurrentConfig
};
