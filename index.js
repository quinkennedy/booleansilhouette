import * as poseDetection from '@tensorflow-models/pose-detection';
import '@tensorflow/tfjs-core';
// Register WebGL backend.
import '@tensorflow/tfjs-backend-webgl';
import '@mediapipe/pose';

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
} else {
    main();
}

/**
 * Main application
 */
async function main() {

    //dom references
    const video = document.getElementById('video');
    const canvas = document.getElementById('segmentation-canvas');

    //debug etc variables
    const width = 1280;
    const height = 720;
    var frameNumber = 0;
    var lastLogTime = 0;
    const canvasDims = {
        width: canvas.width,
        height: canvas.height
    };

    //webgl setup
    const gl = canvas.getContext('webgl2');
    if (!gl) {
        document.body.innerHTML = '<div class="error">WebGL 2 is not supported in your browser.</div>';
        return;
    }

    //blazepose setup
    const model = poseDetection.SupportedModels.BlazePose;
    const detectorConfig = {
        runtime: 'mediapipe', // or 'tfjs'
        solutionPath: '/mediapipe/pose',
        enableSegmentation: true,
        smoothSegmentation: true,
        //modelType: 'lite'//'full'//'heavy'
    };
    const detector = await poseDetection.createDetector(model, detectorConfig);


    try {
        // Load shaders
        const [vertexSource, booleanSource, displaySource] = await Promise.all([
            loadShader('src/shaders/basic.vert.glsl'),
            loadShader('src/shaders/boolean.frag.glsl'),
            loadShader('src/shaders/display.frag.glsl'),
        ]);

        // Create shader programs
        const booleanProgram = createProgram(gl, vertexSource, booleanSource);
        if (!booleanProgram) {
            throw new Error('Failed to create effect shader programs');
        }
        const displayProgram = createProgram(gl, vertexSource, displaySource);
        if (!displayProgram) {
            throw new Error('Failed to create display shader programs');
        }

        // Create video texture
        const webcamTexture = gl.createTexture();

        // Create geometry
        const quadVAO = createFullScreenQuad(gl);

        // Create ping-pong framebuffers
        let fboPair = createPingPongFramebuffers(gl, gl.canvas.width, gl.canvas.height);

        // Get uniform locations
        const booleanUniforms = {
            previousTexture: gl.getUniformLocation(booleanProgram, 'uPreviousTexture'),
            maskTexture: gl.getUniformLocation(booleanProgram, 'uMaskTexture'),
            operation: gl.getUniformLocation(booleanProgram, 'uOperation')
        };

        const displayUniforms = {
            webcamTexture: gl.getUniformLocation(displayProgram, 'uWebcamTexture'),
            //maskTexture: gl.getUniformLocation(displayProgram, 'uMaskTexture'),
            //booleanTexture: gl.getUniformLocation(displayProgram, 'uBooleanTexture')
        };
        //might throw error
    await setupCamera(video);
    console.log('[Init] Camera ready');

        async function render() {
            if (frameNumber < 20){
                console.log("frame", frameNumber);
            }
            frameNumber = frameNumber + 1;
            const poses = await detector.estimatePoses(video);
            var seg = undefined;
            if (poses.length){
                seg = await poses[0].segmentation.mask.toCanvasImageSource();
            if (poses.length && Date.now() - lastLogTime > 5000 && false) {
                lastLogTime = Date.now();
                console.log(poses.length);
                fboPair.swap();
                //resize();

                // --- Feedback Pass: Read from 'read', write to 'write' ---
                gl.bindFramebuffer(gl.FRAMEBUFFER, fboPair.write.framebuffer);
                gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

                gl.useProgram(booleanProgram);

                // Bind the 'read' texture as input
                gl.activeTexture(gl.TEXTURE0);
                gl.bindTexture(gl.TEXTURE_2D, fboPair.read.texture);
                gl.uniform1i(booleanUniforms.previousTexture, 0);

                // Bind mask texture
                gl.activeTexture(gl.TEXTURE1);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, seg); // Load the image into the texture.
                gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
                //gl.drawArrays(gl.TRIANGLES, 0, 6);
            }
        }

            //gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
            gl.useProgram(displayProgram);
            gl.bindVertexArray(quadVAO);
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, webcamTexture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
            gl.uniform1i(displayUniforms.webcamTexture, 0);
            /*
            if (poses.length) {
                gl.activeTexture(gl.TEXTURE1);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, seg); // Load the image into the texture.
            }
            gl.activeTexture(gl.TEXTURE2);
            gl.bindTexture(gl.TEXTURE_2D, fboPair.write.texture);
            */

            gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);

            requestAnimationFrame(render);
        }

        requestAnimationFrame(render);

    } catch (error) {
        console.error('Initialization error:', error);
        document.body.innerHTML = `<div class="error">Failed to initialize: ${error.message}</div>`;
    }
}

