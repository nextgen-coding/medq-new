declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (config: any) => void;
          prompt: (callback: (notification: any) => void) => void;
        };
      };
    };
  }
}

export {}; 