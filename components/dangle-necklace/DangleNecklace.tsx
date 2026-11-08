import * as React from "react"
import { useEffect, useRef } from "react"
import { addPropertyControls, ControlType, RenderTarget } from "framer"

type Pt = { x: number; y: number; px: number; py: number; im: number }
type Con = { a: number; b: number; len: number; rope: boolean }
type Metal = { stops: [number, string][]; outline: string; shine: string }
type Shape = {
    sx: number
    sy: number
    sw: number
    sh: number
    left: { x: number; y: number }
    right: { x: number; y: number }
    top: { x: number; y: number }
}

// The three metals. Each one is a set of light and dark bands that wrap
// around the wire, plus a dark outline and a highlight colour.
const METALS: Record<string, Metal> = {
    Gold: {
        stops: [
            [0, "#FFF6D6"],
            [0.18, "#F3D27C"],
            [0.42, "#C99630"],
            [0.56, "#7A5418"],
            [0.74, "#E9C062"],
            [1, "#9C6F22"],
        ],
        outline: "#4A320C",
        shine: "rgba(255,250,228,0.95)",
    },
    Silver: {
        stops: [
            [0, "#FFFFFF"],
            [0.18, "#E9ECEF"],
            [0.42, "#9CA3AB"],
            [0.56, "#5A6169"],
            [0.74, "#CDD2D8"],
            [1, "#7A8189"],
        ],
        outline: "#353A40",
        shine: "rgba(255,255,255,0.95)",
    },
    "Rose Gold": {
        stops: [
            [0, "#FFEDE6"],
            [0.18, "#F3C4B6"],
            [0.42, "#C98B7B"],
            [0.56, "#7E4C42"],
            [0.74, "#E7B0A0"],
            [1, "#9A6458"],
        ],
        outline: "#4A2A24",
        shine: "rgba(255,240,234,0.95)",
    },
}

// Light comes from the top left, so every link is lit from the same side
const LIGHT = -2.1

const srcOf = (img: any) => (typeof img === "string" ? img : img?.src || "")

function addStops(g: CanvasGradient, m: Metal) {
    for (const [at, c] of m.stops) g.addColorStop(at, c)
    return g
}

function metalFill(
    ctx: CanvasRenderingContext2D,
    r: number,
    ang: number,
    m: Metal
) {
    const a = LIGHT - ang
    const dx = Math.cos(a) * r
    const dy = Math.sin(a) * r
    return addStops(ctx.createLinearGradient(dx, dy, -dx, -dy), m)
}

// One round wire hoop, drawn around (0, 0)
function ring(
    ctx: CanvasRenderingContext2D,
    rx: number,
    ry: number,
    lw: number,
    ang: number,
    m: Metal
) {
    const a = LIGHT - ang
    const full = Math.PI * 2
    ctx.lineCap = "round"

    ctx.lineWidth = lw * 1.3
    ctx.strokeStyle = m.outline
    ctx.beginPath()
    ctx.ellipse(0, 0, rx, ry, 0, 0, full)
    ctx.stroke()

    ctx.lineWidth = lw
    ctx.strokeStyle = metalFill(ctx, Math.max(rx, ry) + lw, ang, m)
    ctx.beginPath()
    ctx.ellipse(0, 0, rx, ry, 0, 0, full)
    ctx.stroke()

    ctx.lineWidth = lw * 0.3
    ctx.strokeStyle = "rgba(20,16,10,0.35)"
    ctx.beginPath()
    ctx.ellipse(
        0,
        0,
        Math.max(0.1, rx - lw * 0.3),
        Math.max(0.1, ry - lw * 0.3),
        0,
        a - 0.9,
        a + 0.9
    )
    ctx.stroke()

    ctx.lineWidth = lw * 0.28
    ctx.strokeStyle = m.shine
    ctx.beginPath()
    ctx.ellipse(0, 0, rx + lw * 0.22, ry + lw * 0.22, 0, a - 0.7, a + 0.7)
    ctx.stroke()

    ctx.lineWidth = lw * 0.2
    ctx.strokeStyle = "rgba(255,255,255,0.55)"
    ctx.beginPath()
    ctx.ellipse(
        0,
        0,
        Math.max(0.1, rx - lw * 0.25),
        Math.max(0.1, ry - lw * 0.25),
        0,
        a + Math.PI - 0.5,
        a + Math.PI + 0.5
    )
    ctx.stroke()
}