async function loop() {
    const poses = await detector.estimatePoses(video);
    if (Date.now() - lastLogTime > 5000) {
        lastLogTime = Date.now();
        console.log(poses.length);
        if (poses.length) {
            poses[0].segmentation.mask.toCanvasImageSource()
                .then(seg => {
                    var newDims = false;
                    if (canvasDims.width != seg.width) {
                        canvas.width = seg.width;
                        canvasDims.width = seg.width;
                        newDims = true;
                    }
                    if (canvasDims.height != seg.height) {
                        canvas.height = seg.height;
                        canvasDims.height = seg.height;
                        newDims = true;
                    }
                    if (!fboPair) {
                        fboPair = createPingPongFramebuffers(gl, seg.width, seg.height);
                    } else {
                        fboPair.swap();
                    }
                    gl.bindFramebuffer(gl.FRAMEBUFFER, fboPair.write.framebuffer);
                    gl.useProgram(program);
                    gl.bindTexture(gl.TEXTURE_2D, fboPair.read.texture);

                    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, seg); // Load the image into the texture.
                    gl.drawArrays(gl.TRIANGLES, 0, 6);
                    //context.drawImage(seg, 0, 0);
                })
        }
    }
    requestAnimationFrame(loop);
}

// Setup camera
async function setupCamera(videoElement) {
    videoElement;

    const stream = await navigator.mediaDevices.getUserMedia({
        video: {
            width: {
                ideal: 1280
            },
            height: {
                ideal: 720
            },
            facingMode: 'user'
        }
    });

    videoElement.srcObject = stream;

    return new Promise((resolve) => {
        videoElement.onloadedmetadata = () => {
            resolve(videoElement);
        };
    });
}

function createWebGLProgram(ctx, vertexShaderSource, fragmentShaderSource) {

    function compileShader(shaderSource, shaderType) {
        var shader = gl.createShader(shaderType);
        gl.shaderSource(shader, shaderSource);
        gl.compileShader(shader);
        return shader;
    };

    var program = gl.createProgram();
    gl.attachShader(
        program,
        compileShader(vertexShaderSource, gl.VERTEX_SHADER)
    );
    gl.attachShader(
        program,
        compileShader(fragmentShaderSource, gl.FRAGMENT_SHADER)
    );
    gl.linkProgram(program);
    gl.useProgram(program);

    return program;
}

/**
 * Fetches and loads a shader source file
 * @param {string} url - Path to the shader file
 * @returns {Promise<string>} The shader source code
 */
async function loadShader(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to load shader: ${url}`);
    }
    return response.text();
}

/**
 * Creates and compiles a shader
 * @param {WebGL2RenderingContext} gl
 * @param {number} type - gl.VERTEX_SHADER or gl.FRAGMENT_SHADER
 * @param {string} source - GLSL source code
 * @returns {WebGLShader}
 */
function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader compilation error:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }

    return shader;
}

/**
 * Creates a shader program from vertex and fragment shaders
 * @param {WebGL2RenderingContext} gl
 * @param {string} vertexSource
 * @param {string} fragmentSource
 * @returns {WebGLProgram}
 */
function createProgram(gl, vertexSource, fragmentSource) {
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);

    if (!vertexShader || !fragmentShader) {
        return null;
    }

    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Program linking error:', gl.getProgramInfoLog(program));
        gl.deleteProgram(program);
        return null;
    }

    return program;
}

/**
 * Creates an optimized full-screen quad VAO using indexed drawing
 * @param {WebGL2RenderingContext} gl
 * @returns {WebGLVertexArrayObject}
 */
function createFullScreenQuad(gl) {
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    // Define only the 4 unique vertices of our quad
    const positions = new Float32Array([
        -1, -1, // 0: Bottom left
         1, -1, // 1: Bottom right
        -1,  1, // 2: Top left
         1,  1, // 3: Top right
    ]);

    // Define indices - which vertices form each triangle
    const indices = new Uint16Array([
        0, 1, 2, // First triangle
        2, 1, 3, // Second triangle
    ]);

    // Create and bind the position buffer
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    // Set up the position attribute
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    // Create and bind the index buffer
    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

    gl.bindVertexArray(null);

    return vao;
}

/**
 * Creates a texture and framebuffer for off-screen rendering
 * @param {WebGL2RenderingContext} gl
 * @param {number} width
 * @param {number} height
 * @returns {{texture: WebGLTexture, framebuffer: WebGLFramebuffer}}
 */
function createFramebuffer(gl, width, height) {
    // Create texture
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // Allocate texture storage
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

    // Create framebuffer
    const framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);

    // Attach texture to framebuffer
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

    // Check framebuffer completeness
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
        throw new Error(`Framebuffer is not complete: ${status}`);
    }

    // Unbind
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    return {
        texture,
        framebuffer
    };
}

/**
 * Creates a pair of framebuffers for ping-pong rendering
 * @param {WebGL2RenderingContext} gl
 * @param {number} width
 * @param {number} height
 * @returns {{read: Object, write: Object, swap: Function}}
 */
function createPingPongFramebuffers(gl, width, height) {
    const fboA = createFramebuffer(gl, width, height);
    const fboB = createFramebuffer(gl, width, height);

    return {
        read: fboA,
        write: fboB,
        swap: function() {
            [this.read, this.write] = [this.write, this.read];
        },
    };
}