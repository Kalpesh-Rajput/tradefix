import {
    c as e,
    n as t,
    r as n
} from "./createLucideIcon-DwuI3uP3.js";
import {
    r
} from "./dist-D3SFEfc9.js";
import {
    R as i,
    a,
    n as o,
    t as s
} from "./http-D6Yh-gg5.js";
import {
    S as c,
    _ as l,
    b as u,
    h as d,
    l as f,
    m as p
} from "./Combination-DQZp0Vig.js";
import {
    t as m
} from "./clsx-CjueKrWZ.js";
import {
    t as h
} from "./utils-Cz4MqTg-.js";
var g = e(n(), 1),
    _ = e(r(), 1),
    v = t(),
    y = e => typeof e == `boolean` ? `${e}` : e === 0 ? `0` : e,
    b = m,
    x = (e, t) => n => {
        if (t ? .variants == null) return b(e, n ? .class, n ? .className);
        let {
            variants: r,
            defaultVariants: i
        } = t, a = Object.keys(r).map(e => {
            let t = n ? .[e],
                a = i ? .[e];
            if (t === null) return null;
            let o = y(t) || y(a);
            return r[e][o]
        }), o = n && Object.entries(n).reduce((e, t) => {
            let [n, r] = t;
            return r === void 0 || (e[n] = r), e
        }, {});
        return b(e, a, t ? .compoundVariants ? .reduce((e, t) => {
            let {
                class: n,
                className: r,
                ...a
            } = t;
            return Object.entries(a).every(e => {
                let [t, n] = e;
                return Array.isArray(n) ? n.includes({ ...i,
                    ...o
                }[t]) : { ...i,
                    ...o
                }[t] === n
            }) ? [...e, n, r] : e
        }, []), n ? .class, n ? .className)
    },
    S = [`top`, `right`, `bottom`, `left`],
    C = Math.min,
    w = Math.max,
    T = Math.round,
    E = Math.floor,
    D = e => ({
        x: e,
        y: e
    }),
    O = {
        left: `right`,
        right: `left`,
        bottom: `top`,
        top: `bottom`
    };

function k(e, t, n) {
    return w(e, C(t, n))
}

function A(e, t) {
    return typeof e == `function` ? e(t) : e
}

function j(e) {
    return e.split(`-`)[0]
}

function M(e) {
    return e.split(`-`)[1]
}

function N(e) {
    return e === `x` ? `y` : `x`
}

function P(e) {
    return e === `y` ? `height` : `width`
}

function F(e) {
    let t = e[0];
    return t === `t` || t === `b` ? `y` : `x`
}

function ee(e) {
    return N(F(e))
}

function I(e, t, n) {
    n === void 0 && (n = !1);
    let r = M(e),
        i = ee(e),
        a = P(i),
        o = i === `x` ? r === (n ? `end` : `start`) ? `right` : `left` : r === `start` ? `bottom` : `top`;
    return t.reference[a] > t.floating[a] && (o = ae(o)), [o, ae(o)]
}

function L(e) {
    let t = ae(e);
    return [R(e), t, R(t)]
}

function R(e) {
    return e.includes(`start`) ? e.replace(`start`, `end`) : e.replace(`end`, `start`)
}
var z = [`left`, `right`],
    B = [`right`, `left`],
    te = [`top`, `bottom`],
    ne = [`bottom`, `top`];

function re(e, t, n) {
    switch (e) {
        case `top`:
        case `bottom`:
            return n ? t ? B : z : t ? z : B;
        case `left`:
        case `right`:
            return t ? te : ne;
        default:
            return []
    }
}

function ie(e, t, n, r) {
    let i = M(e),
        a = re(j(e), n === `start`, r);
    return i && (a = a.map(e => e + `-` + i), t && (a = a.concat(a.map(R)))), a
}

function ae(e) {
    let t = j(e);
    return O[t] + e.slice(t.length)
}

function oe(e) {
    return {
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        ...e
    }
}

function se(e) {
    return typeof e == `number` ? {
        top: e,
        right: e,
        bottom: e,
        left: e
    } : oe(e)
}

function ce(e) {
    let {
        x: t,
        y: n,
        width: r,
        height: i
    } = e;
    return {
        width: r,
        height: i,
        top: n,
        left: t,
        right: t + r,
        bottom: n + i,
        x: t,
        y: n
    }
}

