import { useEffect, useRef } from "react"
import { addPropertyControls, ControlType } from "framer"

const METALS = {
    Silver: [0.72, 0.73, 0.75],
    Gold: [0.83, 0.64, 0.28],
    "Rose Gold": [0.82, 0.6, 0.55],
}

const SCRIPT_FALLBACK = `"Snell Roundhand", "Apple Chancery", "Brush Script MT", cursive`

const DEFAULTS = {
    metal: "Silver",
    brushed: true,
    shine: "Follows Cursor",
    brush: 8,
    depth: 1.6,
    symmetry: "Both Ways",
    emboss: "Raised",
    text: "Metalheart",
    textSize: 72,
    nameFont: null,
}

const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uDpr;
uniform vec2 uLight;
uniform float uDepth;
uniform float uBrushed;
uniform vec3 uBase;
uniform sampler2D uH;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

float vnoise(vec2 p){
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float H(vec2 uv){ return texture2D(uH, uv).r; }

void main(){
    vec2 frag = gl_FragCoord.xy;
    vec2 uv = frag / uRes;
    vec2 t = 1.5 * uDpr / uRes;

    float h = H(uv);
    float dx = H(uv + vec2(t.x, 0.0)) - H(uv - vec2(t.x, 0.0));
    float dy = H(uv + vec2(0.0, t.y)) - H(uv - vec2(0.0, t.y));

    // Brushed scratches running left to right
    vec2 cp = frag / uDpr;
    float streak = vnoise(vec2(cp.x * 0.012, cp.y * 0.9)) * 0.6
                 + vnoise(vec2(cp.x * 0.05, cp.y * 2.3)) * 0.4;

    vec3 n = normalize(vec3(-dx * uDepth,
                            -dy * uDepth + (streak - 0.5) * 0.08 * uBrushed,
                            1.0));

    // A light hovering above the plate
    vec2 toLight = (uLight - frag) / uRes.x;
    vec3 L = normalize(vec3(toLight * 1.4, 0.6));
    vec3 V = vec3(0.0, 0.0, 1.0);
    vec3 Hv = normalize(L + V);

    vec3 T = normalize(vec3(1.0, 0.0, 0.0) - n * n.x);
    vec3 B = cross(n, T);
    float nh = max(dot(n, Hv), 0.001);
    float ht = dot(Hv, T) / 0.28;
    float hb = dot(Hv, B) / 0.9;
    float aniso = exp(-(ht * ht + hb * hb) / (nh * nh));
    float soft = pow(nh, 14.0) * 0.9;
    float shine = mix(soft, aniso, uBrushed);

    float ndl = max(dot(n, L), 0.0);
    float slope = clamp(length(vec2(dx, dy)) * abs(uDepth) * 1.2, 0.0, 1.0);
    float glint = pow(nh, 70.0) * slope;

    // Soft shadow on the side facing away from the light
    vec2 ld = normalize(uLight - frag + vec2(0.001)) * 3.0 * uDpr / uRes;
    float occ = max((H(uv + ld) - h) * sign(uDepth), 0.0);

    vec3 col = uBase * (0.42 + 0.38 * ndl);
    col *= 1.0 + (0.2 * streak - 0.1) * uBrushed;
    col += mix(vec3(1.0), uBase, 0.35) * shine * 0.55;
    col += vec3(1.0) * glint * 0.9;
    col *= 1.0 - 0.5 * occ;

    gl_FragColor = vec4(col, 1.0);
}
`

// Turns the Name Font control into a font the canvas can use
function nameFontString(s, size) {
    const f = s.nameFont || {}
    const family = f.fontFamily || SCRIPT_FALLBACK
    const style = f.fontStyle || (s.nameFont ? "normal" : "italic")
    const weight = f.fontWeight || 400
    return `${style} ${weight} ${size}px ${family}`
}

// Accepts the old on and off values too
function shineOn(value) {
    return value !== "Still" && value !== false
}

// Accepts the old option names too, so older copies keep working
function mirrorMode(value) {
    if (value === "Off") return 0
    if (value === "Four Ways" || value === "Four Way") return 2
    return 1
}

export default function MetalEmbosser(rawProps) {
    const props = { ...DEFAULTS }
    for (const key in rawProps) {
        if (rawProps[key] !== undefined && rawProps[key] !== null)
            props[key] = rawProps[key]
    }

    const wrapRef = useRef<HTMLDivElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const settings = useRef(props)
    settings.current = props

    useEffect(() => {
        const canvas = canvasRef.current
        const wrap = wrapRef.current
        if (!canvas || !wrap) return

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
            const gl = canvas.getContext("webgl", { antialias: false })
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
            const uRes = U("uRes")
            const uDpr = U("uDpr")
            const uLight = U("uLight")
            const uDepth = U("uDepth")
            const uBrushed = U("uBrushed")
            const uBase = U("uBase")

            const tex = gl.createTexture()
            gl.activeTexture(gl.TEXTURE0)
            gl.bindTexture(gl.TEXTURE_2D, tex)
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
            gl.uniform1i(U("uH"), 0)

            // Hidden canvas that stores how high each point of the plate is
            const heightCanvas = document.createElement("canvas")
            const hctx = heightCanvas.getContext("2d")

            const strokes = []
            let active = null
            let dirty = true
            let lastKey = ""
            let visible = true
            const REST = { x: 0.6, y: 0.35 }
            const light = { x: REST.x, y: REST.y }
            const lightTarget = { x: REST.x, y: REST.y }

            const local = (e) => {
                const rect = canvas.getBoundingClientRect()
                const sx = rect.width ? canvas.clientWidth / rect.width : 1
                const sy = rect.height ? canvas.clientHeight / rect.height : 1
                return {
                    x: (e.clientX - rect.left) * sx,
                    y: (e.clientY - rect.top) * sy,
                }
            }
            const onDown = (e) => {
                try {
                    canvas.setPointerCapture(e.pointerId)
                } catch {}
                active = [local(e)]
                strokes.push(active)
                dirty = true
            }
            const onDrawMove = (e) => {
                if (!active) return
                const p = local(e)
                const last = active[active.length - 1]
                if (Math.hypot(p.x - last.x, p.y - last.y) > 2) {
                    active.push(p)
                    dirty = true
                }
            }
            const onUp = () => {
                active = null
            }
            const onClear = () => {
                strokes.length = 0
                active = null
                dirty = true
            }
            // With Shine set to Follows Cursor, the light moves with the cursor
            const onLightMove = (e) => {
                if (!shineOn(settings.current.shine)) return
                const rect = canvas.getBoundingClientRect()
                lightTarget.x =
                    (e.clientX - rect.left) / Math.max(1, rect.width)
                lightTarget.y =
                    (e.clientY - rect.top) / Math.max(1, rect.height)
            }
            // Redraw the name once a chosen font has finished loading
            const onFonts = () => {
                dirty = true
            }
            canvas.addEventListener("pointerdown", onDown)
            canvas.addEventListener("pointermove", onDrawMove)
            canvas.addEventListener("pointerup", onUp)
            canvas.addEventListener("pointercancel", onUp)
            canvas.addEventListener("dblclick", onClear)
            window.addEventListener("pointermove", onLightMove)
            document.fonts?.addEventListener?.("loadingdone", onFonts)

            // Pause drawing while the footer is off screen
            const io = new IntersectionObserver((entries) => {
                visible = !!entries[0]?.isIntersecting
            })
            io.observe(wrap)

            cleanup = () => {
                canvas.removeEventListener("pointerdown", onDown)
                canvas.removeEventListener("pointermove", onDrawMove)
                canvas.removeEventListener("pointerup", onUp)
                canvas.removeEventListener("pointercancel", onUp)
                canvas.removeEventListener("dblclick", onClear)
                window.removeEventListener("pointermove", onLightMove)
                document.fonts?.removeEventListener?.("loadingdone", onFonts)
                io.disconnect()
            }

            const addStroke = (path, pts, w, h, flipX, flipY) => {
                const m = (p) => ({
                    x: flipX ? w - p.x : p.x,
                    y: flipY ? h - p.y : p.y,
                })
                const first = m(pts[0])
                path.moveTo(first.x, first.y)
                if (pts.length === 1) {
                    path.lineTo(first.x + 0.01, first.y)
                    return
                }
                for (let i = 1; i < pts.length - 1; i++) {
                    const a = m(pts[i])
                    const b = m(pts[i + 1])
                    path.quadraticCurveTo(
                        a.x,
                        a.y,
                        (a.x + b.x) / 2,
                        (a.y + b.y) / 2
                    )
                }
                const end = m(pts[pts.length - 1])
                path.lineTo(end.x, end.y)
            }

            const drawHeight = (w, h, dpr, s) => {
                hctx.setTransform(1, 0, 0, 1, 0, 0)
                hctx.globalCompositeOperation = "source-over"
                hctx.fillStyle = "#000"
                hctx.fillRect(0, 0, heightCanvas.width, heightCanvas.height)
                hctx.setTransform(dpr, 0, 0, dpr, 0, 0)
                hctx.globalCompositeOperation = "lighter"

                const path = new Path2D()
                const mode = mirrorMode(s.symmetry)
                for (const pts of strokes) {
                    if (!pts.length) continue
                    addStroke(path, pts, w, h, false, false)
                    if (mode >= 1) addStroke(path, pts, w, h, true, false)
                    if (mode === 2) {
                        addStroke(path, pts, w, h, false, true)
                        addStroke(path, pts, w, h, true, true)
                    }
                }

                // Stack thinner and thinner lines so each stroke becomes a rounded ridge
                const layers = 10
                hctx.lineCap = "round"
                hctx.lineJoin = "round"
                hctx.strokeStyle = `rgba(255,255,255,${1 / layers})`
                for (let i = 0; i < layers; i++) {
                    const k = i / layers
                    hctx.lineWidth = s.brush * Math.sqrt(1 - k * k)
                    hctx.stroke(path)
                }

                if (s.text) {
                    // Shrink the name if it would run off the edges on small screens
                    let size = Number(s.textSize) || 72
                    hctx.font = nameFontString(s, size)
                    const tw = hctx.measureText(s.text).width
                    if (tw > w * 0.9) {
                        size = Math.max(12, (size * w * 0.9) / tw)
                        hctx.font = nameFontString(s, size)
                    }
                    hctx.textAlign = "center"
                    hctx.textBaseline = "middle"
                    hctx.fillStyle = "rgba(255,255,255,0.8)"
                    if ("filter" in hctx) hctx.filter = "blur(0.8px)"
                    hctx.fillText(s.text, w / 2, h / 2)
                    if ("filter" in hctx) hctx.filter = "none"
                }

                gl.texImage2D(
                    gl.TEXTURE_2D,
                    0,
                    gl.RGBA,
                    gl.RGBA,
                    gl.UNSIGNED_BYTE,
                    heightCanvas
                )
            }

            const frame = () => {
                try {
                    raf = requestAnimationFrame(frame)
                    if (!visible) return

                    const s = settings.current
                    const dpr = Math.min(window.devicePixelRatio || 1, 2)
                    const w = Math.max(1, canvas.clientWidth)
                    const h = Math.max(1, canvas.clientHeight)
                    const pw = Math.floor(w * dpr)
                    const ph = Math.floor(h * dpr)
                    if (canvas.width !== pw || canvas.height !== ph) {
                        canvas.width = pw
                        canvas.height = ph
                        heightCanvas.width = pw
                        heightCanvas.height = ph
                        dirty = true
                    }

                    const font = nameFontString(s, Number(s.textSize) || 72)
                    const key = [s.brush, s.symmetry, s.text, font].join("|")
                    if (key !== lastKey) {
                        lastKey = key
                        dirty = true
                        if (document.fonts?.load)
                            document.fonts
                                .load(font, s.text || "a")
                                .then(onFonts)
                                .catch(() => {})
                    }
                    if (dirty) {
                        drawHeight(w, h, dpr, s)
                        dirty = false
                    }

                    // With Shine set to Still, the light rests in one place
                    if (!shineOn(s.shine)) {
                        lightTarget.x = REST.x
                        lightTarget.y = REST.y
                    }
                    light.x += (lightTarget.x - light.x) * 0.08
                    light.y += (lightTarget.y - light.y) * 0.08

                    const base = METALS[s.metal] || METALS.Silver
                    const depth =
                        (Number(s.depth) || 1.6) *
                        (s.emboss === "Engraved" ? -1 : 1)

                    gl.viewport(0, 0, pw, ph)
                    gl.uniform2f(uRes, pw, ph)
                    gl.uniform1f(uDpr, dpr)
                    gl.uniform2f(uLight, light.x * pw, (1 - light.y) * ph)
                    gl.uniform1f(uDepth, depth)
                    gl.uniform1f(uBrushed, s.brushed ? 1 : 0)
                    gl.uniform3f(uBase, base[0], base[1], base[2])
                    gl.drawArrays(gl.TRIANGLES, 0, 3)
                } catch (err) {
                    cancelAnimationFrame(raf)
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

    return (
        <div
            ref={wrapRef}
            style={{
                position: "relative",
                width: "100%",
                height: "100%",
                overflow: "hidden",
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
                    touchAction: "none",
                    cursor: "crosshair",
                }}
            />
        </div>
    )
}

addPropertyControls(MetalEmbosser, {
    text: {
        type: ControlType.String,
        title: "Name",
        defaultValue: DEFAULTS.text,
        description: "The name pressed into the middle of the metal. Leave it empty for a plain plate.",
    },
    nameFont: {
        type: ControlType.Font,
        title: "Name Font",
        controls: "extended",
        description: "Pick a font so the name looks the same on every device.",
    },
    textSize: {
        type: ControlType.Number,
        title: "Name Size",
        min: 16,
        max: 220,
        step: 1,
        defaultValue: DEFAULTS.textSize,
    },
    emboss: {
        type: ControlType.Enum,
        title: "Emboss",
        options: ["Raised", "Engraved"],
        defaultValue: DEFAULTS.emboss,
        description: "Raised makes drawings stand out of the metal. Engraved presses them in.",
    },
    symmetry: {
        type: ControlType.Enum,
        title: "Mirror",
        options: ["Off", "Both Ways", "Four Ways"],
        defaultValue: DEFAULTS.symmetry,
        description: "Both Ways copies drawings left and right. Four Ways also copies them top and bottom.",
    },
    shine: {
        type: ControlType.Enum,
        title: "Shine",
        options: ["Follows Cursor", "Still"],
        defaultValue: DEFAULTS.shine,
        description: "Follows Cursor moves the light with the cursor. Still keeps it in one place.",
    },
    metal: {
        type: ControlType.Enum,
        title: "Metal",
        options: ["Silver", "Gold", "Rose Gold"],
        defaultValue: DEFAULTS.metal,
    },
    brushed: {
        type: ControlType.Boolean,
        title: "Brushed Lines",
        defaultValue: DEFAULTS.brushed,
    },
    brush: {
        type: ControlType.Number,
        title: "Brush",
        min: 3,
        max: 24,
        step: 1,
        defaultValue: DEFAULTS.brush,
    },
    depth: {
        type: ControlType.Number,
        title: "Depth",
        min: 0.4,
        max: 4,
        step: 0.1,
        defaultValue: DEFAULTS.depth,
    },
})
