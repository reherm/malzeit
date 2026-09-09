import sharp from 'sharp';
for (const size of [180, 192, 512])
  await sharp('public/icon.svg')
    .resize(size, size)
    .png()
    .toFile(
      size === 180 ? 'public/apple-touch-icon.png' : `public/icon-${size}.png`,
    );
await sharp('public/timer-badge.svg')
  .resize(96, 96)
  .png()
  .toFile('public/timer-badge.png');
