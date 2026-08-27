// Car mascot keyframes for the SmartWash tunnel scene.
//
// The original build referenced photographic crops of a `car.png` that never
// shipped with the repo. To keep the landing self-contained (and on-palette
// with the rose/cherry wash theme), each keyframe is a hand-built SVG of the
// same friendly car silhouette wearing a different expression:
//
//   kf1 — happy squint  (shown while soaped up / mid-wash)
//   kf2 — resting smile  (default + rinsed)
//   kf3 — worried        (under the dryer)
//   kf4 — crowned grin   (polished & victorious)
//
// The silhouette is intentionally identical across frames so CarStage's
// bottom-up foam clip-mask lines up no matter which expression is active.

type Extras = {
  crown?: boolean;
  sweat?: boolean;
  windLines?: boolean;
  sparkle?: boolean;
};

const face = {
  smile: '<path d="M255 232 q45 34 90 0" fill="none" stroke="#7a1e2d" stroke-width="7" stroke-linecap="round"/>',
  squint:
    '<path d="M255 230 q45 26 90 0" fill="none" stroke="#7a1e2d" stroke-width="7" stroke-linecap="round"/>',
  worried:
    '<path d="M258 236 q22 -18 42 0 q22 18 42 0" fill="none" stroke="#7a1e2d" stroke-width="6.5" stroke-linecap="round"/>',
  grin: '<path d="M250 228 q50 46 100 0 z" fill="#ffffff" stroke="#7a1e2d" stroke-width="6" stroke-linejoin="round"/>',
};

const eyes = {
  open:
    '<circle cx="262" cy="196" r="14" fill="#ffffff" stroke="#7a1e2d" stroke-width="4"/>' +
    '<circle cx="338" cy="196" r="14" fill="#ffffff" stroke="#7a1e2d" stroke-width="4"/>' +
    '<circle cx="265" cy="199" r="6" fill="#3a1620"/>' +
    '<circle cx="341" cy="199" r="6" fill="#3a1620"/>',
  squint:
    '<path d="M250 198 q12 -12 24 0" fill="none" stroke="#7a1e2d" stroke-width="5" stroke-linecap="round"/>' +
    '<path d="M326 198 q12 -12 24 0" fill="none" stroke="#7a1e2d" stroke-width="5" stroke-linecap="round"/>',
  wide:
    '<circle cx="262" cy="196" r="17" fill="#ffffff" stroke="#7a1e2d" stroke-width="4"/>' +
    '<circle cx="338" cy="196" r="17" fill="#ffffff" stroke="#7a1e2d" stroke-width="4"/>' +
    '<circle cx="262" cy="197" r="6" fill="#3a1620"/>' +
    '<circle cx="338" cy="197" r="6" fill="#3a1620"/>',
  star:
    '<path d="M262 184 l4 9 10 1 -7 7 2 10 -9 -5 -9 5 2 -10 -7 -7 10 -1z" fill="#ffd34d" stroke="#c98a12" stroke-width="1.5"/>' +
    '<path d="M338 184 l4 9 10 1 -7 7 2 10 -9 -5 -9 5 2 -10 -7 -7 10 -1z" fill="#ffd34d" stroke="#c98a12" stroke-width="1.5"/>',
};

function buildCar(eyeSet: string, mouth: string, bodyColor: string, extras: Extras = {}): string {
  const crown = extras.crown
    ? '<path d="M244 96 l22 26 34 -34 34 34 22 -26 -10 54 h-92z" fill="#ffd34d" stroke="#c98a12" stroke-width="3" stroke-linejoin="round"/>' +
      '<circle cx="266" cy="118" r="5" fill="#e8546b"/><circle cx="334" cy="118" r="5" fill="#e8546b"/>'
    : '';
  const sweat = extras.sweat
    ? '<path d="M372 176 q10 16 0 26 q-10 -10 0 -26z" fill="#7fd0ff" stroke="#4aa8e0" stroke-width="2"/>'
    : '';
  const wind = extras.windLines
    ? '<g stroke="#c98aa0" stroke-width="5" stroke-linecap="round" opacity="0.7">' +
      '<path d="M40 150 h70"/><path d="M20 190 h95"/><path d="M46 230 h64"/></g>'
    : '';
  const sparkle = extras.sparkle
    ? '<g fill="#fff5c2"><path d="M470 120 l6 14 14 6 -14 6 -6 14 -6 -14 -14 -6 14 -6z"/>' +
      '<path d="M120 300 l4 10 10 4 -10 4 -4 10 -4 -10 -10 -4 10 -4z"/></g>'
    : '';

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400" width="600" height="400">` +
    wind +
    // floor contact shadow
    `<ellipse cx="300" cy="356" rx="210" ry="20" fill="#7a1e2d" opacity="0.14"/>` +
    crown +
    // car body
    `<path d="M110 300 q4 -70 46 -96 q30 -60 60 -70 q84 -20 168 0 q30 10 60 70 q42 26 46 96 q2 30 -30 32 h-320 q-32 -2 -30 -32z" ` +
    `fill="${bodyColor}" stroke="#7a1e2d" stroke-width="6" stroke-linejoin="round"/>` +
    // roof highlight
    `<path d="M170 152 q60 -46 130 -46 q70 0 130 46 q-40 -18 -130 -18 q-90 0 -130 18z" fill="#ffffff" opacity="0.35"/>` +
    // windshield "face" panel
    `<path d="M200 150 q100 -30 200 0 l-24 78 q-76 -16 -152 0z" fill="#dff0ff" stroke="#7a1e2d" stroke-width="5"/>` +
    eyeSet +
    mouth +
    sweat +
    // headlights
    `<ellipse cx="152" cy="270" rx="20" ry="15" fill="#fff2a8" stroke="#7a1e2d" stroke-width="4"/>` +
    `<ellipse cx="448" cy="270" rx="20" ry="15" fill="#fff2a8" stroke="#7a1e2d" stroke-width="4"/>` +
    // wheels
    `<circle cx="196" cy="330" r="42" fill="#2b2230" stroke="#7a1e2d" stroke-width="5"/>` +
    `<circle cx="196" cy="330" r="18" fill="#c9c2cf"/>` +
    `<circle cx="404" cy="330" r="42" fill="#2b2230" stroke="#7a1e2d" stroke-width="5"/>` +
    `<circle cx="404" cy="330" r="18" fill="#c9c2cf"/>` +
    sparkle +
    `</svg>`;

  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export const kf1 = buildCar(eyes.squint, face.squint, '#ef6178'); // soaped up, happy squint
export const kf2 = buildCar(eyes.open, face.smile, '#e8546b'); // resting smile
export const kf3 = buildCar(eyes.wide, face.worried, '#e8546b', { sweat: true, windLines: true }); // dryer worry
export const kf4 = buildCar(eyes.star, face.grin, '#f0607a', { crown: true, sparkle: true }); // crowned champion