function le(e, t, n) {
    let {
        reference: r,
        floating: i
    } = e, a = F(t), o = ee(t), s = P(o), c = j(t), l = a === `y`, u = r.x + r.width / 2 - i.width / 2, d = r.y + r.height / 2 - i.height / 2, f = r[s] / 2 - i[s] / 2, p;
    switch (c) {
        case `top`:
            p = {
                x: u,
                y: r.y - i.height
            };
            break;
        case `bottom`:
            p = {
                x: u,
                y: r.y + r.height
            };
            break;
        case `right`:
            p = {
                x: r.x + r.width,
                y: d
            };
            break;
        case `left`:
            p = {
                x: r.x - i.width,
                y: d
            };
            break;
        default:
            p = {
                x: r.x,
                y: r.y
            }
    }
    switch (M(t)) {
        case `start`:
            p[o] -= f * (n && l ? -1 : 1);
            break;
        case `end`:
            p[o] += f * (n && l ? -1 : 1);
            break
    }
    return p
}
async function ue(e, t) {
    t === void 0 && (t = {});
    let {
        x: n,
        y: r,
        platform: i,
        rects: a,
        elements: o,
        strategy: s
    } = e, {
        boundary: c = `clippingAncestors`,
        rootBoundary: l = `viewport`,
        elementContext: u = `floating`,
        altBoundary: d = !1,
        padding: f = 0
    } = A(t, e), p = se(f), m = o[d ? u === `floating` ? `reference` : `floating` : u], h = ce(await i.getClippingRect({
        element: await (i.isElement == null ? void 0 : i.isElement(m)) ? ? !0 ? m : m.contextElement || await (i.getDocumentElement == null ? void 0 : i.getDocumentElement(o.floating)),
        boundary: c,
        rootBoundary: l,
        strategy: s
    })), g = u === `floating` ? {
        x: n,
        y: r,
        width: a.floating.width,
        height: a.floating.height
    } : a.reference, _ = await (i.getOffsetParent == null ? void 0 : i.getOffsetParent(o.floating)), v = await (i.isElement == null ? void 0 : i.isElement(_)) && await (i.getScale == null ? void 0 : i.getScale(_)) || {
        x: 1,
        y: 1
    }, y = ce(i.convertOffsetParentRelativeRectToViewportRelativeRect ? await i.convertOffsetParentRelativeRectToViewportRelativeRect({
        elements: o,
        rect: g,
        offsetParent: _,
        strategy: s
    }) : g);
    return {
        top: (h.top - y.top + p.top) / v.y,
        bottom: (y.bottom - h.bottom + p.bottom) / v.y,
        left: (h.left - y.left + p.left) / v.x,
        right: (y.right - h.right + p.right) / v.x
    }
}
var de = 50,
    fe = async (e, t, n) => {
        let {
            placement: r = `bottom`,
            strategy: i = `absolute`,
            middleware: a = [],
            platform: o
        } = n, s = o.detectOverflow ? o : { ...o,
            detectOverflow: ue
        }, c = await (o.isRTL == null ? void 0 : o.isRTL(t)), l = await o.getElementRects({
            reference: e,
            floating: t,
            strategy: i
        }), {
            x: u,
            y: d
        } = le(l, r, c), f = r, p = 0, m = {};
        for (let n = 0; n < a.length; n++) {
            let h = a[n];
            if (!h) continue;
            let {
                name: g,
                fn: _
            } = h, {
                x: v,
                y,
                data: b,
                reset: x
            } = await _({
                x: u,
                y: d,
                initialPlacement: r,
                placement: f,
                strategy: i,
                middlewareData: m,
                rects: l,
                platform: s,
                elements: {
                    reference: e,
                    floating: t
                }
            });
            u = v ? ? u, d = y ? ? d, m[g] = { ...m[g],
                ...b
            }, x && p < de && (p++, typeof x == `object` && (x.placement && (f = x.placement), x.rects && (l = x.rects === !0 ? await o.getElementRects({
                reference: e,
                floating: t,
                strategy: i
            }) : x.rects), {
                x: u,
                y: d
            } = le(l, f, c)), n = -1)
        }
        return {
            x: u,
            y: d,
            placement: f,
            strategy: i,
            middlewareData: m
        }
    },
    pe = e => ({
        name: `arrow`,
        options: e,
        async fn(t) {
            let {
                x: n,
                y: r,
                placement: i,
                rects: a,
                platform: o,
                elements: s,
                middlewareData: c
            } = t, {
                element: l,
                padding: u = 0
            } = A(e, t) || {};
            if (l == null) return {};
            let d = se(u),
                f = {
                    x: n,
                    y: r
                },
                p = ee(i),
                m = P(p),
                h = await o.getDimensions(l),
                g = p === `y`,
                _ = g ? `top` : `left`,
                v = g ? `bottom` : `right`,
                y = g ? `clientHeight` : `clientWidth`,
                b = a.reference[m] + a.reference[p] - f[p] - a.floating[m],
                x = f[p] - a.reference[p],
                S = await (o.getOffsetParent == null ? void 0 : o.getOffsetParent(l)),
                w = S ? S[y] : 0;
            (!w || !await (o.isElement == null ? void 0 : o.isElement(S))) && (w = s.floating[y] || a.floating[m]);
            let T = b / 2 - x / 2,
                E = w / 2 - h[m] / 2 - 1,
                D = C(d[_], E),
                O = C(d[v], E),
                j = D,
                N = w - h[m] - O,
                F = w / 2 - h[m] / 2 + T,
                I = k(j, F, N),
                L = !c.arrow && M(i) != null && F !== I && a.reference[m] / 2 - (F < j ? D : O) - h[m] / 2 < 0,
                R = L ? F < j ? F - j : F - N : 0;
            return {
                [p]: f[p] + R,
                data: {
                    [p]: I,
                    centerOffset: F - I - R,
                    ...L && {
                        alignmentOffset: R
                    }
                },
                reset: L
            }
        }
    }),
    me = function(e) {
        return e === void 0 && (e = {}), {
            name: `flip`,
            options: e,
            async fn(t) {
                var n;
                let {
                    placement: r,
                    middlewareData: i,
                    rects: a,
                    initialPlacement: o,
                    platform: s,
                    elements: c
                } = t, {
                    mainAxis: l = !0,
                    crossAxis: u = !0,
                    fallbackPlacements: d,
                    fallbackStrategy: f = `bestFit`,
                    fallbackAxisSideDirection: p = `none`,
                    flipAlignment: m = !0,
                    ...h
                } = A(e, t);
                if ((n = i.arrow) != null && n.alignmentOffset) return {};
                let g = j(r),
                    _ = F(o),
                    v = j(o) === o,
                    y = await (s.isRTL == null ? void 0 : s.isRTL(c.floating)),
                    b = d || (v || !m ? [ae(o)] : L(o)),
                    x = p !== `none`;
                !d && x && b.push(...ie(o, m, p, y));
                let S = [o, ...b],
                    C = await s.detectOverflow(t, h),
                    w = [],
                    T = i.flip ? .overflows || [];
                if (l && w.push(C[g]), u) {
                    let e = I(r, a, y);
                    w.push(C[e[0]], C[e[1]])
                }
                if (T = [...T, {
                        placement: r,
                        overflows: w
                    }], !w.every(e => e <= 0)) {
                    let e = (i.flip ? .index || 0) + 1,
                        t = S[e];
                    if (t && (!(u === `alignment` && _ !== F(t)) || T.every(e => F(e.placement) === _ ? e.overflows[0] > 0 : !0))) return {
                        data: {
                            index: e,
                            overflows: T
                        },
                        reset: {
                            placement: t
                        }
                    };
                    let n = T.filter(e => e.overflows[0] <= 0).sort((e, t) => e.overflows[1] - t.overflows[1])[0] ? .placement;
                    if (!n) switch (f) {
                        case `bestFit`:
                            {
                                let e = T.filter(e => {
                                    if (x) {
                                        let t = F(e.placement);
                                        return t === _ || t === `y`
                                    }
                                    return !0
                                }).map(e => [e.placement, e.overflows.filter(e => e > 0).reduce((e, t) => e + t, 0)]).sort((e, t) => e[1] - t[1])[0] ? .[0];e && (n = e);
                                break
                            }
                        case `initialPlacement`:
                            n = o;
                            break
                    }
                    if (r !== n) return {
                        reset: {
                            placement: n
                        }
                    }
                }
                return {}
            }
        }
    };

function he(e, t) {
    return {
        top: e.top - t.height,
        right: e.right - t.width,
        bottom: e.bottom - t.height,
        left: e.left - t.width
    }
}

function ge(e) {
    return S.some(t => e[t] >= 0)
}
var _e = function(e) {
        return e === void 0 && (e = {}), {
            name: `hide`,
            options: e,
            async fn(t) {
                let {
                    rects: n,
                    platform: r
                } = t, {
                    strategy: i = `referenceHidden`,
                    ...a
                } = A(e, t);
                switch (i) {
                    case `referenceHidden`:
                        {
                            let e = he(await r.detectOverflow(t, { ...a,
                                elementContext: `reference`
                            }), n.reference);
                            return {
                                data: {
                                    referenceHiddenOffsets: e,
                                    referenceHidden: ge(e)
                                }
                            }
                        }
                    case `escaped`:
                        {
                            let e = he(await r.detectOverflow(t, { ...a,
                                altBoundary: !0
                            }), n.floating);
                            return {
                                data: {
                                    escapedOffsets: e,
                                    escaped: ge(e)
                                }
                            }
                        }
                    default:
                        return {}
                }
            }
        }
    },
    ve = new Set([`left`, `top`]);
