/**
 * Dynamically loads the Google Maps JavaScript API using the Vite env variable.
 * This avoids hardcoding the API key in index.html.
 *
 * Call once on app startup (e.g. from main.tsx).
 */
let _promise: Promise<void> | null = null;

export function loadGoogleMaps(): Promise<void> {
  // Return the same promise if already loading / loaded
  if (_promise) return _promise;

  _promise = new Promise<void>((resolve, reject) => {
    const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

    if (!key) {
      console.warn(
        '[loadGoogleMaps] VITE_GOOGLE_MAPS_API_KEY is not set — Google Maps will not be loaded.',
      );
      resolve();
      return;
    }

    // If the script is already present (e.g. HMR reload), skip
    if (document.querySelector('script[src*="maps.googleapis.com/maps/api"]')) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Maps API'));
    document.head.appendChild(script);
  });

  return _promise;
}
