const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');

const iconSizes = [72, 96, 128, 144, 152, 192, 384, 512];
const iconsDir = path.join(__dirname, 'icons');

async function convertIcons() {
    console.log('Starting SVG to PNG conversion...');

    for (const size of iconSizes) {
        const svgPath = path.join(iconsDir, `icon-${size}x${size}.svg`);
        const pngPath = path.join(iconsDir, `icon-${size}x${size}.png`);

        try {
            const svgBuffer = await fs.readFile(svgPath);

            await sharp(svgBuffer)
                .resize(size, size)
                .png()
                .toFile(pngPath);

            console.log(`Successfully converted ${svgPath} to ${pngPath}`);
        } catch (error) {
            console.error(`Error converting icon for size ${size}:`, error);
        }
    }

    console.log('Icon conversion finished.');
}

convertIcons();
