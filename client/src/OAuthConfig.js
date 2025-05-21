import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './OAuthConfig.css';

const STORAGE_KEY = 'hanet_oauth_config';

const OAuthConfig = () => {
  const [config, setConfig] = useState({
    clientId: '',
    clientSecret: '',
    refreshToken: '',
    baseUrl: 'https://partner.hanet.ai',
    tokenUrl: 'https://oauth.hanet.com/token',
    appName: ''
  });
  const [status, setStatus] = useState({
    loading: true,
    message: 'Đang tải cấu hình...',
    status: 'loading',
    error: null
  });

  // Lấy cấu hình từ local storage khi component mount
  useEffect(() => {
    // Luôn load từ localStorage trước
    const savedConfig = localStorage.getItem(STORAGE_KEY);
    if (savedConfig) {
      try {
        const parsedConfig = JSON.parse(savedConfig);
        console.log('Đã tải cấu hình từ localStorage:', parsedConfig);
        setConfig(prevConfig => ({
          ...prevConfig,
          ...parsedConfig,
          // Đảm bảo hiển thị đầy đủ thông tin
          clientId: parsedConfig.clientId || '',
          clientSecret: parsedConfig.clientSecret || '',
          refreshToken: parsedConfig.refreshToken || '',
          appName: parsedConfig.appName || ''
        }));
      } catch (error) {
        console.error('Lỗi khi đọc cấu hình từ local storage:', error);
      }
    }
    
    // Sau đó mới gọi API để kiểm tra trạng thái
    checkAuthStatus();
    
    // Cuối cùng mới fetch cấu hình từ server
    fetchConfig();
  }, []);

  // Lấy cấu hình từ server
  const fetchConfig = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/oauth/config`);
      const result = await response.json();
      
      if (result.success && result.data) {
        // Lấy giá trị từ localStorage, ưu tiên dữ liệu này
        const savedConfig = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        
        // Chỉ sử dụng giá trị từ API nếu không có trong localStorage
        const newConfig = {
          // Ưu tiên giá trị từ localStorage, nếu không có mới lấy từ API
          clientId: savedConfig.clientId || result.data.clientId || '',
          clientSecret: savedConfig.clientSecret || '',
          refreshToken: savedConfig.refreshToken || '',
          baseUrl: savedConfig.baseUrl || result.data.baseUrl || 'https://partner.hanet.ai',
          tokenUrl: savedConfig.tokenUrl || result.data.tokenUrl || 'https://oauth.hanet.com/token',
          appName: savedConfig.appName || result.data.appName || ''
        };
        
        console.log('Cấu hình từ localStorage:', savedConfig);
        console.log('Cấu hình sau khi merge với server:', newConfig);
        
        setConfig(newConfig);
        
        setStatus({
          loading: false,
          message: 'Đã tải cấu hình',
          status: 'loaded',
          error: null
        });
      } else {
        throw new Error(result.message || 'Không thể tải cấu hình');
      }
    } catch (error) {
      console.error('Lỗi khi tải cấu hình:', error);
      
      // Nếu không kết nối được server, vẫn tải từ localStorage
      const savedConfig = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      if (savedConfig.clientId) {
        console.log('Sử dụng cấu hình từ localStorage do không kết nối được server');
        setConfig(savedConfig);
        setStatus({
          loading: false,
          message: 'Đã tải cấu hình từ lưu trữ cục bộ',
          status: 'loaded',
          error: null
        });
      } else {
        setStatus({
          loading: false,
          message: 'Lỗi tải cấu hình',
          status: 'error',
          error: error.message
        });
      }
    }
  };

  // Kiểm tra trạng thái xác thực
  const checkAuthStatus = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/oauth/status`);
      const result = await response.json();
      
      if (result.success && result.data) {
        setStatus(prevStatus => ({
          ...prevStatus,
          authStatus: result.data.status,
          authMessage: result.data.message
        }));
      }
    } catch (error) {
      console.error("Lỗi kiểm tra trạng thái xác thực:", error);
    }
  };

  // Lưu cấu hình
  const saveConfig = async () => {
    try {
      setStatus({
        ...status,
        loading: true,
        message: 'Đang lưu cấu hình...'
      });

      // Lưu đầy đủ các thông tin vào local storage trước
      // để đảm bảo dữ liệu không bị mất ngay cả khi API gặp lỗi
      const configToSave = {
        clientId: config.clientId, 
        clientSecret: config.clientSecret,
        refreshToken: config.refreshToken,
        baseUrl: config.baseUrl,
        tokenUrl: config.tokenUrl,
        appName: config.appName
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(configToSave));
      console.log('Đã lưu cấu hình vào localStorage:', configToSave);

      // Sau đó gửi lên server
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/oauth/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(config)
      });

      const result = await response.json();
      
      if (result.success) {
        setStatus({
          loading: false,
          message: 'Đã lưu cấu hình thành công',
          status: 'success',
          error: null
        });
        
        // Kiểm tra lại trạng thái xác thực
        checkAuthStatus();
      } else {
        throw new Error(result.message || 'Không thể lưu cấu hình');
      }
    } catch (error) {
      console.error('Lỗi khi lưu cấu hình:', error);
      setStatus({
        loading: false,
        message: 'Lỗi khi gửi cấu hình lên server, nhưng đã lưu cục bộ',
        status: 'warning',
        error: error.message
      });
    }
  };

  // Khởi tạo quá trình đăng nhập OAuth
  const initiateOAuth = () => {
    if (!config.clientId) {
      setStatus({
        ...status,
        status: 'error',
        message: 'Vui lòng nhập Client ID trước khi đăng nhập',
        error: 'Thiếu Client ID'
      });
      return;
    }

    // Tạo URL redirect
    const redirectUri = `${window.location.origin}/oauth-callback`;
    // URL xác thực Hanet OAuth2
    const authUrl = `https://oauth.hanet.com/oauth2/authorize?response_type=code&client_id=${config.clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=full`;
    
    // Mở cửa sổ đăng nhập mới
    window.open(authUrl, 'hanetOAuth', 'width=600,height=700');
  };

  const handleChange = (e) => {
    setConfig({
      ...config,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div className="oauth-config">
      <div className="config-header">
        <h2>Cấu hình Xác thực Hanet API</h2>
        <Link to="/" className="home-button">
          Quay về trang chủ
        </Link>
      </div>
      
      {status.error && (
        <div className="error-message">
          <p>{status.error}</p>
        </div>
      )}
      
      {status.authStatus && (
        <div className={`auth-status ${status.authStatus}`}>
          <p>Trạng thái xác thực: {status.authMessage}</p>
        </div>
      )}
      
      <div className="config-form">
        <div className="form-group">
          <label htmlFor="appName">Tên ứng dụng:</label>
          <input
            type="text"
            id="appName"
            name="appName"
            value={config.appName}
            onChange={handleChange}
            placeholder="Nhập tên ứng dụng của bạn"
          />
          <small>* Tên này sẽ được hiển thị khi chọn tài khoản</small>
        </div>
        
        <div className="form-group">
          <label htmlFor="clientId">Client ID:</label>
          <input
            type="text"
            id="clientId"
            name="clientId"
            value={config.clientId}
            onChange={handleChange}
            placeholder="Nhập Client ID của bạn"
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="clientSecret">Client Secret:</label>
          <input
            type="password"
            id="clientSecret"
            name="clientSecret"
            value={config.clientSecret}
            onChange={handleChange}
            placeholder="Nhập Client Secret của bạn"
          />
          <small>* Client Secret sẽ không được hiển thị sau khi lưu</small>
        </div>
        
        <div className="form-group">
          <label htmlFor="refreshToken">Refresh Token (tùy chọn):</label>
          <input
            type="password"
            id="refreshToken"
            name="refreshToken"
            value={config.refreshToken}
            onChange={handleChange}
            placeholder="Nhập Refresh Token nếu có"
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="baseUrl">API Base URL:</label>
          <input
            type="text"
            id="baseUrl"
            name="baseUrl"
            value={config.baseUrl}
            onChange={handleChange}
            placeholder="URL cơ sở của API"
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="tokenUrl">Token URL:</label>
          <input
            type="text"
            id="tokenUrl"
            name="tokenUrl"
            value={config.tokenUrl}
            onChange={handleChange}
            placeholder="URL token OAuth"
          />
          <small>* Thông thường là https://oauth.hanet.com/token</small>
        </div>
        
        <div className="button-group">
          <button 
            className="save-button"
            onClick={saveConfig}
            disabled={status.loading}
          >
            {status.loading ? 'Đang lưu...' : 'Lưu cấu hình'}
          </button>
          
          <button 
            className="oauth-button"
            onClick={initiateOAuth}
            disabled={!config.clientId || status.loading}
          >
            Đăng nhập với Hanet
          </button>
        </div>
      </div>
      
      <div className="oauth-info">
        <h3>Hướng dẫn</h3>
        <ol>
          <li>Nhập <strong>Client ID</strong> và <strong>Client Secret</strong> từ tài khoản Hanet của bạn</li>
          <li>Nhấn <strong>Lưu cấu hình</strong> để lưu thông tin</li>
          <li>Nhấn <strong>Đăng nhập với Hanet</strong> để xác thực</li>
          <li>Sau khi xác thực, hệ thống sẽ tự động lưu trữ token</li>
        </ol>
      </div>
    </div>
  );
};

export default OAuthConfig; 