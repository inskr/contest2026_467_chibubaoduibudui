import device from '@system.device';
import layout from './layout.js';

export function getScreenLayout() {
  return new Promise((resolve) => {
    const fallback = () => resolve(layout.resolveLayout(null));
    try {
      device.getInfo({
        success: (info) => resolve(layout.resolveLayout(info)),
        fail: fallback,
      });
    } catch (error) {
      fallback();
    }
  });
}
