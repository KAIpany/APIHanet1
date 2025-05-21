import React, { useState, useEffect, useCallback, useRef } from "react";
import { BrowserRouter, Routes, Route, Link, Navigate } from "react-router-dom";
import OAuthConfig from "./OAuthConfig";
import OAuthCallback from "./OAuthCallback";
import { getAccounts, getCurrentAccount, setCurrentAccount, deleteAccount } from "./accountManager";
import "./App.css";

// Thêm một trang Debug để xem thông tin localStorage
const DebugPage = () => {
  const [storageItems, setStorageItems] = useState({});
  const [cookiesInfo, setCookiesInfo] = useState('');
  const [browserInfo, setBrowserInfo] = useState('');
  
  useEffect(() => {
    // Lấy tất cả các mục từ localStorage
    const items = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        try {
          const value = localStorage.getItem(key);
          items[key] = {
            raw: value,
            parsed: JSON.parse(value)
          };
        } catch (e) {
          items[key] = {
            raw: localStorage.getItem(key),
            error: 'Không thể parse JSON'
          };
        }
      }
    } catch (e) {
      console.error('Lỗi khi lấy từ localStorage:', e);
      items['localStorage_error'] = {
        raw: e.toString(),
        error: 'Không thể truy cập localStorage'
      };
    }
    setStorageItems(items);
    
    // Lấy thông tin cookies
    setCookiesInfo(document.cookie || 'Không có cookies');
    
    // Lấy thông tin trình duyệt
    const info = {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      cookiesEnabled: navigator.cookieEnabled,
      localStorage: typeof localStorage !== 'undefined',
      origin: window.location.origin,
      href: window.location.href
    };
    setBrowserInfo(JSON.stringify(info, null, 2));
  }, []);
  
  const clearAllStorage = () => {
    if (window.confirm('Bạn có chắc chắn muốn xóa tất cả dữ liệu localStorage?')) {
      try {
        localStorage.clear();
        window.location.reload();
      } catch (e) {
        alert('Lỗi khi xóa localStorage: ' + e.toString());
      }
    }
  };
  
  const clearAllCookies = () => {
    if (window.confirm('Bạn có chắc chắn muốn xóa tất cả cookies?')) {
      try {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
          const cookie = cookies[i];
          const eqPos = cookie.indexOf('=');
          const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
          document.cookie = name + '=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/';
        }
        alert('Đã xóa tất cả cookies');
        window.location.reload();
      } catch (e) {
        alert('Lỗi khi xóa cookies: ' + e.toString());
      }
    }
  };
  
  const removeItem = (key) => {
    if (window.confirm(`Bạn có chắc chắn muốn xóa "${key}"?`)) {
      try {
        localStorage.removeItem(key);
        window.location.reload();
      } catch (e) {
        alert('Lỗi khi xóa item: ' + e.toString());
      }
    }
  };
  
  const testLocalStorage = () => {
    try {
      const testKey = '_test_' + Date.now();
      localStorage.setItem(testKey, 'test');
      const value = localStorage.getItem(testKey);
      localStorage.removeItem(testKey);
      alert('Kiểm tra localStorage: ' + (value === 'test' ? 'THÀNH CÔNG' : 'THẤT BẠI'));
    } catch (e) {
      alert('Lỗi khi kiểm tra localStorage: ' + e.toString());
    }
  };
  
  return (
    <div className="debug-container">
      <div className="debug-header">
        <h1>Trang Debug</h1>
        <div className="debug-actions">
          <Link to="/" className="back-button">Quay lại ứng dụng</Link>
          <button onClick={clearAllStorage} className="clear-button">Xóa tất cả localStorage</button>
          <button onClick={clearAllCookies} className="clear-button danger">Xóa tất cả cookies</button>
          <button onClick={testLocalStorage} className="test-button">Kiểm tra localStorage</button>
        </div>
      </div>
      
      <div className="debug-section">
        <h2>Thông tin trình duyệt</h2>
        <pre className="info-value">{browserInfo}</pre>
      </div>
      
      <div className="debug-section">
        <h2>Cookies</h2>
        <pre className="info-value">{cookiesInfo}</pre>
      </div>
      
      <div className="debug-section">
        <h2>Nội dung localStorage</h2>
        {Object.keys(storageItems).length === 0 ? (
          <div className="no-items">Không có dữ liệu</div>
        ) : (
          Object.keys(storageItems).map(key => (
            <div key={key} className="storage-item">
              <div className="item-header">
                <h3>{key}</h3>
                <button onClick={() => removeItem(key)} className="remove-button">Xóa</button>
              </div>
              <h4>Giá trị gốc:</h4>
              <pre className="item-value">{storageItems[key].raw}</pre>
              
              {storageItems[key].error ? (
                <p className="parse-error">{storageItems[key].error}</p>
              ) : (
                <>
                  <h4>Giá trị đã parse:</h4>
                  <pre className="item-value">{JSON.stringify(storageItems[key].parsed, null, 2)}</pre>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const CheckInApp = () => {
  const [formData, setFormData] = useState({
    placeId: "",
    deviceId: "",
    fromDateTime: "",
    toDateTime: "",
  });
  const [places, setPlaces] = useState([]);
  const [devices, setDevices] = useState([]);
  const [isPlacesLoading, setIsPlacesLoading] = useState(false);
  const [isDevicesLoading, setIsDevicesLoading] = useState(false);
  const [placeError, setPlaceError] = useState(null);
  const [deviceError, setDeviceError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [resultsData, setResultsData] = useState(null);
  const [queryString, setQueryString] = useState(null);
  const [authStatus, setAuthStatus] = useState(null);
  const [userInfo, setUserInfo] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const accountMenuRef = useRef(null);

  // Kiểm tra trạng thái xác thực khi load component
  useEffect(() => {
    // Load user info from localStorage
    const savedUserInfo = localStorage.getItem('user_info');
    console.log('Saved user info from localStorage:', savedUserInfo);
    
    if (savedUserInfo) {
      try {
        const parsedUserInfo = JSON.parse(savedUserInfo);
        console.log('Parsed user info:', parsedUserInfo);
        setUserInfo(parsedUserInfo);
      } catch (error) {
        console.error('Lỗi khi đọc thông tin người dùng:', error);
      }
    }
    
    // Kiểm tra trực tiếp từ localStorage
    const ACCOUNTS_KEY = 'hanet_accounts';
    try {
      const savedAccounts = localStorage.getItem(ACCOUNTS_KEY);
      console.log('Raw accounts data (direct):', savedAccounts);
      if (savedAccounts) {
        const parsedAccounts = JSON.parse(savedAccounts);
        console.log('Tài khoản đã tải trực tiếp:', parsedAccounts);
        if (Array.isArray(parsedAccounts) && parsedAccounts.length > 0) {
          setAccounts(parsedAccounts);
        }
      }
    } catch (error) {
      console.error('Lỗi khi đọc danh sách tài khoản trực tiếp:', error);
    }
    
    // Load danh sách tài khoản qua accountManager
    const loadedAccounts = getAccounts();
    console.log('Tài khoản đã tải từ accountManager:', loadedAccounts);
    if (Array.isArray(loadedAccounts) && loadedAccounts.length > 0) {
      setAccounts(loadedAccounts);
    }
    
    // Kiểm tra tài khoản hiện tại
    const currentAccount = getCurrentAccount();
    console.log('Tài khoản hiện tại:', currentAccount);
    
    checkAuthStatus();
  }, []);

  // Đóng menu tài khoản khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target)) {
        setShowAccountMenu(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Kiểm tra trạng thái xác thực
  const checkAuthStatus = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/oauth/status`);
      const result = await response.json();
      
      if (result.success && result.data) {
        setAuthStatus(result.data.status);
      }
    } catch (error) {
      console.error("Lỗi kiểm tra trạng thái xác thực:", error);
    }
  };

  // Chuyển đổi tài khoản
  const handleSwitchAccount = (accountId) => {
    console.log('Đang chuyển đổi tài khoản:', accountId);
    setShowAccountMenu(false);
    
    // Lưu trạng thái trực tiếp nếu accountManager không hoạt động
    try {
      const ACCOUNTS_KEY = 'hanet_accounts';
      const CURRENT_ACCOUNT_KEY = 'hanet_current_account_id';
      const USER_INFO_KEY = 'user_info';
      const CONFIG_KEY = 'hanet_oauth_config';
      
      // Lấy danh sách tài khoản
      const savedAccounts = localStorage.getItem(ACCOUNTS_KEY);
      if (savedAccounts) {
        const accounts = JSON.parse(savedAccounts);
        const account = accounts.find(acc => acc.id === accountId);
        
        if (account) {
          // Lưu ID tài khoản hiện tại
          localStorage.setItem(CURRENT_ACCOUNT_KEY, accountId);
          
          // Cập nhật thông tin user_info và cấu hình OAuth hiện tại
          if (account.userInfo) {
            localStorage.setItem(USER_INFO_KEY, JSON.stringify(account.userInfo));
          }
          
          if (account.config) {
            localStorage.setItem(CONFIG_KEY, JSON.stringify(account.config));
          }
          
          // Tải lại trang để cập nhật thông tin
          window.location.reload();
          return;
        }
      }
    } catch (error) {
      console.error('Lỗi khi chuyển đổi tài khoản trực tiếp:', error);
    }
    
    // Sử dụng accountManager (dự phòng)
    if (setCurrentAccount(accountId)) {
      console.log('Đã chuyển tài khoản thành công, đang tải lại trang');
      // Tải lại trang để cập nhật thông tin
      window.location.reload();
    } else {
      console.error('Không thể chuyển tài khoản:', accountId);
    }
  };

  // Xóa tài khoản
  const handleDeleteAccount = (e, accountId) => {
    e.stopPropagation(); // Ngăn không cho event lan tới phần tử cha
    console.log('Xóa tài khoản:', accountId);
    
    if (window.confirm(`Bạn có chắc chắn muốn xóa tài khoản này?`)) {
      // Thử xóa trực tiếp trước
      try {
        const ACCOUNTS_KEY = 'hanet_accounts';
        const CURRENT_ACCOUNT_KEY = 'hanet_current_account_id';
        const USER_INFO_KEY = 'user_info';
        const CONFIG_KEY = 'hanet_oauth_config';
        
        // Lấy danh sách tài khoản hiện tại
        const savedAccounts = localStorage.getItem(ACCOUNTS_KEY);
        if (savedAccounts) {
          const accounts = JSON.parse(savedAccounts);
          const filteredAccounts = accounts.filter(acc => acc.id !== accountId);
          
          // Lưu lại danh sách sau khi xóa
          localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(filteredAccounts));
          
          // Nếu xóa tài khoản hiện tại
          const currentId = localStorage.getItem(CURRENT_ACCOUNT_KEY);
          if (currentId === accountId) {
            if (filteredAccounts.length > 0) {
              // Chuyển sang tài khoản đầu tiên trong danh sách
              const newAccount = filteredAccounts[0];
              localStorage.setItem(CURRENT_ACCOUNT_KEY, newAccount.id);
              if (newAccount.userInfo) {
                localStorage.setItem(USER_INFO_KEY, JSON.stringify(newAccount.userInfo));
              }
              if (newAccount.config) {
                localStorage.setItem(CONFIG_KEY, JSON.stringify(newAccount.config));
              }
            } else {
              // Xóa thông tin nếu không còn tài khoản nào
              localStorage.removeItem(CURRENT_ACCOUNT_KEY);
              localStorage.removeItem(USER_INFO_KEY);
              localStorage.removeItem(CONFIG_KEY);
            }
          }
          
          // Cập nhật danh sách tài khoản
          setAccounts(filteredAccounts);
          // Tải lại trang nếu cần
          window.location.reload();
          return;
        }
      } catch (error) {
        console.error('Lỗi khi xóa tài khoản trực tiếp:', error);
      }
      
      // Sử dụng accountManager (dự phòng)
      if (deleteAccount(accountId)) {
        console.log('Đã xóa tài khoản thành công');
        // Cập nhật danh sách tài khoản
        const updatedAccounts = getAccounts();
        console.log('Danh sách tài khoản sau khi xóa:', updatedAccounts);
        setAccounts(updatedAccounts);
        // Đóng menu
        setShowAccountMenu(false);
        // Tải lại trang nếu cần
        window.location.reload();
      } else {
        console.error('Không thể xóa tài khoản:', accountId);
      }
    }
  };

  const fetchPlaces = useCallback(async () => {
    setIsPlacesLoading(true);
    setPlaceError(null);
    try {
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/place`
      );
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Lỗi ${response.status}: ${
            errorData.message || "Không thể lấy danh sách địa điểm."
          }`
        );
      }
      const result = await response.json();
      if (result.success && Array.isArray(result.data)) {
        setPlaces(result.data);
      } else {
        throw new Error("Dữ liệu địa điểm trả về không hợp lệ.");
      }
    } catch (err) {
      setPlaceError(err.message || "Lỗi khi tải địa điểm.");
      setPlaces([]);
    } finally {
      setIsPlacesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authStatus === 'authenticated') {
      fetchPlaces();
    }
  }, [fetchPlaces, authStatus]);

  const fetchDevices = useCallback(async (selectedPlaceId) => {
    if (!selectedPlaceId) {
      setDevices([]);
      setDeviceError(null);
      return;
    }
    setIsDevicesLoading(true);
    setDeviceError(null);
    setDevices([]);
    try {
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/device?placeId=${selectedPlaceId}`
      );
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Lỗi ${response.status}: ${
            errorData.message || "Không thể lấy danh sách thiết bị."
          }`
        );
      }
      const result = await response.json();
      if (result.success && Array.isArray(result.data)) {
        setDevices(result.data);
      } else {
        throw new Error("Dữ liệu thiết bị trả về không hợp lệ.");
      }
    } catch (err) {
      setDeviceError(err.message || "Lỗi khi tải thiết bị.");
      setDevices([]);
    } finally {
      setIsDevicesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDevices(formData.placeId);
  }, [formData.placeId, fetchDevices]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prevState) => ({
      ...prevState,
      [name]: value,
    }));
    setSubmitError(null);
    setSuccessMessage(null);
    setResultsData(null);
  };

  const handlePlaceChange = (event) => {
    const { value } = event.target;
    setFormData((prevState) => ({
      ...prevState,
      placeId: value,
      deviceId: "",
    }));
    setSubmitError(null);
    setSuccessMessage(null);
    setDeviceError(null);
    setDevices([]);
    setResultsData(null);
  };

  const getPlaceName = useCallback(
    (id) => {
      if (!id) return "Chưa chọn";
      return places.find((p) => p.id.toString() === id)?.name || `ID: ${id}`;
    },
    [places]
  );

  const getDeviceName = useCallback(
    (id) => {
      if (!id) return "Chưa chọn / Tất cả";
      return devices.find((d) => d.deviceID === id)?.deviceName || `ID: ${id}`;
    },
    [devices]
  );

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);
    setSuccessMessage(null);
    setResultsData(null);

    const params = new URLSearchParams();
    if (formData.placeId) params.append("placeId", formData.placeId);
    if (formData.deviceId) params.append("deviceId", formData.deviceId);
    try {
      if (formData.fromDateTime) {
        params.append(
          "dateFrom",
          new Date(formData.fromDateTime).getTime().toString()
        );
      } else {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        params.append("dateFrom", today.getTime().toString());
      }
      if (formData.toDateTime) {
        params.append(
          "dateTo",
          new Date(formData.toDateTime).getTime().toString()
        );
      } else {
        params.append("dateTo", new Date().getTime().toString());
      }
      if (
        formData.fromDateTime &&
        formData.toDateTime &&
        new Date(formData.fromDateTime) > new Date(formData.toDateTime)
      ) {
        throw new Error(
          "Thời gian bắt đầu không được lớn hơn thời gian kết thúc."
        );
      }
    } catch (e) {
      setSubmitError(e.message || "Định dạng ngày giờ không hợp lệ.");
      setIsSubmitting(false);
      return;
    }
    const queryString = params.toString();
    setQueryString(queryString);

    const apiUrl = `${process.env.REACT_APP_API_URL}/api/checkins?${queryString}`;
    console.log("Đang gọi API:", apiUrl);

    try {
      const response = await fetch(apiUrl);
      const result = await response.json();
      console.log(result);

      if (!response.ok) {
        throw new Error(
          `Lỗi ${response.status}: ${result.message || "Không thể lấy dữ liệu"}`
        );
      }

      if (Array.isArray(result)) {
        setResultsData(result);
        setSuccessMessage(`Tìm thấy ${result.length} kết quả.`);
      } else {
        setResultsData([]);
        setSuccessMessage(result.message || "Không tìm thấy kết quả nào.");
      }
    } catch (err) {
      console.error("Lỗi khi lấy dữ liệu:", err);
      setSubmitError(err.message || "Đã xảy ra lỗi khi truy vấn.");
      setResultsData(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render main application
  const renderMainApp = () => (
    <main className="container">
      <nav className="app-nav">
        <div className="user-info">
          <span className="welcome-text">Anycross</span>
        </div>

        <div className="account-section" ref={accountMenuRef}>
          {/* Hiển thị thông tin người dùng hiện tại */}
          <div className="current-account" onClick={() => {
            // Khi mở menu, cập nhật lại danh sách tài khoản
            try {
              const ACCOUNTS_KEY = 'hanet_accounts';
              const savedAccounts = localStorage.getItem(ACCOUNTS_KEY);
              if (savedAccounts) {
                const parsedAccounts = JSON.parse(savedAccounts);
                console.log('Tài khoản khi mở menu:', parsedAccounts);
                if (Array.isArray(parsedAccounts) && parsedAccounts.length > 0) {
                  setAccounts(parsedAccounts);
                }
              }
            } catch (error) {
              console.error('Lỗi khi đọc danh sách tài khoản khi mở menu:', error);
            }
            setShowAccountMenu(!showAccountMenu);
          }}>
            <span className="account-name">
              {userInfo ? (userInfo.name || userInfo.username || 'Người dùng') : 'Người dùng'}
            </span>
            <span className="dropdown-icon">▼</span>
          </div>
          
          {showAccountMenu && (
            <div className="account-menu">
              <div className="account-menu-header">
                <h4>Tài khoản</h4>
                <button 
                  className="refresh-accounts-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    try {
                      const ACCOUNTS_KEY = 'hanet_accounts';
                      const savedAccounts = localStorage.getItem(ACCOUNTS_KEY);
                      if (savedAccounts) {
                        const parsedAccounts = JSON.parse(savedAccounts);
                        console.log('Tài khoản sau khi làm mới:', parsedAccounts);
                        if (Array.isArray(parsedAccounts) && parsedAccounts.length > 0) {
                          setAccounts(parsedAccounts);
                        }
                      }
                    } catch (error) {
                      console.error('Lỗi khi làm mới danh sách tài khoản:', error);
                    }
                  }}
                  title="Làm mới danh sách"
                >
                  🔄
                </button>
              </div>
              
              <div className="account-list">
                {accounts && accounts.length > 0 ? accounts.map(account => (
                  <div 
                    key={account.id} 
                    className={`account-item ${(getCurrentAccount()?.id === account.id || (userInfo && userInfo.username === account.id)) ? 'active' : ''}`}
                    onClick={() => handleSwitchAccount(account.id)}
                  >
                    <span className="account-item-name">{account.name || account.id}</span>
                    <button 
                      className="account-delete-btn"
                      onClick={(e) => handleDeleteAccount(e, account.id)}
                      title="Xóa tài khoản"
                    >
                      ✕
                    </button>
                  </div>
                )) : (
                  <div className="no-accounts">
                    Chưa có tài khoản nào
                    <div className="storage-info">
                      {localStorage.getItem('hanet_accounts') ? 
                        `${JSON.parse(localStorage.getItem('hanet_accounts')).length} tài khoản trong storage` : 
                        'Không có dữ liệu trong storage'}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="account-menu-footer">
                <Link to="/config" className="add-account-btn" onClick={() => setShowAccountMenu(false)}>
                  + Thêm tài khoản mới
                </Link>
                <Link to="/debug" className="debug-link" onClick={() => setShowAccountMenu(false)}>
                  🛠 Debug
                </Link>
              </div>
            </div>
          )}
        </div>
        
        <Link to="/config" className="config-button">
          Cấu hình API
        </Link>
      </nav>
      
      {/* --- Message khi chưa xác thực --- */}
      {authStatus !== 'authenticated' && (
        <div className="auth-message">
          <h2>Yêu cầu xác thực</h2>
          <p>Bạn cần cấu hình và xác thực với Hanet API trước khi sử dụng ứng dụng.</p>
          <Link to="/config" className="auth-button">
            Tiến hành cấu hình
          </Link>
        </div>
      )}
      
      {/* --- Form --- */}
      {authStatus === 'authenticated' && (
        <>
          <form onSubmit={handleSubmit} className="query-form">
            <h2 className="form-title">Truy vấn Dữ liệu Check-in</h2>

            {/* --- Dropdown PlaceId --- */}
            <div className="form-group">
              <label htmlFor="placeId" className="form-label required">
                Địa điểm:
              </label>
              <select
                id="placeId"
                name="placeId"
                value={formData.placeId}
                onChange={handlePlaceChange}
                className={isPlacesLoading ? "select-loading" : ""}
                required
                disabled={isPlacesLoading}
              >
                <option value="">
                  {isPlacesLoading ? "Đang tải địa điểm..." : "-- Chọn địa điểm --"}
                </option>
                {places.map((place) => (
                  <option key={place.id} value={place.id}>
                    {place.name} (ID: {place.id})
                  </option>
                ))}
              </select>
              {placeError && <p className="error-message">{placeError}</p>}
            </div>

            {/* --- Dropdown DeviceId --- */}
            <div className="form-group">
              <label
                htmlFor="deviceId"
                className={
                  !formData.placeId || isDevicesLoading
                    ? "form-label disabled"
                    : "form-label"
                }
              >
                Thiết bị (Tùy chọn):
              </label>
              <select
                id="deviceId"
                name="deviceId"
                value={formData.deviceId}
                onChange={handleChange}
                className={
                  !formData.placeId || isDevicesLoading ? "select-disabled" : ""
                }
                disabled={!formData.placeId || isDevicesLoading}
              >
                <option value="">
                  {!formData.placeId
                    ? "-- Chọn địa điểm trước --"
                    : isDevicesLoading
                    ? "Đang tải thiết bị..."
                    : devices.length === 0
                    ? "-- Không có thiết bị --"
                    : "-- Chọn thiết bị (để lọc) --"}
                </option>
                {/* Chỉ render options khi có devices */}
                {devices.map((device) => (
                  <option key={device.deviceID} value={device.deviceID}>
                    {device.deviceName} (ID: {device.deviceID})
                  </option>
                ))}
              </select>
              {deviceError && <p className="error-message">{deviceError}</p>}
            </div>

            {/* --- Khu vực chọn thời gian --- */}
            <div className="time-range-container">
              <p className="section-title">Khoảng thời gian</p>
              <div className="time-range-grid">
                {/* Input From */}
                <div className="form-group">
                  <label htmlFor="fromDateTime" className="form-label required">
                    Từ:
                  </label>
                  <input
                    type="datetime-local"
                    id="fromDateTime"
                    name="fromDateTime"
                    value={formData.fromDateTime}
                    onChange={handleChange}
                  />
                </div>
                {/* Input To */}
                <div className="form-group">
                  <label htmlFor="toDateTime" className="form-label required">
                    Đến:
                  </label>
                  <input
                    type="datetime-local"
                    id="toDateTime"
                    name="toDateTime"
                    value={formData.toDateTime}
                    onChange={handleChange}
                  />
                </div>
              </div>
            </div>

            {/* --- Input Tóm tắt --- */}
            <div className="form-group">
              <label htmlFor="summaryInput" className="form-label-sm">
                Thông tin truy vấn:
              </label>
              <input
                type="text"
                id="summaryInput"
                readOnly
                value={`${process.env.REACT_APP_API_URL}/api/checkins?${queryString || ""}`}
                className="summary-input"
              />
            </div>

            {/* --- Thông báo Lỗi/Thành công Submit --- */}
            {submitError && (
              <div className="alert-error" role="alert">
                <span className="alert-label">Lỗi: </span>
                {submitError}
              </div>
            )}
            {successMessage && resultsData === null && (
              <div className="alert-info" role="status">
                <span>{successMessage}</span>
              </div>
            )}

            {/* --- Nút Submit --- */}
            <button
              type="submit"
              className={
                isSubmitting || isPlacesLoading
                  ? "submit-btn disabled"
                  : "submit-btn"
              }
              disabled={isSubmitting || isPlacesLoading}
            >
              {isSubmitting ? "Đang tìm kiếm..." : "Tìm kiếm Check-in"}
            </button>
          </form>

          {resultsData !== null && (
            <div className="results-container">
              <h3 className="results-title">
                Kết quả truy vấn ({resultsData.length})
              </h3>
              {resultsData.length > 0 ? (
                <div className="table-container">
                  <table className="results-table">
                    <thead>
                      <tr>
                        <th>Tên</th>
                        <th>PersonID</th>
                        <th>PlaceId</th>
                        <th>AliasID</th>
                        <th>Chức vụ</th>
                        <th>Thời gian Checkin</th>
                        <th>Thời gian Checkout</th>
                        <th>Thời gian làm việc</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resultsData.map((result, index) => {
                        // Tính thời gian làm việc
                        let workingTime = '';
                        if (result.checkinTime && result.checkoutTime) {
                          const duration = (result.checkoutTime - result.checkinTime) / (1000 * 60); // Convert to minutes
                          const hours = Math.floor(duration / 60);
                          const minutes = Math.floor(duration % 60);
                          workingTime = `${hours}h ${minutes}m`;
                        }

                        return (
                          <tr key={result.personID + "_" + index}>
                            <td>{result.personName || "(Không tên)"}</td>
                            <td className="monospace">{result.personID}</td>
                            <td>{result.placeID || "(Không tên)"}</td>
                            <td>{result.aliasID || "N/A"}</td>
                            <td>{result.title || "N/A"}</td>
                            <td>
                              {result.checkinTime
                                ? new Date(result.checkinTime).toLocaleString("vi-VN")
                                : "N/A"}
                            </td>
                            <td>
                              {result.checkoutTime
                                ? new Date(result.checkoutTime).toLocaleString("vi-VN")
                                : "N/A"}
                            </td>
                            <td>{workingTime || "N/A"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="no-results">{successMessage}</p>
              )}
              {/* Textarea hiển thị JSON thô */}
              <div className="json-container">
                <h4 className="json-title">Dữ liệu API trả về (JSON thô)</h4>
                <textarea
                  readOnly
                  rows={15}
                  className="json-display"
                  value={JSON.stringify(resultsData, null, 2)}
                />
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={renderMainApp()} />
        <Route path="/config" element={<OAuthConfig />} />
        <Route path="/oauth-callback" element={<OAuthCallback />} />
        <Route path="/debug" element={<DebugPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default CheckInApp;
