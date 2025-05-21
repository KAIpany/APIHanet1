import React, { useState, useEffect, useCallback } from "react";
import { BrowserRouter, Routes, Route, Link, Navigate } from "react-router-dom";
import OAuthConfig from "./OAuthConfig";
import OAuthCallback from "./OAuthCallback";
import "./App.css";

const CheckInApp = () => {
  const [formData, setFormData] = useState({
    placeId: "",
    deviceId: "",
    fromDateTime: "",
    toDateTime: "",
  });
  const [places, setPlaces] = useState([]);
  const [devices, setDevices] = useState([]);
  const [isPlacesLoading, setIsPlacesLoading] = useState(false);
  const [isDevicesLoading, setIsDevicesLoading] = useState(false);
  const [placeError, setPlaceError] = useState(null);
  const [deviceError, setDeviceError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [resultsData, setResultsData] = useState(null);
  const [queryString, setQueryString] = useState(null);
  const [authStatus, setAuthStatus] = useState({
    isAuthenticated: false,
    appName: '',
    loading: true
  });

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/oauth/status`);
      const result = await response.json();
      
      setAuthStatus({
        isAuthenticated: result.data?.status === 'authenticated',
        appName: 'Anycross',
        loading: false
      });
    } catch (error) {
      console.error('Lỗi kiểm tra trạng thái xác thực:', error);
      setAuthStatus(prev => ({ ...prev, loading: false }));
    }
  };

  const fetchPlaces = useCallback(async () => {
    setIsPlacesLoading(true);
    setPlaceError(null);
    try {
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/place`
      );
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Lỗi ${response.status}: ${
            errorData.message || "Không thể lấy danh sách địa điểm."
          }`
        );
      }
      const result = await response.json();
      if (result.success && Array.isArray(result.data)) {
        setPlaces(result.data);
      } else {
        throw new Error("Dữ liệu địa điểm trả về không hợp lệ.");
      }
    } catch (err) {
      setPlaceError(err.message || "Lỗi khi tải địa điểm.");
      setPlaces([]);
    } finally {
      setIsPlacesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authStatus.isAuthenticated) {
      fetchPlaces();
    }
  }, [fetchPlaces, authStatus.isAuthenticated]);

  const fetchDevices = useCallback(async (selectedPlaceId) => {
    if (!selectedPlaceId) {
      setDevices([]);
      setDeviceError(null);
      return;
    }
    setIsDevicesLoading(true);
    setDeviceError(null);
    setDevices([]);
    try {
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/device?placeId=${selectedPlaceId}`
      );
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `Lỗi ${response.status}: ${
            errorData.message || "Không thể lấy danh sách thiết bị."
          }`
        );
      }
      const result = await response.json();
      if (result.success && Array.isArray(result.data)) {
        setDevices(result.data);
      } else {
        throw new Error("Dữ liệu thiết bị trả về không hợp lệ.");
      }
    } catch (err) {
      setDeviceError(err.message || "Lỗi khi tải thiết bị.");
      setDevices([]);
    } finally {
      setIsDevicesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDevices(formData.placeId);
  }, [formData.placeId, fetchDevices]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prevState) => ({
      ...prevState,
      [name]: value,
    }));
    setSubmitError(null);
    setSuccessMessage(null);
    setResultsData(null);
  };

  const handlePlaceChange = (event) => {
    const { value } = event.target;
    setFormData((prevState) => ({
      ...prevState,
      placeId: value,
      deviceId: "",
    }));
    setSubmitError(null);
    setSuccessMessage(null);
    setDeviceError(null);
    setDevices([]);
    setResultsData(null);
  };

  const getPlaceName = useCallback(
    (id) => {
      if (!id) return "Chưa chọn";
      return places.find((p) => p.id.toString() === id)?.name || `ID: ${id}`;
    },
    [places]
  );

  const getDeviceName = useCallback(
    (id) => {
      if (!id) return "Chưa chọn / Tất cả";
      return devices.find((d) => d.deviceID === id)?.deviceName || `ID: ${id}`;
    },
    [devices]
  );

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);
    setSuccessMessage(null);
    setResultsData(null);

    const params = new URLSearchParams();
    if (formData.placeId) params.append("placeId", formData.placeId);
    if (formData.deviceId) params.append("deviceId", formData.deviceId);
    try {
      if (formData.fromDateTime) {
        params.append(
          "dateFrom",
          new Date(formData.fromDateTime).getTime().toString()
        );
      } else {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        params.append("dateFrom", today.getTime().toString());
      }
      if (formData.toDateTime) {
        params.append(
          "dateTo",
          new Date(formData.toDateTime).getTime().toString()
        );
      } else {
        params.append("dateTo", new Date().getTime().toString());
      }
      if (
        formData.fromDateTime &&
        formData.toDateTime &&
        new Date(formData.fromDateTime) > new Date(formData.toDateTime)
      ) {
        throw new Error(
          "Thời gian bắt đầu không được lớn hơn thời gian kết thúc."
        );
      }
    } catch (e) {
      setSubmitError(e.message || "Định dạng ngày giờ không hợp lệ.");
      setIsSubmitting(false);
      return;
    }
    const queryString = params.toString();
    setQueryString(queryString);

    const apiUrl = `${process.env.REACT_APP_API_URL}/api/checkins?${queryString}`;
    console.log("Đang gọi API:", apiUrl);

    try {
      const response = await fetch(apiUrl);
      const result = await response.json();
      console.log(result);

      if (!response.ok) {
        throw new Error(
          `Lỗi ${response.status}: ${result.message || "Không thể lấy dữ liệu"}`
        );
      }

      if (Array.isArray(result)) {
        setResultsData(result);
        setSuccessMessage(`Tìm thấy ${result.length} kết quả.`);
      } else {
        setResultsData([]);
        setSuccessMessage(result.message || "Không tìm thấy kết quả nào.");
      }
    } catch (err) {
      console.error("Lỗi khi lấy dữ liệu:", err);
      setSubmitError(err.message || "Đã xảy ra lỗi khi truy vấn.");
      setResultsData(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const HomePage = () => (
    <div className="home-container">
      {authStatus.isAuthenticated ? (
        <div className="auth-success">
          <h2>Chào mừng bạn đã kết nối với {authStatus.appName}</h2>
          <p>Tài khoản của bạn đã được kết nối thành công.</p>
          <button onClick={() => window.location.href = '/config'} className="config-button">
            Cài đặt cấu hình
          </button>
        </div>
      ) : (
        <Navigate to="/config" replace />
      )}
    </div>
  );

  if (authStatus.loading) {
    return <div className="loading">Đang tải...</div>;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/config" element={<OAuthConfig onLoginSuccess={checkAuthStatus} />} />
        <Route path="/oauth-callback" element={<OAuthCallback onLoginSuccess={checkAuthStatus} />} />
      </Routes>
    </BrowserRouter>
  );
};

export default CheckInApp;
