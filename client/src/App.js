import React, { useState, useEffect, useCallback, useRef } from "react";
import { BrowserRouter, Routes, Route, Link, Navigate } from "react-router-dom";
import OAuthConfig from "./OAuthConfig";
import OAuthCallback from "./OAuthCallback";
import { getAccounts, getCurrentAccount, setCurrentAccount, deleteAccount } from "./directAccountManager";
import "./App.css";

// Thêm một trang Debug để xem thông tin localStorage
const DebugPage = () => {
  const [storageItems, setStorageItems] = useState({});
  const [cookiesInfo, setCookiesInfo] = useState('');
  const [browserInfo, setBrowserInfo] = useState('');
  const [accountsInfo, setAccountsInfo] = useState(null);
  
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
    
    // Phân tích thông tin tài khoản
    try {
      const oldAccounts = localStorage.getItem('hanet_accounts');
      const newAccounts = localStorage.getItem('hanet_accounts_v2');
      const oldCurrentId = localStorage.getItem('hanet_current_account_id');
      const newCurrentId = localStorage.getItem('hanet_current_account_id_v2');
      
      setAccountsInfo({
        oldAccounts: oldAccounts ? JSON.parse(oldAccounts) : null,
        newAccounts: newAccounts ? JSON.parse(newAccounts) : null,
        oldCurrentId,
        newCurrentId
      });
    } catch (e) {
      console.error('Lỗi khi phân tích thông tin tài khoản:', e);
    }
    
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
  
  const migrateAccounts = () => {
    try {
      // Di chuyển từ key cũ sang key mới
      const oldAccounts = localStorage.getItem('hanet_accounts');
      if (oldAccounts) {
        localStorage.setItem('hanet_accounts_v2', oldAccounts);
        
        const oldCurrentId = localStorage.getItem('hanet_current_account_id');
        if (oldCurrentId) {
          localStorage.setItem('hanet_current_account_id_v2', oldCurrentId);
        }
        
        alert('Đã di chuyển dữ liệu tài khoản từ key cũ sang key mới');
        window.location.reload();
      } else {
        alert('Không có dữ liệu tài khoản ở key cũ để di chuyển');
      }
    } catch (e) {
      alert('Lỗi khi di chuyển dữ liệu: ' + e.toString());
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
          <button onClick={migrateAccounts} className="migrate-button">Di chuyển tài khoản</button>
        </div>
      </div>
      
      {accountsInfo && (
        <div className="debug-section accounts-summary">
          <h2>Thông tin tài khoản</h2>
          <div className="accounts-info">
            <div className="account-column">
              <h3>Key cũ (hanet_accounts)</h3>
              {accountsInfo.oldAccounts ? (
                <>
                  <p>Số lượng: {accountsInfo.oldAccounts.length}</p>
                  <p>ID hiện tại: {accountsInfo.oldCurrentId || 'Không có'}</p>
                  <pre className="accounts-data">{JSON.stringify(accountsInfo.oldAccounts, null, 2)}</pre>
                </>
              ) : (
                <p>Không có dữ liệu</p>
              )}
            </div>
            <div className="account-column">
              <h3>Key mới (hanet_accounts_v2)</h3>
              {accountsInfo.newAccounts ? (
                <>
                  <p>Số lượng: {accountsInfo.newAccounts.length}</p>
                  <p>ID hiện tại: {accountsInfo.newCurrentId || 'Không có'}</p>
                  <pre className="accounts-data">{JSON.stringify(accountsInfo.newAccounts, null, 2)}</pre>
                </>
              ) : (
                <p>Không có dữ liệu</p>
              )}
            </div>
          </div>
        </div>
      )}
      
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
  const [oauthConfigs, setOauthConfigs] = useState([]);
  const [activeOauthConfig, setActiveOauthConfig] = useState('');

  // Kiểm tra trạng thái xác thực khi load component
  useEffect(() => {
    console.log('=== KHỞI ĐỘNG ỨNG DỤNG - ĐANG KIỂM TRA THÔNG TIN ĐĂNG NHẬP ===');
    
    // In ra tất cả keys trong localStorage
    console.log('Tất cả các keys trong localStorage:');
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      console.log(`- ${key}`);
    }
    
    // Load OAuth configs
    loadOAuthConfigs();
    
    // Load user info from localStorage
    const savedUserInfo = localStorage.getItem('user_info');
    console.log('Thông tin người dùng từ localStorage:', savedUserInfo);
    
    if (savedUserInfo) {
      try {
        const parsedUserInfo = JSON.parse(savedUserInfo);
        console.log('Đã phân tích thông tin người dùng:', parsedUserInfo);
        setUserInfo(parsedUserInfo);
      } catch (error) {
        console.error('Lỗi khi đọc thông tin người dùng:', error);
      }
    } else {
      console.log('Không tìm thấy thông tin người dùng trong localStorage');
    }
    
    // Lấy danh sách tài khoản trực tiếp từ localStorage
    try {
      // Thử đọc từ tất cả các key
      const keys = [
        'hanet_accounts_direct',
        'hanet_accounts_v2',
        'hanet_accounts'
      ];
      
      let accountsLoaded = false;
      
      for (const key of keys) {
        const rawData = localStorage.getItem(key);
        console.log(`Kiểm tra key ${key}:`, rawData);
        
        if (rawData) {
          try {
            const parsedAccounts = JSON.parse(rawData);
            console.log(`Dữ liệu tài khoản từ ${key}:`, parsedAccounts);
            
            if (Array.isArray(parsedAccounts) && parsedAccounts.length > 0) {
              console.log(`Tải ${parsedAccounts.length} tài khoản từ ${key}`);
              setAccounts(parsedAccounts);
              accountsLoaded = true;
              break;
            }
          } catch (parseError) {
            console.error(`Lỗi khi phân tích dữ liệu từ ${key}:`, parseError);
          }
        }
      }
      
      if (!accountsLoaded) {
        console.log('Không tìm thấy tài khoản nào trong localStorage, tạo tài khoản từ user_info');
        
        // Nếu không tìm thấy danh sách tài khoản nhưng có user_info, tạo tài khoản từ user_info
        if (savedUserInfo) {
          const userInfo = JSON.parse(savedUserInfo);
          if (userInfo && userInfo.username) {
            const newAccount = {
              id: userInfo.username,
              userInfo: userInfo,
              name: userInfo.name || userInfo.username,
              createdAt: new Date().toISOString()
            };
            
            const accounts = [newAccount];
            setAccounts(accounts);
            
            // Lưu danh sách tài khoản mới
            localStorage.setItem('hanet_accounts_direct', JSON.stringify(accounts));
            localStorage.setItem('hanet_accounts', JSON.stringify(accounts));
            localStorage.setItem('hanet_current_account_direct', newAccount.id);
            localStorage.setItem('hanet_current_account_id', newAccount.id);
            
            console.log('Đã tạo tài khoản từ user_info:', newAccount);
          }
        }
      }
    } catch (error) {
      console.error('Lỗi khi đọc danh sách tài khoản:', error);
    }
    
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
      // Lấy khóa cấu hình OAuth hiện tại
      const currentOAuthConfigKey = localStorage.getItem('hanet_current_oauth_config_key') || 'hanet_oauth_config';
      console.log('Khóa cấu hình OAuth hiện tại:', currentOAuthConfigKey);
      
      // Sử dụng API để kiểm tra trạng thái
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/oauth/status`);
      const result = await response.json();
      
      if (result.success && result.data) {
        setAuthStatus(result.data.status);
      }
    } catch (error) {
      console.error("Lỗi kiểm tra trạng thái xác thực:", error);
    }
  };

  // Lưu ID tài khoản hiện tại vào storage
  const saveCurrentAccountId = (accountId) => {
    const CURRENT_ACCOUNT_KEYS = [
      'hanet_current_account_direct',
      'hanet_current_account_id_v2',
      'hanet_current_account_id'
    ];
    
    // Lưu vào cả localStorage và sessionStorage
    try {
      // Lưu vào localStorage trước
      for (const key of CURRENT_ACCOUNT_KEYS) {
        localStorage.setItem(key, accountId);
      }
      console.log('Đã lưu ID tài khoản hiện tại vào localStorage:', accountId);
      return true;
    } catch (error) {
      console.error('Lỗi khi lưu vào localStorage:', error);
      
      // Thử lưu vào sessionStorage nếu localStorage thất bại
      try {
        for (const key of CURRENT_ACCOUNT_KEYS) {
          sessionStorage.setItem(key, accountId);
        }
        console.log('Đã lưu ID tài khoản hiện tại vào sessionStorage:', accountId);
        return true;
      } catch (error) {
        console.error('Lỗi khi lưu vào sessionStorage:', error);
        return false;
      }
    }
  };

  // Load OAuth configs from localStorage
  const loadOAuthConfigs = () => {
    try {
      const CONFIGS_LIST_KEY = 'hanet_oauth_configs_list';
      const ACTIVE_CONFIG_KEY = 'hanet_oauth_active_config';
      const CONFIG_PREFIX = 'hanet_oauth_config_';
      
      // Get list of configs
      const configsList = localStorage.getItem(CONFIGS_LIST_KEY);
      let configNames = [];
      if (configsList) {
        try {
          configNames = JSON.parse(configsList);
          console.log('Đã tải danh sách cấu hình OAuth:', configNames);
          
          // Get active config
          const activeConfig = localStorage.getItem(ACTIVE_CONFIG_KEY) || '';
          setActiveOauthConfig(activeConfig);
          
          // Set configs to state
          setOauthConfigs(configNames);
        } catch (error) {
          console.error('Lỗi khi đọc danh sách cấu hình OAuth từ local storage:', error);
        }
      }
    } catch (error) {
      console.error('Lỗi khi tải cấu hình OAuth:', error);
    }
  };
  
  // Handle OAuth config selection
  const handleOAuthConfigSelect = (configName) => {
    try {
      const CONFIG_PREFIX = 'hanet_oauth_config_';
      const ACTIVE_CONFIG_KEY = 'hanet_oauth_active_config';
      
      console.log(`Chuyển sang cấu hình OAuth: ${configName}`);
      
      // Set as active config
      localStorage.setItem(ACTIVE_CONFIG_KEY, configName);
      setActiveOauthConfig(configName);
      
      // Load the config data
      const savedConfig = localStorage.getItem(CONFIG_PREFIX + configName);
      if (savedConfig) {
        const parsedConfig = JSON.parse(savedConfig);
        
        // Set the OAuth config to localStorage for compatibility
        localStorage.setItem('hanet_oauth_config', JSON.stringify(parsedConfig));
        
        // Update the server with this config
        fetch(`${process.env.REACT_APP_API_URL}/api/oauth/config`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(parsedConfig)
        }).then(response => {
          console.log('Đã cập nhật cấu hình lên server');
          
          // Check auth status
          checkAuthStatus();
          
          // Close menu
          setShowAccountMenu(false);
          
          // Reload to apply changes
          window.location.reload();
        }).catch(error => {
          console.error('Lỗi khi cập nhật cấu hình lên server:', error);
          alert('Đã chuyển đổi cấu hình nhưng không cập nhật được lên server');
          
          // Still close menu and reload
          setShowAccountMenu(false);
          window.location.reload();
        });
      }
    } catch (error) {
      console.error('Lỗi khi chuyển đổi cấu hình OAuth:', error);
      alert('Không thể chuyển đổi cấu hình: ' + error.message);
    }
  };

  // Xử lý khi chọn tài khoản
  const handleAccountSelect = (account) => {
    console.log('Chọn tài khoản:', account);
    
    try {
      // Lưu thông tin người dùng
      if (account.userInfo) {
        console.log('Lưu thông tin người dùng:', account.userInfo);
        localStorage.setItem('user_info', JSON.stringify(account.userInfo));
        setUserInfo(account.userInfo);
      }
      
      // Sử dụng khóa cấu hình OAuth của tài khoản nếu có
      if (account.oauthConfigKey) {
        console.log('Sử dụng khóa cấu hình OAuth:', account.oauthConfigKey);
        localStorage.setItem('hanet_current_oauth_config_key', account.oauthConfigKey);
      } else if (account.oauthConfig) {
        // Tài khoản cũ chưa có oauthConfigKey, tạo khóa mới và lưu riêng
        const appName = account.appName || '';
        const oauthConfigKey = appName 
          ? `hanet_oauth_config_${appName.toLowerCase().replace(/[^a-z0-9]/g, '_')}` 
          : 'hanet_oauth_config';
        
        console.log('Tạo khóa cấu hình OAuth mới:', oauthConfigKey);
        localStorage.setItem(oauthConfigKey, JSON.stringify(account.oauthConfig));
        localStorage.setItem('hanet_current_oauth_config_key', oauthConfigKey);
        
        // Cập nhật tài khoản trong danh sách
        const updatedAccount = {
          ...account,
          oauthConfigKey: oauthConfigKey
        };
        
        const accountsList = [...accounts];
        const accountIndex = accountsList.findIndex(acc => acc.id === account.id);
        if (accountIndex >= 0) {
          accountsList[accountIndex] = updatedAccount;
          
          // Lưu danh sách tài khoản đã cập nhật
          const accountsJSON = JSON.stringify(accountsList);
          localStorage.setItem('hanet_accounts_direct', accountsJSON);
          localStorage.setItem('hanet_accounts_v2', accountsJSON);
          localStorage.setItem('hanet_accounts', accountsJSON);
          
          console.log('Đã cập nhật danh sách tài khoản với khóa OAuth mới');
        }
      }
      
      // Lưu ID tài khoản hiện tại
      console.log('Đặt tài khoản hiện tại:', account.id);
      localStorage.setItem('hanet_current_account_direct', account.id);
      localStorage.setItem('hanet_current_account_id_v2', account.id);
      localStorage.setItem('hanet_current_account_id', account.id);
      
      // Đóng menu tài khoản
      setShowAccountMenu(false);
      
      // Chuyển hướng để làm mới trang
      window.location.reload();
    } catch (error) {
      console.error('Lỗi khi chuyển đổi tài khoản:', error);
      alert('Không thể chuyển đổi tài khoản: ' + error.message);
    }
  };

  // Xử lý xóa tài khoản
  const handleDeleteAccount = (accountId) => {
    console.log('Xóa tài khoản:', accountId);
    
    try {
      // Lấy danh sách tài khoản từ localStorage
      const rawAccounts = localStorage.getItem('hanet_accounts_direct') || 
                         localStorage.getItem('hanet_accounts_v2') || 
                         localStorage.getItem('hanet_accounts');
      
      if (!rawAccounts) {
        console.error('Không tìm thấy danh sách tài khoản');
        return;
      }
      
      let accounts = JSON.parse(rawAccounts);
      if (!Array.isArray(accounts)) {
        console.error('Dữ liệu tài khoản không phải mảng:', accounts);
        accounts = [];
      }
      
      // Lọc bỏ tài khoản cần xóa
      const updatedAccounts = accounts.filter(acc => acc && acc.id !== accountId);
      console.log('Danh sách tài khoản sau khi xóa:', updatedAccounts);
      
      // Cập nhật state
      setAccounts(updatedAccounts);
      
      // Lưu danh sách tài khoản đã cập nhật
      const accountsJSON = JSON.stringify(updatedAccounts);
      localStorage.setItem('hanet_accounts_direct', accountsJSON);
      localStorage.setItem('hanet_accounts_v2', accountsJSON);
      localStorage.setItem('hanet_accounts', accountsJSON);
      
      // Kiểm tra nếu đang xóa tài khoản hiện tại
      const currentId = localStorage.getItem('hanet_current_account_direct') || 
                       localStorage.getItem('hanet_current_account_id_v2') || 
                       localStorage.getItem('hanet_current_account_id');
      
      if (currentId === accountId) {
        console.log('Đang xóa tài khoản hiện tại');
        
        // Nếu còn tài khoản khác, chuyển sang tài khoản đó
        if (updatedAccounts.length > 0) {
          console.log('Chuyển sang tài khoản khác:', updatedAccounts[0]);
          handleAccountSelect(updatedAccounts[0]);
        } else {
          // Không còn tài khoản nào, xóa thông tin người dùng
          console.log('Không còn tài khoản nào, xóa thông tin người dùng');
          localStorage.removeItem('user_info');
          localStorage.removeItem('hanet_current_account_direct');
          localStorage.removeItem('hanet_current_account_id_v2');
          localStorage.removeItem('hanet_current_account_id');
          
          setUserInfo(null);
          window.location.reload();
        }
      }
    } catch (error) {
      console.error('Lỗi khi xóa tài khoản:', error);
      alert('Không thể xóa tài khoản: ' + error.message);
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

  // Tạo tài khoản từ cấu hình OAuth (khi không có user_info)
  const createAccountFromOAuthConfig = () => {
    console.log('Thử tạo tài khoản từ cấu hình OAuth');
    
    try {
      // Lấy khóa cấu hình OAuth hiện tại
      const currentOAuthConfigKey = localStorage.getItem('hanet_current_oauth_config_key') || 'hanet_oauth_config';
      
      // Lấy cấu hình OAuth
      const oauthConfigRaw = localStorage.getItem(currentOAuthConfigKey);
      if (!oauthConfigRaw) {
        console.error('Không có cấu hình OAuth để tạo tài khoản');
        return false;
      }
      
      const oauthConfig = JSON.parse(oauthConfigRaw);
      console.log('Đã đọc cấu hình OAuth:', oauthConfig);
      
      // Lấy tên ứng dụng
      const appName = oauthConfig.appName || '';
      
      // Tạo ID tài khoản từ thông tin có sẵn
      let accountId = 'hanet_user_' + new Date().getTime();
      // Thêm tên ứng dụng vào ID nếu có
      if (appName) {
        const appNameSlug = appName.toLowerCase().replace(/[^a-z0-9]/g, '_');
        accountId = `hanet_user_${appNameSlug}_${new Date().getTime()}`;
      }
      
      // Tạo khóa cấu hình OAuth cho tài khoản này
      const oauthConfigKey = appName 
        ? `hanet_oauth_config_${appName.toLowerCase().replace(/[^a-z0-9]/g, '_')}` 
        : 'hanet_oauth_config';
      
      // Tạo tài khoản mới
      const newAccount = {
        id: accountId,
        name: appName || 'Người dùng Hanet',
        appName: appName,
        oauthConfigKey: oauthConfigKey,
        createdAt: new Date().toISOString(),
        oauthConfig: oauthConfig
      };
      
      console.log('Tạo tài khoản mới:', newAccount);
      
      // Lấy danh sách tài khoản hiện tại
      let accounts = [];
      const rawAccounts = localStorage.getItem('hanet_accounts_direct') || 
                         localStorage.getItem('hanet_accounts_v2') || 
                         localStorage.getItem('hanet_accounts');
      
      if (rawAccounts) {
        try {
          accounts = JSON.parse(rawAccounts);
          if (!Array.isArray(accounts)) {
            console.log('Dữ liệu tài khoản không phải mảng, khởi tạo mới');
            accounts = [];
          }
        } catch (e) {
          console.error('Lỗi khi phân tích dữ liệu tài khoản:', e);
          accounts = [];
        }
      }
      
      // Thêm tài khoản mới
      accounts.push(newAccount);
      
      // Lưu danh sách tài khoản
      const accountsJSON = JSON.stringify(accounts);
      localStorage.setItem('hanet_accounts_direct', accountsJSON);
      localStorage.setItem('hanet_accounts_v2', accountsJSON);
      localStorage.setItem('hanet_accounts', accountsJSON);
      
      // Lưu ID tài khoản hiện tại
      localStorage.setItem('hanet_current_account_direct', accountId);
      localStorage.setItem('hanet_current_account_id_v2', accountId);
      localStorage.setItem('hanet_current_account_id', accountId);
      
      // Lưu khóa cấu hình OAuth hiện tại
      localStorage.setItem('hanet_current_oauth_config_key', oauthConfigKey);
      
      // Tạo user_info đơn giản
      const simpleUserInfo = {
        username: accountId,
        name: appName || 'Người dùng Hanet'
      };
      
      // Lưu user_info
      localStorage.setItem('user_info', JSON.stringify(simpleUserInfo));
      
      // Cập nhật state
      setUserInfo(simpleUserInfo);
      setAccounts(accounts);
      
      console.log('Đã hoàn thành việc tạo tài khoản từ cấu hình OAuth');
      return true;
    } catch (error) {
      console.error('Lỗi khi tạo tài khoản từ cấu hình OAuth:', error);
      return false;
    }
  };

  // Tạo tài khoản từ thông tin người dùng hiện tại
  const createAccountFromUserInfo = () => {
    console.log('Tạo tài khoản từ thông tin người dùng hiện tại');
    
    try {
      // Lấy thông tin người dùng
      const userInfoRaw = localStorage.getItem('user_info');
      if (!userInfoRaw) {
        console.log('Không có thông tin người dùng để tạo tài khoản');
        return false;
      }
      
      const userInfo = JSON.parse(userInfoRaw);
      console.log('Đã đọc thông tin người dùng:', userInfo);
      
      if (!userInfo || !userInfo.username) {
        console.log('Thông tin người dùng không hợp lệ');
        return false;
      }
      
      // Lấy khóa cấu hình OAuth hiện tại và cấu hình
      const currentOAuthConfigKey = localStorage.getItem('hanet_current_oauth_config_key') || 'hanet_oauth_config';
      const oauthConfigRaw = localStorage.getItem(currentOAuthConfigKey);
      const oauthConfig = oauthConfigRaw ? JSON.parse(oauthConfigRaw) : null;
      console.log('Đã đọc cấu hình OAuth từ khóa:', currentOAuthConfigKey, oauthConfig);
      
      // Lấy tên ứng dụng
      const appName = oauthConfig ? oauthConfig.appName || '' : '';
      
      // Tạo ID tài khoản 
      let accountId = userInfo.username;
      // Thêm tên ứng dụng vào ID nếu có
      if (appName) {
        const appNameSlug = appName.toLowerCase().replace(/[^a-z0-9]/g, '_');
        accountId = `${userInfo.username}_${appNameSlug}`;
      }
      
      // Tạo khóa cấu hình OAuth cho tài khoản này
      const oauthConfigKey = appName 
        ? `hanet_oauth_config_${appName.toLowerCase().replace(/[^a-z0-9]/g, '_')}` 
        : currentOAuthConfigKey;
      
      // Tạo tài khoản mới
      const newAccount = {
        id: accountId,
        name: userInfo.name || userInfo.username,
        userInfo: userInfo,
        oauthConfig: oauthConfig,
        appName: appName,
        oauthConfigKey: oauthConfigKey,
        createdAt: new Date().toISOString()
      };
      
      console.log('Tài khoản mới:', newAccount);
      
      // Lấy danh sách tài khoản hiện tại
      let accounts = [];
      const rawAccounts = localStorage.getItem('hanet_accounts_direct') || 
                         localStorage.getItem('hanet_accounts_v2') || 
                         localStorage.getItem('hanet_accounts');
      
      if (rawAccounts) {
        try {
          accounts = JSON.parse(rawAccounts);
          if (!Array.isArray(accounts)) {
            console.log('Dữ liệu tài khoản không phải mảng, khởi tạo mới');
            accounts = [];
          }
        } catch (e) {
          console.error('Lỗi khi phân tích dữ liệu tài khoản:', e);
          accounts = [];
        }
      }
      
      // Kiểm tra xem tài khoản đã tồn tại chưa
      const existingIndex = accounts.findIndex(acc => acc && acc.id === newAccount.id);
      
      if (existingIndex >= 0) {
        console.log('Cập nhật tài khoản đã tồn tại');
        accounts[existingIndex] = {
          ...accounts[existingIndex],
          userInfo: newAccount.userInfo,
          oauthConfig: newAccount.oauthConfig,
          appName: newAccount.appName,
          oauthConfigKey: oauthConfigKey,
          updatedAt: new Date().toISOString()
        };
      } else {
        console.log('Thêm tài khoản mới');
        accounts.push(newAccount);
      }
      
      // Lưu danh sách tài khoản
      const accountsJSON = JSON.stringify(accounts);
      localStorage.setItem('hanet_accounts_direct', accountsJSON);
      localStorage.setItem('hanet_accounts_v2', accountsJSON);
      localStorage.setItem('hanet_accounts', accountsJSON);
      
      // Lưu ID tài khoản hiện tại
      localStorage.setItem('hanet_current_account_direct', newAccount.id);
      localStorage.setItem('hanet_current_account_id_v2', newAccount.id);
      localStorage.setItem('hanet_current_account_id', newAccount.id);
      
      // Lưu khóa cấu hình OAuth hiện tại
      localStorage.setItem('hanet_current_oauth_config_key', oauthConfigKey);
      
      // Cập nhật state
      setAccounts(accounts);
      
      console.log('Đã hoàn thành việc tạo tài khoản');
      return true;
    } catch (error) {
      console.error('Lỗi khi tạo tài khoản từ thông tin người dùng:', error);
      return false;
    }
  };
  
  // Thử tạo tài khoản từ cả hai phương thức
  const tryCreateAccount = () => {
    // Thử tạo từ thông tin người dùng trước
    if (createAccountFromUserInfo()) {
      return true;
    }
    
    // Nếu không có thông tin người dùng, thử tạo từ cấu hình OAuth
    return createAccountFromOAuthConfig();
  };

  // Phần hiển thị menu tài khoản
  const renderAccountMenu = () => {
    if (!showAccountMenu) return null;
    
    console.log('Hiển thị menu tài khoản, danh sách tài khoản:', accounts);
    
    return (
      <div className="account-menu" ref={accountMenuRef}>
        <div className="account-menu-header">
          <h3>Tài khoản</h3>
          <button 
            className="refresh-button"
            onClick={(e) => {
              e.stopPropagation();
              tryCreateAccount();
            }}
            title="Làm mới tài khoản"
          >
            🔄
          </button>
        </div>
        <div className="account-menu-list">
          {accounts && accounts.length > 0 ? (
            accounts.map((account) => (
              <div 
                key={account.id} 
                className="account-item"
                onClick={() => handleAccountSelect(account)}
              >
                <div className="account-avatar">
                  {account.userInfo && account.userInfo.avatar ? (
                    <img src={account.userInfo.avatar} alt="Avatar" />
                  ) : (
                    <div className="default-avatar">
                      {account.name ? account.name.charAt(0) : 
                       account.userInfo && account.userInfo.name ? account.userInfo.name.charAt(0) : 
                       account.id ? account.id.charAt(0).toUpperCase() : '?'}
                    </div>
                  )}
                </div>
                <div className="account-info">
                  <div className="account-name">
                    {account.name || 
                     (account.userInfo && account.userInfo.name) || 
                     (account.userInfo && account.userInfo.username) || 
                     account.id || 'Người dùng'}
                    
                    {/* Hiển thị tên ứng dụng nếu có */}
                    {account.appName && (
                      <span className="app-name-badge">
                        {account.appName}
                      </span>
                    )}
                  </div>
                  <div className="account-email">
                    {account.email || 
                     (account.userInfo && account.userInfo.email) || 
                     ''}
                  </div>
                </div>
                <div 
                  className="account-delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm('Bạn có chắc chắn muốn xóa tài khoản này?')) {
                      handleDeleteAccount(account.id);
                    }
                  }}
                >
                  ×
                </div>
              </div>
            ))
          ) : (
            <div className="no-accounts">
              Không có tài khoản nào
              <div>
                <button
                  className="create-account-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    tryCreateAccount();
                  }}
                >
                  Tạo tài khoản mới
                </button>
              </div>
            </div>
          )}
        </div>
        {/* Display OAuth Configurations Section */}
        {oauthConfigs.length > 0 && (
          <div className="oauth-configs-section">
            <h3 className="section-title">Cấu hình API đã lưu</h3>
            <div className="oauth-configs-list">
              {oauthConfigs.map(configName => (
                <div 
                  key={configName} 
                  className={`oauth-config-item ${activeOauthConfig === configName ? 'active' : ''}`}
                  onClick={() => handleOAuthConfigSelect(configName)}
                >
                  <div className="oauth-config-icon">
                    <i className="fas fa-cog"></i>
                  </div>
                  <div className="oauth-config-name">
                    {configName}
                    {activeOauthConfig === configName && (
                      <span className="active-badge">Đang dùng</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        <div className="account-menu-footer">
          <div className="storage-info">
            ID: {localStorage.getItem('hanet_current_account_direct') || 
                 localStorage.getItem('hanet_current_account_id_v2') || 
                 localStorage.getItem('hanet_current_account_id') || 
                 'không xác định'}
          </div>
          <div className="menu-actions">
            <Link to="/debug" className="debug-link" onClick={() => setShowAccountMenu(false)}>
              Debug
            </Link>
            <button 
              className="refresh-data-button"
              onClick={(e) => {
                e.stopPropagation();
                window.location.reload();
              }}
            >
              Làm mới dữ liệu
            </button>
          </div>
          
          {/* Thêm nút tạo tài khoản mới */}
          <div className="add-account-section">
            <Link to="/config" className="add-account-button" onClick={() => setShowAccountMenu(false)}>
              + Thêm tài khoản mới (Đăng nhập)
            </Link>
            <button 
              className="create-manual-account-button"
              onClick={(e) => {
                e.stopPropagation();
                createManualAccount();
              }}
            >
              + Tạo tài khoản thủ công
            </button>
          </div>
        </div>
      </div>
    );
  };
  
  // Tạo tài khoản thủ công
  const createManualAccount = () => {
    try {
      // Đóng menu
      setShowAccountMenu(false);
      
      // Yêu cầu thông tin tài khoản
      const accountName = prompt('Nhập tên tài khoản:');
      if (!accountName) return;
      
      // Lấy tên ứng dụng từ cấu hình OAuth nếu có
      let appName = '';
      try {
        // Lấy khóa cấu hình OAuth hiện tại
        const currentOAuthConfigKey = localStorage.getItem('hanet_current_oauth_config_key') || 'hanet_oauth_config';
        const oauthConfig = JSON.parse(localStorage.getItem(currentOAuthConfigKey) || '{}');
        appName = oauthConfig.appName || '';
      } catch (e) {
        console.error('Không thể đọc cấu hình OAuth:', e);
      }
      
      // Tạo ID tài khoản
      let accountId = 'manual_user_' + Date.now();
      if (appName) {
        const appNameSlug = appName.toLowerCase().replace(/[^a-z0-9]/g, '_');
        accountId = `manual_user_${appNameSlug}_${Date.now()}`;
      }
      
      // Tạo khóa cấu hình OAuth cho tài khoản này
      const oauthConfigKey = appName 
        ? `hanet_oauth_config_${appName.toLowerCase().replace(/[^a-z0-9]/g, '_')}` 
        : 'hanet_oauth_config';
      
      // Tạo tài khoản mới
      const newAccount = {
        id: accountId,
        name: accountName,
        appName: appName,
        oauthConfigKey: oauthConfigKey,
        createdAt: new Date().toISOString()
      };
      
      // Lấy danh sách tài khoản hiện tại
      let currentAccounts = [...accounts];
      if (!Array.isArray(currentAccounts)) {
        currentAccounts = [];
      }
      
      // Thêm tài khoản mới
      currentAccounts.push(newAccount);
      
      // Lưu danh sách tài khoản
      const accountsJSON = JSON.stringify(currentAccounts);
      localStorage.setItem('hanet_accounts_direct', accountsJSON);
      localStorage.setItem('hanet_accounts_v2', accountsJSON);
      localStorage.setItem('hanet_accounts', accountsJSON);
      
      // Cập nhật state
      setAccounts(currentAccounts);
      
      // Hỏi người dùng có muốn chuyển sang tài khoản mới không
      if (window.confirm(`Đã tạo tài khoản "${accountName}". Bạn có muốn chuyển sang tài khoản này không?`)) {
        // Tạo thông tin người dùng đơn giản
        const simpleUserInfo = {
          username: accountId,
          name: accountName
        };
        
        // Lưu user_info
        localStorage.setItem('user_info', JSON.stringify(simpleUserInfo));
        
        // Cập nhật ID tài khoản hiện tại
        localStorage.setItem('hanet_current_account_direct', accountId);
        localStorage.setItem('hanet_current_account_id_v2', accountId);
        localStorage.setItem('hanet_current_account_id', accountId);
        
        // Lưu khóa cấu hình OAuth hiện tại
        localStorage.setItem('hanet_current_oauth_config_key', oauthConfigKey);
        
        // Cập nhật state
        setUserInfo(simpleUserInfo);
        
        // Làm mới trang
        window.location.reload();
      }
      
      return true;
    } catch (error) {
      console.error('Lỗi khi tạo tài khoản thủ công:', error);
      alert('Không thể tạo tài khoản: ' + error.message);
      return false;
    }
  };

  // Render main application
  const renderMainApp = () => (
    <main className="container">
      <nav className="app-nav">
        <div className="user-info">
          <span className="welcome-text">
            {(() => {
              // Hiển thị tên ứng dụng từ cấu hình OAuth hiện tại
              try {
                // Nếu có cấu hình OAuth active, hiển thị tên cấu hình đó
                if (activeOauthConfig) {
                  return activeOauthConfig;
                }
                
                // Nếu không có cấu hình active, thử lấy từ tài khoản hiện tại
                const currentAccount = accounts.find(acc => {
                  const currentId = localStorage.getItem('hanet_current_account_direct') || 
                                   localStorage.getItem('hanet_current_account_id_v2') || 
                                   localStorage.getItem('hanet_current_account_id');
                  return acc.id === currentId;
                });
                
                if (currentAccount && currentAccount.appName) {
                  return currentAccount.appName;
                }
                
                // Nếu không có trong tài khoản, thử lấy từ cấu hình OAuth trực tiếp
                const configKey = localStorage.getItem('hanet_current_oauth_config_key') || 'hanet_oauth_config';
                const configData = localStorage.getItem(configKey);
                if (configData) {
                  const config = JSON.parse(configData);
                  if (config && config.appName) {
                    return config.appName;
                  }
                }
                
                // Mặc định
                return "Hanet API";
              } catch (e) {
                console.error('Lỗi khi hiển thị tên ứng dụng:', e);
                return "Hanet API";
              }
            })()} 
          </span>
        </div>

        <div className="account-section" ref={accountMenuRef}>
          {/* Hiển thị thông tin người dùng hiện tại */}
          <div className="current-account" onClick={() => {
            // Khi mở menu, kiểm tra và tạo tài khoản nếu cần
            console.log('Mở menu tài khoản');
            
            // Nếu không có tài khoản nào, thử tạo tài khoản
            if (!accounts || accounts.length === 0) {
              console.log('Chưa có tài khoản, thử tạo tài khoản');
              tryCreateAccount();
            }
            
            setShowAccountMenu(!showAccountMenu);
          }}>
            <span className="account-name">
              {userInfo ? (userInfo.name || userInfo.username || 'Người dùng') : 'Người dùng'}
            </span>
            <span className="dropdown-icon">▼</span>
          </div>
          
          {renderAccountMenu()}
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
