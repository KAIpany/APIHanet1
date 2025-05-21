/**
 * AccountManager.js - Module quản lý tài khoản và lưu trữ
 * 
 * Quản lý việc đăng nhập, lưu trữ thông tin tài khoản và chuyển đổi giữa các tài khoản
 */

// Quản lý tài khoản - Mô hình dữ liệu chuẩn cho hệ thống quản lý tài khoản

// Constants - Khóa lưu trữ
export const KEYS = {
  ACCOUNTS: 'hanet_accounts',
  CURRENT_ACCOUNT_ID: 'hanet_current_account_id',
  OAUTH_CONFIG: 'hanet_oauth_config',
  USER_INFO: 'hanet_user_info'
};

/**
 * Lấy danh sách tài khoản
 * @returns {Array} Danh sách tài khoản
 */
export const getAccounts = () => {
  try {
    const accountsData = localStorage.getItem(KEYS.ACCOUNTS);
    if (!accountsData) return [];

    const accounts = JSON.parse(accountsData);
    return Array.isArray(accounts) ? accounts : [];
  } catch (error) {
    console.error('Lỗi khi lấy danh sách tài khoản:', error);
    return [];
  }
};

/**
 * Lưu danh sách tài khoản
 * @param {Array} accounts Danh sách tài khoản cần lưu
 * @returns {boolean} Kết quả thao tác
 */
export const saveAccounts = (accounts) => {
  if (!Array.isArray(accounts)) {
    console.error('Không thể lưu danh sách tài khoản: Dữ liệu không phải mảng');
    return false;
  }

  try {
    localStorage.setItem(KEYS.ACCOUNTS, JSON.stringify(accounts));
    console.log('Đã lưu danh sách tài khoản:', accounts.length);
    return true;
  } catch (error) {
    console.error('Lỗi khi lưu danh sách tài khoản:', error);
    return false;
  }
};

/**
 * Lấy ID tài khoản hiện tại
 * @returns {string|null} ID tài khoản hiện tại hoặc null nếu không có
 */
export const getCurrentAccountId = () => {
  return localStorage.getItem(KEYS.CURRENT_ACCOUNT_ID);
};

/**
 * Lấy tài khoản hiện tại
 * @returns {Object|null} Thông tin tài khoản hiện tại hoặc null nếu không có
 */
export const getCurrentAccount = () => {
  const accountId = getCurrentAccountId();
  if (!accountId) {
    console.log('Không có ID tài khoản hiện tại');
    return null;
  }
  
  const accounts = getAccounts();
  const account = accounts.find(acc => acc.id === accountId);
  
  if (!account) {
    console.log('Không tìm thấy tài khoản với ID:', accountId);
    return null;
  }
  
  return account;
};

/**
 * Thêm hoặc cập nhật tài khoản
 * @param {Object} account Thông tin tài khoản cần thêm/cập nhật
 * @returns {boolean} Kết quả thao tác
 */
export const addAccount = (account) => {
  if (!account || !account.id) {
    console.error('Không thể thêm tài khoản: Thiếu ID tài khoản');
    return false;
  }
  
  const accounts = getAccounts();
  const existingIndex = accounts.findIndex(acc => acc.id === account.id);
  
  if (existingIndex >= 0) {
    // Cập nhật tài khoản hiện có
    accounts[existingIndex] = {
      ...accounts[existingIndex],
      ...account,
      updatedAt: new Date().toISOString()
    };
    console.log('Đã cập nhật tài khoản:', account.id);
  } else {
    // Thêm tài khoản mới
    accounts.push({
      ...account,
      createdAt: new Date().toISOString()
    });
    console.log('Đã thêm tài khoản mới:', account.id);
  }
  
  return saveAccounts(accounts);
};

/**
 * Cập nhật tài khoản
 * @param {string} accountId ID tài khoản cần cập nhật
 * @param {Object} data Dữ liệu cần cập nhật
 * @returns {boolean} Kết quả thao tác
 */
export const updateAccount = (accountId, data) => {
  if (!accountId) {
    console.error('Không thể cập nhật tài khoản: Thiếu ID tài khoản');
    return false;
  }
  
  const accounts = getAccounts();
  const index = accounts.findIndex(acc => acc.id === accountId);
  
  if (index < 0) {
    console.error('Không tìm thấy tài khoản để cập nhật:', accountId);
    return false;
  }
  
  accounts[index] = {
    ...accounts[index],
    ...data,
    updatedAt: new Date().toISOString()
  };
  
  console.log('Đã cập nhật tài khoản:', accountId);
  return saveAccounts(accounts);
};

