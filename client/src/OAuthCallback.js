import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import './App.css';

function OAuthCallback() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();
  
  // Kiểm tra xem storage có sẵn và hoạt động không
  const checkStorage = (type = 'localStorage') => {
    const storage = type === 'localStorage' ? window.localStorage : window.sessionStorage;
    try {
      const testKey = `test_${Date.now()}`;
      storage.setItem(testKey, 'test');
      const testValue = storage.getItem(testKey);
      storage.removeItem(testKey);
      console.log(`${type} kiểm tra thành công:`, testValue === 'test');
      return testValue === 'test';
    } catch (error) {
      console.error(`Lỗi khi kiểm tra ${type}:`, error);
      return false;
    }
  };
  
  // Key cho việc lưu trữ
  const ACCOUNTS_KEYS = [
    'hanet_accounts_direct',
    'hanet_accounts_v2',
    'hanet_accounts'
  ];
  
  const CURRENT_ACCOUNT_KEYS = [
    'hanet_current_account_direct',
    'hanet_current_account_id_v2',
    'hanet_current_account_id'
  ];
  
  // Lưu tài khoản mới
  const saveAccount = (userInfo, oauthConfig) => {
    console.log('Đang lưu tài khoản với thông tin:', userInfo);
    
    if (!userInfo || !userInfo.username) {
      console.error('Không thể lưu tài khoản: thiếu thông tin người dùng hoặc username');
      return false;
    }
    
    // Khởi tạo tài khoản mới
    const newAccount = {
      id: userInfo.username,
      userInfo: userInfo,
      oauthConfig: oauthConfig,
      createdAt: new Date().toISOString()
    };
    
    // Lưu vào cả localStorage và sessionStorage
    const saveToStorage = (storage) => {
      try {
        // Lấy danh sách tài khoản hiện tại
        let accounts = [];
        let accountsLoaded = false;
        
        // Thử đọc từ tất cả các key
        for (const key of ACCOUNTS_KEYS) {
          try {
            const rawData = storage.getItem(key);
            if (rawData) {
              const parsedAccounts = JSON.parse(rawData);
              if (Array.isArray(parsedAccounts)) {
                accounts = parsedAccounts;
                accountsLoaded = true;
                console.log(`Đã tải danh sách tài khoản từ ${key}:`, accounts);
                break;
              }
            }
          } catch (e) {
            console.error(`Lỗi khi đọc ${key} từ storage:`, e);
          }
        }
        
        if (!accountsLoaded) {
          accounts = [];
        }
        
        // Kiểm tra xem tài khoản đã tồn tại chưa
        const existingIndex = accounts.findIndex(acc => acc && acc.id === newAccount.id);
        
        if (existingIndex >= 0) {
          // Cập nhật tài khoản đã tồn tại
          accounts[existingIndex] = {
            ...accounts[existingIndex],
            userInfo: newAccount.userInfo,
            oauthConfig: newAccount.oauthConfig,
            updatedAt: new Date().toISOString()
          };
        } else {
          // Thêm tài khoản mới
          accounts.push(newAccount);
        }
        
        // Lưu vào tất cả các key
        for (const key of ACCOUNTS_KEYS) {
          storage.setItem(key, JSON.stringify(accounts));
        }
        
        // Lưu ID tài khoản hiện tại
        for (const key of CURRENT_ACCOUNT_KEYS) {
          storage.setItem(key, newAccount.id);
        }
        
        console.log('Đã lưu danh sách tài khoản và ID hiện tại:', accounts);
        return true;
      } catch (error) {
        console.error('Lỗi khi lưu tài khoản vào storage:', error);
        return false;
      }
    };
    
    // Thử lưu vào localStorage
    const localStorageWorking = checkStorage('localStorage');
    let saved = false;
    
    if (localStorageWorking) {
      saved = saveToStorage(localStorage);
      console.log('Kết quả lưu vào localStorage:', saved);
    }
    
    // Nếu lưu vào localStorage thất bại hoặc không khả dụng, thử lưu vào sessionStorage
    if (!saved) {
      const sessionStorageWorking = checkStorage('sessionStorage');
      if (sessionStorageWorking) {
        saved = saveToStorage(sessionStorage);
        console.log('Kết quả lưu vào sessionStorage:', saved);
      }
    }
    
    // Lưu thông tin người dùng trực tiếp
    try {
      if (localStorageWorking) {
        localStorage.setItem('user_info', JSON.stringify(userInfo));
      } else {
        sessionStorage.setItem('user_info', JSON.stringify(userInfo));
      }
    } catch (error) {
      console.error('Lỗi khi lưu user_info:', error);
      try {
        sessionStorage.setItem('user_info', JSON.stringify(userInfo));
      } catch (e) {
        console.error('Không thể lưu user_info vào cả localStorage và sessionStorage');
      }
    }
    
    // Lưu OAuth config
    try {
      if (localStorageWorking) {
        localStorage.setItem('hanet_oauth_config', JSON.stringify(oauthConfig));
      } else {
        sessionStorage.setItem('hanet_oauth_config', JSON.stringify(oauthConfig));
      }
    } catch (error) {
      console.error('Lỗi khi lưu oauth_config:', error);
    }
    
    return saved;
  };

  const handleCallback = async () => {
    const queryParams = new URLSearchParams(location.search);
    const code = queryParams.get('code');
    const state = queryParams.get('state');
    const error = queryParams.get('error');
    
    if (error) {
      console.error('Lỗi OAuth:', error);
      setError(`Lỗi xác thực: ${error}`);
      setLoading(false);
      return;
    }
    
    if (!code) {
      console.error('Thiếu mã xác thực');
      setError('Thiếu thông tin xác thực từ máy chủ');
      setLoading(false);
      return;
    }
    
    try {
      console.log('Đang xử lý callback với code:', code);
      
      // Lấy OAuth config từ localStorage
      let oauthConfig;
      try {
        const savedOAuthConfig = localStorage.getItem('hanet_oauth_config');
        if (savedOAuthConfig) {
          oauthConfig = JSON.parse(savedOAuthConfig);
        }
      } catch (error) {
        console.error('Lỗi khi lấy oauth_config từ localStorage:', error);
        
        // Thử lấy từ sessionStorage
        try {
          const sessionOAuthConfig = sessionStorage.getItem('hanet_oauth_config');
          if (sessionOAuthConfig) {
            oauthConfig = JSON.parse(sessionOAuthConfig);
          }
        } catch (e) {
          console.error('Lỗi khi lấy oauth_config từ sessionStorage:', e);
        }
      }
      
      if (!oauthConfig) {
        setError('Không tìm thấy cấu hình xác thực');
        setLoading(false);
        return;
      }
      
      // Exchange the authorization code for an access token
      const tokenResponse = await axios.post(oauthConfig.tokenUrl, {
        code,
        client_id: oauthConfig.clientId,
        client_secret: oauthConfig.clientSecret,
        redirect_uri: oauthConfig.redirectUri,
        grant_type: 'authorization_code'
      });
      
      const { access_token, refresh_token, expires_in } = tokenResponse.data;
      
      // Lưu token
      const tokenData = {
        access_token,
        refresh_token,
        expires_in,
        expiry_date: new Date().getTime() + expires_in * 1000
      };
      
      // Cập nhật OAuth config với token mới
      oauthConfig.token = tokenData;
      
      // Lưu OAuth config đã cập nhật vào storage
      try {
        localStorage.setItem('hanet_oauth_config', JSON.stringify(oauthConfig));
      } catch (error) {
        console.error('Lỗi khi lưu oauth_config vào localStorage:', error);
        try {
          sessionStorage.setItem('hanet_oauth_config', JSON.stringify(oauthConfig));
        } catch (e) {
          console.error('Lỗi khi lưu oauth_config vào sessionStorage:', e);
        }
      }
      
      // Lấy thông tin người dùng
      const userInfoResponse = await axios.get(oauthConfig.userInfoUrl, {
        headers: {
          Authorization: `Bearer ${access_token}`
        }
      });
      
      const userInfo = userInfoResponse.data;
      console.log('Thông tin người dùng:', userInfo);
      
      // Lưu thông tin người dùng vào storage
      try {
        localStorage.setItem('user_info', JSON.stringify(userInfo));
      } catch (error) {
        console.error('Lỗi khi lưu user_info vào localStorage:', error);
        try {
          sessionStorage.setItem('user_info', JSON.stringify(userInfo));
        } catch (e) {
          console.error('Lỗi khi lưu user_info vào sessionStorage:', e);
        }
      }
      
      // Lưu tài khoản
      const saveResult = saveAccount(userInfo, oauthConfig);
      console.log('Kết quả lưu tài khoản:', saveResult);
      
      // Điều hướng về trang chủ
      setLoading(false);
      navigate('/');
    } catch (error) {
      console.error('Lỗi khi xử lý OAuth callback:', error);
      setError(error.message || 'Lỗi không xác định khi xử lý xác thực');
      setLoading(false);
    }
  };

  useEffect(() => {
    handleCallback();
  }, []);

  if (loading) {
    return (
      <div className="oauth-callback-container">
        <div className="loading-indicator">
          <p>Đang xử lý đăng nhập...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="oauth-callback-container">
        <div className="error-message">
          <h2>Lỗi xác thực</h2>
          <p>{error}</p>
          <button onClick={() => navigate('/')}>Quay lại trang chủ</button>
        </div>
      </div>
    );
  }

  return null;
}

export default OAuthCallback; 