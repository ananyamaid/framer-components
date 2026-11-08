import { useEffect, useRef, useState } from "react"
import { addPropertyControls, ControlType } from "framer"

const METALS = {
    Silver: [0.95, 0.96, 1.0],
    Gold: [1.0, 0.78, 0.34],
    "Rose Gold": [0.97, 0.66, 0.56],
}
const SHAPES = { Heart: 0, Circle: 1, Square: 2 }

const DEFAULTS = {
    shape: "Heart",
    metal: "Silver",
    size: 1,
    width: 0.09,
    spikes: 18,
    spikeLength: 0.2,
    sharpness: 3,
    twist: 0.4,
    innerSpikes: false,
    imageScale: 48,
    background: "rgba(0,0,0,0)",
    camera: true,
    hint: "Click to reflect",
    textColor: "#D9D9D9",
}

// One camera shared by every frame on the page
const sharedCam = { video: null, on: false, starting: false }

async function startSharedCamera() {
    if (sharedCam.on || sharedCam.starting) return
    sharedCam.starting = true
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: "user",
                width: { ideal: 640 },
                height: { ideal: 480 },
            },
            audio: false,
        })
        const video = document.createElement("video")
        video.playsInline = true
        video.muted = true
        video.srcObject = stream
        video.style.cssText =
            "position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;pointer-events:none;"
        document.body.appendChild(video)
        await video.play()
        sharedCam.video = video
        sharedCam.on = true
        window.dispatchEvent(new Event("metalheart-camera"))
    } catch (e) {
        // Permission was denied, so the frames keep their studio lighting
    }
    sharedCam.starting = false
}

const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform vec2 uTilt;
uniform float uHover;
uniform float uShape;
uniform float uSize;
uniform float uWidth;
uniform float uCount;
uniform float uSpike;
uniform float uSharp;
uniform float uTwist;
uniform float uInner;
uniform vec3 uTint;
uniform sampler2D uCam;
uniform float uCamOn;
uniform float uCamAspect;

float dot2(vec2 v){ return dot(v, v); }

float sdHeart(vec2 p){
    p.x = abs(p.x);
    float lobe = sqrt(dot2(p - vec2(0.25, 0.75))) - 0.3535534;
    float body = sqrt(min(dot2(p - vec2(0.0, 1.0)),
                          dot2(p - 0.5 * max(p.x + p.y, 0.0)))) * sign(p.x - p.y);
    return (p.y + p.x > 1.0) ? lobe : body;
}

float baseShape(vec2 p){
    float d = sdHeart(p / uSize + vec2(0.0, 0.57)) * uSize;
    float circle = length(p) - 0.56 * uSize;
    vec2 q = abs(p) - vec2(0.46 * uSize);
    float square = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - 0.08 * uSize;
    if (uShape > 0.5) d = circle;
    if (uShape > 1.5) d = square;
    return d;
}

// A band that follows the shape, with spikes pushed out of its outer edge
float map(vec2 p){
    float d = baseShape(p);
    float ang = atan(p.y, p.x) + uTwist * d * 6.0;
    float x = ang * uCount / 6.28318;
    float tri = 1.0 - abs(2.0 * fract(x) - 1.0);
    float spike = pow(max(tri, 0.0001), uSharp);
    float alt = mix(0.55, 1.0, step(0.5, fract(floor(x) * 0.5)));
    float len = uSpike * (1.0 + 0.4 * uHover);
    float dOut = d - uWidth * 0.5 - len * spike * alt;
    float dIn = -d - uWidth * 0.5 - len * 0.3 * spike * uInner;
    return max(dOut, dIn);
}

vec3 studio(vec3 d){
    vec3 c = mix(vec3(0.03), vec3(0.45), smoothstep(-0.6, 0.9, d.y));
    c += smoothstep(0.75, 0.95, d.y) * 1.2;
    c += (1.0 - smoothstep(0.0, 0.12, abs(d.x - 0.55))) * (1.0 - smoothstep(0.0, 0.7, abs(d.y))) * 0.9;
    c += (1.0 - smoothstep(0.0, 0.08, abs(d.x + 0.7))) * (1.0 - smoothstep(0.0, 0.5, abs(d.y))) * 0.6;
    c *= 0.25 + 0.75 * smoothstep(-0.8, 0.0, d.y);
    return c;
}

