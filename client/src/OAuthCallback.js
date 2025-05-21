import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import * as AccountManager from './accountManager';
import './App.css';

const OAuthCallback = () => {
  const [status, setStatus] = useState({
    loading: true,
    message: 'Đang xử lý xác thực...',
    error: null,
    success: false
  });
  const navigate = useNavigate();
  const location = useLocation();
  
  useEffect(() => {
    const handleOAuthCallback = async () => {
      try {
        // Lấy code từ URL
        const queryParams = new URLSearchParams(location.search);
        const code = queryParams.get('code');
        
        if (!code) {
          throw new Error('Không tìm thấy mã xác thực trong URL callback');
        }
        
        console.log('Mã xác thực:', code);
        setStatus({
          ...status,
          message: 'Đã nhận được mã xác thực, đang trao đổi token...'
        });
        
        // Lấy cấu hình OAuth
        const oauthConfig = AccountManager.getOAuthConfig();
        
        if (!oauthConfig) {
          throw new Error('Không tìm thấy cấu hình OAuth');
        }
        
        console.log('Cấu hình OAuth:', oauthConfig);
        
        // Đảm bảo có redirectUri
        if (!oauthConfig.redirectUri) {
          oauthConfig.redirectUri = `${window.location.origin}/callback`;
        }
        
        // Đảm bảo có userInfoUrl
        if (!oauthConfig.userInfoUrl) {
          oauthConfig.userInfoUrl = 'https://oauth.hanet.com/userInfo';
        }
        
        // Tạo URL token
        const tokenUrl = oauthConfig.accessTokenUrl || 'https://oauth.hanet.com/token';
        
        // Trao đổi code lấy token
        const tokenResponse = await fetch(tokenUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            code: code,
            client_id: oauthConfig.clientId,
            redirect_uri: oauthConfig.redirectUri
          })
        });
        
        if (!tokenResponse.ok) {
          const errorData = await tokenResponse.json();
          throw new Error(`Lỗi khi trao đổi token: ${errorData.error || tokenResponse.statusText}`);
        }
        
        const tokenData = await tokenResponse.json();
        console.log('Dữ liệu token:', tokenData);
        
        // Cập nhật cấu hình với token mới
        const updatedConfig = {
          ...oauthConfig,
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          tokenType: tokenData.token_type,
          expiresIn: tokenData.expires_in,
          tokenTimestamp: new Date().getTime()
        };
        
        // Lưu cấu hình đã cập nhật
        AccountManager.setOAuthConfig(updatedConfig);
        
        setStatus({
          ...status,
          message: 'Đã nhận được token, đang lấy thông tin người dùng...'
        });
        
        // Lấy thông tin người dùng
        const userInfoUrl = oauthConfig.userInfoUrl;
        const userInfoResponse = await fetch(userInfoUrl, {
          headers: {
            'Authorization': `${tokenData.token_type} ${tokenData.access_token}`
          }
        });
        
        if (!userInfoResponse.ok) {
          throw new Error(`Lỗi khi lấy thông tin người dùng: ${userInfoResponse.statusText}`);
        }
        
        const userInfo = await userInfoResponse.json();
        console.log('Thông tin người dùng:', userInfo);
        
        // Tạo tài khoản từ thông tin người dùng
        const account = AccountManager.createAccountFromOAuth(userInfo, updatedConfig);
        
        if (!account) {
          throw new Error('Không thể tạo tài khoản từ thông tin người dùng');
        }
        
        setStatus({
          loading: false,
          message: 'Đăng nhập thành công!',
          error: null,
          success: true
        });
        
        // Chờ 1 giây trước khi chuyển hướng
        setTimeout(() => {
          navigate('/');
        }, 1000);
      } catch (error) {
        console.error('Lỗi xử lý callback OAuth:', error);
        setStatus({
          loading: false,
          message: 'Đăng nhập thất bại',
          error: error.message,
          success: false
        });
      }
    };
    
    handleOAuthCallback();
  }, [location, navigate]);
  
  return (
    <div className='oauth-callback'>
      <div className={`callback-status ${status.error ? 'error' : status.success ? 'success' : 'loading'}`}>
        <h2>{status.message}</h2>
        {status.error && (
          <div className='error-details'>
            <p>{status.error}</p>
            <button onClick={() => navigate('/config')}>Quay lại trang cấu hình</button>
          </div>
        )}
        {status.loading && <div className='loading-spinner'></div>}
      </div>
    </div>
  );
};

export default OAuthCallback; 