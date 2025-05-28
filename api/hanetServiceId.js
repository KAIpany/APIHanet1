require("dotenv").config();
const fetch = require('node-fetch');
const tokenManager = require("./tokenManager");

const MAX_SEGMENT_SIZE = 6 * 60 * 60 * 1000; // 6 hours per segment
const MAX_RETRIES = 3;
const RETRY_DELAY = 5000;
const HANET_API_BASE_URL = process.env.HANET_API_BASE_URL;

// Validate base URL
if (!HANET_API_BASE_URL) {
  console.error("Error: HANET_API_BASE_URL environment variable is not set");
  throw new Error("Missing HANET_API_BASE_URL configuration");
}

async function getPeopleListByMethod(placeId, dateFrom, dateTo, devices) {
  try {
    console.log('getPeopleListByMethod called with:', {
      placeId,
      dateFrom: new Date(parseInt(dateFrom)).toLocaleString(),
      dateTo: new Date(parseInt(dateTo)).toLocaleString(),
      devices
    });

    // Get access token
    const accessToken = await tokenManager.getValidHanetToken();
    if (!accessToken) {
      throw new Error('Could not get valid access token');
    }

    // Split into smaller segments
    const segments = [];
    let startTime = parseInt(dateFrom);
    const endTime = parseInt(dateTo);

    while (startTime < endTime) {
      segments.push({
        start: startTime,
        end: Math.min(startTime + MAX_SEGMENT_SIZE, endTime)
      });
      startTime += MAX_SEGMENT_SIZE;
    }

    console.log(`Split into ${segments.length} segments`);

    // Process each segment
    const allResults = new Map();
    const failedSegments = [];

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      try {
        console.log(`Processing segment ${i + 1}/${segments.length}`);
        
        const url = `${HANET_API_BASE_URL}/person/getCheckinByPlaceIdInTimestamp`;
        const formData = new URLSearchParams({
          token: accessToken,
          placeID: placeId,
          from: segment.start.toString(),
          to: segment.end.toString(),
          size: 200
        });

        if (devices) {
          formData.append('devices', devices);
        }

        console.log(`Calling API: ${url} with placeId=${placeId}`);
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: formData.toString(),
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const result = await response.json();
        if (result.returnCode !== 1 && result.returnCode !== 0) {
          throw new Error(result.returnMessage || 'Unknown API error');
        }

        const data = result.data || [];
        
        // Filter and process records
        data.forEach(record => {
          if (record && record.personID) {
            const key = `${record.date || new Date(parseInt(record.checkinTime)).toISOString().split('T')[0]}_${record.personID}`;
            if (!allResults.has(key)) {
              allResults.set(key, {
                records: [],
                personInfo: {
                  personName: record.personName || "",
                  personID: record.personID,
                  aliasID: record.aliasID || "",
                  placeID: record.placeID || null,
                  title: record.title ? (typeof record.title === "string" ? record.title.trim() : "N/A") : "Customer",
                  date: record.date || new Date(parseInt(record.checkinTime)).toISOString().split('T')[0],
                }
              });
            }
            allResults.get(key).records.push({
              time: record.checkinTime,
              formattedTime: formatTimestamp(record.checkinTime)
            });
          }
        });

        // Wait between requests
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Error processing segment ${i + 1}:`, error);
        failedSegments.push({ ...segment, retryCount: 0 });
      }
    }

    // Retry failed segments
    while (failedSegments.length > 0) {
      const segment = failedSegments.shift();
      if (segment.retryCount >= MAX_RETRIES) {
        console.error(`Failed to process segment after ${MAX_RETRIES} retries`);
        continue;
      }

      try {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        
        const url = `${HANET_API_BASE_URL}/person/getCheckinByPlaceIdInTimestamp`;
        const formData = new URLSearchParams({
          token: accessToken,
          placeID: placeId,
          from: segment.start.toString(),
          to: segment.end.toString(),
          size: 200
        });

        if (devices) {
          formData.append('devices', devices);
        }

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: formData.toString(),
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const result = await response.json();
        if (result.returnCode !== 1 && result.returnCode !== 0) {
          throw new Error(result.returnMessage || 'Unknown API error');
        }

        const data = result.data || [];
        
        // Process retry data
        data.forEach(record => {
          if (record && record.personID) {
            const key = `${record.date || new Date(parseInt(record.checkinTime)).toISOString().split('T')[0]}_${record.personID}`;
            if (!allResults.has(key)) {
              allResults.set(key, {
                records: [],
                personInfo: {
                  personName: record.personName || "",
                  personID: record.personID,
                  aliasID: record.aliasID || "",
                  placeID: record.placeID || null,
                  title: record.title ? (typeof record.title === "string" ? record.title.trim() : "N/A") : "Customer",
                  date: record.date || new Date(parseInt(record.checkinTime)).toISOString().split('T')[0],
                }
              });
            }
            allResults.get(key).records.push({
              time: record.checkinTime,
              formattedTime: formatTimestamp(record.checkinTime)
            });
          }
        });
      } catch (error) {
        console.error(`Retry ${segment.retryCount + 1} failed:`, error);
        segment.retryCount++;
        if (segment.retryCount < MAX_RETRIES) {
          failedSegments.push(segment);
        }
      }
    }

    // Process results
    const results = [];
    for (const [_, group] of allResults) {
      // Sort records by time
      group.records.sort((a, b) => parseInt(a.time) - parseInt(b.time));
      
      // Get first check-in and last check-out
      const checkinRecord = group.records[0];
      const checkoutRecord = group.records[group.records.length - 1];
      
      // Calculate working time
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
        totalRecords: group.records.length
      });
    }

    // Sort results by date and check-in time
    results.sort((a, b) => {
      if (a.date !== b.date) {
        return a.date.localeCompare(b.date);
      }
      return parseInt(a.checkinTime) - parseInt(b.checkinTime);
    });

    console.log(`Final results: ${results.length} records processed.`);
    return results;
  } catch (error) {
    console.error("Error processing data:", error);
    throw error; // Re-throw to handle in the calling code
  }
}

function formatTimestamp(timestamp) {
  // Ensure timestamp is a number
  const ts = parseInt(timestamp, 10);
  
  // Create Date object with timestamp
  const date = new Date(ts);
  
  // Convert to Vietnam time (UTC+7)
  const vietnamTime = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  
  // Format time components
  const hours = vietnamTime.getUTCHours().toString().padStart(2, "0");
  const minutes = vietnamTime.getUTCMinutes().toString().padStart(2, "0");
  const seconds = vietnamTime.getUTCSeconds().toString().padStart(2, "0");
  const day = vietnamTime.getUTCDate().toString().padStart(2, "0");
  const month = (vietnamTime.getUTCMonth() + 1).toString().padStart(2, "0");
  const year = vietnamTime.getUTCFullYear();
  
  // Return format: HH:MM:SS DD/MM/YYYY
  return `${hours}:${minutes}:${seconds} ${day}/${month}/${year}`;
}

module.exports = {
  getPeopleListByMethod
};
