const radians = degrees => degrees * Math.PI / 180;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const modulo = (value, divisor) => ((value % divisor) + divisor) % divisor;

function directionFor(elevation, azimuth) {
  const horizontal = Math.cos(elevation);
  return {
    x: horizontal * Math.sin(azimuth),
    y: Math.sin(elevation),
    z: -horizontal * Math.cos(azimuth),
  };
}

export function calculateSolarPosition(date, latitude, longitude) {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) {
    throw new TypeError('date must be a valid Date');
  }
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90
      || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new RangeError('latitude and longitude must be valid geographic coordinates');
  }

  const yearStart = Date.UTC(date.getUTCFullYear(), 0, 1);
  const dayOfYear = Math.floor((Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - yearStart) / 86400000) + 1;
  const utcHour = date.getUTCHours() + date.getUTCMinutes() / 60
    + date.getUTCSeconds() / 3600 + date.getUTCMilliseconds() / 3600000;
  const gamma = 2 * Math.PI / 365 * (dayOfYear - 1 + (utcHour - 12) / 24);
  const eqtime = 229.18 * (0.000075 + 0.001868 * Math.cos(gamma)
    - 0.032077 * Math.sin(gamma) - 0.014615 * Math.cos(2 * gamma)
    - 0.040849 * Math.sin(2 * gamma));
  const declination = 0.006918 - 0.399912 * Math.cos(gamma)
    + 0.070257 * Math.sin(gamma) - 0.006758 * Math.cos(2 * gamma)
    + 0.000907 * Math.sin(2 * gamma) - 0.002697 * Math.cos(3 * gamma)
    + 0.00148 * Math.sin(3 * gamma);
  const utcMinutes = utcHour * 60;
  const trueSolarMinutes = modulo(utcMinutes + eqtime + 4 * longitude, 1440);
  const hourAngle = radians(trueSolarMinutes / 4 - 180);
  const latitudeRadians = radians(latitude);
  const sinElevation = Math.sin(latitudeRadians) * Math.sin(declination)
    + Math.cos(latitudeRadians) * Math.cos(declination) * Math.cos(hourAngle);
  const elevation = Math.asin(clamp(sinElevation, -1, 1));
  const azimuth = Math.atan2(
    Math.sin(hourAngle),
    Math.cos(hourAngle) * Math.sin(latitudeRadians)
      - Math.tan(declination) * Math.cos(latitudeRadians),
  ) + Math.PI;

  return { elevation, azimuth, direction: directionFor(elevation, azimuth) };
}

export function localClockApproximation(date = new Date()) {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) {
    throw new TypeError('date must be a valid Date');
  }
  const localHour = date.getHours() + date.getMinutes() / 60
    + date.getSeconds() / 3600 + date.getMilliseconds() / 3600000;
  const dayPhase = (localHour - 6) / 12 * Math.PI;
  const elevation = radians(45) * Math.sin(dayPhase);
  const azimuth = localHour * Math.PI / 12;
  return { elevation, azimuth, direction: directionFor(elevation, azimuth) };
}
