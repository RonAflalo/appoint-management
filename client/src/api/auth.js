import api from './axios';
export const register = (data) => api.post('/auth/register', data).then(r => r.data);
export const login = (data) => api.post('/auth/login', data).then(r => r.data);
export const logout = () => api.post('/auth/logout').then(r => r.data);
export const getMe = () => api.get('/auth/me').then(r => r.data);
export const forgotPassword = (email) => api.post('/auth/forgot-password', { email }).then(r => r.data);
export const resetPassword = (token, password) => api.post(`/auth/reset-password/${token}`, { password }).then(r => r.data);
export const verifyEmail = (token) => api.get(`/auth/verify-email/${token}`).then(r => r.data);
export const resendVerification = () => api.post('/auth/resend-verification').then(r => r.data);