// Looks at the picture's transparency to find where the chain should attach:
// the far left and far right edges, and the top centre.
function analyse(src: CanvasImageSource, nw: number, nh: number): Shape {
    const fallback: Shape = {
        sx: 0,
        sy: 0,
        sw: nw,
        sh: nh,
        left: { x: 0.03, y: 0.3 },
        right: { x: 0.97, y: 0.3 },
        top: { x: 0.5, y: 0.02 },
    }
    try {
        const S = Math.min(1, 300 / Math.max(nw, nh))
        const cw = Math.max(1, Math.round(nw * S))
        const ch = Math.max(1, Math.round(nh * S))
        const c = document.createElement("canvas")
        c.width = cw
        c.height = ch
        const x = c.getContext("2d", {
            willReadFrequently: true,
        } as any) as CanvasRenderingContext2D
        x.drawImage(src, 0, 0, cw, ch)
        const d = x.getImageData(0, 0, cw, ch).data
        const solid = (px: number, py: number) => d[(py * cw + px) * 4 + 3] > 40

        let minX = cw,
            maxX = -1,
            minY = ch,
            maxY = -1
        for (let py = 0; py < ch; py++)
            for (let px = 0; px < cw; px++)
                if (solid(px, py)) {
                    if (px < minX) minX = px
                    if (px > maxX) maxX = px
                    if (py < minY) minY = py
                    if (py > maxY) maxY = py
                }
        if (maxX < 0) return fallback

        const bw = maxX - minX + 1
        const bh = maxY - minY + 1
        const midY = (col: number) => {
            let sum = 0,
                n = 0
            for (let k = 0; k < 3; k++) {
                const px = col + k * (col === minX ? 1 : -1)
                for (let py = minY; py <= maxY; py++)
                    if (solid(px, py)) {
                        sum += py
                        n++
                    }
            }
            return n ? sum / n : (minY + maxY) / 2
        }
        const cx = Math.round((minX + maxX) / 2)
        const band = Math.max(1, Math.round(bw * 0.03))
        let topY = maxY
        for (let px = cx - band; px <= cx + band; px++)
            for (let py = minY; py <= maxY; py++)
                if (solid(px, py)) {
                    if (py < topY) topY = py
                    break
                }

        return {
            sx: minX / S,
            sy: minY / S,
            sw: bw / S,
            sh: bh / S,
            left: { x: 0, y: (midY(minX) - minY) / bh },
            right: { x: 1, y: (midY(maxX) - minY) / bh },
            top: { x: (cx - minX + 0.5) / bw, y: (topY - minY) / bh },
        }
    } catch {
        // The image host blocked reading its pixels, so use sensible defaults
        return fallback
    }
}

/**
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any-prefer-fixed
 * @framerIntrinsicWidth 1200
 * @framerIntrinsicHeight 800
 */
