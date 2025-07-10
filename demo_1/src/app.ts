import { Renderer, Camera, RenderTarget, Geometry, Program, Mesh, Color, Vec2, Box, NormalProgram, Post } from 'ogl';
import { FBOOptions } from '../types/index.ts.js';
import { advectionManualFilteringShader, advectionShader, baseVertex, clearShader, curlShader, divergenceShader, fragment, gradientSubtractShader, pressureShader, splatShader, vorticityShader } from './shader.ts';

const renderer = new Renderer({ dpr: 2 });
const gl = renderer.gl;
const app_doc = document.getElementById("app") as HTMLElement;
app_doc.appendChild(gl.canvas);
gl.clearColor(1, 1, 1, 1);

const camera = new Camera(gl, { fov: 35 });
camera.position.set(0, 1, 5);
camera.lookAt([0, 0, 0]);

    
const post = new Post(gl);


function supportRenderTextureFormat(gl: { createTexture: () => any; bindTexture: (arg0: any, arg1: any) => void; TEXTURE_2D: any; texParameteri: (arg0: any, arg1: any, arg2: any) => void; TEXTURE_MIN_FILTER: any; NEAREST: any; TEXTURE_MAG_FILTER: any; TEXTURE_WRAP_S: any; CLAMP_TO_EDGE: any; TEXTURE_WRAP_T: any; texImage2D: (arg0: any, arg1: number, arg2: any, arg3: number, arg4: number, arg5: number, arg6: any, arg7: any, arg8: null) => void; createFramebuffer: () => any; bindFramebuffer: (arg0: any, arg1: any) => void; FRAMEBUFFER: any; framebufferTexture2D: (arg0: any, arg1: any, arg2: any, arg3: any, arg4: number) => void; COLOR_ATTACHMENT0: any; checkFramebufferStatus: (arg0: any) => any; FRAMEBUFFER_COMPLETE: any; }, internalFormat: number, format: number, type: any) {
    let texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, 4, 4, 0, format, type, null);

    let fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status != gl.FRAMEBUFFER_COMPLETE) return false;
    return true;
}


const getSupportedFormat=(gl: any, internalFormat: number, format: number, type: any)=> {
    if (!supportRenderTextureFormat(gl, internalFormat, format, type)) {
        switch (internalFormat) {
            case gl.R16F:
                return getSupportedFormat(gl, gl.RG16F, gl.RG, type);
            case gl.RG16F:
                return getSupportedFormat(gl, gl.RGBA16F, gl.RGBA, type);
            default:
                return null;
        }
    }

    return { internalFormat, format };
}


