uniform float uTime; 
uniform float uDeltaTime; 
uniform sampler2D uBase; 
uniform float uFlowFieldInfluence;

#include ../includes/simplexNoise4d.glsl

void main() {
    float time = uTime * 0.2;
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec4 particle = texture(uParticles, uv); // 3D position as rgb colours
    vec4 base = texture(uBase, uv); // Retrieve the initial position of the particle

    // Life cycle: End
    if(particle.a >= 1.0) {
        particle.a = mod(particle.a, 1.0); // Updating the alpha to 0.0
        particle.xyz = base.xyz; // Set back to initial position
    } else { // Life cycle: Alive

        // Strength flow field
        float strength = simplexNoise4d(vec4(base.xyz * 0.2, time + 1.0));
        float influence = (uFlowFieldInfluence - 0.5) * (- 2.0); // Remapping to
        strength = smoothstep(influence, 1.0, strength);

        // Particle flow field direction
        // A SimplexNoise for each vertex
        vec3 flowField = vec3(
            simplexNoise4d(vec4(particle.xyz + 0.0, time)),
            simplexNoise4d(vec4(particle.xyz + 1.0, time)),
            simplexNoise4d(vec4(particle.xyz + 2.0, time))
        ); 

        flowField = normalize(flowField); // Normalize the direction
        particle.xyz += flowField * uDeltaTime * strength * 0.05; // Add the direction to the particles

        // Life cycle: Decay
        particle.a += uDeltaTime * 0.03; // Set life cycle in the alpha channel
    }

    gl_FragColor = particle;
}