/**
 * Xóa tài khoản
 * @param {string} accountId ID tài khoản cần xóa
 * @returns {boolean} Kết quả thao tác
 */
export const deleteAccount = (accountId) => {
  if (!accountId) {
    console.error('Không thể xóa tài khoản: Thiếu ID tài khoản');
    return false;
  }
  
  const accounts = getAccounts();
  const updatedAccounts = accounts.filter(acc => acc.id !== accountId);
  
  if (updatedAccounts.length === accounts.length) {
    console.error('Không tìm thấy tài khoản để xóa:', accountId);
    return false;
  }
  
  // Kiểm tra nếu đang xóa tài khoản hiện tại
  const currentId = getCurrentAccountId();
  if (currentId === accountId) {
    // Nếu còn tài khoản khác, chọn tài khoản đầu tiên
    if (updatedAccounts.length > 0) {
      switchToAccount(updatedAccounts[0].id);
    } else {
      // Không còn tài khoản nào, xóa thông tin tài khoản hiện tại
      localStorage.removeItem(KEYS.CURRENT_ACCOUNT_ID);
      localStorage.removeItem(KEYS.OAUTH_CONFIG);
      localStorage.removeItem(KEYS.USER_INFO);
    }
  }
  
  console.log('Đã xóa tài khoản:', accountId);
  return saveAccounts(updatedAccounts);
};

/**
 * Chuyển đổi sang tài khoản khác
 * @param {string} accountId ID tài khoản cần chuyển đổi
 * @returns {boolean} Kết quả thao tác
 */
export const switchToAccount = (accountId) => {
  if (!accountId) {
    console.error('Không thể chuyển đổi tài khoản: Thiếu ID tài khoản');
    return false;
  }
  
  const accounts = getAccounts();
  const account = accounts.find(acc => acc.id === accountId);
  
  if (!account) {
    console.error('Không tìm thấy tài khoản để chuyển đổi:', accountId);
    return false;
  }
  
  try {
    // Lưu ID tài khoản hiện tại
    localStorage.setItem(KEYS.CURRENT_ACCOUNT_ID, accountId);
    
    // Cập nhật cấu hình OAuth
    if (account.oauthConfig) {
      localStorage.setItem(KEYS.OAUTH_CONFIG, JSON.stringify(account.oauthConfig));
    }
    
    // Cập nhật thông tin người dùng
    if (account.userInfo) {
      localStorage.setItem(KEYS.USER_INFO, JSON.stringify(account.userInfo));
    }
    
    console.log('Đã chuyển đổi sang tài khoản:', accountId);
    return true;
  } catch (error) {
    console.error('Lỗi khi chuyển đổi tài khoản:', error);
    return false;
  }
};

/**
 * Tạo tài khoản thủ công
 * @param {string} name Tên tài khoản
 * @param {string} appName Tên ứng dụng (tùy chọn)
 * @returns {Object|null} Tài khoản đã tạo hoặc null nếu thất bại
 */
export const createManualAccount = (name, appName = '') => {
  if (!name) {
    console.error('Không thể tạo tài khoản: Thiếu tên tài khoản');
    return null;
  }
  
  try {
    // Tạo ID ngẫu nhiên
    const accountId = 'account_' + Math.random().toString(36).substring(2, 11);
    
    // Tạo thông tin người dùng đơn giản
    const userInfo = {
      id: accountId,
      username: accountId,
      name: name
    };
    
    // Tạo cấu hình OAuth đơn giản
    const oauthConfig = {
      appName: appName,
      redirectUri: `${window.location.origin}/callback`
    };
    
    // Tạo tài khoản mới
    const account = {
      id: accountId,
      name: name,
      appName: appName,
      userInfo: userInfo,
      oauthConfig: oauthConfig,
      createdAt: new Date().toISOString()
    };
    
    // Thêm vào danh sách tài khoản
    if (addAccount(account)) {
      console.log('Đã tạo tài khoản thủ công:', account);
      return account;
    }
    
    return null;
  } catch (error) {
    console.error('Lỗi khi tạo tài khoản thủ công:', error);
    return null;
  }
};

