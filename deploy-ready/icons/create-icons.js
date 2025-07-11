// Simple script to create placeholder icons using canvas
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

function createIcon(size) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    
    // Background
    ctx.fillStyle = '#007AFF';
    ctx.fillRect(0, 0, size, size);
    
    // Clock circle
    ctx.strokeStyle = 'white';
    ctx.lineWidth = size * 0.04;
    ctx.beginPath();
    ctx.arc(size * 0.5, size * 0.4, size * 0.25, 0, 2 * Math.PI);
    ctx.stroke();
    
    // Clock hands
    ctx.lineCap = 'round';
    ctx.lineWidth = size * 0.03;
    
    // Hour hand
    ctx.beginPath();
    ctx.moveTo(size * 0.5, size * 0.4);
    ctx.lineTo(size * 0.5, size * 0.25);
    ctx.stroke();
    
    // Minute hand
    ctx.beginPath();
    ctx.moveTo(size * 0.5, size * 0.4);
    ctx.lineTo(size * 0.6, size * 0.3);
    ctx.stroke();
    
    // Bell base
    ctx.strokeStyle = 'white';
    ctx.lineWidth = size * 0.03;
    ctx.beginPath();
    ctx.arc(size * 0.5, size * 0.7, size * 0.15, Math.PI, 0);
    ctx.stroke();
    
    // Bell top
    ctx.beginPath();
    ctx.moveTo(size * 0.35, size * 0.7);
    ctx.lineTo(size * 0.35, size * 0.65);
    ctx.moveTo(size * 0.65, size * 0.7);
    ctx.lineTo(size * 0.65, size * 0.65);
    ctx.stroke();
    
    return canvas.toDataURL('image/png');
}

// Create icons and save as data URLs
sizes.forEach(size => {
    const dataUrl = createIcon(size);
    console.log(`Icon ${size}x${size} created:`, dataUrl.substring(0, 50) + '...');
});