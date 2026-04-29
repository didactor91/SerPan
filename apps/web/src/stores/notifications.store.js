import { create } from 'zustand';
export const useNotificationsStore = create((set) => ({
    notifications: [],
    add: (notification) => {
        const id = crypto.randomUUID();
        const newNotification = { ...notification, id };
        set((state) => ({
            notifications: [...state.notifications, newNotification],
        }));
        // Auto-remove after duration (default 5s)
        const duration = notification.duration ?? 5000;
        if (duration > 0) {
            setTimeout(() => {
                set((state) => ({
                    notifications: state.notifications.filter((n) => n.id !== id),
                }));
            }, duration);
        }
    },
    remove: (id) => {
        set((state) => ({
            notifications: state.notifications.filter((n) => n.id !== id),
        }));
    },
}));
