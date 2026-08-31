// High-accuracy GPS helper. Returns { lat, lng, accuracy } or rejects.
export function getAccurateLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("Geolokasi tidak didukung perangkat ini"));
    let best = null;
    let watchId = null;
    const opts = { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 };

    const finish = () => {
      if (watchId != null) navigator.geolocation.clearWatch(watchId);
      if (best) resolve({ lat: best.coords.latitude, lng: best.coords.longitude, accuracy: best.coords.accuracy });
      else reject(new Error("Gagal mendapatkan lokasi"));
    };

    // Watch briefly to let the GPS fix converge to a smaller accuracy radius.
    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (!best || pos.coords.accuracy < best.coords.accuracy) best = pos;
        if (pos.coords.accuracy <= 20) finish(); // good enough
      },
      (err) => {
        if (!best) reject(err);
      },
      opts
    );

    // Stop after 12s and use the best fix so far.
    setTimeout(finish, 12000);
  });
}
