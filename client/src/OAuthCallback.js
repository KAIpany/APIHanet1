import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './OAuthCallback.css';

const OAuthCallback = ({ onLoginSuccess }) => {
  const navigate = useNavigate();
  const [status, setStatus] = useState({ loading: true, error: null });

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        
        if (!code) {
          throw new Error('Không nhận được mã xác thực');
        }

        // Gọi API để đổi code lấy token
        const response = await fetch(`${process.env.REACT_APP_API_URL}/api/oauth/callback?code=${code}&redirect_uri=${window.location.origin}/oauth-callback`);
        const data = await response.json();

        if (data.success) {
          // Cập nhật trạng thái xác thực
          if (onLoginSuccess) {
            await onLoginSuccess();
          }
          
          // Đóng cửa sổ popup nếu đang trong popup
          if (window.opener) {
            window.opener.postMessage({ type: 'oauth-success' }, window.location.origin);
            window.close();
          } else {
            // Nếu không phải popup, chuyển hướng về trang chủ
            navigate('/', { replace: true });
          }
        } else {
          throw new Error(data.message || 'Xác thực không thành công');
        }
      } catch (error) {
        console.error('Lỗi xử lý callback:', error);
        setStatus({
          loading: false,
          error: error.message
        });
      }
    };

    handleCallback();
  }, [navigate, onLoginSuccess]);

  if (status.loading) {
    return (
      <div className="oauth-callback">
        <h2>Đang xử lý xác thực...</h2>
        <div className="loading-spinner"></div>
      </div>
    );
  }

  if (status.error) {
    return (
      <div className="oauth-callback error">
        <h2>Lỗi xác thực</h2>
        <p>{status.error}</p>
        <button onClick={() => navigate('/config')}>Quay lại trang cấu hình</button>
      </div>
    );
  }

  return null;
};

export default OAuthCallback; 