/**
 * Tạo tài khoản từ thông tin OAuth
 * @param {Object} userInfo Thông tin người dùng
 * @param {Object} oauthConfig Cấu hình OAuth
 * @returns {Object|null} Tài khoản đã tạo hoặc null nếu thất bại
 */
export const createAccountFromOAuth = (userInfo, oauthConfig) => {
  if (!userInfo || !oauthConfig) {
    console.error('Không thể tạo tài khoản: Thiếu thông tin người dùng hoặc cấu hình OAuth');
    return null;
  }
  
  try {
    // Lấy thông tin để tạo ID tài khoản
    const username = userInfo.username || userInfo.id || 'user_' + Math.random().toString(36).substring(2, 11);
    const appName = oauthConfig.appName || '';
    
    // Tạo ID kết hợp tên người dùng và ứng dụng
    let accountId = username;
    if (appName) {
      const appNameSlug = appName.toLowerCase().replace(/[^a-z0-9]/g, '_');
      accountId = `${username}_${appNameSlug}`;
    }
    
    // Tạo tài khoản mới
    const account = {
      id: accountId,
      name: userInfo.name || username,
      appName: appName,
      userInfo: userInfo,
      oauthConfig: oauthConfig,
      createdAt: new Date().toISOString()
    };
    
    // Thêm vào danh sách tài khoản
    if (addAccount(account)) {
      // Lưu tài khoản hiện tại
      localStorage.setItem(KEYS.CURRENT_ACCOUNT_ID, accountId);
      
      // Cập nhật localStorage với thông tin mới
      localStorage.setItem(KEYS.USER_INFO, JSON.stringify(userInfo));
      localStorage.setItem(KEYS.OAUTH_CONFIG, JSON.stringify(oauthConfig));
      
      console.log('Đã tạo tài khoản từ OAuth:', account);
      return account;
    }
    
    return null;
  } catch (error) {
    console.error('Lỗi khi tạo tài khoản từ OAuth:', error);
    return null;
  }
};

/**
 * Lấy thông tin người dùng hiện tại
 * @returns {Object|null} Thông tin người dùng hiện tại hoặc null nếu không có
 */
export const getUserInfo = () => {
  try {
    // Ưu tiên lấy từ tài khoản hiện tại
    const currentAccount = getCurrentAccount();
    if (currentAccount && currentAccount.userInfo) {
      return currentAccount.userInfo;
    }
    
    // Nếu không có tài khoản, lấy trực tiếp từ localStorage
    const userInfoData = localStorage.getItem(KEYS.USER_INFO);
    return userInfoData ? JSON.parse(userInfoData) : null;
  } catch (error) {
    console.error('Lỗi khi lấy thông tin người dùng:', error);
    return null;
  }
};

/**
 * Lấy cấu hình OAuth
 * @returns {Object|null} Cấu hình OAuth hoặc null nếu không có
 */
export const getOAuthConfig = () => {
  try {
    // Ưu tiên lấy từ tài khoản hiện tại
    const currentAccount = getCurrentAccount();
    if (currentAccount && currentAccount.oauthConfig) {
      return currentAccount.oauthConfig;
    }
    
    // Nếu không có tài khoản, lấy trực tiếp từ localStorage
    const oauthConfigData = localStorage.getItem(KEYS.OAUTH_CONFIG);
    return oauthConfigData ? JSON.parse(oauthConfigData) : null;
  } catch (error) {
    console.error('Lỗi khi lấy cấu hình OAuth:', error);
    return null;
  }
};

/**
 * Lưu cấu hình OAuth
 * @param {Object} config Cấu hình OAuth cần lưu
 * @returns {boolean} Kết quả thao tác
 */
export const setOAuthConfig = (config) => {
  if (!config) {
    console.error('Không thể lưu cấu hình OAuth: Thiếu dữ liệu cấu hình');
    return false;
  }
  
  try {
    // Lưu cấu hình vào localStorage
    localStorage.setItem(KEYS.OAUTH_CONFIG, JSON.stringify(config));
    
    // Cập nhật tài khoản hiện tại nếu có
    const currentAccountId = getCurrentAccountId();
    if (currentAccountId) {
      updateAccount(currentAccountId, { oauthConfig: config });
    }
    
    console.log('Đã lưu cấu hình OAuth');
    return true;
  } catch (error) {
    console.error('Lỗi khi lưu cấu hình OAuth:', error);
    return false;
  }
};