void main(){
    float m = min(uRes.x, uRes.y);
    vec2 uv = (gl_FragCoord.xy * 2.0 - uRes) / m;
    float px = 2.0 / m;

    float d = map(uv);
    vec2 ex = vec2(px, 0.0);
    vec2 ey = vec2(0.0, px);
    vec2 grad = vec2(map(uv + ex) - map(uv - ex),
                     map(uv + ey) - map(uv - ey)) / (2.0 * px);
    float glen = length(grad) + 0.00001;
    float dist = d / glen;

    float alpha = clamp(0.5 - dist / px, 0.0, 1.0);
    if (alpha <= 0.0){
        gl_FragColor = vec4(0.0);
        return;
    }

    // Rounded tube profile so the band and every spike catch the light
    vec2 dir = grad / glen;
    float t = clamp(-dist / (uWidth * 0.5 + 0.0001), 0.0, 1.0);
    float z = sqrt(t * (2.0 - t));
    vec3 n = vec3(dir * sqrt(max(1.0 - z * z, 0.0)), z + 0.02);
    n.xy += uTilt * 0.45;
    n = normalize(n);

    vec3 rd = normalize(vec3(uv * 0.4, -1.0));
    vec3 r = reflect(rd, n);
    vec3 env = studio(r);

    // Camera reflection, blended in once the camera is on
    vec2 q = r.xy * 0.55;
    q.x /= uCamAspect;
    vec3 cam = texture2D(uCam, vec2(0.5) - q).rgb;
    cam = pow(max(cam, vec3(0.0001)), vec3(1.25)) * 1.3;
    env = mix(env, cam + env * 0.3, uCamOn);

    float sat = max(uTint.r, max(uTint.g, uTint.b)) - min(uTint.r, min(uTint.g, uTint.b));
    float lum = dot(env, vec3(0.299, 0.587, 0.114));
    env = mix(env, vec3(lum), clamp(sat * 1.3, 0.0, 0.85));

    vec3 base = mix(uTint * uTint, uTint, smoothstep(0.0, 0.6, lum));
    float cosT = max(dot(n, -rd), 0.0);
    vec3 fres = base + (vec3(1.0) - base) * pow(1.0 - cosT, 5.0);
    vec3 col = env * fres;
    col += vec3(pow(max(lum, 0.0001), 4.0) * 0.25 * sat);
    col = mix(col, mix(vec3(1.0), uTint, 0.5), pow(1.0 - cosT, 3.0) * 0.3);

    gl_FragColor = vec4(col * alpha, alpha);
}
`

export default function MetalheartFrame(rawProps) {
    const props = { ...DEFAULTS }
    for (const key in rawProps) {
        if (rawProps[key] !== undefined && rawProps[key] !== null)
            props[key] = rawProps[key]
    }
    const { image, imageScale, background, camera, hint, textColor } = props

    const wrapRef = useRef<HTMLDivElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const settings = useRef(props)
    settings.current = props

    const [camOn, setCamOn] = useState(sharedCam.on)
    const [hovered, setHovered] = useState(false)

    useEffect(() => {
        const onCam = () => setCamOn(true)
        window.addEventListener("metalheart-camera", onCam)
        return () => window.removeEventListener("metalheart-camera", onCam)
    }, [])

    useEffect(() => {
        const canvas = canvasRef.current
        const wrap = wrapRef.current
        if (!canvas || !wrap) return

        // Prints any problem on the component in red so it can be fixed
        let failed = false
        const fail = (msg) => {
            if (failed) return
            failed = true
            const pre = document.createElement("pre")
            pre.textContent = msg
            pre.style.cssText =
                "position:absolute;left:8px;top:8px;right:8px;margin:0;color:#ff5a5a;font:11px monospace;white-space:pre-wrap;z-index:5;"
            wrap.appendChild(pre)
        }

        let raf = 0
        let cleanup = () => {}

        try {
            const gl = canvas.getContext("webgl", {
                alpha: true,
                antialias: true,
            })
            if (!gl) {
                fail("WebGL could not start on this canvas.")
                return
            }

            const compile = (type, src) => {
                const s = gl.createShader(type)
                gl.shaderSource(s, src)
                gl.compileShader(s)
                if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
                    fail("Shader error: " + gl.getShaderInfoLog(s))
                return s
            }
            const prog = gl.createProgram()
            gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT))
            gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG))
            gl.linkProgram(prog)
            if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
                fail("Link error: " + gl.getProgramInfoLog(prog))
                return
            }
            gl.useProgram(prog)

            const buf = gl.createBuffer()
            gl.bindBuffer(gl.ARRAY_BUFFER, buf)
            gl.bufferData(
                gl.ARRAY_BUFFER,
                new Float32Array([-1, -1, 3, -1, -1, 3]),
                gl.STATIC_DRAW
            )
            const loc = gl.getAttribLocation(prog, "p")
            gl.enableVertexAttribArray(loc)
            gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)

            const U = (name) => gl.getUniformLocation(prog, name)
            const u = {
                res: U("uRes"),
                tilt: U("uTilt"),
                hover: U("uHover"),
                shape: U("uShape"),
                size: U("uSize"),
                width: U("uWidth"),
                count: U("uCount"),
                spike: U("uSpike"),
                sharp: U("uSharp"),
                twist: U("uTwist"),
                inner: U("uInner"),
                tint: U("uTint"),
                cam: U("uCam"),
                camOn: U("uCamOn"),
                camAspect: U("uCamAspect"),
            }

            const tex = gl.createTexture()
            gl.activeTexture(gl.TEXTURE0)
            gl.bindTexture(gl.TEXTURE_2D, tex)
            gl.texImage2D(
                gl.TEXTURE_2D,
                0,
                gl.RGBA,
                1,
                1,
                0,
                gl.RGBA,
                gl.UNSIGNED_BYTE,
                new Uint8Array([0, 0, 0, 255])
            )
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
            gl.uniform1i(u.cam, 0)

            const target = { x: 0, y: 0, hover: 0 }
            const current = { x: 0, y: 0, hover: 0 }
            const start = performance.now()
            let camMix = 0

            const onMove = (e) => {
                const rect = wrap.getBoundingClientRect()
                target.x = ((e.clientX - rect.left) / rect.width - 0.5) * 2
                target.y = -((e.clientY - rect.top) / rect.height - 0.5) * 2
                target.hover = 1
            }
            const onLeave = () => {
                target.x = 0
                target.y = 0
                target.hover = 0
            }
            wrap.addEventListener("pointermove", onMove)
            wrap.addEventListener("pointerleave", onLeave)
            cleanup = () => {
                wrap.removeEventListener("pointermove", onMove)
                wrap.removeEventListener("pointerleave", onLeave)
            }

            const num = (value, fallback) =>
                typeof value === "number" && isFinite(value) ? value : fallback

            const frame = () => {
                try {
                    const dpr = Math.min(window.devicePixelRatio || 1, 2)
                    const w = Math.max(1, Math.floor(canvas.clientWidth * dpr))
                    const h = Math.max(1, Math.floor(canvas.clientHeight * dpr))
                    if (canvas.width !== w || canvas.height !== h) {
                        canvas.width = w
                        canvas.height = h
                    }
                    gl.viewport(0, 0, w, h)

                    const s = settings.current
                    const time = (performance.now() - start) / 1000
                    const idleX = Math.sin(time * 0.7) * 0.25
                    const idleY = Math.cos(time * 0.5) * 0.2
                    current.x += (target.x + idleX - current.x) * 0.08
                    current.y += (target.y + idleY - current.y) * 0.08
                    current.hover += (target.hover - current.hover) * 0.1

                    const useCam = !!s.camera && sharedCam.on
                    camMix += ((useCam ? 1 : 0) - camMix) * 0.05
                    let aspect = 1.33
                    const video = sharedCam.video
                    if (useCam && video && video.readyState >= 2) {
                        gl.texImage2D(
                            gl.TEXTURE_2D,
                            0,
                            gl.RGBA,
                            gl.RGBA,
                            gl.UNSIGNED_BYTE,
                            video
                        )
                        aspect = video.videoWidth / video.videoHeight || 1.33
                    }

                    const tint = METALS[s.metal] || METALS.Silver
                    const shape = SHAPES[s.shape] || 0
                    gl.uniform2f(u.res, w, h)
                    gl.uniform2f(u.tilt, current.x, current.y)
                    gl.uniform1f(u.hover, current.hover)
                    gl.uniform1f(u.shape, shape)
                    gl.uniform1f(u.size, num(s.size, 1) || 1)
                    gl.uniform1f(u.width, num(s.width, 0.09))
                    gl.uniform1f(
                        u.count,
                        Math.max(2, Math.round(num(s.spikes, 18) / 2) * 2)
                    )
                    gl.uniform1f(u.spike, num(s.spikeLength, 0.2))
                    gl.uniform1f(u.sharp, num(s.sharpness, 3))
                    gl.uniform1f(u.twist, num(s.twist, 0.4))
                    gl.uniform1f(u.inner, s.innerSpikes ? 1 : 0)
                    gl.uniform3f(u.tint, tint[0], tint[1], tint[2])
                    gl.uniform1f(u.camOn, camMix)
                    gl.uniform1f(u.camAspect, aspect)

                    gl.clearColor(0, 0, 0, 0)
                    gl.clear(gl.COLOR_BUFFER_BIT)
                    gl.drawArrays(gl.TRIANGLES, 0, 3)
                    raf = requestAnimationFrame(frame)
                } catch (err) {
                    fail("Draw error: " + String(err))
                }
            }
            raf = requestAnimationFrame(frame)
        } catch (err) {
            fail("Setup error: " + String(err))
        }

        return () => {
            cancelAnimationFrame(raf)
            cleanup()
        }
    }, [])

    const showHint = camera && hint && hovered && !camOn

    return (
        <div
            ref={wrapRef}
            onClick={() => camera && startSharedCamera()}
            onPointerEnter={() => setHovered(true)}
            onPointerLeave={() => setHovered(false)}
            style={{
                position: "relative",
                width: "100%",
                height: "100%",
                background,
                overflow: "visible",
                cursor: camera && !camOn ? "pointer" : "default",
            }}
        >
            <canvas
                ref={canvasRef}
                style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    width: "100%",
                    height: "100%",
                    display: "block",
                }}
            />
            {image && (
                <img
                    src={image}
                    alt=""
                    draggable={false}
                    style={{
                        position: "absolute",
                        left: "50%",
                        top: "50%",
                        width: `${imageScale}%`,
                        height: `${imageScale}%`,
                        transform: "translate(-50%, -50%)",
                        objectFit: "contain",
                        pointerEvents: "none",
                    }}
                />
            )}
            {showHint && (
                <div
                    style={{
                        position: "absolute",
                        left: "50%",
                        bottom: 6,
                        transform: "translateX(-50%)",
                        color: textColor,
                        fontFamily: "monospace",
                        fontSize: 10,
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                        whiteSpace: "nowrap",
                        pointerEvents: "none",
                    }}
                >
                    {hint}
                </div>
            )}
        </div>
    )
}

addPropertyControls(MetalheartFrame, {
    image: { type: ControlType.Image, title: "Image" },
    shape: {
        type: ControlType.Enum,
        title: "Shape",
        options: ["Heart", "Circle", "Square"],
        defaultValue: DEFAULTS.shape,
    },
    metal: {
        type: ControlType.Enum,
        title: "Metal",
        options: ["Silver", "Gold", "Rose Gold"],
        defaultValue: DEFAULTS.metal,
    },
    size: {
        type: ControlType.Number,
        title: "Frame Size",
        min: 0.5,
        max: 1.2,
        step: 0.02,
        defaultValue: DEFAULTS.size,
    },
    width: {
        type: ControlType.Number,
        title: "Border",
        min: 0.02,
        max: 0.18,
        step: 0.01,
        defaultValue: DEFAULTS.width,
    },
    spikes: {
        type: ControlType.Number,
        title: "Spikes",
        min: 4,
        max: 48,
        step: 2,
        defaultValue: DEFAULTS.spikes,
    },
    spikeLength: {
        type: ControlType.Number,
        title: "Spike Length",
        min: 0,
        max: 0.45,
        step: 0.01,
        defaultValue: DEFAULTS.spikeLength,
    },
    sharpness: {
        type: ControlType.Number,
        title: "Sharpness",
        min: 1,
        max: 7,
        step: 0.25,
        defaultValue: DEFAULTS.sharpness,
    },
    twist: {
        type: ControlType.Number,
        title: "Twist",
        min: -1.5,
        max: 1.5,
        step: 0.05,
        defaultValue: DEFAULTS.twist,
    },
    innerSpikes: {
        type: ControlType.Boolean,
        title: "Inner Spikes",
        defaultValue: DEFAULTS.innerSpikes,
    },
    imageScale: {
        type: ControlType.Number,
        title: "Image Size",
        min: 20,
        max: 95,
        step: 1,
        unit: "%",
        defaultValue: DEFAULTS.imageScale,
    },
    camera: {
        type: ControlType.Boolean,
        title: "Camera",
        defaultValue: DEFAULTS.camera,
    },
    hint: {
        type: ControlType.String,
        title: "Hint",
        defaultValue: DEFAULTS.hint,
    },
    textColor: {
        type: ControlType.Color,
        title: "Hint Color",
        defaultValue: DEFAULTS.textColor,
    },
    background: {
        type: ControlType.Color,
        title: "Background",
        defaultValue: DEFAULTS.background,
    },
})
