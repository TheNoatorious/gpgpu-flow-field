# GPGPU Flow Field

This project was built with [ThreeJS Journey](https://threejs-journey.com/) as source.

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

## Techniques

1. GPGPU
2. Flow Field

A GPGPU technique is being used to calculate the flow field animation inside the project.

## Shaders

The shader inside this project is meant for the particles. The size is handled with perspective and can be controlled in the `controls` panel.
