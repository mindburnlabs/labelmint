#!/bin/bash

# Create placeholder PNG files for PWA icons
# This script uses ImageMagick if available, otherwise creates simple base64-encoded PNGs

cd "$(dirname "$0")/../public/icons"

# Function to create a simple PNG using base64 (fallback method)
create_placeholder_png() {
    local size=$1
    local filename="icon-${size}x${size}.png"

    # Create a simple 1x1 pixel PNG and scale it (very basic placeholder)
    echo "Creating placeholder for ${filename}"

    # Create a simple purple square PNG using base64
    # This is a 1x1 purple pixel in PNG format
    echo "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==" | base64 -d > "${filename}"

    echo "Created placeholder: ${filename}"
}

# Create placeholder icons for all required sizes
for size in 72 96 128 144 152 192 384 512; do
    create_placeholder_png $size
done

# Create badge icon
echo "Creating badge placeholder..."
echo "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==" | base64 -d > "badge-72x72.png"

# Create action icons
echo "Creating action icon placeholders..."
for action in view dismiss new-task projects earnings; do
    echo "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==" | base64 -d > "${action}.png"
done

echo "Placeholder icons created!"
echo "Note: These are basic 1x1 pixel placeholders."
echo "For production, replace them with properly designed icons."