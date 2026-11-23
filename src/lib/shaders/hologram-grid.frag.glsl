precision highp float;

uniform float uTime;
uniform float uWpmPulse;
uniform vec3 uPrimaryColor;
uniform vec3 uSecondaryColor;
uniform vec2 uResolution;
uniform float uHealthRatio;

varying vec2 vUv;
varying vec3 vPosition;

// Grid line calculation with anti-aliasing
float grid(vec2 st, float res) {
  vec2 grid = fract(st * res);
  vec2 dGrid = fwidth(st * res);
  vec2 line = smoothstep(dGrid, vec2(0.0), abs(grid - 0.5));
  return max(line.x, line.y);
}

void main() {
  vec2 uv = vUv;
  
  // Holographic scanline displacement
  float scanline = sin(uv.y * 300.0 + uTime * 6.0) * 0.08;
  
  // Cyber grid coordinate projection
  vec2 gridCoords = uv * 16.0;
  float gridPattern = grid(gridCoords, 1.0);
  
  // Typing WPM energy ripple expanding from center
  float distFromCenter = distance(uv, vec2(0.5, 0.5));
  float ripple = sin(distFromCenter * 24.0 - uTime * (4.0 + uWpmPulse * 0.05)) * 0.5 + 0.5;
  ripple *= exp(-distFromCenter * 2.5);

  // Dynamic color mix based on player health and active pulse
  vec3 baseColor = mix(uPrimaryColor, uSecondaryColor, ripple);
  if (uHealthRatio < 0.3) {
    // Red critical health alert glow
    baseColor = mix(baseColor, vec3(1.0, 0.1, 0.2), sin(uTime * 12.0) * 0.5 + 0.5);
  }

  // Combine grid neon glow with hologram scanlines and energy ripples
  float glow = (gridPattern * 0.7 + ripple * (0.3 + uWpmPulse * 0.005)) + scanline;
  vec3 finalColor = baseColor * glow;

  // Outer vignette fade
  float alpha = clamp(glow * (1.0 - distFromCenter * 0.8), 0.0, 0.95);

  gl_FragColor = vec4(finalColor, alpha);
}
