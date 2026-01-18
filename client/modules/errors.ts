/**
 * Error Handling Module
 * Centralized error types, logging, and user-facing error display.
 */

/**
 * Base error class for OpenSpatial errors.
 */
export class OpenSpatialError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly recoverable: boolean = true
  ) {
    super(message);
    this.name = 'OpenSpatialError';
  }
}

/**
 * Error thrown when media access fails.
 */
export class MediaAccessError extends OpenSpatialError {
  constructor(message: string, public readonly mediaType: 'camera' | 'microphone' | 'screen') {
    super(message, 'MEDIA_ACCESS_ERROR', true);
    this.name = 'MediaAccessError';
  }

  /**
   * Create from a DOMException.
   */
  static fromDOMException(err: DOMException, mediaType: 'camera' | 'microphone' | 'screen' = 'camera'): MediaAccessError {
    let message: string;

    switch (err.name) {
      case 'NotAllowedError':
        message = `${mediaType === 'screen' ? 'Screen sharing' : 'Camera/microphone'} access was denied. Please grant permission and try again.`;
        break;
      case 'NotFoundError':
        message = `No ${mediaType} found on this device.`;
        break;
      case 'NotReadableError':
        message = `${mediaType === 'screen' ? 'Screen' : 'Camera/microphone'} is already in use by another application.`;
        break;
      case 'OverconstrainedError':
        message = `Unable to access ${mediaType} with the requested constraints.`;
        break;
      default:
        message = `${mediaType === 'screen' ? 'Screen sharing' : 'Camera/microphone'} error: ${err.name}`;
    }

    return new MediaAccessError(message, mediaType);
  }
}

/**
 * Error thrown when connection fails.
 */
export class ConnectionError extends OpenSpatialError {
  constructor(message: string, public readonly reason?: string) {
    super(message, 'CONNECTION_ERROR', true);
    this.name = 'ConnectionError';
  }
}

/**
 * Error thrown when a space is not found.
 */
export class SpaceNotFoundError extends OpenSpatialError {
  constructor(public readonly spaceId: string) {
    super(`Space "${spaceId}" doesn't exist. An admin needs to create it first.`, 'SPACE_NOT_FOUND', false);
    this.name = 'SpaceNotFoundError';
  }
}

/**
 * Error thrown for WebRTC-related failures.
 */
export class WebRTCError extends OpenSpatialError {
  constructor(message: string, public readonly peerId?: string) {
    super(message, 'WEBRTC_ERROR', true);
    this.name = 'WebRTCError';
  }
}

/**
 * Centralized error logger.
 */
export function logError(error: Error, context?: string): void {
  const prefix = context ? `[${context}]` : '';
  
  if (error instanceof OpenSpatialError) {
    console.error(`${prefix} [${error.code}] ${error.message}`);
  } else {
    console.error(`${prefix} ${error.name}: ${error.message}`);
  }

  // Log stack trace in development (when not in production)
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    console.error(error);
  }
}

/**
 * Display an error message to the user in the specified container.
 */
export function displayError(container: HTMLElement, message: string): void {
  container.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="12" y1="8" x2="12" y2="12"></line>
      <line x1="12" y1="16" x2="12.01" y2="16"></line>
    </svg>
    <span>${message}</span>
  `;
  container.classList.remove('hidden');
}

/**
 * Hide an error container.
 */
export function hideError(container: HTMLElement): void {
  container.classList.add('hidden');
  container.innerHTML = '';
}

/**
 * Get a user-friendly error message from any error.
 */
export function getUserMessage(error: unknown): string {
  if (error instanceof OpenSpatialError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unexpected error occurred.';
}