async function ye(e, t) {
    let {
        placement: n,
        platform: r,
        elements: i
    } = e, a = await (r.isRTL == null ? void 0 : r.isRTL(i.floating)), o = j(n), s = M(n), c = F(n) === `y`, l = ve.has(o) ? -1 : 1, u = a && c ? -1 : 1, d = A(t, e), {
        mainAxis: f,
        crossAxis: p,
        alignmentAxis: m
    } = typeof d == `number` ? {
        mainAxis: d,
        crossAxis: 0,
        alignmentAxis: null
    } : {
        mainAxis: d.mainAxis || 0,
        crossAxis: d.crossAxis || 0,
        alignmentAxis: d.alignmentAxis
    };
    return s && typeof m == `number` && (p = s === `end` ? m * -1 : m), c ? {
        x: p * u,
        y: f * l
    } : {
        x: f * l,
        y: p * u
    }
}
var be = function(e) {
        return e === void 0 && (e = 0), {
            name: `offset`,
            options: e,
            async fn(t) {
                var n;
                let {
                    x: r,
                    y: i,
                    placement: a,
                    middlewareData: o
                } = t, s = await ye(t, e);
                return a === o.offset ? .placement && (n = o.arrow) != null && n.alignmentOffset ? {} : {
                    x: r + s.x,
                    y: i + s.y,
                    data: { ...s,
                        placement: a
                    }
                }
            }
        }
    },
    xe = function(e) {
        return e === void 0 && (e = {}), {
            name: `shift`,
            options: e,
            async fn(t) {
                let {
                    x: n,
                    y: r,
                    placement: i,
                    platform: a
                } = t, {
                    mainAxis: o = !0,
                    crossAxis: s = !1,
                    limiter: c = {
                        fn: e => {
                            let {
                                x: t,
                                y: n
                            } = e;
                            return {
                                x: t,
                                y: n
                            }
                        }
                    },
                    ...l
                } = A(e, t), u = {
                    x: n,
                    y: r
                }, d = await a.detectOverflow(t, l), f = F(j(i)), p = N(f), m = u[p], h = u[f];
                if (o) {
                    let e = p === `y` ? `top` : `left`,
                        t = p === `y` ? `bottom` : `right`,
                        n = m + d[e],
                        r = m - d[t];
                    m = k(n, m, r)
                }
                if (s) {
                    let e = f === `y` ? `top` : `left`,
                        t = f === `y` ? `bottom` : `right`,
                        n = h + d[e],
                        r = h - d[t];
                    h = k(n, h, r)
                }
                let g = c.fn({ ...t,
                    [p]: m,
                    [f]: h
                });
                return { ...g,
                    data: {
                        x: g.x - n,
                        y: g.y - r,
                        enabled: {
                            [p]: o,
                            [f]: s
                        }
                    }
                }
            }
        }
    },
    Se = function(e) {
        return e === void 0 && (e = {}), {
            options: e,
            fn(t) {
                let {
                    x: n,
                    y: r,
                    placement: i,
                    rects: a,
                    middlewareData: o
                } = t, {
                    offset: s = 0,
                    mainAxis: c = !0,
                    crossAxis: l = !0
                } = A(e, t), u = {
                    x: n,
                    y: r
                }, d = F(i), f = N(d), p = u[f], m = u[d], h = A(s, t), g = typeof h == `number` ? {
                    mainAxis: h,
                    crossAxis: 0
                } : {
                    mainAxis: 0,
                    crossAxis: 0,
                    ...h
                };
                if (c) {
                    let e = f === `y` ? `height` : `width`,
                        t = a.reference[f] - a.floating[e] + g.mainAxis,
                        n = a.reference[f] + a.reference[e] - g.mainAxis;
                    p < t ? p = t : p > n && (p = n)
                }
                if (l) {
                    let e = f === `y` ? `width` : `height`,
                        t = ve.has(j(i)),
                        n = a.reference[d] - a.floating[e] + (t && o.offset ? .[d] || 0) + (t ? 0 : g.crossAxis),
                        r = a.reference[d] + a.reference[e] + (t ? 0 : o.offset ? .[d] || 0) - (t ? g.crossAxis : 0);
                    m < n ? m = n : m > r && (m = r)
                }
                return {
                    [f]: p,
                    [d]: m
                }
            }
        }
    },
    Ce = function(e) {
        return e === void 0 && (e = {}), {
            name: `size`,
            options: e,
            async fn(t) {
                var n, r;
                let {
                    placement: i,
                    rects: a,
                    platform: o,
                    elements: s
                } = t, {
                    apply: c = () => {},
                    ...l
                } = A(e, t), u = await o.detectOverflow(t, l), d = j(i), f = M(i), p = F(i) === `y`, {
                    width: m,
                    height: h
                } = a.floating, g, _;
                d === `top` || d === `bottom` ? (g = d, _ = f === (await (o.isRTL == null ? void 0 : o.isRTL(s.floating)) ? `start` : `end`) ? `left` : `right`) : (_ = d, g = f === `end` ? `top` : `bottom`);
                let v = h - u.top - u.bottom,
                    y = m - u.left - u.right,
                    b = C(h - u[g], v),
                    x = C(m - u[_], y),
                    S = !t.middlewareData.shift,
                    T = b,
                    E = x;
                if ((n = t.middlewareData.shift) != null && n.enabled.x && (E = y), (r = t.middlewareData.shift) != null && r.enabled.y && (T = v), S && !f) {
                    let e = w(u.left, 0),
                        t = w(u.right, 0),
                        n = w(u.top, 0),
                        r = w(u.bottom, 0);
                    p ? E = m - 2 * (e !== 0 || t !== 0 ? e + t : w(u.left, u.right)) : T = h - 2 * (n !== 0 || r !== 0 ? n + r : w(u.top, u.bottom))
                }
                await c({ ...t,
                    availableWidth: E,
                    availableHeight: T
                });
                let D = await o.getDimensions(s.floating);
                return m !== D.width || h !== D.height ? {
                    reset: {
                        rects: !0
                    }
                } : {}
            }
        }
    };

function we() {
    return typeof window < `u`
}

function V(e) {
    return Te(e) ? (e.nodeName || ``).toLowerCase() : `#document`
}

function H(e) {
    var t;
    return (e == null || (t = e.ownerDocument) == null ? void 0 : t.defaultView) || window
}

function U(e) {
    return ((Te(e) ? e.ownerDocument : e.document) || window.document) ? .documentElement
}

function Te(e) {
    return we() ? e instanceof Node || e instanceof H(e).Node : !1
}

function W(e) {
    return we() ? e instanceof Element || e instanceof H(e).Element : !1
}

function G(e) {
    return we() ? e instanceof HTMLElement || e instanceof H(e).HTMLElement : !1
}

function Ee(e) {
    return !we() || typeof ShadowRoot > `u` ? !1 : e instanceof ShadowRoot || e instanceof H(e).ShadowRoot
}

function K(e) {
    let {
        overflow: t,
        overflowX: n,
        overflowY: r,
        display: i
    } = Y(e);
    return /auto|scroll|overlay|hidden|clip/.test(t + r + n) && i !== `inline` && i !== `contents`
}

function De(e) {
    return /^(table|td|th)$/.test(V(e))
}

function Oe(e) {
    try {
        if (e.matches(`:popover-open`)) return !0
    } catch {}
    try {
        return e.matches(`:modal`)
    } catch {
        return !1
    }
}
var ke = /transform|translate|scale|rotate|perspective|filter/,
    Ae = /paint|layout|strict|content/,
    q = e => !!e && e !== `none`,
    je;

function Me(e) {
    let t = W(e) ? Y(e) : e;
    return q(t.transform) || q(t.translate) || q(t.scale) || q(t.rotate) || q(t.perspective) || !Pe() && (q(t.backdropFilter) || q(t.filter)) || ke.test(t.willChange || ``) || Ae.test(t.contain || ``)
}

function Ne(e) {
    let t = X(e);
    for (; G(t) && !J(t);) {
        if (Me(t)) return t;
        if (Oe(t)) return null;
        t = X(t)
    }
    return null
}

