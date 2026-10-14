import apiClient from './client';

/**
 * Методы API для аналитики (Amplitude).
 */
export const analyticsApi = {
  // Отправка события
  track: (eventType, eventProperties) =>
    apiClient
      .post('/analytics/track', {
        event_type: eventType,
        event_properties: eventProperties || {},
      })
      .then((r) => r.data),
};