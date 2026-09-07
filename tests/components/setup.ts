import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

type MediaQueryListener = (event: MediaQueryListEvent) => void

const mediaQueryListeners = new Set<MediaQueryListener>()

export function setDesktopViewport(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query: string): MediaQueryList => ({
      matches,
      media: query,
      onchange: null,
      addListener: (listener: MediaQueryListener) => mediaQueryListeners.add(listener),
      removeListener: (listener: MediaQueryListener) => mediaQueryListeners.delete(listener),
      addEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
        mediaQueryListeners.add(listener as MediaQueryListener)
      },
      removeEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
        mediaQueryListeners.delete(listener as MediaQueryListener)
      },
      dispatchEvent: () => true,
    })),
  })
}

setDesktopViewport(false)

Object.defineProperty(window, 'requestAnimationFrame', {
  configurable: true,
  writable: true,
  value: (callback: FrameRequestCallback) => {
    callback(0)
    return 1
  },
})

afterEach(() => {
  cleanup()
  document.body.style.overflow = ''
  mediaQueryListeners.clear()
  setDesktopViewport(false)
})
