#version 300 es
precision highp float;

in vec2 vUV;
out vec4 outColor;

uniform sampler2D uWebcamTexture;
//uniform sampler2D uMaskTexture;
//uniform sampler2D uBooleanTexture;

void main() {
    //vec4 booleanColor = texture(uBooleanTexture, vUV);
    vec4 webcamColor = texture(uWebcamTexture, vUV);
    //vec4 maskColor = texture(uMaskTexture, vUV);
    //float mask = step(0.5, maskColor.a) * 0.5;
    //outColor.rgb = booleanColor.rgb + (webcamColor.rgb * mask);
    //outColor.a = 1.;
    outColor = webcamColor;
    //outColor = vec4(vUV.x, vUV.y, 0., 1.);
}
