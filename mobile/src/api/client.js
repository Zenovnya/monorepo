import axios from 'axios';

/**
 * Настроенный axios-клиент для обращения к backend API.
 * Базовый URL можно переопределить через переменную окружения
 * EXPO_PUBLIC_API_URL или константу ниже.
 */
const apiClient = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default apiClient;