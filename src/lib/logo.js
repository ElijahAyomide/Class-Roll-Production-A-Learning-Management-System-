import { supabase } from './supabaseClient';

const BUCKET = 'school-logos';
const MAX_INPUT_BYTES = 5 * 1024 * 1024; // refuse huge originals before resizing
const ALLOWED = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_SIDE = 256;                    // a logo never needs to be bigger

// Shrinks the chosen picture to at most 256px and turns it into a PNG.
// A 4MB phone photo becomes a file of a few KB, so pages stay fast.
export async function prepareLogo(file) {
  if (!ALLOWED.includes(file.type)) throw new Error('Please choose a PNG, JPG or WebP image.');
  if (file.size > MAX_INPUT_BYTES) throw new Error('That image is too large. Please choose one under 5 MB.');

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('That file could not be read as an image.'));
      i.src = url;
    });
    const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
    if (!blob) throw new Error('Could not process that image.');
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Uploads into this school's own folder. A fresh file name each time means
// browsers never show a stale cached logo after it is changed.
export async function uploadLogo(schoolId, blob) {
  const path = `${schoolId}/logo-${Date.now()}.png`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: 'image/png',
    cacheControl: '31536000',
  });
  if (error) throw new Error('Could not upload the logo. ' + error.message);
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

// Tidies up: deletes every file in the school's folder except the one now in
// use (pass null to delete them all). Failure here is harmless, so it never throws.
export async function removeOldLogos(schoolId, keepUrl) {
  try {
    const { data } = await supabase.storage.from(BUCKET).list(schoolId);
    const stale = (data || [])
      .map(f => f.name)
      .filter(name => !keepUrl || !keepUrl.endsWith('/' + name))
      .map(name => `${schoolId}/${name}`);
    if (stale.length) await supabase.storage.from(BUCKET).remove(stale);
  } catch { /* ignore */ }
}
