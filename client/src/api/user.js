import api from './axios';
export const getPublicServices = () => api.get('/services').then(r => r.data);
export const getPublicWorkers = () => api.get('/workers').then(r => r.data);
export const getSlots = (params) => api.get('/slots', { params }).then(r => r.data);
export const getAvailableDays = (params) => api.get('/available-days', { params }).then(r => r.data);
export const bookAppointment = (data) => api.post('/appointments', data).then(r => r.data);
export const getMyAppointments = () => api.get('/appointments/mine').then(r => r.data);
export const cancelAppointment = (id) => api.put(`/appointments/${id}/cancel`).then(r => r.data);
export const acceptReschedule = (id) => api.put(`/appointments/${id}/accept-reschedule`).then(r => r.data);
