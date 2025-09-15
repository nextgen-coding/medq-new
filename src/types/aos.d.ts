declare module 'aos' {
  interface AOSInitOptions {
    offset?: number;
    delay?: number;
    duration?: number;
    easing?: string;
    once?: boolean;
    mirror?: boolean;
    anchorPlacement?: string;
    startEvent?: string;
    disable?: boolean | 'phone' | 'tablet' | 'mobile';
  }
  interface AOS {
    init(options?: AOSInitOptions): void;
    refresh(): void;
    refreshHard(): void;
  }
  const AOS: AOS;
  export default AOS;
}
