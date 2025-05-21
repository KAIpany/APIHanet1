import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './OAuthCallback.css';

const OAuthCallback = () => {
  const [status, setStatus] = useState({
    message: 'Đang xử lý xác thực...',
    error: null,
    processing: true
  });
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Lấy code từ query string
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        
        if (!code) {
          setStatus({
            message: 'Không nhận được mã xác thực từ Hanet',
            error: 'Thiếu code xác thực',
            processing: false
          });
          return;
        }
        
        // Tạo redirect URI giống với lúc gửi request ban đầu
        const redirectUri = `${window.location.origin}/oauth-callback`;
        
        // Gọi API để đổi code lấy token
        const response = await fetch(`${process.env.REACT_APP_API_URL}/api/oauth/callback?code=${code}&redirect_uri=${encodeURIComponent(redirectUri)}`);
        const result = await response.json();
        
        if (result.success) {
          // Lấy thông tin người dùng
          const userResponse = await fetch(`${process.env.REACT_APP_API_URL}/api/user/info`);
          const userData = await userResponse.json();
          
          console.log('Received user data:', userData);
          
          if (userData.success) {
            // Lưu thông tin người dùng vào localStorage
            console.log('Saving user info to localStorage:', userData.data);
            localStorage.setItem('user_info', JSON.stringify(userData.data));
            
            // Verify data was saved correctly
            const savedData = localStorage.getItem('user_info');
            console.log('Verified saved user info:', savedData);
          } else {
            console.error('Failed to get user data:', userData);
          }
          
          // Lưu refresh token nếu có
          if (result.data && result.data.refreshToken) {
            // Lấy cấu hình hiện tại từ localStorage
            const STORAGE_KEY = 'hanet_oauth_config';
            const currentConfig = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
            
            // Cập nhật refresh token trong cấu hình
            currentConfig.refreshToken = result.data.refreshToken;
            
            // Lưu lại vào localStorage
            console.log('Saving updated OAuth config with refresh token to localStorage');
            localStorage.setItem(STORAGE_KEY, JSON.stringify(currentConfig));
          }
          
          setStatus({
            message: 'Xác thực thành công! Đang chuyển hướng...',
            error: null,
            processing: false
          });
          
          // Thông báo cho cửa sổ mở ra (nếu là popup)
          if (window.opener) {
            window.opener.postMessage({ 
              type: 'OAUTH_SUCCESS',
              userData: userData.success ? userData.data : null
            }, window.location.origin);
            // Đóng cửa sổ popup sau 2 giây
            setTimeout(() => {
              window.close();
            }, 2000);
          } else {
            // Nếu không phải popup, chuyển về trang chính sau 2 giây
            setTimeout(() => {
              navigate('/');
            }, 2000);
          }
        } else {
          throw new Error(result.message || 'Lỗi xác thực không xác định');
        }
      } catch (error) {
        console.error('Lỗi xử lý OAuth callback:', error);
        setStatus({
          message: 'Xác thực thất bại',
          error: error.message,
          processing: false
        });
      }
    };
    
    handleCallback();
  }, [navigate]);

  return (
    <div className="oauth-callback-container">
      <div className="oauth-callback-card">
        <h2>Xác thực Hanet</h2>
        
        <div className={`status-message ${status.error ? 'error' : status.processing ? 'processing' : 'success'}`}>
          <div className="status-icon">
            {status.processing ? (
              <div className="loading-spinner"></div>
            ) : status.error ? (
              <span className="error-icon">✕</span>
            ) : (
              <span className="success-icon">✓</span>
            )}
          </div>
          <p>{status.message}</p>
        </div>
        
        {status.error && (
          <div className="error-details">
            <h3>Chi tiết lỗi:</h3>
            <p>{status.error}</p>
            <button 
              className="retry-button"
              onClick={() => window.location.href = '/'}
            >
              Quay lại trang chính
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default OAuthCallback; 