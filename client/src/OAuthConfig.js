import React, { useState, useEffect } from 'react';
import * as AccountManager from './accountManager';
import { Link } from 'react-router-dom';
import './OAuthConfig.css';

const OAuthConfig = () => {
  const [config, setConfig] = useState({
    clientId: '',
    redirectUri: '',
    accessTokenUrl: '',
    authUrl: '',
    appName: ''
  });
  const [errorText, setErrorText] = useState('');

  useEffect(() => {
    // Tải cấu hình từ localStorage nếu có
    try {
      // Lấy thông tin từ tài khoản hiện tại
      const oauthConfig = AccountManager.getOAuthConfig();
      
      if (oauthConfig) {
        console.log('Đã tải cấu hình OAuth:', oauthConfig);
        setConfig({
          clientId: oauthConfig.clientId || '',
          redirectUri: oauthConfig.redirectUri || '',
          accessTokenUrl: oauthConfig.accessTokenUrl || '',
          authUrl: oauthConfig.authUrl || '',
          appName: oauthConfig.appName || ''
        });
      } else {
        console.log('Không có cấu hình OAuth, sử dụng cấu hình mặc định');
        
        // Tạo redirectUri mặc định
        const origin = window.location.origin;
        const redirectUri = `${origin}/callback`;
        
        setConfig({
          clientId: '',
          redirectUri: redirectUri,
          accessTokenUrl: 'https://oauth.hanet.com/token',
          authUrl: 'https://oauth.hanet.com/authorize',
          appName: ''
        });
      }
    } catch (error) {
      console.error("Lỗi khi đọc cấu hình từ localStorage:", error);
    }
  }, []);

  const handleChange = (e) => {
    setConfig({ ...config, [e.target.name]: e.target.value });
  };

  const initiateOAuth = () => {
    try {
      // Kiểm tra các giá trị bắt buộc
      if (!config.clientId) {
        setErrorText('Client ID là bắt buộc');
        return;
      }
      setErrorText('');

      // Tạo redirectUri
      const origin = window.location.origin;
      const redirectUri = config.redirectUri || `${origin}/callback`;
      
      // Tạo URL thông tin người dùng
      const userInfoUrl = 'https://oauth.hanet.com/userInfo';

      // Tạo cấu hình OAuth hoàn chỉnh
      const oauthConfig = {
        ...config,
        redirectUri: redirectUri,
        userInfoUrl: userInfoUrl
      };
      
      // Lưu cấu hình vào localStorage
      AccountManager.setOAuthConfig(oauthConfig);

      // Tạo URL xác thực
      const scope = 'basic';
      const responseType = 'code';
      const authUrl = `${config.authUrl}?client_id=${config.clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=${responseType}&scope=${scope}`;

      // Mở cửa sổ đăng nhập
      window.open(authUrl, '_self');
    } catch (error) {
      console.error('Lỗi khi khởi tạo OAuth:', error);
      setErrorText(`Lỗi: ${error.message}`);
    }
  };

  return (
    <div className="oauth-config-container">
      <h2>Cấu hình OAuth</h2>
      <div className="config-form">
        <div className="form-group">
          <label htmlFor="appName">Tên ứng dụng</label>
          <input
            type="text"
            id="appName"
            name="appName"
            value={config.appName}
            onChange={handleChange}
            placeholder="Nhập tên ứng dụng (tùy chọn)"
          />
          <div className="help-text">
            Tên ứng dụng sẽ hiển thị cùng với tài khoản
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="clientId">Client ID</label>
          <input
            type="text"
            id="clientId"
            name="clientId"
            value={config.clientId}
            onChange={handleChange}
            placeholder="Nhập Client ID"
            required
          />
          <div className="help-text">
            Client ID được cung cấp bởi Hanet
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="authUrl">Auth URL</label>
          <input
            type="text"
            id="authUrl"
            name="authUrl"
            value={config.authUrl}
            onChange={handleChange}
            placeholder="Nhập Auth URL"
          />
          <div className="help-text">
            Đường dẫn yêu cầu xác thực (mặc định: https://oauth.hanet.com/authorize)
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="accessTokenUrl">Access Token URL</label>
          <input
            type="text"
            id="accessTokenUrl"
            name="accessTokenUrl"
            value={config.accessTokenUrl}
            onChange={handleChange}
            placeholder="Nhập Access Token URL"
          />
          <div className="help-text">
            Đường dẫn lấy token (mặc định: https://oauth.hanet.com/token)
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="redirectUri">Redirect URI</label>
          <input
            type="text"
            id="redirectUri"
            name="redirectUri"
            value={config.redirectUri}
            onChange={handleChange}
            placeholder="Nhập Redirect URI"
          />
          <div className="help-text">
            URL đích sau khi xác thực (mặc định: {window.location.origin}/callback)
          </div>
        </div>

        {errorText && <div className="error-message">{errorText}</div>}

        <div className="form-actions">
          <button onClick={initiateOAuth} className="login-button">
            Đăng nhập
          </button>
          <Link to="/" className="cancel-button">
            Quay lại
          </Link>
        </div>
      </div>
    </div>
  );
};

export default OAuthConfig; 