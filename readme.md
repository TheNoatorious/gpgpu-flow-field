# GPGPU Flow Field

This project was built with [Chartogne Tailler](https://chartogne-taillet.com/en) by Bruno Simon as inspiration to explorer the techniques that have been used on that website.

## Techniques

1. GPGPU
2. Flow Field

The GPGPU (General-Purpose computing on Graphics Processing Units) is a way of using the GPU to process data instead of rendering pixels. The GPGPU technique in this case is used to handle the coordinates and animation direction of the particles within the flow field. By storing the coordinates of each particle inside a Frame Buffer Object (FBO) texture, the GPU can retrieve and render this data on each frame.

## Shaders

The shader inside this project is meant for the particles. The size of the particles is handled with the perspective and can be controlled in the `controls` panel.

## Setup

Download [Node.js](https://nodejs.org/en/download/).
Run this followed commands:

```bash
# Install dependencies (only the first time)
npm install

# Run the local server at localhost:8080
npm run dev

# Build for production in the dist/ directory
npm run build
```
