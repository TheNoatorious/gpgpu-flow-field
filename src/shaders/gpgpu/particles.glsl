uniform float uTime; 

#include ../includes/simplexNoise4d.glsl

void main() {
    float time = uTime * 0.2;
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec4 particle = texture(uParticles, uv); // 3D position as rgb colours

	// Particle flow field direction
    // A SimplexNoise for each vertex
    vec3 flowField = vec3(
		simplexNoise4d(vec4(particle.xyz + 0.0, time)),
		simplexNoise4d(vec4(particle.xyz + 1.0, time)),
		simplexNoise4d(vec4(particle.xyz + 2.0, time))
    ); 

    flowField = normalize(flowField); // Normalize the direction
    particle.xyz += flowField * 0.01; // Add the direction to the particles

    
    gl_FragColor = particle;
}