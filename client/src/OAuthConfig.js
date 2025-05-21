import React, { useState, useEffect } from 'react';
import './OAuthConfig.css';

const OAuthConfig = () => {
  const [config, setConfig] = useState({
    clientId: '',
    clientSecret: '',
    refreshToken: '',
    baseUrl: 'https://partner.hanet.ai',
    tokenUrl: 'https://oauth.hanet.com/token'
  });
  const [status, setStatus] = useState({
    loading: true,
    message: 'Đang tải cấu hình...',
    status: 'loading',
    error: null
  });

  // Lấy cấu hình từ server khi component mount
  useEffect(() => {
    fetchConfig();
    checkAuthStatus();
  }, []);

  // Lấy cấu hình hiện tại
  const fetchConfig = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/oauth/config`);
      const result = await response.json();
      
      if (result.success && result.data) {
        setConfig({
          clientId: result.data.clientId || '',
          clientSecret: '',  // Không hiển thị client secret từ server
          refreshToken: '',  // Không hiển thị refresh token từ server
          baseUrl: result.data.baseUrl || 'https://partner.hanet.ai',
          tokenUrl: result.data.tokenUrl || 'https://oauth.hanet.com/token'
        });
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
      setStatus({
        loading: false,
        message: 'Lỗi tải cấu hình',
        status: 'error',
        error: error.message
      });
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
        
        // Xóa client secret và refresh token khỏi form sau khi lưu
        setConfig({
          ...config,
          clientSecret: '',
          refreshToken: ''
        });
        
        // Kiểm tra lại trạng thái xác thực
        checkAuthStatus();
      } else {
        throw new Error(result.message || 'Không thể lưu cấu hình');
      }
    } catch (error) {
      setStatus({
        loading: false,
        message: 'Lỗi lưu cấu hình',
        status: 'error',
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
    // URL xác thực Hanet (mặc định sử dụng baseUrl nhưng có thể cấu hình)
    const authUrl = `${config.baseUrl}/oauth2/authorize?client_id=${config.clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code`;
    
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
      <h2>Cấu hình Xác thực Hanet API</h2>
      
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