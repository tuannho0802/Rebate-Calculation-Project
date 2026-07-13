import { ApiResponse, Notification, NotificationType } from '@/types';
import { apiClient } from './client';

export interface NotificationQueryParams {
  isRead?: boolean;
  type?: NotificationType;
  page?: number;
  limit?: number;
}

export interface SendNotificationDto {
  recipientId: string;
  title: string;
  body: string;
  type?: NotificationType;
  metadata?: Record<string, unknown>;
}

export const notificationApi = {
  getMyNotifications: async (
    params?: NotificationQueryParams
  ): Promise<ApiResponse<Notification[]>> => {
    const response = await apiClient.get<ApiResponse<Notification[]>>('/notifications', {
      params,
    });
    return response.data;
  },

  sendNotification: async (
    dto: SendNotificationDto
  ): Promise<ApiResponse<Notification>> => {
    const response = await apiClient.post<ApiResponse<Notification>>('/notifications/send', dto);
    return response.data;
  },

  markAsRead: async (id: string): Promise<ApiResponse<Notification>> => {
    const response = await apiClient.patch<ApiResponse<Notification>>(`/notifications/${id}/read`);
    return response.data;
  },

  markAllAsRead: async (): Promise<ApiResponse<{ updated: number }>> => {
    const response = await apiClient.patch<ApiResponse<{ updated: number }>>('/notifications/read-all');
    return response.data;
  },

  removeNotification: async (id: string): Promise<ApiResponse<{ message: string }>> => {
    const response = await apiClient.delete<ApiResponse<{ message: string }>>(`/notifications/${id}`);
    return response.data;
  },
};
