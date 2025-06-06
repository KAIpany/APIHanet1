import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './OAuthConfig.css';

// Lưu trữ danh sách các cấu hình
const CONFIGS_LIST_KEY = 'hanet_oauth_configs_list';
// Lưu trữ cấu hình đang active
const ACTIVE_CONFIG_KEY = 'hanet_oauth_active_config';
// Lưu trữ một cấu hình cụ thể (sẽ có prefix + name)
const CONFIG_PREFIX = 'hanet_oauth_config_';
// Legacy storage key, giữ lại để tương thích ngược
const STORAGE_KEY = 'hanet_oauth_config';

const OAuthConfig = () => {
  const [config, setConfig] = useState({
    clientId: '',
    clientSecret: '',
    baseUrl: 'https://partner.hanet.ai',
    tokenUrl: 'https://oauth.hanet.com/token'
  });

  const [status, setStatus] = useState({
    loading: false,
    error: null,
    authStatus: null,
    authMessage: null
  });

  const [configName, setConfigName] = useState('');
  const [savedConfigs, setSavedConfigs] = useState([]);
  const [activeConfig, setActiveConfig] = useState('');

  // Lấy danh sách cấu hình và cấu hình đang active khi component mount
  useEffect(() => {
    // Đặt trạng thái đang tải
    setStatus({
      loading: true,
      message: 'Đang tải dữ liệu cấu hình...',
      status: 'loading',
      error: null
    });

    // Kiểm tra trạng thái xác thực ngay khi tải
    checkAuthStatus().catch(error => {
      console.error('Lỗi khi kiểm tra trạng thái xác thực:', error);
      setStatus(prevStatus => ({
        ...prevStatus,
        error: 'Lỗi khi kiểm tra xác thực: ' + error.message,
        authStatus: 'error'
      }));
    });

    // Lấy danh sách cấu hình
    const configsList = localStorage.getItem(CONFIGS_LIST_KEY);
    let configNames = [];
    if (configsList) {
      try {
        configNames = JSON.parse(configsList);
        setSavedConfigs(configNames);
        console.log('Đã tải danh sách cấu hình:', configNames);
      } catch (error) {
        console.error('Lỗi khi đọc danh sách cấu hình từ local storage:', error);
      }
    }

    // Get active config after a short delay
    setTimeout(() => {
      const currentActive = localStorage.getItem(ACTIVE_CONFIG_KEY);
      if (currentActive && configNames.includes(currentActive)) {
        console.log(`Đang tải cấu hình active: ${currentActive}`);
        loadConfigByName(currentActive);
      }
    }, 500);
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
          baseUrl: savedConfig.baseUrl || result.data.baseUrl || 'https://partner.hanet.ai',
          tokenUrl: savedConfig.tokenUrl || result.data.tokenUrl || 'https://oauth.hanet.com/token',
          appName: savedConfig.appName || result.data.appName || '',
          redirectUri: savedConfig.redirectUri || '',
          userInfoUrl: savedConfig.userInfoUrl || ''
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
    console.log('Đang kiểm tra trạng thái xác thực...');
    
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/oauth/status`, {
        headers: {
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('Kết quả kiểm tra xác thực:', result);
      
      if (result.success && result.data) {
        setStatus(prevStatus => ({
          ...prevStatus,
          authStatus: result.data.status,
          authMessage: result.data.message,
          error: null
        }));
        return result.data;
      } else {
        throw new Error(result.message || 'Lỗi không xác định khi kiểm tra trạng thái');
      }
    } catch (error) {
      console.error("Lỗi kiểm tra trạng thái xác thực:", error);
      setStatus(prevStatus => ({
        ...prevStatus,
        authStatus: 'error',
        authMessage: `Lỗi kiểm tra trạng thái: ${error.message}`,
        error: error.message
      }));
      throw error;
    }
  };

  // Load cấu hình theo tên
  const loadConfigByName = (name) => {
    if (!name) return;
    
    try {
      const savedConfig = localStorage.getItem(CONFIG_PREFIX + name);
      if (savedConfig) {
        const parsedConfig = JSON.parse(savedConfig);
        console.log(`Đã tải cấu hình '${name}' từ localStorage:`, parsedConfig);
        
        // Đặt trạng thái tải trước khi tải cấu hình
        setStatus({
          loading: true,
          message: `Đang tải cấu hình '${name}'...`,
          status: 'loading',
          error: null
        });
        
        // Set activeConfig trước để tránh lỗi khi chuyển đổi
        setActiveConfig(name);
        localStorage.setItem(ACTIVE_CONFIG_KEY, name);
        
        // Cập nhật cấu hình lên server trước, sau đó mới cập nhật UI
        updateServerConfig(parsedConfig).then(() => {
          // Sau khi cập nhật server xong mới cập nhật state
          setConfig({
            clientId: parsedConfig.clientId || '',
            clientSecret: parsedConfig.clientSecret || '',
            baseUrl: parsedConfig.baseUrl || 'https://partner.hanet.ai',
            tokenUrl: parsedConfig.tokenUrl || 'https://oauth.hanet.com/token',
            appName: parsedConfig.appName || '',
            redirectUri: parsedConfig.redirectUri || '',
            userInfoUrl: parsedConfig.userInfoUrl || ''
          });
          
          // Đặt tên cấu hình để dễ quản lý
          setConfigName(name);
          
          setStatus({
            loading: false,
            message: `Đã tải cấu hình '${name}'`,
            status: 'success',
            error: null
          });
          
          // Cập nhật trạng thái xác thực sau khi đã cập nhật cấu hình
          checkAuthStatus();
        }).catch(error => {
          console.error(`Lỗi khi cập nhật cấu hình '${name}' lên server:`, error);
          setStatus({
            loading: false,
            message: `Đã tải cấu hình '${name}' nhưng không cập nhật được lên server`,
            status: 'warning',
            error: error.message
          });
        });
      }
    } catch (error) {
      console.error(`Lỗi khi tải cấu hình '${name}':`, error);
      setStatus({
        loading: false,
        message: `Lỗi khi tải cấu hình '${name}'`,
        status: 'error',
        error: error.message
      });
    }
  };
  
  // Cập nhật cấu hình lên server
  const updateServerConfig = async (configData) => {
    // Lấy refreshToken nếu có
    const refreshToken = configData.token?.refresh_token || configData.refreshToken || '';
    const configToSend = {
      ...configData,
      refreshToken
    };
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/oauth/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(configToSend)
      });
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.message || 'Không thể cập nhật cấu hình lên server');
      }
      return true;
    } catch (error) {
      console.error('Lỗi khi cập nhật cấu hình lên server:', error);
      throw error;
    }
  };

  // Lưu cấu hình mới
  const saveConfig = async () => {
    if (!configName.trim()) {
      setStatus({ ...status, error: 'Vui lòng nhập tên cấu hình' });
      return;
    }

    setStatus({ ...status, loading: true, error: null });

    try {
      const configData = {
        ...config,
        appName: configName
      };

      // Lưu vào localStorage
      localStorage.setItem(CONFIG_PREFIX + configName, JSON.stringify(configData));
      setActiveConfig(configName);

      // Cập nhật danh sách cấu hình
      let configsList = [];
      try {
        const savedList = localStorage.getItem(CONFIGS_LIST_KEY);
        if (savedList) {
          configsList = JSON.parse(savedList);
        }
      } catch (error) {
        console.error('Lỗi khi đọc danh sách cấu hình:', error);
      }

      if (!configsList.includes(configName)) {
        configsList.push(configName);
        localStorage.setItem(CONFIGS_LIST_KEY, JSON.stringify(configsList));
        setSavedConfigs(configsList);
      }

      // Cập nhật cấu hình lên server
      await updateServerConfig({
        ...configData,
        clientSecret: configData.clientSecret || undefined
      });

      setStatus({ loading: false, error: null, authStatus: 'success' });
      
    } catch (error) {
      setStatus({
        loading: false,
        error: error.message || 'Có lỗi xảy ra khi lưu cấu hình',
        authStatus: 'error'
      });
    }
  };

  // Xóa cấu hình
  const deleteConfig = (name) => {
    if (!name) return;
    
    try {
      // Xóa cấu hình
      localStorage.removeItem(CONFIG_PREFIX + name);
      
      // Cập nhật danh sách
      let configsList = [];
      try {
        const savedList = localStorage.getItem(CONFIGS_LIST_KEY);
        if (savedList) {
          configsList = JSON.parse(savedList);
          configsList = configsList.filter(item => item !== name);
          localStorage.setItem(CONFIGS_LIST_KEY, JSON.stringify(configsList));
          setSavedConfigs(configsList);
        }
      } catch (error) {
        console.error('Lỗi khi cập nhật danh sách cấu hình:', error);
      }
      
      // Nếu xóa cấu hình đang active
      if (activeConfig === name) {
        setActiveConfig('');
        localStorage.removeItem(ACTIVE_CONFIG_KEY);
        
        // Nếu còn cấu hình khác, load cấu hình đầu tiên
        if (configsList.length > 0) {
          loadConfigByName(configsList[0]);
        } else {
          // Reset form
          setConfig({
            clientId: '',
            clientSecret: '',
            baseUrl: 'https://partner.hanet.ai',
            tokenUrl: 'https://oauth.hanet.com/token',
            appName: '',
            redirectUri: '',
            userInfoUrl: ''
          });
        }
      }
      
      setStatus({
        loading: false,
        message: `Đã xóa cấu hình '${name}'`,
        status: 'success',
        error: null
      });
    } catch (error) {
      console.error(`Lỗi khi xóa cấu hình '${name}':`, error);
      setStatus({
        loading: false,
        message: `Lỗi khi xóa cấu hình '${name}'`,
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
    
    // Lưu redirectUri vào cấu hình để sử dụng sau này
    const updatedConfig = {
      ...config,
      redirectUri: redirectUri,
      userInfoUrl: `${config.baseUrl}/api/user/info`
    };
    
    // Cập nhật state
    setConfig(updatedConfig);
    
    // Nếu đang có cấu hình active thì lưu vào cấu hình đó
    if (activeConfig) {
      localStorage.setItem(CONFIG_PREFIX + activeConfig, JSON.stringify(updatedConfig));
    } else if (configName) {
      // Nếu đã nhập tên nhưng chưa lưu, lưu luôn
      localStorage.setItem(CONFIG_PREFIX + configName, JSON.stringify(updatedConfig));
      localStorage.setItem(ACTIVE_CONFIG_KEY, configName);
      setActiveConfig(configName);
      
      // Cập nhật danh sách cấu hình
      let configsList = [];
      try {
        const savedList = localStorage.getItem(CONFIGS_LIST_KEY);
        if (savedList) {
          configsList = JSON.parse(savedList);
        }
      } catch (error) {
        console.error('Lỗi khi đọc danh sách cấu hình:', error);
      }
      
      // Thêm vào danh sách nếu chưa có
      if (!configsList.includes(configName)) {
        configsList.push(configName);
        localStorage.setItem(CONFIGS_LIST_KEY, JSON.stringify(configsList));
        setSavedConfigs(configsList);
      }
    } else {
      // Lưu tạm thời vào localStorage cũ
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedConfig));
    }
    
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
          <p>{status.authStatus === 'success' ? 'Cấu hình đã được lưu thành công!' : 'Có lỗi xảy ra!'}</p>
        </div>
      )}
      
      <div className="config-form">
        <div className="form-group">
          <label htmlFor="configName">Tên cấu hình:</label>
          <input
            type="text"
            id="configName"
            value={configName}
            onChange={(e) => setConfigName(e.target.value)}
            placeholder="Nhập tên cho cấu hình này"
          />
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
            disabled={status.loading || !configName.trim()}
          >
            {status.loading ? 'Đang lưu...' : 'Lưu cấu hình mới'}
          </button>
        </div>
      </div>
      
      <div className="oauth-info">
        <h3>Hướng dẫn</h3>
        <ol>
          <li>Nhập <strong>Client ID</strong> và <strong>Client Secret</strong> từ tài khoản Hanet của bạn</li>
          <li>Nhấn <strong>Lưu cấu hình</strong> để lưu thông tin</li>
          <li>Hệ thống sẽ sử dụng Access Token đã được cấu hình sẵn</li>
        </ol>
      </div>
    </div>
  );
};

export default OAuthConfig;
