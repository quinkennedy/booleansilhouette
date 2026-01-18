#version 300 es
precision mediump float;

in vec2 vUV;
out vec4 outColor;

  uniform sampler2D uPreviousTexture;
  uniform sampler2D uMaskTexture;
  //0 = and, 1 = or, 2 = not
  uniform uint uOperation;

  void main() {
    vec4 maskColor = texture(uMaskTexture, vUV);
    vec4 prevColor = texture(uPreviousTexture, vUV);
    float prevValue = step(0.1, prevColor.r+prevColor.g+prevColor.b);
    float maskValue = step(0.5, maskColor.a);
    float grey = 0.0;
    if (uOperation == 0u){
      // AND
      grey = step(1.5, maskValue + prevValue);
    } else if (uOperation == 1u){
      // OR
      grey = step(0.9, maskValue + prevValue);
    } else {// if (uOperation == 2u){
      // NOT
      grey = step(0.9, prevValue - maskValue);
    }
    grey = 1. - grey;
    outColor.rgba = vec4(grey, grey, grey, 1.);//(grey - outColor.rgb);
  }