export default function Necklace(props: any) {
    const {
        pendant,
        metal = "Gold",
        hangFrom = "center",
        size = 34,
        hangHeight = 45,
        style,
    } = props

    const pendantSrc = srcOf(pendant)
    const wrapRef = useRef<HTMLDivElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)

    useEffect(() => {
        const wrap = wrapRef.current as HTMLDivElement
        const canvas = canvasRef.current as HTMLCanvasElement
        if (!wrap || !canvas) return
        const ctx = canvas.getContext("2d") as CanvasRenderingContext2D
        if (!ctx) return

        const M = METALS[metal] || METALS.Gold
        const both = hangFrom === "ends"
        const reduced = !!window.matchMedia?.(
            "(prefers-reduced-motion: reduce)"
        ).matches
        const chainAngle = both ? 24 : 22
        const gravity = 2200
        const damping = 0.994

        let art: CanvasImageSource | null = null
        let shape: Shape | null = null

        let W = 0,
            H = 0,
            dpr = 1
        let pts: Pt[] = []
        let cons: Con[] = []
        let chains: number[][] = []
        let anchors: { i: number; x: number; y: number; reach: number }[] = []
        let tri = [0, 0, 0]
        // Pendant size and its three body points in pendant space
        let g = {
            w: 0,
            h: 0,
            p: [
                { x: 0, y: 0 },
                { x: 0, y: 0 },
                { x: 0, y: 0 },
            ],
            theta0: 0,
            link: 10,
            draw: 6,
            s: 1,
            maxPull: 150,
        }
        let extend = 0
        let drag: any = null
        const ptr = { x: 0, y: 0 }
        let built = false,
            started = false,
            sleeping = true,
            dead = false
        let still = 0,
            raf = 0,
            last = 0,
            acc = 0

        const add = (x: number, y: number, im: number) => {
            pts.push({ x, y, px: x, py: y, im })
            return pts.length - 1
        }
        const join = (a: number, b: number, rope: boolean, len?: number) => {
            const l =
                len ?? Math.hypot(pts[a].x - pts[b].x, pts[a].y - pts[b].y)
            cons.push({ a, b, len: l, rope })
        }

        function build(drop: boolean) {
            const r = wrap.getBoundingClientRect()
            W = r.width
            H = r.height
            dpr = Math.min(window.devicePixelRatio || 1, 2)
            canvas.width = Math.max(1, Math.round(W * dpr))
            canvas.height = Math.max(1, Math.round(H * dpr))
            built = false
            if (!art || !shape || W < 20 || H < 20) return

            // Pendant size follows the frame, so it works on any screen
            const base = Math.min(W, H * 1.15)
            let w = Math.max(90, (base * size) / 100)
            w = Math.min(w, W * 0.9)
            let h = (w * shape.sh) / shape.sw
            const maxH = H * 0.5
            if (h > maxH) {
                w *= maxH / h
                h = maxH
            }
            // Length of each physics segment of the chain
            const lnk = Math.min(16, Math.max(6, base * 0.012))
            // Drawn links are smaller than the physics segments, for a fine, delicate chain
            const drawLen = Math.min(8, Math.max(4, base * 0.006))
            const s = w / 400

            let p0, p1, p2
            if (both) {
                const inset = Math.min(drawLen * 1.1, w * 0.03)
                p0 = { x: shape.left.x * w + inset, y: shape.left.y * h }
                p1 = { x: shape.right.x * w - inset, y: shape.right.y * h }
                p2 = { x: w / 2, y: Math.max(p0.y, p1.y) + h * 0.45 }
            } else {
                p0 = { x: shape.top.x * w, y: shape.top.y * h + drawLen * 0.3 }
                p1 = { x: p0.x + w * 0.35, y: p0.y + h * 0.6 }
                p2 = { x: p0.x - w * 0.35, y: p0.y + h * 0.6 }
            }
            const maxPull = Math.max(60, Math.min(260, H * 0.25))
            g = {
                w,
                h,
                p: [p0, p1, p2],
                theta0: Math.atan2(p1.y - p0.y, p1.x - p0.x),
                link: lnk,
                draw: drawLen,
                s,
                maxPull,
            }

            // Centre the pendant, with its top hanging at Hang Height
            const left = both ? W / 2 - w / 2 : W / 2 - p0.x
            const restY = (H * hangHeight) / 100
            const world = (q: { x: number; y: number }) => ({
                x: left + q.x,
                y: restY + (q.y - p0.y),
            })
            const R0 = world(p0),
                R1 = world(p1),
                R2 = world(p2)

            const ay = -maxPull - lnk * 2
            const t = Math.tan((chainAngle * Math.PI) / 180)
            const lift = drop ? (restY - ay) * 0.6 : 0

            pts = []
            cons = []
            chains = []
            anchors = []
            const i0 = add(R0.x, R0.y - lift, 0.4)
            // Equal weight on both sides in Top Centre mode, so the pendant hangs straight
            const i1 = add(R1.x, R1.y - lift, both ? 0.4 : 0.3)
            const i2 = add(R2.x, R2.y - lift, 0.3)
            tri = [i0, i1, i2]
            join(i0, i1, false)
            join(i0, i2, false)
            join(i1, i2, false)

            const makeChain = (
                ax: number,
                end: number,
                rest: { x: number; y: number }
            ) => {
                const reach = Math.hypot(rest.x - ax, rest.y - ay) * 1.02
                const n = Math.max(2, Math.round(reach / lnk))
                const seg = reach / n
                const a = add(ax, ay, 0)
                const idx = [a]
                const ex = pts[end].x,
                    ey = pts[end].y
                let prev = a
                for (let k = 1; k < n; k++) {
                    const f = k / n
                    const i = add(ax + (ex - ax) * f, ay + (ey - ay) * f, 1)
                    join(prev, i, true, seg)
                    idx.push(i)
                    prev = i
                }
                join(prev, end, true, seg)
                idx.push(end)
                chains.push(idx)
                anchors.push({ i: a, x: ax, y: ay, reach })
            }

            if (both) {
                makeChain(R0.x - (R0.y - ay) * t, i0, R0)
                makeChain(R1.x + (R1.y - ay) * t, i1, R1)
            } else {
                makeChain(R0.x - (R0.y - ay) * t, i0, R0)
                makeChain(R0.x + (R0.y - ay) * t, i0, R0)
            }
            extend = 0
            drag = null
            built = true
        }

        function plateAngle() {
            const A = pts[tri[0]],
                B = pts[tri[1]]
            return Math.atan2(B.y - A.y, B.x - A.x) - g.theta0
        }

        function applyDrag() {
            if (!drag) return
            if (drag.kind === "plate") {
                const A = pts[tri[0]],
                    B = pts[tri[1]],
                    C = pts[tri[2]]
                const wx = drag.u * A.x + drag.v * B.x + drag.bw * C.x
                const wy = drag.u * A.y + drag.v * B.y + drag.bw * C.y
                const k = 0.35 / drag.s
                const dx = (ptr.x - wx) * k,
                    dy = (ptr.y - wy) * k
                A.x += dx * drag.u
                A.y += dy * drag.u
                B.x += dx * drag.v
                B.y += dy * drag.v
                C.x += dx * drag.bw
                C.y += dy * drag.bw
            } else {
                const p = pts[drag.i]
                p.x += (ptr.x - p.x) * 0.5
                p.y += (ptr.y - p.y) * 0.5
            }
        }

        function step(dt: number) {
            if (!built) return
            const grav = gravity * g.s * dt * dt

            // Pulling further than the chain reaches feeds more chain in from the top
            let target = 0
            if (drag) {
                for (const a of anchors) {
                    const over = Math.hypot(ptr.x - a.x, ptr.y - a.y) - a.reach
                    if (over > target) target = over
                }
                target = Math.min(g.maxPull, target)
            }
            extend += (target - extend) * (drag ? 0.12 : 0.02)

            for (const p of pts) {
                if (p.im === 0) continue
                const vx = (p.x - p.px) * damping
                const vy = (p.y - p.py) * damping
                p.px = p.x
                p.py = p.y
                p.x += vx
                p.y += vy + grav
            }
            for (const a of anchors) {
                const p = pts[a.i]
                p.x = p.px = a.x
                p.y = p.py = a.y + extend
            }

            for (let it = 0; it < 10; it++) {
                for (const c of cons) {
                    const A = pts[c.a],
                        B = pts[c.b]
                    const dx = B.x - A.x,
                        dy = B.y - A.y
                    const d = Math.hypot(dx, dy) || 0.0001
                    if (c.rope && d <= c.len) continue
                    const wsum = A.im + B.im
                    if (wsum === 0) continue
                    const diff = (d - c.len) / (d * wsum)
                    A.x += dx * diff * A.im
                    A.y += dy * diff * A.im
                    B.x -= dx * diff * B.im
                    B.y -= dy * diff * B.im
                }
                applyDrag()
            }
        }

        // A link seen from the front: an oval hoop
        function drawFace(x: number, y: number, ang: number, len: number) {
            const rx = len * 0.62,
                ry = len * 0.36
            const lw = len * 0.24

            ctx.save()
            ctx.translate(x + len * 0.04, y + len * 0.1)
            ctx.rotate(ang)
            ctx.lineWidth = lw * 1.2
            ctx.strokeStyle = "rgba(0,0,0,0.14)"
            ctx.beginPath()
            ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2)
            ctx.stroke()
            ctx.restore()

            ctx.save()
            ctx.translate(x, y)
            ctx.rotate(ang)
            ring(ctx, rx, ry, lw, ang, M)
            ctx.restore()
        }

        // A link seen from the side: a rounded bar
        function drawEdge(x: number, y: number, ang: number, len: number) {
            ctx.save()
            ctx.translate(x, y)
            ctx.rotate(ang)
            const L2 = len * 1.3,
                T = len * 0.32
            const facing =
                Math.sin(ang) * Math.cos(LIGHT) -
                Math.cos(ang) * Math.sin(LIGHT)
            const side = facing >= 0 ? -1 : 1
            const rr = (w: number, h: number) => {
                ctx.beginPath()
                if ((ctx as any).roundRect)
                    (ctx as any).roundRect(-w / 2, -h / 2, w, h, h / 2)
                else ctx.rect(-w / 2, -h / 2, w, h)
            }

            ctx.fillStyle = M.outline
            rr(L2 + T * 0.24, T * 1.24)
            ctx.fill()

            ctx.fillStyle = addStops(
                ctx.createLinearGradient(0, (side * T) / 2, 0, (-side * T) / 2),
                M
            )
            rr(L2, T)
            ctx.fill()

            ctx.lineCap = "round"
            ctx.lineWidth = T * 0.16
            ctx.strokeStyle = M.shine
            ctx.beginPath()
            ctx.moveTo(-L2 / 2 + T * 0.5, side * T * 0.24)
            ctx.lineTo(L2 / 2 - T * 0.5, side * T * 0.24)
            ctx.stroke()
            ctx.restore()
        }

        function render() {
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
            ctx.clearRect(0, 0, W, H)
            if (!built || !art || !shape) return
            const len = g.draw

            // Walk along each chain and place a small link every few pixels,
            // alternating front facing and side facing like a real chain
            for (const idx of chains) {
                let k = 0
                let carry = len / 2
                for (let j = 0; j < idx.length - 1; j++) {
                    const A = pts[idx[j]],
                        B = pts[idx[j + 1]]
                    const dx = B.x - A.x,
                        dy = B.y - A.y
                    const segLen = Math.hypot(dx, dy)
                    if (segLen < 0.0001) continue
                    const ang = Math.atan2(dy, dx)
                    let d = carry
                    while (d <= segLen) {
                        const f = d / segLen
                        const x = A.x + dx * f,
                            y = A.y + dy * f
                        if (y > -len * 2) {
                            if (k % 2 === 0) drawFace(x, y, ang, len)
                            else drawEdge(x, y, ang, len)
                        }
                        k++
                        d += len
                    }
                    carry = d - segLen
                }
            }

            const A = pts[tri[0]]
            const rot = plateAngle()
            ctx.save()
            ctx.translate(A.x, A.y)
            ctx.rotate(rot)
            ctx.shadowColor = "rgba(20,12,0,0.28)"
            ctx.shadowBlur = 24 * g.s
            ctx.shadowOffsetY = 14 * g.s
            ctx.drawImage(
                art,
                shape.sx,
                shape.sy,
                shape.sw,
                shape.sh,
                -g.p[0].x,
                -g.p[0].y,
                g.w,
                g.h
            )
            ctx.restore()

            // The hoops that join the chain to the pendant
            if (both) {
                for (const idx of chains) {
                    const end = pts[idx[idx.length - 1]],
                        prev = pts[idx[idx.length - 2]]
                    const ang = Math.atan2(end.y - prev.y, end.x - prev.x)
                    const r = len * 0.75
                    ctx.save()
                    ctx.translate(
                        end.x - Math.cos(ang) * len * 0.15,
                        end.y - Math.sin(ang) * len * 0.15
                    )
                    ctx.rotate(ang)
                    ring(ctx, r, r * 0.8, len * 0.24, ang, M)
                    ctx.restore()
                }
            } else {
                const r = len * 1.1
                const up = rot - Math.PI / 2
                ctx.save()
                ctx.translate(
                    A.x + Math.cos(up) * r * 0.2,
                    A.y + Math.sin(up) * r * 0.2
                )
                ctx.rotate(rot)
                ring(ctx, r * 0.78, r, len * 0.26, rot, M)
                ctx.restore()
            }
        }

        function hitPlate(x: number, y: number) {
            if (!built) return null
            const A = pts[tri[0]],
                a = plateAngle()
            const dx = x - A.x,
                dy = y - A.y
            const lx = dx * Math.cos(-a) - dy * Math.sin(-a) + g.p[0].x
            const ly = dx * Math.sin(-a) + dy * Math.cos(-a) + g.p[0].y
            const pad = Math.max(10, g.link * 0.6)
            if (lx > -pad && lx < g.w + pad && ly > -pad && ly < g.h + pad)
                return { gx: lx, gy: ly }
            return null
        }

        function nearChain(x: number, y: number) {
            if (!built) return -1
            let best = -1
            let bd = Math.max(22, g.link * 1.4)
            for (const idx of chains) {
                for (let k = 1; k < idx.length - 1; k++) {
                    const p = pts[idx[k]]
                    const d = Math.hypot(p.x - x, p.y - y)
                    if (d < bd) {
                        bd = d
                        best = idx[k]
                    }
                }
            }
            return best
        }

        function grab(x: number, y: number) {
            const hp = hitPlate(x, y)
            if (hp) {
                const [q0, q1, q2] = g.p
                const v0x = q1.x - q0.x,
                    v0y = q1.y - q0.y
                const v1x = q2.x - q0.x,
                    v1y = q2.y - q0.y
                const v2x = hp.gx - q0.x,
                    v2y = hp.gy - q0.y
                const d00 = v0x * v0x + v0y * v0y
                const d01 = v0x * v1x + v0y * v1y
                const d11 = v1x * v1x + v1y * v1y
                const d20 = v2x * v0x + v2y * v0y
                const d21 = v2x * v1x + v2y * v1y
                const den = d00 * d11 - d01 * d01 || 1
                const v = (d11 * d20 - d01 * d21) / den
                const bw = (d00 * d21 - d01 * d20) / den
                const u = 1 - v - bw
                drag = {
                    kind: "plate",
                    u,
                    v,
                    bw,
                    s: u * u + v * v + bw * bw || 1,
                }
                return true
            }
            const i = nearChain(x, y)
            if (i >= 0) {
                drag = { kind: "point", i }
                return true
            }
            return false
        }

        function frame(t: number) {
            if (dead) return
            const dt = Math.min(0.05, Math.max(0, (t - last) / 1000))
            last = t
            acc += dt
            const h = 1 / 120
            let n = 0
            while (acc >= h && n < 8) {
                step(h)
                acc -= h
                n++
            }
            render()
            let motion = 0
            for (const p of pts)
                motion += Math.abs(p.x - p.px) + Math.abs(p.y - p.py)
            // The pendant has to be still too, so it never freezes mid swing
            let body = 0
            for (const i of tri)
                body +=
                    Math.abs(pts[i].x - pts[i].px) +
                    Math.abs(pts[i].y - pts[i].py)
            if (
                !drag &&
                motion < pts.length * 0.01 &&
                body < 0.01 &&
                extend < 0.5
            )
                still++
            else still = 0
            if (still > 60) {
                sleeping = true
                return
            }
            raf = requestAnimationFrame(frame)
        }

        function wake() {
            if (!sleeping || dead) return
            sleeping = false
            still = 0
            acc = 0
            last = performance.now()
            raf = requestAnimationFrame(frame)
        }

        const local = (cx: number, cy: number) => {
            const r = canvas.getBoundingClientRect()
            // Accounts for the frame being scaled, like in Framer's canvas
            const sx = r.width ? W / r.width : 1
            const sy = r.height ? H / r.height : 1
            return { x: (cx - r.left) * sx, y: (cy - r.top) * sy }
        }
        const onDown = (e: PointerEvent) => {
            const p = local(e.clientX, e.clientY)
            if (!grab(p.x, p.y)) return
            ptr.x = p.x
            ptr.y = p.y
            try {
                canvas.setPointerCapture(e.pointerId)
            } catch {}
            canvas.style.cursor = "grabbing"
            wake()
        }
        const onMove = (e: PointerEvent) => {
            const p = local(e.clientX, e.clientY)
            if (drag) {
                ptr.x = p.x
                ptr.y = p.y
                wake()
                return
            }
            if (e.pointerType === "mouse") {
                canvas.style.cursor =
                    hitPlate(p.x, p.y) || nearChain(p.x, p.y) >= 0
                        ? "grab"
                        : "default"
            }
        }
        const onUp = (e: PointerEvent) => {
            if (!drag) return
            drag = null
            canvas.style.cursor = "grab"
            try {
                canvas.releasePointerCapture(e.pointerId)
            } catch {}
            wake()
        }
        // On phones, stop the page scrolling only when a finger is on the necklace
        const onTouchStart = (e: TouchEvent) => {
            const t = e.touches[0]
            if (!t) return
            const p = local(t.clientX, t.clientY)
            if (hitPlate(p.x, p.y) || nearChain(p.x, p.y) >= 0)
                e.preventDefault()
        }

        canvas.addEventListener("pointerdown", onDown)
        canvas.addEventListener("pointermove", onMove)
        canvas.addEventListener("pointerup", onUp)
        canvas.addEventListener("pointercancel", onUp)
        canvas.addEventListener("touchstart", onTouchStart, { passive: false })

        const start = () => {
            build(!reduced)
            render()
            wake()
        }
        const ready = (src: CanvasImageSource, nw: number, nh: number) => {
            if (dead) return
            art = src
            shape = analyse(src, nw, nh)
            if (started) start()
        }

        // Load the uploaded pendant
        if (pendantSrc) {
            const load = (cors: boolean) => {
                const img = new Image()
                if (cors) img.crossOrigin = "anonymous"
                img.onload = () =>
                    ready(img, img.naturalWidth, img.naturalHeight)
                img.onerror = () => {
                    if (cors) load(false)
                }
                img.src = pendantSrc
            }
            load(true)
        }

        // Drop in once the section scrolls into view
        const io = new IntersectionObserver(
            (entries) => {
                if (entries[0]?.isIntersecting && !started) {
                    started = true
                    start()
                    io.disconnect()
                }
            },
            { threshold: 0.25 }
        )
        io.observe(wrap)

        // Rebuild when the frame changes size, like rotating a phone
        let lastW = 0,
            lastH = 0
        const ro = new ResizeObserver(() => {
            const r = wrap.getBoundingClientRect()
            const widthChanged = Math.abs(r.width - lastW) > 1
            const heightChanged =
                lastH > 0 && Math.abs(r.height - lastH) / lastH > 0.15
            if (!widthChanged && !heightChanged && lastW > 0) return
            lastW = r.width
            lastH = r.height
            if (started) {
                build(false)
                render()
                wake()
            }
        })
        ro.observe(wrap)

        return () => {
            dead = true
            cancelAnimationFrame(raf)
            io.disconnect()
            ro.disconnect()
            canvas.removeEventListener("pointerdown", onDown)
            canvas.removeEventListener("pointermove", onMove)
            canvas.removeEventListener("pointerup", onUp)
            canvas.removeEventListener("pointercancel", onUp)
            canvas.removeEventListener("touchstart", onTouchStart)
        }
    }, [pendantSrc, metal, hangFrom, size, hangHeight])

    // Only shown in the Framer editor, before a pendant is added
    const showHint =
        !pendantSrc && RenderTarget.current() === RenderTarget.canvas

    return (
        <div
            ref={wrapRef}
            style={{
                position: "relative",
                width: "100%",
                height: "100%",
                ...style,
            }}
        >
            <canvas
                ref={canvasRef}
                style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    display: "block",
                    touchAction: "pan-y",
                }}
            />
            {showHint && (
                <div
                    style={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        textAlign: "center",
                        padding: 24,
                        fontFamily: "Inter, system-ui, sans-serif",
                        fontSize: 14,
                        color: "#8A8A8A",
                        pointerEvents: "none",
                    }}
                >
                    Add a picture of your pendant in the Pendant control on the
                    right.
                </div>
            )}
        </div>
    )
}

