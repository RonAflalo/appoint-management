import api from './axios';
export const getWorkerAppointments = (params) => api.get('/worker/appointments', { params }).then(r => r.data);
export const updateWorkerAppointmentStatus = (id, status) => api.put(`/worker/appointments/${id}/status`, { status }).then(r => r.data);
export const approveAppointment = (id) => api.put(`/worker/appointments/${id}/approve`).then(r => r.data);
export const cancelAppointmentByWorker = (id) => api.put(`/worker/appointments/${id}/cancel`).then(r => r.data);
export const requestReschedule = (id, data) => api.put(`/worker/appointments/${id}/reschedule-request`, data).then(r => r.data);
export const getAvailability = () => api.get('/worker/availability').then(r => r.data);
export const setAvailability = (data) => api.post('/worker/availability', data).then(r => r.data);
export const getWorkerApptPhotos = (id) => api.get(`/worker/appointments/${id}/photos`).then(r => r.data);
export const addWorkerApptPhoto = (apptId, file) => {
  const form = new FormData();
  form.append('image', file);
  return api.post(`/worker/appointments/${apptId}/photos`, form, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data);
};
export const deleteWorkerApptPhoto = (apptId, photoId) => api.delete(`/worker/appointments/${apptId}/photos/${photoId}`).then(r => r.data);
