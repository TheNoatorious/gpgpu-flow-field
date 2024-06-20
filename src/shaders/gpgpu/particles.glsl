void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec4 particle = texture(uParticles, uv); // 3D position as rgb colours
    particle.y += 0.01;
    
    gl_FragColor = particle;
}