// Các khóa localStorage
const ACCOUNTS_KEY = 'hanet_accounts';
const CURRENT_ACCOUNT_KEY = 'hanet_current_account_id';
const USER_INFO_KEY = 'user_info'; 
const CONFIG_KEY = 'hanet_oauth_config';

// Lấy danh sách tài khoản
export const getAccounts = () => {
  try {
    const accounts = localStorage.getItem(ACCOUNTS_KEY);
    console.log('Raw accounts data:', accounts);
    return accounts ? JSON.parse(accounts) : [];
  } catch (error) {
    console.error('Lỗi khi lấy danh sách tài khoản:', error);
    return [];
  }
};

// Lấy ID tài khoản hiện tại
export const getCurrentAccountId = () => {
  const id = localStorage.getItem(CURRENT_ACCOUNT_KEY);
  console.log('Current account ID:', id);
  return id;
};

// Lấy thông tin tài khoản hiện tại
export const getCurrentAccount = () => {
  const accountId = getCurrentAccountId();
  if (!accountId) {
    console.log('Không có tài khoản hiện tại');
    return null;
  }
  
  const accounts = getAccounts();
  const account = accounts.find(acc => acc.id === accountId);
  console.log('Current account data:', account);
  return account || null;
};

// Lưu tài khoản mới
export const saveAccount = (userInfo, oauthConfig) => {
  if (!userInfo || !userInfo.username) {
    console.error('Không thể lưu tài khoản thiếu thông tin');
    return false;
  }
  
  console.log('Saving account with userInfo:', userInfo);
  
  const accountId = userInfo.username;
  const accounts = getAccounts();
  
  // Kiểm tra xem tài khoản đã tồn tại chưa
  const existingIndex = accounts.findIndex(acc => acc.id === accountId);
  
  const accountData = {
    id: accountId,
    name: userInfo.name || userInfo.username,
    email: userInfo.email,
    config: oauthConfig,
    userInfo: userInfo,
    lastUpdated: new Date().toISOString()
  };
  
  if (existingIndex >= 0) {
    // Cập nhật tài khoản hiện có
    accounts[existingIndex] = accountData;
    console.log('Đã cập nhật tài khoản:', accountData);
  } else {
    // Thêm tài khoản mới
    accounts.push(accountData);
    console.log('Đã thêm tài khoản mới:', accountData);
  }
  
  try {
    // Lưu danh sách tài khoản
    const accountsJSON = JSON.stringify(accounts);
    console.log('Saving accounts to localStorage:', accountsJSON);
    localStorage.setItem(ACCOUNTS_KEY, accountsJSON);
    
    // Đặt làm tài khoản hiện tại
    const success = setCurrentAccount(accountId);
    return success;
  } catch (error) {
    console.error('Lỗi khi lưu danh sách tài khoản:', error);
    return false;
  }
};

// Đặt tài khoản hiện tại
export const setCurrentAccount = (accountId) => {
  const accounts = getAccounts();
  const account = accounts.find(acc => acc.id === accountId);
  
  if (!account) {
    console.error('Không tìm thấy tài khoản:', accountId);
    return false;
  }
  
  try {
    // Lưu ID tài khoản hiện tại
    localStorage.setItem(CURRENT_ACCOUNT_KEY, accountId);
    
    // Cập nhật thông tin user_info và cấu hình OAuth hiện tại
    localStorage.setItem(USER_INFO_KEY, JSON.stringify(account.userInfo));
    localStorage.setItem(CONFIG_KEY, JSON.stringify(account.config));
    
    console.log('Đã chuyển sang tài khoản:', account.name);
    return true;
  } catch (error) {
    console.error('Lỗi khi đặt tài khoản hiện tại:', error);
    return false;
  }
};

// Xóa tài khoản
export const deleteAccount = (accountId) => {
  let accounts = getAccounts();
  const initialLength = accounts.length;
  
  accounts = accounts.filter(acc => acc.id !== accountId);
  
  if (accounts.length === initialLength) {
    console.error('Không tìm thấy tài khoản để xóa:', accountId);
    return false;
  }
  
  try {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
    
    // Nếu xóa tài khoản hiện tại, chuyển sang tài khoản đầu tiên (nếu có)
    const currentId = getCurrentAccountId();
    if (currentId === accountId) {
      if (accounts.length > 0) {
        setCurrentAccount(accounts[0].id);
      } else {
        // Xóa thông tin hiện tại nếu không còn tài khoản nào
        localStorage.removeItem(CURRENT_ACCOUNT_KEY);
        localStorage.removeItem(USER_INFO_KEY);
        localStorage.removeItem(CONFIG_KEY);
      }
    }
    
    return true;
  } catch (error) {
    console.error('Lỗi khi xóa tài khoản:', error);
    return false;
  }
}; 