export const MAX_MESSAGE_LENGTH = 400;
export const MAX_NAME_LENGTH = 32;
export const MOODS = Object.freeze(['hope', 'memory', 'secret', 'wish']);

export function validateBottle(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { error: 'Please write a letter first.' };
  }
  if (typeof input.message !== 'string') return { error: 'Your letter must contain text.' };
  const message = input.message.trim();
  if (message.length < 2 || message.length > MAX_MESSAGE_LENGTH) {
    return { error: `Write between 2 and ${MAX_MESSAGE_LENGTH} characters.` };
  }
  const name = typeof input.author_name === 'string' ? input.author_name.trim() : '';
  if (name.length > MAX_NAME_LENGTH) return { error: 'Keep your signature under 33 characters.' };
  const mood = typeof input.mood === 'string' ? input.mood : 'hope';
  if (!MOODS.includes(mood)) return { error: 'Please choose a valid message type.' };
  return { value: { message, author_name: name || 'A stranger', mood } };
}

export function validateEdit(input) {
  const checked = validateBottle({message: input?.message, author_name:'A stranger', mood:'hope'});
  return checked.error ? checked : {value:{message:checked.value.message}};
}

export function positionForNewBottle(input = {}) {
  return {
    start_x: Number.isFinite(input.start_x) ? Math.max(-17, Math.min(17, Math.round(input.start_x * 100) / 100)) : Math.round((Math.random() * 18 - 9) * 100) / 100,
    start_z: Number.isFinite(input.start_z) ? Math.max(-30, Math.min(1, Math.round(input.start_z * 100) / 100)) : Math.round((-5 - Math.random() * 20) * 100) / 100,
    drift_seed: Math.random() * 30 + 1,
  };
}
