import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { saveAccount } from './directAccountManager';
import './OAuthCallback.css';

// Các khóa localStorage (cho lưu trực tiếp)
const USER_INFO_KEY = 'user_info'; 
const CONFIG_KEY = 'hanet_oauth_config';

const OAuthCallback = () => {
  const [status, setStatus] = useState({
    message: 'Đang xử lý xác thực...',
    error: null,
    processing: true
  });
  const navigate = useNavigate();

  // Hàm kiểm tra localStorage
  const checkLocalStorage = () => {
    try {
      const testKey = '_test_oauth_' + Date.now();
      localStorage.setItem(testKey, 'test');
      const value = localStorage.getItem(testKey);
      localStorage.removeItem(testKey);
      return value === 'test';
    } catch (e) {
      console.error('Lỗi localStorage:', e);
      return false;
    }
  };

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Kiểm tra localStorage trước
        if (!checkLocalStorage()) {
          throw new Error('Trình duyệt không hỗ trợ hoặc đã chặn localStorage. Vui lòng kiểm tra cài đặt trình duyệt.');
        }

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
            try {
              // Lưu cấu hình OAuth
              const currentConfig = result.data || {};
              console.log('Cấu hình OAuth hiện tại:', currentConfig);
              
              // Lưu tài khoản qua module mới
              const saveResult = saveAccount(userData.data, currentConfig);
              console.log('Kết quả lưu tài khoản (directAccountManager):', saveResult);
              
              // Vẫn lưu cả thông tin cơ bản cho tương thích ngược
              localStorage.setItem(USER_INFO_KEY, JSON.stringify(userData.data));
              localStorage.setItem(CONFIG_KEY, JSON.stringify(currentConfig));
              
              console.log('Đã lưu tài khoản:', userData.data.username);
            } catch (storageError) {
              console.error('Lỗi khi lưu thông tin:', storageError);
              setStatus({
                message: 'Đã xác thực thành công nhưng không thể lưu thông tin',
                error: 'Có vấn đề với localStorage: ' + storageError.message,
                processing: false
              });
              return;
            }
          } else {
            console.error('Failed to get user data:', userData);
            throw new Error('Không thể lấy thông tin người dùng');
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