// Kiểm tra và chuyển đổi từ cấu trúc cũ (nếu cần)
export const migrateFromOldFormat = () => {
  try {
    console.log('Đang kiểm tra và chuyển đổi từ cấu trúc cũ...');
    
    // Kiểm tra các key cũ
    const oldKeys = {
      accounts: ['hanet_accounts_direct', 'hanet_accounts_v2', 'hanet_accounts'],
      currentAccount: ['hanet_current_account_direct', 'hanet_current_account_id_v2', 'hanet_current_account_id'],
      oauthConfig: ['hanet_oauth_config', 'hanet_current_oauth_config_key'],
      userInfo: ['user_info']
    };
    
    let migrated = false;
    
    // Chuyển đổi danh sách tài khoản
    for (const key of oldKeys.accounts) {
      const accountsData = localStorage.getItem(key);
      if (accountsData) {
        try {
          const accounts = JSON.parse(accountsData);
          if (Array.isArray(accounts) && accounts.length > 0) {
            // Không ghi đè nếu đã có dữ liệu
            if (getAccounts().length === 0) {
              saveAccounts(accounts);
              migrated = true;
              console.log(`Đã chuyển đổi tài khoản từ ${key}`);
            }
            break;
          }
        } catch (e) {
          console.error(`Lỗi khi phân tích dữ liệu từ ${key}:`, e);
        }
      }
    }
    
    // Chuyển đổi ID tài khoản hiện tại
    for (const key of oldKeys.currentAccount) {
      const currentAccountId = localStorage.getItem(key);
      if (currentAccountId) {
        if (!getCurrentAccountId()) {
          localStorage.setItem(KEYS.CURRENT_ACCOUNT_ID, currentAccountId);
          migrated = true;
          console.log(`Đã chuyển đổi ID tài khoản hiện tại từ ${key}`);
        }
        break;
      }
    }
    
    // Chuyển đổi cấu hình OAuth
    let oauthConfigKey = oldKeys.oauthConfig[0]; // Mặc định là hanet_oauth_config
    
    // Kiểm tra nếu có key cấu hình riêng cho tài khoản
    const configKeyData = localStorage.getItem(oldKeys.oauthConfig[1]);
    if (configKeyData) {
      oauthConfigKey = configKeyData;
    }
    
    // Lấy dữ liệu cấu hình OAuth
    const oauthConfigData = localStorage.getItem(oauthConfigKey);
    if (oauthConfigData) {
      try {
        const oauthConfig = JSON.parse(oauthConfigData);
        if (!getOAuthConfig()) {
          localStorage.setItem(KEYS.OAUTH_CONFIG, JSON.stringify(oauthConfig));
          migrated = true;
          console.log(`Đã chuyển đổi cấu hình OAuth từ ${oauthConfigKey}`);
        }
      } catch (e) {
        console.error('Lỗi khi phân tích cấu hình OAuth:', e);
      }
    }
    
    // Chuyển đổi thông tin người dùng
    for (const key of oldKeys.userInfo) {
      const userInfoData = localStorage.getItem(key);
      if (userInfoData) {
        try {
          const userInfo = JSON.parse(userInfoData);
          if (!getUserInfo()) {
            localStorage.setItem(KEYS.USER_INFO, userInfoData);
            migrated = true;
            console.log(`Đã chuyển đổi thông tin người dùng từ ${key}`);
          }
          break;
        } catch (e) {
          console.error(`Lỗi khi phân tích dữ liệu từ ${key}:`, e);
        }
      }
    }
    
    // Cập nhật tài khoản hiện tại với dữ liệu mới
    if (migrated) {
      const currentAccountId = getCurrentAccountId();
      if (currentAccountId) {
        const userInfo = getUserInfo();
        const oauthConfig = getOAuthConfig();
        
        if (userInfo || oauthConfig) {
          updateAccount(currentAccountId, {
            userInfo: userInfo,
            oauthConfig: oauthConfig
          });
        }
      }
    }
    
    return migrated;
  } catch (error) {
    console.error('Lỗi khi chuyển đổi từ định dạng cũ:', error);
    return false;
  }
};

export default {
  getAccounts,
  getCurrentAccount,
  getCurrentAccountId,
  switchToAccount,
  addAccount,
  updateAccount,
  deleteAccount,
  createAccountFromOAuth,
  createManualAccount,
  getOAuthConfig,
  setOAuthConfig,
  migrateFromOldFormat
}; 