function Pe() {
    return je ? ? = typeof CSS < `u` && CSS.supports && CSS.supports(`-webkit-backdrop-filter`, `none`), je
}

function J(e) {
    return /^(html|body|#document)$/.test(V(e))
}

function Y(e) {
    return H(e).getComputedStyle(e)
}

function Fe(e) {
    return W(e) ? {
        scrollLeft: e.scrollLeft,
        scrollTop: e.scrollTop
    } : {
        scrollLeft: e.scrollX,
        scrollTop: e.scrollY
    }
}

function X(e) {
    if (V(e) === `html`) return e;
    let t = e.assignedSlot || e.parentNode || Ee(e) && e.host || U(e);
    return Ee(t) ? t.host : t
}

function Ie(e) {
    let t = X(e);
    return J(t) ? e.ownerDocument ? e.ownerDocument.body : e.body : G(t) && K(t) ? t : Ie(t)
}

function Le(e, t, n) {
    t === void 0 && (t = []), n === void 0 && (n = !0);
    let r = Ie(e),
        i = r === e.ownerDocument ? .body,
        a = H(r);
    if (i) {
        let e = Re(a);
        return t.concat(a, a.visualViewport || [], K(r) ? r : [], e && n ? Le(e) : [])
    } else return t.concat(r, Le(r, [], n))
}

function Re(e) {
    return e.parent && Object.getPrototypeOf(e.parent) ? e.frameElement : null
}

function ze(e) {
    let t = Y(e),
        n = parseFloat(t.width) || 0,
        r = parseFloat(t.height) || 0,
        i = G(e),
        a = i ? e.offsetWidth : n,
        o = i ? e.offsetHeight : r,
        s = T(n) !== a || T(r) !== o;
    return s && (n = a, r = o), {
        width: n,
        height: r,
        $: s
    }
}

function Be(e) {
    return W(e) ? e : e.contextElement
}

function Z(e) {
    let t = Be(e);
    if (!G(t)) return D(1);
    let n = t.getBoundingClientRect(),
        {
            width: r,
            height: i,
            $: a
        } = ze(t),
        o = (a ? T(n.width) : n.width) / r,
        s = (a ? T(n.height) : n.height) / i;
    return (!o || !Number.isFinite(o)) && (o = 1), (!s || !Number.isFinite(s)) && (s = 1), {
        x: o,
        y: s
    }
}
var Ve = D(0);

function He(e) {
    let t = H(e);
    return !Pe() || !t.visualViewport ? Ve : {
        x: t.visualViewport.offsetLeft,
        y: t.visualViewport.offsetTop
    }
}

function Ue(e, t, n) {
    return t === void 0 && (t = !1), !n || t && n !== H(e) ? !1 : t
}

function Q(e, t, n, r) {
    t === void 0 && (t = !1), n === void 0 && (n = !1);
    let i = e.getBoundingClientRect(),
        a = Be(e),
        o = D(1);
    t && (r ? W(r) && (o = Z(r)) : o = Z(e));
    let s = Ue(a, n, r) ? He(a) : D(0),
        c = (i.left + s.x) / o.x,
        l = (i.top + s.y) / o.y,
        u = i.width / o.x,
        d = i.height / o.y;
    if (a) {
        let e = H(a),
            t = r && W(r) ? H(r) : r,
            n = e,
            i = Re(n);
        for (; i && r && t !== n;) {
            let e = Z(i),
                t = i.getBoundingClientRect(),
                r = Y(i),
                a = t.left + (i.clientLeft + parseFloat(r.paddingLeft)) * e.x,
                o = t.top + (i.clientTop + parseFloat(r.paddingTop)) * e.y;
            c *= e.x, l *= e.y, u *= e.x, d *= e.y, c += a, l += o, n = H(i), i = Re(n)
        }
    }
    return ce({
        width: u,
        height: d,
        x: c,
        y: l
    })
}

function We(e, t) {
    let n = Fe(e).scrollLeft;
    return t ? t.left + n : Q(U(e)).left + n
}

function Ge(e, t) {
    let n = e.getBoundingClientRect();
    return {
        x: n.left + t.scrollLeft - We(e, n),
        y: n.top + t.scrollTop
    }
}

function Ke(e) {
    let {
        elements: t,
        rect: n,
        offsetParent: r,
        strategy: i
    } = e, a = i === `fixed`, o = U(r), s = t ? Oe(t.floating) : !1;
    if (r === o || s && a) return n;
    let c = {
            scrollLeft: 0,
            scrollTop: 0
        },
        l = D(1),
        u = D(0),
        d = G(r);
    if ((d || !d && !a) && ((V(r) !== `body` || K(o)) && (c = Fe(r)), d)) {
        let e = Q(r);
        l = Z(r), u.x = e.x + r.clientLeft, u.y = e.y + r.clientTop
    }
    let f = o && !d && !a ? Ge(o, c) : D(0);
    return {
        width: n.width * l.x,
        height: n.height * l.y,
        x: n.x * l.x - c.scrollLeft * l.x + u.x + f.x,
        y: n.y * l.y - c.scrollTop * l.y + u.y + f.y
    }
}

function qe(e) {
    return Array.from(e.getClientRects())
}

function Je(e) {
    let t = U(e),
        n = Fe(e),
        r = e.ownerDocument.body,
        i = w(t.scrollWidth, t.clientWidth, r.scrollWidth, r.clientWidth),
        a = w(t.scrollHeight, t.clientHeight, r.scrollHeight, r.clientHeight),
        o = -n.scrollLeft + We(e),
        s = -n.scrollTop;
    return Y(r).direction === `rtl` && (o += w(t.clientWidth, r.clientWidth) - i), {
        width: i,
        height: a,
        x: o,
        y: s
    }
}
var Ye = 25;

function Xe(e, t) {
    let n = H(e),
        r = U(e),
        i = n.visualViewport,
        a = r.clientWidth,
        o = r.clientHeight,
        s = 0,
        c = 0;
    if (i) {
        a = i.width, o = i.height;
        let e = Pe();
        (!e || e && t === `fixed`) && (s = i.offsetLeft, c = i.offsetTop)
    }
    let l = We(r);
    if (l <= 0) {
        let e = r.ownerDocument,
            t = e.body,
            n = getComputedStyle(t),
            i = e.compatMode === `CSS1Compat` && parseFloat(n.marginLeft) + parseFloat(n.marginRight) || 0,
            o = Math.abs(r.clientWidth - t.clientWidth - i);
        o <= Ye && (a -= o)
    } else l <= Ye && (a += l);
    return {
        width: a,
        height: o,
        x: s,
        y: c
    }
}

function Ze(e, t) {
    let n = Q(e, !0, t === `fixed`),
        r = n.top + e.clientTop,
        i = n.left + e.clientLeft,
        a = G(e) ? Z(e) : D(1);
    return {
        width: e.clientWidth * a.x,
        height: e.clientHeight * a.y,
        x: i * a.x,
        y: r * a.y
    }
}

function Qe(e, t, n) {
    let r;
    if (t === `viewport`) r = Xe(e, n);
    else if (t === `document`) r = Je(U(e));
    else if (W(t)) r = Ze(t, n);
    else {
        let n = He(e);
        r = {
            x: t.x - n.x,
            y: t.y - n.y,
            width: t.width,
            height: t.height
        }
    }
    return ce(r)
}

function $e(e, t) {
    let n = X(e);
    return n === t || !W(n) || J(n) ? !1 : Y(n).position === `fixed` || $e(n, t)
}

function et(e, t) {
    let n = t.get(e);
    if (n) return n;
    let r = Le(e, [], !1).filter(e => W(e) && V(e) !== `body`),
        i = null,
        a = Y(e).position === `fixed`,
        o = a ? X(e) : e;
    for (; W(o) && !J(o);) {
        let t = Y(o),
            n = Me(o);
        !n && t.position === `fixed` && (i = null), (a ? !n && !i : !n && t.position === `static` && i && (i.position === `absolute` || i.position === `fixed`) || K(o) && !n && $e(e, o)) ? r = r.filter(e => e !== o) : i = t, o = X(o)
    }
    return t.set(e, r), r
}

function tt(e) {
    let {
        element: t,
        boundary: n,
        rootBoundary: r,
        strategy: i
    } = e, a = [...n === `clippingAncestors` ? Oe(t) ? [] : et(t, this._c) : [].concat(n), r], o = Qe(t, a[0], i), s = o.top, c = o.right, l = o.bottom, u = o.left;
    for (let e = 1; e < a.length; e++) {
        let n = Qe(t, a[e], i);
        s = w(n.top, s), c = C(n.right, c), l = C(n.bottom, l), u = w(n.left, u)
    }
    return {
        width: c - u,
        height: l - s,
        x: u,
        y: s
    }
}

function nt(e) {
    let {
        width: t,
        height: n
    } = ze(e);
    return {
        width: t,
        height: n
    }
}

function rt(e, t, n) {
    let r = G(t),
        i = U(t),
        a = n === `fixed`,
        o = Q(e, !0, a, t),
        s = {
            scrollLeft: 0,
            scrollTop: 0
        },
        c = D(0);

    function l() {
        c.x = We(i)
    }
    if (r || !r && !a)
        if ((V(t) !== `body` || K(i)) && (s = Fe(t)), r) {
            let e = Q(t, !0, a, t);
            c.x = e.x + t.clientLeft, c.y = e.y + t.clientTop
        } else i && l();
    a && !r && i && l();
    let u = i && !r && !a ? Ge(i, s) : D(0);
    return {
        x: o.left + s.scrollLeft - c.x - u.x,
        y: o.top + s.scrollTop - c.y - u.y,
        width: o.width,
        height: o.height
    }
}

function it(e) {
    return Y(e).position === `static`
}

function at(e, t) {
    if (!G(e) || Y(e).position === `fixed`) return null;
    if (t) return t(e);
    let n = e.offsetParent;
    return U(e) === n && (n = n.ownerDocument.body), n
}

function ot(e, t) {
    let n = H(e);
    if (Oe(e)) return n;
    if (!G(e)) {
        let t = X(e);
        for (; t && !J(t);) {
            if (W(t) && !it(t)) return t;
            t = X(t)
        }
        return n
    }
    let r = at(e, t);
    for (; r && De(r) && it(r);) r = at(r, t);
    return r && J(r) && it(r) && !Me(r) ? n : r || Ne(e) || n
}
var st = async function(e) {
    let t = this.getOffsetParent || ot,
        n = this.getDimensions,
        r = await n(e.floating);
    return {
        reference: rt(e.reference, await t(e.floating), e.strategy),
        floating: {
            x: 0,
            y: 0,
            width: r.width,
            height: r.height
        }
    }
};

function ct(e) {
    return Y(e).direction === `rtl`
}
var lt = {
    convertOffsetParentRelativeRectToViewportRelativeRect: Ke,
    getDocumentElement: U,
    getClippingRect: tt,
    getOffsetParent: ot,
    getElementRects: st,
    getClientRects: qe,
    getDimensions: nt,
    getScale: Z,
    isElement: W,
    isRTL: ct
};

function ut(e, t) {
    return e.x === t.x && e.y === t.y && e.width === t.width && e.height === t.height
}

function dt(e, t) {
    let n = null,
        r, i = U(e);

    function a() {
        var e;
        clearTimeout(r), (e = n) == null || e.disconnect(), n = null
    }

    function o(s, c) {
        s === void 0 && (s = !1), c === void 0 && (c = 1), a();
        let l = e.getBoundingClientRect(),
            {
                left: u,
                top: d,
                width: f,
                height: p
            } = l;
        if (s || t(), !f || !p) return;
        let m = E(d),
            h = E(i.clientWidth - (u + f)),
            g = E(i.clientHeight - (d + p)),
            _ = E(u),
            v = {
                rootMargin: -m + `px ` + -h + `px ` + -g + `px ` + -_ + `px`,
                threshold: w(0, C(1, c)) || 1
            },
            y = !0;

        function b(t) {
            let n = t[0].intersectionRatio;
            if (n !== c) {
                if (!y) return o();
                n ? o(!1, n) : r = setTimeout(() => {
                    o(!1, 1e-7)
                }, 1e3)
            }
            n === 1 && !ut(l, e.getBoundingClientRect()) && o(), y = !1
        }
        try {
            n = new IntersectionObserver(b, { ...v,
                root: i.ownerDocument
            })
        } catch {
            n = new IntersectionObserver(b, v)
        }
        n.observe(e)
    }
    return o(!0), a
}

function ft(e, t, n, r) {
    r === void 0 && (r = {});
    let {
        ancestorScroll: i = !0,
        ancestorResize: a = !0,
        elementResize: o = typeof ResizeObserver == `function`,
        layoutShift: s = typeof IntersectionObserver == `function`,
        animationFrame: c = !1
    } = r, l = Be(e), u = i || a ? [...l ? Le(l) : [], ...t ? Le(t) : []] : [];
    u.forEach(e => {
        i && e.addEventListener(`scroll`, n, {
            passive: !0
        }), a && e.addEventListener(`resize`, n)
    });
    let d = l && s ? dt(l, n) : null,
        f = -1,
        p = null;
    o && (p = new ResizeObserver(e => {
        let [r] = e;
        r && r.target === l && p && t && (p.unobserve(t), cancelAnimationFrame(f), f = requestAnimationFrame(() => {
            var e;
            (e = p) == null || e.observe(t)
        })), n()
    }), l && !c && p.observe(l), t && p.observe(t));
    let m, h = c ? Q(e) : null;
    c && g();

    function g() {
        let t = Q(e);
        h && !ut(h, t) && n(), h = t, m = requestAnimationFrame(g)
    }
    return n(), () => {
        var e;
        u.forEach(e => {
            i && e.removeEventListener(`scroll`, n), a && e.removeEventListener(`resize`, n)
        }), d ? .(), (e = p) == null || e.disconnect(), p = null, c && cancelAnimationFrame(m)
    }
}
var pt = be,
    mt = xe,
    ht = me,
    gt = Ce,
    _t = _e,
    vt = pe,
    yt = Se,
    bt = (e, t, n) => {
        let r = new Map,
            i = {
                platform: lt,
                ...n
            },
            a = { ...i.platform,
                _c: r
            };
        return fe(e, t, { ...i,
            platform: a
        })
    },
    xt = typeof document < `u` ? g.useLayoutEffect : function() {};

function St(e, t) {
    if (e === t) return !0;
    if (typeof e != typeof t) return !1;
    if (typeof e == `function` && e.toString() === t.toString()) return !0;
    let n, r, i;
    if (e && t && typeof e == `object`) {
        if (Array.isArray(e)) {
            if (n = e.length, n !== t.length) return !1;
            for (r = n; r-- !== 0;)
                if (!St(e[r], t[r])) return !1;
            return !0
        }
        if (i = Object.keys(e), n = i.length, n !== Object.keys(t).length) return !1;
        for (r = n; r-- !== 0;)
            if (!{}.hasOwnProperty.call(t, i[r])) return !1;
        for (r = n; r-- !== 0;) {
            let n = i[r];
            if (!(n === `_owner` && e.$$typeof) && !St(e[n], t[n])) return !1
        }
        return !0
    }
    return e !== e && t !== t
}

function Ct(e) {
    return typeof window > `u` ? 1 : (e.ownerDocument.defaultView || window).devicePixelRatio || 1
}

function wt(e, t) {
    let n = Ct(e);
    return Math.round(t * n) / n
}

function Tt(e) {
    let t = g.useRef(e);
    return xt(() => {
        t.current = e
    }), t
}

function Et(e) {
    e === void 0 && (e = {});
    let {
        placement: t = `bottom`,
        strategy: n = `absolute`,
        middleware: r = [],
        platform: i,
        elements: {
            reference: a,
            floating: o
        } = {},
        transform: s = !0,
        whileElementsMounted: c,
        open: l
    } = e, [u, d] = g.useState({
        x: 0,
        y: 0,
        strategy: n,
        placement: t,
        middlewareData: {},
        isPositioned: !1
    }), [f, p] = g.useState(r);
    St(f, r) || p(r);
    let [m, h] = g.useState(null), [v, y] = g.useState(null), b = g.useCallback(e => {
        e !== w.current && (w.current = e, h(e))
    }, []), x = g.useCallback(e => {
        e !== T.current && (T.current = e, y(e))
    }, []), S = a || m, C = o || v, w = g.useRef(null), T = g.useRef(null), E = g.useRef(u), D = c != null, O = Tt(c), k = Tt(i), A = Tt(l), j = g.useCallback(() => {
        if (!w.current || !T.current) return;
        let e = {
            placement: t,
            strategy: n,
            middleware: f
        };
        k.current && (e.platform = k.current), bt(w.current, T.current, e).then(e => {
            let t = { ...e,
                isPositioned: A.current !== !1
            };
            M.current && !St(E.current, t) && (E.current = t, _.flushSync(() => {
                d(t)
            }))
        })
    }, [f, t, n, k, A]);
    xt(() => {
        l === !1 && E.current.isPositioned && (E.current.isPositioned = !1, d(e => ({ ...e,
            isPositioned: !1
        })))
    }, [l]);
    let M = g.useRef(!1);
    xt(() => (M.current = !0, () => {
        M.current = !1
    }), []), xt(() => {
        if (S && (w.current = S), C && (T.current = C), S && C) {
            if (O.current) return O.current(S, C, j);
            j()
        }
    }, [S, C, j, O, D]);
    let N = g.useMemo(() => ({
            reference: w,
            floating: T,
            setReference: b,
            setFloating: x
        }), [b, x]),
        P = g.useMemo(() => ({
            reference: S,
            floating: C
        }), [S, C]),
        F = g.useMemo(() => {
            let e = {
                position: n,
                left: 0,
                top: 0
            };
            if (!P.floating) return e;
            let t = wt(P.floating, u.x),
                r = wt(P.floating, u.y);
            return s ? { ...e,
                transform: `translate(` + t + `px, ` + r + `px)`,
                ...Ct(P.floating) >= 1.5 && {
                    willChange: `transform`
                }
            } : {
                position: n,
                left: t,
                top: r
            }
        }, [n, s, P.floating, u.x, u.y]);
    return g.useMemo(() => ({ ...u,
        update: j,
        refs: N,
        elements: P,
        floatingStyles: F
    }), [u, j, N, P, F])
}
var Dt = e => {
        function t(e) {
            return {}.hasOwnProperty.call(e, `current`)
        }
        return {
            name: `arrow`,
            options: e,
            fn(n) {
                let {
                    element: r,
                    padding: i
                } = typeof e == `function` ? e(n) : e;
                return r && t(r) ? r.current == null ? {} : vt({
                    element: r.current,
                    padding: i
                }).fn(n) : r ? vt({
                    element: r,
                    padding: i
                }).fn(n) : {}
            }
        }
    },
    Ot = (e, t) => {
        let n = pt(e);
        return {
            name: n.name,
            fn: n.fn,
            options: [e, t]
        }
    },
    kt = (e, t) => {
        let n = mt(e);
        return {
            name: n.name,
            fn: n.fn,
            options: [e, t]
        }
    },
    At = (e, t) => ({
        fn: yt(e).fn,
        options: [e, t]
    }),
    jt = (e, t) => {
        let n = ht(e);
        return {
            name: n.name,
            fn: n.fn,
            options: [e, t]
        }
    },
    Mt = (e, t) => {
        let n = gt(e);
        return {
            name: n.name,
            fn: n.fn,
            options: [e, t]
        }
    },
    Nt = (e, t) => {
        let n = _t(e);
        return {
            name: n.name,
            fn: n.fn,
            options: [e, t]
        }
    },
    Pt = (e, t) => {
        let n = Dt(e);
        return {
            name: n.name,
            fn: n.fn,
            options: [e, t]
        }
    },
    Ft = `Arrow`,
    It = g.forwardRef((e, t) => {
        let {
            children: n,
            width: r = 10,
            height: i = 5,
            ...a
        } = e;
        return (0, v.jsx)(d.svg, { ...a,
            ref: t,
            width: r,
            height: i,
            viewBox: `0 0 30 10`,
            preserveAspectRatio: `none`,
            children: e.asChild ? n : (0, v.jsx)(`polygon`, {
                points: `0,0 30,0 15,10`
            })
        })
    });
It.displayName = Ft;
var Lt = It;

function Rt(e) {
    let [t, n] = g.useState(void 0);
    return f(() => {
        if (e) {
            n({
                width: e.offsetWidth,
                height: e.offsetHeight
            });
            let t = new ResizeObserver(t => {
                if (!Array.isArray(t) || !t.length) return;
                let r = t[0],
                    i, a;
                if (`borderBoxSize` in r) {
                    let e = r.borderBoxSize,
                        t = Array.isArray(e) ? e[0] : e;
                    i = t.inlineSize, a = t.blockSize
                } else i = e.offsetWidth, a = e.offsetHeight;
                n({
                    width: i,
                    height: a
                })
            });
            return t.observe(e, {
                box: `border-box`
            }), () => t.unobserve(e)
        } else n(void 0)
    }, [e]), t
}
var zt = `Popper`,
    [Bt, Vt] = u(zt),
    [Ht, Ut] = Bt(zt),
    Wt = e => {
        let {
            __scopePopper: t,
            children: n
        } = e, [r, i] = g.useState(null), [a, o] = g.useState(void 0);
        return (0, v.jsx)(Ht, {
            scope: t,
            anchor: r,
            onAnchorChange: i,
            placementState: a,
            setPlacementState: o,
            children: n
        })
    };
Wt.displayName = zt;
var Gt = `PopperAnchor`,
    Kt = g.forwardRef((e, t) => {
        let {
            __scopePopper: n,
            virtualRef: r,
            ...i
        } = e, a = Ut(Gt, n), o = g.useRef(null), s = a.onAnchorChange, l = c(t, g.useCallback(e => {
            o.current = e, e && s(e)
        }, [s])), u = g.useRef(null);
        g.useEffect(() => {
            if (!r) return;
            let e = u.current;
            u.current = r.current, e !== u.current && s(u.current)
        });
        let f = a.placementState && nn(a.placementState),
            p = f ? .[0],
            m = f ? .[1];
        return r ? null : (0, v.jsx)(d.div, {
            "data-radix-popper-side": p,
            "data-radix-popper-align": m,
            ...i,
            ref: l
        })
    });
Kt.displayName = Gt;
var qt = `PopperContent`,
    [Jt, Yt] = Bt(qt),
    Xt = g.forwardRef((e, t) => {
        let {
            __scopePopper: n,
            side: r = `bottom`,
            sideOffset: i = 0,
            align: a = `center`,
            alignOffset: o = 0,
            arrowPadding: s = 0,
            avoidCollisions: l = !0,
            collisionBoundary: u = [],
            collisionPadding: m = 0,
            sticky: h = `partial`,
            hideWhenDetached: _ = !1,
            updatePositionStrategy: y = `optimized`,
            onPlaced: b,
            ...x
        } = e, S = Ut(qt, n), [C, w] = g.useState(null), T = c(t, e => w(e)), [E, D] = g.useState(null), O = Rt(E), k = O ? .width ? ? 0, A = O ? .height ? ? 0, j = r + (a === `center` ? `` : `-` + a), M = typeof m == `number` ? m : {
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            ...m
        }, N = Array.isArray(u) ? u : [u], P = N.length > 0, F = {
            padding: M,
            boundary: N.filter(en),
            altBoundary: P
        }, {
            refs: ee,
            floatingStyles: I,
            placement: L,
            isPositioned: R,
            middlewareData: z
        } = Et({
            strategy: `fixed`,
            placement: j,
            whileElementsMounted: (...e) => ft(...e, {
                animationFrame: y === `always`
            }),
            elements: {
                reference: S.anchor
            },
            middleware: [Ot({
                mainAxis: i + A,
                alignmentAxis: o
            }), l && kt({
                mainAxis: !0,
                crossAxis: !1,
                limiter: h === `partial` ? At() : void 0,
                ...F
            }), l && jt({ ...F
            }), Mt({ ...F,
                apply: ({
                    elements: e,
                    rects: t,
                    availableWidth: n,
                    availableHeight: r
                }) => {
                    let {
                        width: i,
                        height: a
                    } = t.reference, o = e.floating.style;
                    o.setProperty(`--radix-popper-available-width`, `${n}px`), o.setProperty(`--radix-popper-available-height`, `${r}px`), o.setProperty(`--radix-popper-anchor-width`, `${i}px`), o.setProperty(`--radix-popper-anchor-height`, `${a}px`)
                }
            }), E && Pt({
                element: E,
                padding: s
            }), tn({
                arrowWidth: k,
                arrowHeight: A
            }), _ && Nt({
                strategy: `referenceHidden`,
                ...F,
                boundary: P ? F.boundary : void 0
            })]
        }), B = S.setPlacementState;
        f(() => (B(L), () => {
            B(void 0)
        }), [L, B]);
        let [te, ne] = nn(L), re = p(b);
        f(() => {
            R && re ? .()
        }, [R, re]);
        let ie = z.arrow ? .x,
            ae = z.arrow ? .y,
            oe = z.arrow ? .centerOffset !== 0,
            [se, ce] = g.useState();
        return f(() => {
            C && ce(window.getComputedStyle(C).zIndex)
        }, [C]), (0, v.jsx)(`div`, {
            ref: ee.setFloating,
            "data-radix-popper-content-wrapper": ``,
            style: { ...I,
                transform: R ? I.transform : `translate(0, -200%)`,
                minWidth: `max-content`,
                zIndex: se,
                "--radix-popper-transform-origin": [z.transformOrigin ? .x, z.transformOrigin ? .y].join(` `),
                ...z.hide ? .referenceHidden && {
                    visibility: `hidden`,
                    pointerEvents: `none`
                }
            },
            dir: e.dir,
            children: (0, v.jsx)(Jt, {
                scope: n,
                placedSide: te,
                placedAlign: ne,
                onArrowChange: D,
                arrowX: ie,
                arrowY: ae,
                shouldHideArrow: oe,
                children: (0, v.jsx)(d.div, {
                    "data-side": te,
                    "data-align": ne,
                    ...x,
                    ref: T,
                    style: { ...x.style,
                        animation: R ? void 0 : `none`
                    }
                })
            })
        })
    });
Xt.displayName = qt;
var Zt = `PopperArrow`,
    Qt = {
        top: `bottom`,
        right: `left`,
        bottom: `top`,
        left: `right`
    },
    $t = g.forwardRef(function(e, t) {
        let {
            __scopePopper: n,
            ...r
        } = e, i = Yt(Zt, n), a = Qt[i.placedSide];
        return (0, v.jsx)(`span`, {
            ref: i.onArrowChange,
            style: {
                position: `absolute`,
                left: i.arrowX,
                top: i.arrowY,
                [a]: 0,
                transformOrigin: {
                    top: ``,
                    right: `0 0`,
                    bottom: `center 0`,
                    left: `100% 0`
                }[i.placedSide],
                transform: {
                    top: `translateY(100%)`,
                    right: `translateY(50%) rotate(90deg) translateX(-50%)`,
                    bottom: `rotate(180deg)`,
                    left: `translateY(50%) rotate(-90deg) translateX(50%)`
                }[i.placedSide],
                visibility: i.shouldHideArrow ? `hidden` : void 0
            },
            children: (0, v.jsx)(Lt, { ...r,
                ref: t,
                style: { ...r.style,
                    display: `block`
                }
            })
        })
    });
$t.displayName = Zt;

function en(e) {
    return e !== null
}
var tn = e => ({
    name: `transformOrigin`,
    options: e,
    fn(t) {
        let {
            placement: n,
            rects: r,
            middlewareData: i
        } = t, a = i.arrow ? .centerOffset !== 0, o = a ? 0 : e.arrowWidth, s = a ? 0 : e.arrowHeight, [c, l] = nn(n), u = {
            start: `0%`,
            center: `50%`,
            end: `100%`
        }[l], d = (i.arrow ? .x ? ? 0) + o / 2, f = (i.arrow ? .y ? ? 0) + s / 2, p = ``, m = ``;
        return c === `bottom` ? (p = a ? u : `${d}px`, m = `${-s}px`) : c === `top` ? (p = a ? u : `${d}px`, m = `${r.floating.height+s}px`) : c === `right` ? (p = `${-s}px`, m = a ? u : `${f}px`) : c === `left` && (p = `${r.floating.width+s}px`, m = a ? u : `${f}px`), {
            data: {
                x: p,
                y: m
            }
        }
    }
});

function nn(e) {
    let [t, n = `center`] = e.split(`-`);
    return [t, n]
}
var rn = Wt,
    an = Kt,
    on = Xt,
    sn = $t;

function $(e) {
    return typeof e != `object` || !e || Array.isArray(e) ? {} : e
}

function cn(e) {
    let t = $(e),
        n = $(a(e));
    return {
        success: t.success !== !1 && n.success !== !1,
        message: (typeof t.message == `string` ? t.message : void 0) ? ? (typeof n.message == `string` ? n.message : void 0),
        data: Object.keys(n).length ? n : t
    }
}
async function ln(e) {
    let t = {
            name: e.brokerName,
            api_key: e.apiKey || ``,
            api_secret: e.apiSecret || ``,
            username: e.additionalCredentials ? .username || ``,
            password: e.additionalCredentials ? .password || ``,
            server: e.additionalCredentials ? .server || ``,
            account_id: e.accountNumber || ``
        },
        n = e.additionalCredentials ? .environment ? .trim();
    return n && (t.environment = n), cn((await o.post(i.add, t)).data).data ? ? null
}
async function un(e) {
    let t = cn((e ? await o.post(i.list, {
        broker_name: e
    }) : await o.get(i.list)).data).data ? .accounts;
    return Array.isArray(t) ? t : []
}
async function dn(e) {
    return $((await o.delete(i.delete, {
        data: {
            account_id: e
        }
    })).data).success !== !1
}
async function fn(e, t, n) {
    let r = {
        broker_name: e,
        account_id: t,
        web: 1
    };
    return n && (r.symbol = n), cn((await o.post(i.sync, r, {
        timeout: 18e4
    })).data)
}
async function pn(e) {
    return cn((await o.get(i.syncJob(e))).data)
}
async function mn(e, t) {
    let n = t ? .maxWaitMs ? ? 600 * 1e3,
        r = Date.now();
    for (; Date.now() - r < n;) {
        let n = await pn(e),
            r = $(n.data),
            i = typeof r.status == `string` ? r.status : void 0,
            a = typeof r.stage == `string` ? r.stage : void 0;
        if (t ? .onProgress ? .(a || i || null), i === `completed`) return n;
        if (i === `failed`) throw Error(typeof r.error == `string` && r.error.trim() || n.message || `Sync failed`);
        await new Promise(e => setTimeout(e, 2e3))
    }
    throw Error(`Sync is still running. Refresh trades in a few minutes.`)
}
async function hn(e) {
    try {
        let t = cn((await o.post(i.snaptrade.connect, {
                connection_type: `read`,
                broker_name: e
            })).data),
            n = $(t.data);
        return {
            success: t.success,
            connect_url: typeof n.connect_url == `string` && n.connect_url || typeof n.redirect_url == `string` && n.redirect_url || void 0,
            session_id: typeof n.session_id == `string` ? n.session_id : void 0,
            message: t.message
        }
    } catch (e) {
        return {
            success: !1,
            message: e instanceof s || e instanceof Error ? e.message : `Failed to create connection`
        }
    }
}
async function gn() {
    try {
        let e = (await o.get(i.mt5Servers)).data;
        if (Array.isArray(e)) return e;
        let t = $(e);
        return Array.isArray(t.data) ? t.data : []
    } catch {
        return []
    }
}
async function _n() {
    try {
        let e = await o.get(i.mt5ServerTree, {
                timeout: 12e4
            }),
            t = $(e.data),
            n = $(a(e.data)),
            r = n.companies ? n : t;
        return Array.isArray(r.companies) && r.companies.length > 0 ? {
            data: r
        } : {
            data: null,
            error: typeof t.message == `string` && t.message.trim() ? t.message.trim() : `Broker catalog returned no companies. Check that the MT5 bridge is running.`
        }
    } catch (e) {
        return {
            data: null,
            error: e instanceof Error ? e.message : `Failed to load broker catalog`
        }
    }
}
async function vn(e) {
    try {
        let t = $(a((await o.post(i.mt5ValidateCredentials, e, {
            timeout: 12e4
        })).data));
        return t ? .valid === !1 ? {
            ok: !1,
            status: 400,
            data: t,
            message: t.message || `Invalid MT5 credentials`
        } : {
            ok: !0,
            status: 200,
            data: t
        }
    } catch (e) {
        let t = e instanceof s ? e.statusCode : 502,
            n = e instanceof Error ? e.message : `MT5 validation failed`;
        return {
            ok: !1,
            status: t ? ? 502,
            message: n
        }
    }
}
async function yn(e) {
    try {
        let t = await o.post(i.mt5AddServer, e, {
                timeout: 18e4
            }),
            n = $(a(t.data));
        return {
            success: !0,
            data: n,
            message: n ? .message || $(t.data).message
        }
    } catch (e) {
        return {
            success: !1,
            message: e instanceof Error ? e.message : `Add server failed`
        }
    }
}
async function bn() {
    try {
        let e = await o.get(i.mt4ServerTree, {
                timeout: 12e4
            }),
            t = $(e.data),
            n = $(a(e.data)),
            r = n.companies ? n : t;
        return Array.isArray(r.companies) && r.companies.length > 0 ? {
            data: r
        } : {
            data: null,
            error: typeof t.message == `string` && t.message.trim() ? t.message.trim() : `Broker catalog returned no companies. Check that the MT4 bridge is running.`
        }
    } catch (e) {
        return {
            data: null,
            error: e instanceof Error ? e.message : `Failed to load broker catalog`
        }
    }
}
async function xn(e) {
    try {
        let t = $(a((await o.post(i.mt4ValidateCredentials, e, {
            timeout: 12e4
        })).data));
        return t ? .valid === !1 ? {
            ok: !1,
            status: 400,
            data: t,
            message: t.message || `Invalid MT4 credentials`
        } : {
            ok: !0,
            status: 200,
            data: t
        }
    } catch (e) {
        let t = e instanceof s ? e.statusCode : 502,
            n = e instanceof Error ? e.message : `MT4 validation failed`;
        return {
            ok: !1,
            status: t ? ? 502,
            message: n
        }
    }
}
async function Sn(e) {
    try {
        let t = await o.post(i.mt4AddServer, e, {
                timeout: 18e4
            }),
            n = $(a(t.data));
        return {
            success: !0,
            data: n,
            message: n ? .message || $(t.data).message
        }
    } catch (e) {
        return {
            success: !1,
            message: e instanceof Error ? e.message : `Add server failed`
        }
    }
}
var Cn = x(`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 hover-elevate active-elevate-2`, {
        variants: {
            variant: {
                default: `bg-primary text-primary-foreground border border-primary-border`,
                destructive: `bg-destructive text-destructive-foreground shadow-sm border-destructive-border`,
                outline: `border [border-color:var(--button-outline)] shadow-xs active:shadow-none`,
                secondary: `border bg-secondary text-secondary-foreground border border-secondary-border`,
                ghost: `border border-transparent`,
                link: `text-primary underline-offset-4 hover:underline`
            },
            size: {
                default: `min-h-9 px-4 py-2`,
                sm: `min-h-8 rounded-md px-3 text-xs`,
                lg: `min-h-10 rounded-md px-8`,
                icon: `h-9 w-9`
            }
        },
        defaultVariants: {
            variant: `default`,
            size: `default`
        }
    }),
    wn = g.forwardRef(({
        className: e,
        variant: t,
        size: n,
        asChild: r = !1,
        ...i
    }, a) => (0, v.jsx)(r ? l : `button`, {
        className: h(Cn({
            variant: t,
            size: n,
            className: e
        })),
        ref: a,
        ...i
    }));
wn.displayName = `Button`;
export {
    x as S, sn as _, yn as a, Vt as b, bn as c, mn as d, hn as f, an as g, vn as h, Sn as i, _n as l, xn as m, Cn as n, dn as o, fn as p, ln as r, un as s, wn as t, gn as u, on as v, Rt as x, rn as y
};