addPropertyControls(Necklace, {
    pendant: {
        type: ControlType.ResponsiveImage,
        title: "Pendant",
        description:
            "Add a picture of your necklace pendant. Use a PNG with a transparent background and no chain. The chain and hoops are added for you.",
    },
    metal: {
        type: ControlType.Enum,
        title: "Metal",
        options: ["Gold", "Silver", "Rose Gold"],
        defaultValue: "Gold",
        description:
            "The colour of the chain and hoops. Pick the one that matches your pendant.",
    },
    hangFrom: {
        type: ControlType.Enum,
        title: "Hang From",
        options: ["center", "ends"],
        optionTitles: ["Top Centre", "Both Ends"],
        defaultValue: "center",
        displaySegmentedControl: true,
        description:
            "Top Centre for hearts, lockets and charms. Both Ends for name and bar necklaces.",
    },
    size: {
        type: ControlType.Number,
        title: "Size",
        defaultValue: 34,
        min: 10,
        max: 90,
        unit: "%",
        description: "How big the pendant is compared to the frame.",
    },
    hangHeight: {
        type: ControlType.Number,
        title: "Hang Height",
        defaultValue: 45,
        min: 10,
        max: 85,
        unit: "%",
        description: "How far down the frame the pendant rests.",
    },
})