const createDoubleFBO = ( gl: WebGLRenderingContext, { width, height, wrapS,  wrapT,  minFilter = gl.LINEAR,  magFilter = minFilter,  type,  format,  internalFormat,  depth, }: FBOOptions): {
    read: RenderTarget;
    write: RenderTarget;
    swap: () => void;
  } => {
    const options = {
      width,
      height,
      wrapS,
      wrapT,
      minFilter,
      magFilter,
      type,
      format,
      internalFormat,
      depth,
    };
  
    const fbo = {
      read: new RenderTarget(gl, options),
      write: new RenderTarget(gl, options),
      swap: () => {
        const temp = fbo.read;
        fbo.read = fbo.write;
        fbo.write = temp;
      },
    };
  
    return fbo;
  };

  // Resolution of simulation
  const simRes = 128;
  const dyeRes = 512;

  // Main inputs to control look and feel of fluid
  const iterations = 3;
  const densityDissipation = 0.97;
  const velocityDissipation = 0.98;
  const pressureDissipation = 0.8;
  const curlStrength = 20;
  const radius = 0.2;

  // Common uniform
  const texelSize = { value: new Vec2(1 / simRes) };


  
    // Get supported formats and types for FBOs
    let supportLinearFiltering = gl.renderer.extensions[`OES_texture_${gl.renderer.isWebgl2 ? `` : `half_`}float_linear`];
    const halfFloat = gl.renderer.isWebgl2 ? gl.HALF_FLOAT : gl.renderer.extensions['OES_texture_half_float'].HALF_FLOAT_OES;

    const filtering = supportLinearFiltering ? gl.LINEAR : gl.NEAREST;
    let rgba, rg, r;

    if (gl.renderer.isWebgl2) {
        rgba = getSupportedFormat(gl, gl.RGBA16F, gl.RGBA, halfFloat);
        rg = getSupportedFormat(gl, gl.RG16F, gl.RG, halfFloat);
        r = getSupportedFormat(gl, gl.R16F, gl.RED, halfFloat);
    } else {
        rgba = getSupportedFormat(gl, gl.RGBA, gl.RGBA, halfFloat);
        rg = rgba;
        r = rgba;
    }

    // Create fluid simulation FBOs
    const density = createDoubleFBO(gl, {
        width: dyeRes,
        height: dyeRes,
        type: halfFloat,
        format: rgba?.format,
        internalFormat: rgba?.internalFormat,
        minFilter: filtering,
        depth: false,
    });

    const velocity = createDoubleFBO(gl, {
        width: simRes,
        height: simRes,
        type: halfFloat,
        format: rg?.format,
        internalFormat: rg?.internalFormat,
        minFilter: filtering,
        depth: false,
    });

    const pressure = createDoubleFBO(gl, {
        width: simRes,
        height: simRes,
        type: halfFloat,
        format: r?.format,
        internalFormat: r?.internalFormat,
        minFilter: gl.NEAREST,
        depth: false,
    });

    const divergence = new RenderTarget(gl, {
        width: simRes,
        height: simRes,
        type: halfFloat,
        format: r?.format,
        internalFormat: r?.internalFormat,
        minFilter: gl.NEAREST,
        depth: false,
    });

    const curl = new RenderTarget(gl, {
        width: simRes,
        height: simRes,
        type: halfFloat,
        format: r?.format,
        internalFormat: r?.internalFormat,
        minFilter: gl.NEAREST,
        depth: false,
    });


    
    // Geometry to be used for the simulation programs
    const triangle = new Geometry(gl, {
        position: { size: 2, data: new Float32Array([-1, -1, 3, -1, -1, 3]) },
        uv: { size: 2, data: new Float32Array([0, 0, 2, 0, 0, 2]) },
    });

    // Create fluid simulation programs
    const clearProgram = new Mesh(gl, {
        geometry: triangle,
        program: new Program(gl, {
            vertex: baseVertex,
            fragment: clearShader,
            uniforms: {
                texelSize,
                uTexture: { value: null },
                value: { value: pressureDissipation },
            },
            depthTest: false,
            depthWrite: false,
        }),
    });

    const splatProgram = new Mesh(gl, {
        geometry: triangle,
        program: new Program(gl, {
            vertex: baseVertex,
            fragment: splatShader,
            uniforms: {
                texelSize,
                uTarget: { value: null },
                aspectRatio: { value: 1 },
                color: { value: new Color() },
                point: { value: new Vec2() },
                radius: { value: radius / 100 },
            },
            depthTest: false,
            depthWrite: false,
        }),
    });

    const advectionProgram = new Mesh(gl, {
        geometry: triangle,
        program: new Program(gl, {
            vertex: baseVertex,
            fragment: supportLinearFiltering ? advectionShader : advectionManualFilteringShader,
            uniforms: {
                texelSize,
                dyeTexelSize: { value: new Vec2(1 / dyeRes) },
                uVelocity: { value: null },
                uSource: { value: null },
                dt: { value: 0.016 },
                dissipation: { value: 1 },
            },
            depthTest: false,
            depthWrite: false,
        }),
    });

    const divergenceProgram = new Mesh(gl, {
        geometry: triangle,
        program: new Program(gl, {
            vertex: baseVertex,
            fragment: divergenceShader,
            uniforms: {
                texelSize,
                uVelocity: { value: null },
            },
            depthTest: false,
            depthWrite: false,
        }),
    });

    const curlProgram = new Mesh(gl, {
        geometry: triangle,
        program: new Program(gl, {
            vertex: baseVertex,
            fragment: curlShader,
            uniforms: {
                texelSize,
                uVelocity: { value: null },
            },
            depthTest: false,
            depthWrite: false,
        }),
    });

    const vorticityProgram = new Mesh(gl, {
        geometry: triangle,
        program: new Program(gl, {
            vertex: baseVertex,
            fragment: vorticityShader,
            uniforms: {
                texelSize,
                uVelocity: { value: null },
                uCurl: { value: null },
                curl: { value: curlStrength },
                dt: { value: 0.016 },
            },
            depthTest: false,
            depthWrite: false,
        }),
    });

    const pressureProgram = new Mesh(gl, {
        geometry: triangle,
        program: new Program(gl, {
            vertex: baseVertex,
            fragment: pressureShader,
            uniforms: {
                texelSize,
                uPressure: { value: null },
                uDivergence: { value: null },
            },
            depthTest: false,
            depthWrite: false,
        }),
    });

    const gradientSubtractProgram = new Mesh(gl, {
        geometry: triangle,
        program: new Program(gl, {
            vertex: baseVertex,
            fragment: gradientSubtractShader,
            uniforms: {
                texelSize,
                uPressure: { value: null },
                uVelocity: { value: null },
            },
            depthTest: false,
            depthWrite: false,
        }),
    });

    const splats: { 
      // Get mouse value in 0 to 1 range, with y flipped
      x: number; y: number; dx: number; dy: number;
    }[] = [];

    // Create handlers to get mouse position and velocity
    const isTouchCapable = 'ontouchstart' in window;
    if (isTouchCapable) {
        window.addEventListener('touchstart', updateMouse, false);
        window.addEventListener('touchmove', updateMouse, false);
    } else {
        window.addEventListener('mousemove', updateMouse, false);
    }

    const lastMouse = new Vec2();
    function updateMouse(e:any) {
        if (e.changedTouches && e.changedTouches.length) {
            e.x = e.changedTouches[0].pageX;
            e.y = e.changedTouches[0].pageY;
        }
        if (e.x === undefined) {
            e.x = e.pageX;
            e.y = e.pageY;
        }

        if (!lastMouse.isInit) {
            lastMouse.isInit = true;

            // First input
            lastMouse.set(e.x, e.y);
        }

        const deltaX = e.x - lastMouse.x;
        const deltaY = e.y - lastMouse.y;

        lastMouse.set(e.x, e.y);

        // Add if the mouse is moving
        if (Math.abs(deltaX) || Math.abs(deltaY)) {
            splats.push({
                // Get mouse value in 0 to 1 range, with y flipped
                x: e.x / gl.renderer.width,
                y: 1 - e.y / gl.renderer.height,
                dx: deltaX * 5,
                dy: deltaY * -5,
            });
        }
    }

    // Function to draw number of interactions onto input render target
    function splat({ x, y, dx, dy }: { x: number; y: number; dx: number; dy: number }) {
        splatProgram.program.uniforms.uTarget.value = velocity.read.texture;
        splatProgram.program.uniforms.aspectRatio.value = gl.renderer.width / gl.renderer.height;
        splatProgram.program.uniforms.point.value.set(x, y);
        splatProgram.program.uniforms.color.value.set(dx, dy, 1);

        gl.renderer.render({
            scene: splatProgram,
            target: velocity.write,
            sort: false,
            update: false,
        });
        velocity.swap();

        splatProgram.program.uniforms.uTarget.value = density.read.texture;

        gl.renderer.render({
            scene: splatProgram,
            target: density.write,
            sort: false,
            update: false,
        });
        density.swap();
    }

    // Create initial scene
    const geometry = new Box(gl);
    const mesh = new Mesh(gl, { geometry, program: new NormalProgram(gl) });

    for (let i = 0; i < 20; i++) {
        const m = new Mesh(gl, { geometry, program: new NormalProgram(gl) });
        m.position.set(Math.random() * 3 - 1.5, Math.random() * 3 - 1.5, Math.random() * 3 - 1.5);
        m.rotation.set(Math.random() * 6.28 - 3.14, Math.random() * 6.28 - 3.14, 0);
        m.scale.set(Math.random() * 0.5 + 0.1);
        m.setParent(mesh);
    }

    const pass = post.addPass({
        fragment,
        uniforms: {
            tFluid: { value: null },
            uTime: { value: 0 },
        },
    });

    requestAnimationFrame(update);
    function update(t:any) {
        requestAnimationFrame(update);

        // Perform all of the fluid simulation renders
        // No need to clear during sim, saving a number of GL calls.
        gl.renderer.autoClear = false;

        // Render all of the inputs since last frame
        for (let i = splats.length - 1; i >= 0; i--) {
            splat(splats.splice(i, 1)[0]);
        }

        curlProgram.program.uniforms.uVelocity.value = velocity.read.texture;

        gl.renderer.render({
            scene: curlProgram,
            target: curl,
            sort: false,
            update: false,
        });

        vorticityProgram.program.uniforms.uVelocity.value = velocity.read.texture;
        vorticityProgram.program.uniforms.uCurl.value = curl.texture;

        gl.renderer.render({
            scene: vorticityProgram,
            target: velocity.write,
            sort: false,
            update: false,
        });
        velocity.swap();

        divergenceProgram.program.uniforms.uVelocity.value = velocity.read.texture;

        gl.renderer.render({
            scene: divergenceProgram,
            target: divergence,
            sort: false,
            update: false,
        });

        clearProgram.program.uniforms.uTexture.value = pressure.read.texture;

        gl.renderer.render({
            scene: clearProgram,
            target: pressure.write,
            sort: false,
            update: false,
        });
        pressure.swap();

        pressureProgram.program.uniforms.uDivergence.value = divergence.texture;

        for (let i = 0; i < iterations; i++) {
            pressureProgram.program.uniforms.uPressure.value = pressure.read.texture;

            gl.renderer.render({
                scene: pressureProgram,
                target: pressure.write,
                sort: false,
                update: false,
            });
            pressure.swap();
        }

        gradientSubtractProgram.program.uniforms.uPressure.value = pressure.read.texture;
        gradientSubtractProgram.program.uniforms.uVelocity.value = velocity.read.texture;

        gl.renderer.render({
            scene: gradientSubtractProgram,
            target: velocity.write,
            sort: false,
            update: false,
        });
        velocity.swap();

        advectionProgram.program.uniforms.dyeTexelSize.value.set(1 / simRes);
        advectionProgram.program.uniforms.uVelocity.value = velocity.read.texture;
        advectionProgram.program.uniforms.uSource.value = velocity.read.texture;
        advectionProgram.program.uniforms.dissipation.value = velocityDissipation;

        gl.renderer.render({
            scene: advectionProgram,
            target: velocity.write,
            sort: false,
            update: false,
        });
        velocity.swap();

        advectionProgram.program.uniforms.dyeTexelSize.value.set(1 / dyeRes);
        advectionProgram.program.uniforms.uVelocity.value = velocity.read.texture;
        advectionProgram.program.uniforms.uSource.value = density.read.texture;
        advectionProgram.program.uniforms.dissipation.value = densityDissipation;

        gl.renderer.render({
            scene: advectionProgram,
            target: density.write,
            sort: false,
            update: false,
        });
        density.swap();

        // Set clear back to default
        gl.renderer.autoClear = true;

        // Update post pass uniform with the simulation output
        pass.uniforms.tFluid.value = density.read.texture;

        mesh.rotation.y -= 0.0025;
        mesh.rotation.x -= 0.005;

        pass.uniforms.uTime.value = t * 0.001;

        // Replace Renderer.render with post.render. Use the same arguments.
        post.render({ scene: mesh, camera });
    }

const resize=()=> {
    renderer.setSize(globalThis.window.innerWidth, globalThis.window.innerHeight);
    camera.perspective({ aspect: gl.canvas.width / gl.canvas.height });
    post.resize();
}
globalThis.window.addEventListener('resize', resize, false);
resize();