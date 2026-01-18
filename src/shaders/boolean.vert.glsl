#version 300 es

attribute vec2 aPosition;
attribute vec2 a_texCoord;
uniform vec2 uResolution;
varying vec2 vUV;

void main() {
  vec2 clipSpace = (aPosition / uResolution) * 2.0 - 1.0;
  gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
  vUV = a_texCoord;
}