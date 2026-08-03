import {
    c as e,
    n as t,
    r as n
} from "./createLucideIcon-DwuI3uP3.js";
import {
    r
} from "./dist-D3SFEfc9.js";
var i = e(n(), 1),
    a = t();
typeof window < `u` && window.document && window.document.createElement;

function o(e, t, {
    checkForDefaultPrevented: n = !0
} = {}) {
    return function(r) {
        if (e ? .(r), n === !1 || !r.defaultPrevented) return t ? .(r)
    }
}
var s = e(r(), 1);

function c(e, t) {
    if (typeof e == `function`) return e(t);
    e != null && (e.current = t)
}

function l(...e) {
    return t => {
        let n = !1,
            r = e.map(e => {
                let r = c(e, t);
                return !n && typeof r == `function` && (n = !0), r
            });
        if (n) return () => {
            for (let t = 0; t < r.length; t++) {
                let n = r[t];
                typeof n == `function` ? n() : c(e[t], null)
            }
        }
    }
}

function u(...e) {
    return i.useCallback(l(...e), e)
}

function d(e, t = []) {
    let n = [];

    function r(t, r) {
        let o = i.createContext(r);
        o.displayName = t + `Context`;
        let s = n.length;
        n = [...n, r];
        let c = t => {
            let {
                scope: n,
                children: r,
                ...c
            } = t, l = n ? .[e] ? .[s] || o, u = i.useMemo(() => c, Object.values(c));
            return (0, a.jsx)(l.Provider, {
                value: u,
                children: r
            })
        };
        c.displayName = t + `Provider`;

        function l(n, a) {
            let c = a ? .[e] ? .[s] || o,
                l = i.useContext(c);
            if (l) return l;
            if (r !== void 0) return r;
            throw Error(`\`${n}\` must be used within \`${t}\``)
        }
        return [c, l]
    }
    let o = () => {
        let t = n.map(e => i.createContext(e));
        return function(n) {
            let r = n ? .[e] || t;
            return i.useMemo(() => ({
                [`__scope${e}`]: { ...n,
                    [e]: r
                }
            }), [n, r])
        }
    };
    return o.scopeName = e, [r, f(o, ...t)]
}

function f(...e) {
    let t = e[0];
    if (e.length === 1) return t;
    let n = () => {
        let n = e.map(e => ({
            useScope: e(),
            scopeName: e.scopeName
        }));
        return function(e) {
            let r = n.reduce((t, {
                useScope: n,
                scopeName: r
            }) => {
                let i = n(e)[`__scope${r}`];
                return { ...t,
                    ...i
                }
            }, {});
            return i.useMemo(() => ({
                [`__scope${t.scopeName}`]: r
            }), [r])
        }
    };
    return n.scopeName = t.scopeName, n
}

function p(e) {
    let t = i.forwardRef((t, n) => {
        let {
            children: r,
            ...a
        } = t, o = null, s = !1, c = [];
        x(r) && typeof T == `function` && (r = T(r._payload)), i.Children.forEach(r, e => {
            if (y(e)) {
                s = !0;
                let t = e,
                    n = `child` in t.props ? t.props.child : t.props.children;
                x(n) && typeof T == `function` && (n = T(n._payload)), o = _(t, n), c.push(o ? .props ? .children)
            } else c.push(e)
        }), o ? o = i.cloneElement(o, void 0, c) : !s && i.Children.count(r) === 1 && i.isValidElement(r) && (o = r);
        let l = o ? ee(o) : void 0,
            d = u(n, l);
        if (!o) {
            if (r || r === 0) throw Error(s ? w(e) : C(e));
            return r
        }
        let f = v(a, o.props ? ? {});
        return o.type !== i.Fragment && (f.ref = n ? d : l), i.cloneElement(o, f)
    });
    return t.displayName = `${e}.Slot`, t
}
var m = p(`Slot`),
    h = Symbol.for(`radix.slottable`);

function g(e) {
    let t = e => `child` in e ? e.children(e.child) : e.children;
    return t.displayName = `${e}.Slottable`, t.__radixId = h, t
}
var _ = (e, t) => {
    if (`child` in e.props) {
        let t = e.props.child;
        return i.isValidElement(t) ? i.cloneElement(t, void 0, e.props.children(t.props.children)) : null
    }
    return i.isValidElement(t) ? t : null
};

function v(e, t) {
    let n = { ...t
    };
    for (let r in t) {
        let i = e[r],
            a = t[r];
        /^on[A-Z]/.test(r) ? i && a ? n[r] = (...e) => {
            let t = a(...e);
            return i(...e), t
        } : i && (n[r] = i) : r === `style` ? n[r] = { ...i,
            ...a
        } : r === `className` && (n[r] = [i, a].filter(Boolean).join(` `))
    }
    return { ...e,
        ...n
    }
}

function ee(e) {
    let t = Object.getOwnPropertyDescriptor(e.props, `ref`) ? .get,
        n = t && `isReactWarning` in t && t.isReactWarning;
    return n ? e.ref : (t = Object.getOwnPropertyDescriptor(e, `ref`) ? .get, n = t && `isReactWarning` in t && t.isReactWarning, n ? e.props.ref : e.props.ref || e.ref)
}

function y(e) {
    return i.isValidElement(e) && typeof e.type == `function` && `__radixId` in e.type && e.type.__radixId === h
}
var b = Symbol.for(`react.lazy`);

function x(e) {
    return typeof e == `object` && !!e && `$$typeof` in e && e.$$typeof === b && `_payload` in e && S(e._payload)
}

function S(e) {
    return typeof e == `object` && !!e && `then` in e
}
var C = e => `${e} failed to slot onto its children. Expected a single React element child or \`Slottable\`.`,
    w = e => `${e} failed to slot onto its \`Slottable\`. Expected \`Slottable\` to receive a single React element child.`,
    T = i.use,
    E = [`a`, `button`, `div`, `form`, `h2`, `h3`, `img`, `input`, `label`, `li`, `nav`, `ol`, `p`, `select`, `span`, `svg`, `ul`].reduce((e, t) => {
        let n = p(`Primitive.${t}`),
            r = i.forwardRef((e, r) => {
                let {
                    asChild: i,
                    ...o
                } = e, s = i ? n : t;
                return typeof window < `u` && (window[Symbol.for(`radix-ui`)] = !0), (0, a.jsx)(s, { ...o,
                    ref: r
                })
            });
        return r.displayName = `Primitive.${t}`, { ...e,
            [t]: r
        }
    }, {});

function D(e, t) {
    e && s.flushSync(() => e.dispatchEvent(t))
}

function O(e) {
    let t = i.useRef(e);
    return i.useEffect(() => {
        t.current = e
    }), i.useMemo(() => ((...e) => t.current ? .(...e)), [])
}

function te(e, t = globalThis ? .document) {
    let n = O(e);
    i.useEffect(() => {
        let e = e => {
            e.key === `Escape` && n(e)
        };
        return t.addEventListener(`keydown`, e, {
            capture: !0
        }), () => t.removeEventListener(`keydown`, e, {
            capture: !0
        })
    }, [n, t])
}
var ne = `DismissableLayer`,
    re = `dismissableLayer.update`,
    ie = `dismissableLayer.pointerDownOutside`,
    ae = `dismissableLayer.focusOutside`,
    oe, k = i.createContext({
        layers: new Set,
        layersWithOutsidePointerEventsDisabled: new Set,
        branches: new Set,
        dismissableSurfaces: new Set
    }),
    A = i.forwardRef((e, t) => {
        let {
            disableOutsidePointerEvents: n = !1,
            deferPointerDownOutside: r = !1,
            onEscapeKeyDown: s,
            onPointerDownOutside: c,
            onFocusOutside: l,
            onInteractOutside: d,
            onDismiss: f,
            ...p
        } = e, m = i.useContext(k), [h, g] = i.useState(null), _ = h ? .ownerDocument ? ? globalThis ? .document, [, v] = i.useState({}), ee = u(t, e => g(e)), y = Array.from(m.layers), [b] = [...m.layersWithOutsidePointerEventsDisabled].slice(-1), x = y.indexOf(b), S = h ? y.indexOf(h) : -1, C = m.layersWithOutsidePointerEventsDisabled.size > 0, w = S >= x, T = i.useRef(!1), D = ue(e => {
            let t = e.target;
            if (!(t instanceof Node)) return;
            let n = [...m.branches].some(e => e.contains(t));
            !w || n || (c ? .(e), d ? .(e), e.defaultPrevented || f ? .())
        }, {
            ownerDocument: _,
            deferPointerDownOutside: r,
            isDeferredPointerDownOutsideRef: T,
            dismissableSurfaces: m.dismissableSurfaces
        }), O = de(e => {
            if (r && T.current) return;
            let t = e.target;
            [...m.branches].some(e => e.contains(t)) || (l ? .(e), d ? .(e), e.defaultPrevented || f ? .())
        }, _);
        return te(e => {
            S === m.layers.size - 1 && (s ? .(e), !e.defaultPrevented && f && (e.preventDefault(), f()))
        }, _), i.useEffect(() => {
            if (h) return n && (m.layersWithOutsidePointerEventsDisabled.size === 0 && (oe = _.body.style.pointerEvents, _.body.style.pointerEvents = `none`), m.layersWithOutsidePointerEventsDisabled.add(h)), m.layers.add(h), fe(), () => {
                n && (m.layersWithOutsidePointerEventsDisabled.delete(h), m.layersWithOutsidePointerEventsDisabled.size === 0 && (_.body.style.pointerEvents = oe))
            }
        }, [h, _, n, m]), i.useEffect(() => () => {
            h && (m.layers.delete(h), m.layersWithOutsidePointerEventsDisabled.delete(h), fe())
        }, [h, m]), i.useEffect(() => {
            let e = () => v({});
            return document.addEventListener(re, e), () => document.removeEventListener(re, e)
        }, []), (0, a.jsx)(E.div, { ...p,
            ref: ee,
            style: {
                pointerEvents: C ? w ? `auto` : `none` : void 0,
                ...e.style
            },
            onFocusCapture: o(e.onFocusCapture, O.onFocusCapture),
            onBlurCapture: o(e.onBlurCapture, O.onBlurCapture),
            onPointerDownCapture: o(e.onPointerDownCapture, D.onPointerDownCapture)
        })
    });
A.displayName = ne;
var se = `DismissableLayerBranch`,
    ce = i.forwardRef((e, t) => {
        let n = i.useContext(k),
            r = i.useRef(null),
            o = u(t, r);
        return i.useEffect(() => {
            let e = r.current;
            if (e) return n.branches.add(e), () => {
                n.branches.delete(e)
            }
        }, [n.branches]), (0, a.jsx)(E.div, { ...e,
            ref: o
        })
    });
ce.displayName = se;

function le() {
    let e = i.useContext(k),
        [t, n] = i.useState(null);
    return i.useEffect(() => {
        if (t) return e.dismissableSurfaces.add(t), () => {
            e.dismissableSurfaces.delete(t)
        }
    }, [t, e.dismissableSurfaces]), n
}

function ue(e, t) {
    let {
        ownerDocument: n = globalThis ? .document,
        deferPointerDownOutside: r = !1,
        isDeferredPointerDownOutsideRef: a,
        dismissableSurfaces: o
    } = t, s = O(e), c = i.useRef(!1), l = i.useRef(!1), u = i.useRef(new Map), d = i.useRef(() => {});
    return i.useEffect(() => {
        function e() {
            l.current = !1, a.current = !1, u.current.clear()
        }

        function t() {
            return Array.from(u.current.values()).some(Boolean)
        }

        function i(e) {
            if (!l.current) return;
            let t = e.target;
            t instanceof Node && [...o].some(e => e.contains(t)) || u.current.set(e.type, !0), e.type === `click` && window.setTimeout(() => {
                l.current && d.current()
            }, 0)
        }

        function f(e) {
            l.current && u.current.set(e.type, !1)
        }
        let p = i => {
                if (i.target && !c.current) {
                    let o = function() {
                            n.removeEventListener(`click`, d.current);
                            let r = t();
                            e(), r || pe(ie, s, c, {
                                discrete: !0
                            })
                        },
                        c = {
                            originalEvent: i
                        };
                    l.current = !0, a.current = r && i.button === 0, u.current.clear(), !r || i.button !== 0 ? o() : (n.removeEventListener(`click`, d.current), d.current = o, n.addEventListener(`click`, d.current, {
                        once: !0
                    }))
                } else n.removeEventListener(`click`, d.current), e();
                c.current = !1
            },
            m = [`pointerup`, `mousedown`, `mouseup`, `touchstart`, `touchend`, `click`];
        for (let e of m) n.addEventListener(e, i, !0), n.addEventListener(e, f);
        let h = window.setTimeout(() => {
            n.addEventListener(`pointerdown`, p)
        }, 0);
        return () => {
            window.clearTimeout(h), n.removeEventListener(`pointerdown`, p), n.removeEventListener(`click`, d.current);
            for (let e of m) n.removeEventListener(e, i, !0), n.removeEventListener(e, f)
        }
    }, [n, s, r, a, o]), {
        onPointerDownCapture: () => c.current = !0
    }
}

function de(e, t = globalThis ? .document) {
    let n = O(e),
        r = i.useRef(!1);
    return i.useEffect(() => {
        let e = e => {
            e.target && !r.current && pe(ae, n, {
                originalEvent: e
            }, {
                discrete: !1
            })
        };
        return t.addEventListener(`focusin`, e), () => t.removeEventListener(`focusin`, e)
    }, [t, n]), {
        onFocusCapture: () => r.current = !0,
        onBlurCapture: () => r.current = !1
    }
}

function fe() {
    let e = new CustomEvent(re);
    document.dispatchEvent(e)
}

function pe(e, t, n, {
    discrete: r
}) {
    let i = n.originalEvent.target,
        a = new CustomEvent(e, {
            bubbles: !1,
            cancelable: !0,
            detail: n
        });
    t && i.addEventListener(e, t, {
        once: !0
    }), r ? D(i, a) : i.dispatchEvent(a)
}
var me = A,
    he = ce,
    j = globalThis ? .document ? i.useLayoutEffect : () => {},
    ge = `Portal`,
    _e = i.forwardRef((e, t) => {
        let {
            container: n,
            ...r
        } = e, [o, c] = i.useState(!1);
        j(() => c(!0), []);
        let l = n || o && globalThis ? .document ? .body;
        return l ? s.createPortal((0, a.jsx)(E.div, { ...r,
            ref: t
        }), l) : null
    });
_e.displayName = ge;

function ve(e, t) {
    return i.useReducer((e, n) => t[e][n] ? ? e, e)
}
var ye = e => {
    let {
        present: t,
        children: n
    } = e, r = be(t), a = typeof n == `function` ? n({
        present: r.isPresent
    }) : i.Children.only(n), o = Se(r.ref, Ce(a));
    return typeof n == `function` || r.isPresent ? i.cloneElement(a, {
        ref: o
    }) : null
};
ye.displayName = `Presence`;

function be(e) {
    let [t, n] = i.useState(), r = i.useRef(null), a = i.useRef(e), o = i.useRef(`none`), [s, c] = ve(e ? `mounted` : `unmounted`, {
        mounted: {
            UNMOUNT: `unmounted`,
            ANIMATION_OUT: `unmountSuspended`
        },
        unmountSuspended: {
            MOUNT: `mounted`,
            ANIMATION_END: `unmounted`
        },
        unmounted: {
            MOUNT: `mounted`
        }
    });
    return i.useEffect(() => {
        let e = M(r.current);
        o.current = s === `mounted` ? e : `none`
    }, [s]), j(() => {
        let t = r.current,
            n = a.current;
        if (n !== e) {
            let r = o.current,
                i = M(t);
            e ? c(`MOUNT`) : i === `none` || t ? .display === `none` ? c(`UNMOUNT`) : c(n && r !== i ? `ANIMATION_OUT` : `UNMOUNT`), a.current = e
        }
    }, [e, c]), j(() => {
        if (t) {
            let e, n = t.ownerDocument.defaultView ? ? window,
                i = i => {
                    let o = M(r.current).includes(CSS.escape(i.animationName));
                    if (i.target === t && o && (c(`ANIMATION_END`), !a.current)) {
                        let r = t.style.animationFillMode;
                        t.style.animationFillMode = `forwards`, e = n.setTimeout(() => {
                            t.style.animationFillMode === `forwards` && (t.style.animationFillMode = r)
                        })
                    }
                },
                s = e => {
                    e.target === t && (o.current = M(r.current))
                };
            return t.addEventListener(`animationstart`, s), t.addEventListener(`animationcancel`, i), t.addEventListener(`animationend`, i), () => {
                n.clearTimeout(e), t.removeEventListener(`animationstart`, s), t.removeEventListener(`animationcancel`, i), t.removeEventListener(`animationend`, i)
            }
        } else c(`ANIMATION_END`)
    }, [t, c]), {
        isPresent: [`mounted`, `unmountSuspended`].includes(s),
        ref: i.useCallback(e => {
            r.current = e ? getComputedStyle(e) : null, n(e)
        }, [])
    }
}

function xe(e, t) {
    if (typeof e == `function`) return e(t);
    e != null && (e.current = t)
}

function Se(...e) {
    let t = i.useRef(e);
    return t.current = e, i.useCallback(e => {
        let n = t.current,
            r = !1,
            i = n.map(t => {
                let n = xe(t, e);
                return !r && typeof n == `function` && (r = !0), n
            });
        if (r) return () => {
            for (let e = 0; e < i.length; e++) {
                let t = i[e];
                typeof t == `function` ? t() : xe(n[e], null)
            }
        }
    }, [])
}

function M(e) {
    return e ? .animationName || `none`
}

function Ce(e) {
    let t = Object.getOwnPropertyDescriptor(e.props, `ref`) ? .get,
        n = t && `isReactWarning` in t && t.isReactWarning;
    return n ? e.ref : (t = Object.getOwnPropertyDescriptor(e, `ref`) ? .get, n = t && `isReactWarning` in t && t.isReactWarning, n ? e.props.ref : e.props.ref || e.ref)
}
var we = i.useInsertionEffect || j;

function Te({
    prop: e,
    defaultProp: t,
    onChange: n = () => {},
    caller: r
}) {
    let [a, o, s] = Ee({
        defaultProp: t,
        onChange: n
    }), c = e !== void 0, l = c ? e : a; {
        let t = i.useRef(e !== void 0);
        i.useEffect(() => {
            let e = t.current;
            e !== c && console.warn(`${r} is changing from ${e?`controlled`:`uncontrolled`} to ${c?`controlled`:`uncontrolled`}. Components should not switch from controlled to uncontrolled (or vice versa). Decide between using a controlled or uncontrolled value for the lifetime of the component.`), t.current = c
        }, [c, r])
    }
    return [l, i.useCallback(t => {
        if (c) {
            let n = De(t) ? t(e) : t;
            n !== e && s.current ? .(n)
        } else o(t)
    }, [c, e, o, s])]
}

function Ee({
    defaultProp: e,
    onChange: t
}) {
    let [n, r] = i.useState(e), a = i.useRef(n), o = i.useRef(t);
    return we(() => {
        o.current = t
    }, [t]), i.useEffect(() => {
        a.current !== n && (o.current ? .(n), a.current = n)
    }, [n, a]), [n, r, o]
}

function De(e) {
    return typeof e == `function`
}
var Oe = i.useId || (() => void 0),
    ke = 0;

function Ae(e) {
    let [t, n] = i.useState(Oe());
    return j(() => {
        e || n(e => e ? ? String(ke++))
    }, [e]), e || (t ? `radix-${t}` : ``)
}
var N = 0,
    P = null;

function je() {
    i.useEffect(() => {
        P || = {
            start: Me(),
            end: Me()
        };
        let {
            start: e,
            end: t
        } = P;
        return document.body.firstElementChild !== e && document.body.insertAdjacentElement(`afterbegin`, e), document.body.lastElementChild !== t && document.body.insertAdjacentElement(`beforeend`, t), N++, () => {
            N === 1 && (P ? .start.remove(), P ? .end.remove(), P = null), N = Math.max(0, N - 1)
        }
    }, [])
}

function Me() {
    let e = document.createElement(`span`);
    return e.setAttribute(`data-radix-focus-guard`, ``), e.tabIndex = 0, e.style.outline = `none`, e.style.opacity = `0`, e.style.position = `fixed`, e.style.pointerEvents = `none`, e
}
var F = `focusScope.autoFocusOnMount`,
    I = `focusScope.autoFocusOnUnmount`,
    Ne = {
        bubbles: !1,
        cancelable: !0
    },
    Pe = `FocusScope`,
    Fe = i.forwardRef((e, t) => {
        let {
            loop: n = !1,
            trapped: r = !1,
            onMountAutoFocus: o,
            onUnmountAutoFocus: s,
            ...c
        } = e, [l, d] = i.useState(null), f = O(o), p = O(s), m = i.useRef(null), h = u(t, e => d(e)), g = i.useRef({
            paused: !1,
            pause() {
                this.paused = !0
            },
            resume() {
                this.paused = !1
            }
        }).current;
        i.useEffect(() => {
            if (r) {
                let e = function(e) {
                        if (g.paused || !l) return;
                        let t = e.target;
                        l.contains(t) ? m.current = t : L(m.current, {
                            select: !0
                        })
                    },
                    t = function(e) {
                        if (g.paused || !l) return;
                        let t = e.relatedTarget;
                        t !== null && (l.contains(t) || L(m.current, {
                            select: !0
                        }))
                    },
                    n = function(e) {
                        if (document.activeElement === document.body)
                            for (let t of e) t.removedNodes.length > 0 && L(l)
                    };
                document.addEventListener(`focusin`, e), document.addEventListener(`focusout`, t);
                let r = new MutationObserver(n);
                return l && r.observe(l, {
                    childList: !0,
                    subtree: !0
                }), () => {
                    document.removeEventListener(`focusin`, e), document.removeEventListener(`focusout`, t), r.disconnect()
                }
            }
        }, [r, l, g.paused]), i.useEffect(() => {
            if (l) {
                He.add(g);
                let e = document.activeElement;
                if (!l.contains(e)) {
                    let t = new CustomEvent(F, Ne);
                    l.addEventListener(F, f), l.dispatchEvent(t), t.defaultPrevented || (Ie(Ge(Re(l)), {
                        select: !0
                    }), document.activeElement === e && L(l))
                }
                return () => {
                    l.removeEventListener(F, f), setTimeout(() => {
                        let t = new CustomEvent(I, Ne);
                        l.addEventListener(I, p), l.dispatchEvent(t), t.defaultPrevented || L(e ? ? document.body, {
                            select: !0
                        }), l.removeEventListener(I, p), He.remove(g)
                    }, 0)
                }
            }
        }, [l, f, p, g]);
        let _ = i.useCallback(e => {
            if (!n && !r || g.paused) return;
            let t = e.key === `Tab` && !e.altKey && !e.ctrlKey && !e.metaKey,
                i = document.activeElement;
            if (t && i) {
                let t = e.currentTarget,
                    [r, a] = Le(t);
                r && a ? !e.shiftKey && i === a ? (e.preventDefault(), n && L(r, {
                    select: !0
                })) : e.shiftKey && i === r && (e.preventDefault(), n && L(a, {
                    select: !0
                })) : i === t && e.preventDefault()
            }
        }, [n, r, g.paused]);
        return (0, a.jsx)(E.div, {
            tabIndex: -1,
            ...c,
            ref: h,
            onKeyDown: _
        })
    });
Fe.displayName = Pe;

function Ie(e, {
    select: t = !1
} = {}) {
    let n = document.activeElement;
    for (let r of e)
        if (L(r, {
                select: t
            }), document.activeElement !== n) return
}

function Le(e) {
    let t = Re(e);
    return [ze(t, e), ze(t.reverse(), e)]
}

function Re(e) {
    let t = [],
        n = document.createTreeWalker(e, NodeFilter.SHOW_ELEMENT, {
            acceptNode: e => {
                let t = e.tagName === `INPUT` && e.type === `hidden`;
                return e.disabled || e.hidden || t ? NodeFilter.FILTER_SKIP : e.tabIndex >= 0 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP
            }
        });
    for (; n.nextNode();) t.push(n.currentNode);
    return t
}

function ze(e, t) {
    for (let n of e)
        if (!Be(n, {
                upTo: t
            })) return n
}

function Be(e, {
    upTo: t
}) {
    if (getComputedStyle(e).visibility === `hidden`) return !0;
    for (; e;) {
        if (t !== void 0 && e === t) return !1;
        if (getComputedStyle(e).display === `none`) return !0;
        e = e.parentElement
    }
    return !1
}

function Ve(e) {
    return e instanceof HTMLInputElement && `select` in e
}

function L(e, {
    select: t = !1
} = {}) {
    if (e && e.focus) {
        let n = document.activeElement;
        e.focus({
            preventScroll: !0
        }), e !== n && Ve(e) && t && e.select()
    }
}
var He = Ue();

function Ue() {
    let e = [];
    return {
        add(t) {
            let n = e[0];
            t !== n && n ? .pause(), e = We(e, t), e.unshift(t)
        },
        remove(t) {
            e = We(e, t), e[0] ? .resume()
        }
    }
}

function We(e, t) {
    let n = [...e],
        r = n.indexOf(t);
    return r !== -1 && n.splice(r, 1), n
}

function Ge(e) {
    return e.filter(e => e.tagName !== `A`)
}
var Ke = function(e) {
        return typeof document > `u` ? null : (Array.isArray(e) ? e[0] : e).ownerDocument.body
    },
    R = new WeakMap,
    z = new WeakMap,
    B = {},
    qe = 0,
    Je = function(e) {
        return e && (e.host || Je(e.parentNode))
    },
    Ye = function(e, t) {
        return t.map(function(t) {
            if (e.contains(t)) return t;
            var n = Je(t);
            return n && e.contains(n) ? n : (console.error(`aria-hidden`, t, `in not contained inside`, e, `. Doing nothing`), null)
        }).filter(function(e) {
            return !!e
        })
    },
    Xe = function(e, t, n, r) {
        var i = Ye(t, Array.isArray(e) ? e : [e]);
        B[n] || (B[n] = new WeakMap);
        var a = B[n],
            o = [],
            s = new Set,
            c = new Set(i),
            l = function(e) {
                !e || s.has(e) || (s.add(e), l(e.parentNode))
            };
        i.forEach(l);
        var u = function(e) {
            !e || c.has(e) || Array.prototype.forEach.call(e.children, function(e) {
                if (s.has(e)) u(e);
                else try {
                    var t = e.getAttribute(r),
                        i = t !== null && t !== `false`,
                        c = (R.get(e) || 0) + 1,
                        l = (a.get(e) || 0) + 1;
                    R.set(e, c), a.set(e, l), o.push(e), c === 1 && i && z.set(e, !0), l === 1 && e.setAttribute(n, `true`), i || e.setAttribute(r, `true`)
                } catch (t) {
                    console.error(`aria-hidden: cannot operate on `, e, t)
                }
            })
        };
        return u(t), s.clear(), qe++,
            function() {
                o.forEach(function(e) {
                    var t = R.get(e) - 1,
                        i = a.get(e) - 1;
                    R.set(e, t), a.set(e, i), t || (z.has(e) || e.removeAttribute(r), z.delete(e)), i || e.removeAttribute(n)
                }), qe--, qe || (R = new WeakMap, R = new WeakMap, z = new WeakMap, B = {})
            }
    },
    Ze = function(e, t, n) {
        n === void 0 && (n = `data-aria-hidden`);
        var r = Array.from(Array.isArray(e) ? e : [e]),
            i = t || Ke(e);
        return i ? (r.push.apply(r, Array.from(i.querySelectorAll(`[aria-live], script`))), Xe(r, i, n, `aria-hidden`)) : function() {
            return null
        }
    },
    V = function() {
        return V = Object.assign || function(e) {
            for (var t, n = 1, r = arguments.length; n < r; n++)
                for (var i in t = arguments[n], t) Object.prototype.hasOwnProperty.call(t, i) && (e[i] = t[i]);
            return e
        }, V.apply(this, arguments)
    };

function Qe(e, t) {
    var n = {};
    for (var r in e) Object.prototype.hasOwnProperty.call(e, r) && t.indexOf(r) < 0 && (n[r] = e[r]);
    if (e != null && typeof Object.getOwnPropertySymbols == `function`)
        for (var i = 0, r = Object.getOwnPropertySymbols(e); i < r.length; i++) t.indexOf(r[i]) < 0 && Object.prototype.propertyIsEnumerable.call(e, r[i]) && (n[r[i]] = e[r[i]]);
    return n
}

function $e(e, t, n) {
    if (n || arguments.length === 2)
        for (var r = 0, i = t.length, a; r < i; r++)(a || !(r in t)) && (a || = Array.prototype.slice.call(t, 0, r), a[r] = t[r]);
    return e.concat(a || Array.prototype.slice.call(t))
}
var H = `right-scroll-bar-position`,
    U = `width-before-scroll-bar`,
    et = `with-scroll-bars-hidden`,
    tt = `--removed-body-scroll-bar-size`;

function W(e, t) {
    return typeof e == `function` ? e(t) : e && (e.current = t), e
}

function nt(e, t) {
    var n = (0, i.useState)(function() {
        return {
            value: e,
            callback: t,
            facade: {
                get current() {
                    return n.value
                },
                set current(e) {
                    var t = n.value;
                    t !== e && (n.value = e, n.callback(e, t))
                }
            }
        }
    })[0];
    return n.callback = t, n.facade
}
var rt = typeof window < `u` ? i.useLayoutEffect : i.useEffect,
    it = new WeakMap;

function at(e, t) {
    var n = nt(t || null, function(t) {
        return e.forEach(function(e) {
            return W(e, t)
        })
    });
    return rt(function() {
        var t = it.get(n);
        if (t) {
            var r = new Set(t),
                i = new Set(e),
                a = n.current;
            r.forEach(function(e) {
                i.has(e) || W(e, null)
            }), i.forEach(function(e) {
                r.has(e) || W(e, a)
            })
        }
        it.set(n, e)
    }, [e]), n
}

function ot(e) {
    return e
}

function st(e, t) {
    t === void 0 && (t = ot);
    var n = [],
        r = !1;
    return {
        read: function() {
            if (r) throw Error("Sidecar: could not `read` from an `assigned` medium. `read` could be used only with `useMedium`.");
            return n.length ? n[n.length - 1] : e
        },
        useMedium: function(e) {
            var i = t(e, r);
            return n.push(i),
                function() {
                    n = n.filter(function(e) {
                        return e !== i
                    })
                }
        },
        assignSyncMedium: function(e) {
            for (r = !0; n.length;) {
                var t = n;
                n = [], t.forEach(e)
            }
            n = {
                push: function(t) {
                    return e(t)
                },
                filter: function() {
                    return n
                }
            }
        },
        assignMedium: function(e) {
            r = !0;
            var t = [];
            if (n.length) {
                var i = n;
                n = [], i.forEach(e), t = n
            }
            var a = function() {
                    var n = t;
                    t = [], n.forEach(e)
                },
                o = function() {
                    return Promise.resolve().then(a)
                };
            o(), n = {
                push: function(e) {
                    t.push(e), o()
                },
                filter: function(e) {
                    return t = t.filter(e), n
                }
            }
        }
    }
}

function ct(e) {
    e === void 0 && (e = {});
    var t = st(null);
    return t.options = V({
        async: !0,
        ssr: !1
    }, e), t
}
var lt = function(e) {
    var t = e.sideCar,
        n = Qe(e, [`sideCar`]);
    if (!t) throw Error("Sidecar: please provide `sideCar` property to import the right car");
    var r = t.read();
    if (!r) throw Error(`Sidecar medium not found`);
    return i.createElement(r, V({}, n))
};
lt.isSideCarExport = !0;

function ut(e, t) {
    return e.useMedium(t), lt
}
var dt = ct(),
    G = function() {},
    K = i.forwardRef(function(e, t) {
        var n = i.useRef(null),
            r = i.useState({
                onScrollCapture: G,
                onWheelCapture: G,
                onTouchMoveCapture: G
            }),
            a = r[0],
            o = r[1],
            s = e.forwardProps,
            c = e.children,
            l = e.className,
            u = e.removeScrollBar,
            d = e.enabled,
            f = e.shards,
            p = e.sideCar,
            m = e.noRelative,
            h = e.noIsolation,
            g = e.inert,
            _ = e.allowPinchZoom,
            v = e.as,
            ee = v === void 0 ? `div` : v,
            y = e.gapMode,
            b = Qe(e, [`forwardProps`, `children`, `className`, `removeScrollBar`, `enabled`, `shards`, `sideCar`, `noRelative`, `noIsolation`, `inert`, `allowPinchZoom`, `as`, `gapMode`]),
            x = p,
            S = at([n, t]),
            C = V(V({}, b), a);
        return i.createElement(i.Fragment, null, d && i.createElement(x, {
            sideCar: dt,
            removeScrollBar: u,
            shards: f,
            noRelative: m,
            noIsolation: h,
            inert: g,
            setCallbacks: o,
            allowPinchZoom: !!_,
            lockRef: n,
            gapMode: y
        }), s ? i.cloneElement(i.Children.only(c), V(V({}, C), {
            ref: S
        })) : i.createElement(ee, V({}, C, {
            className: l,
            ref: S
        }), c))
    });
K.defaultProps = {
    enabled: !0,
    removeScrollBar: !0,
    inert: !1
}, K.classNames = {
    fullWidth: U,
    zeroRight: H
};
var ft, pt = function() {
    if (ft) return ft;
    if (typeof __webpack_nonce__ < `u`) return __webpack_nonce__
};

function mt() {
    if (!document) return null;
    var e = document.createElement(`style`);
    e.type = `text/css`;
    var t = pt();
    return t && e.setAttribute(`nonce`, t), e
}

function ht(e, t) {
    e.styleSheet ? e.styleSheet.cssText = t : e.appendChild(document.createTextNode(t))
}

function gt(e) {
    (document.head || document.getElementsByTagName(`head`)[0]).appendChild(e)
}
var _t = function() {
        var e = 0,
            t = null;
        return {
            add: function(n) {
                e == 0 && (t = mt()) && (ht(t, n), gt(t)), e++
            },
            remove: function() {
                e--, !e && t && (t.parentNode && t.parentNode.removeChild(t), t = null)
            }
        }
    },
    vt = function() {
        var e = _t();
        return function(t, n) {
            i.useEffect(function() {
                return e.add(t),
                    function() {
                        e.remove()
                    }
            }, [t && n])
        }
    },
    yt = function() {
        var e = vt();
        return function(t) {
            var n = t.styles,
                r = t.dynamic;
            return e(n, r), null
        }
    },
    bt = {
        left: 0,
        top: 0,
        right: 0,
        gap: 0
    },
    q = function(e) {
        return parseInt(e || ``, 10) || 0
    },
    xt = function(e) {
        var t = window.getComputedStyle(document.body),
            n = t[e === `padding` ? `paddingLeft` : `marginLeft`],
            r = t[e === `padding` ? `paddingTop` : `marginTop`],
            i = t[e === `padding` ? `paddingRight` : `marginRight`];
        return [q(n), q(r), q(i)]
    },
    St = function(e) {
        if (e === void 0 && (e = `margin`), typeof window > `u`) return bt;
        var t = xt(e),
            n = document.documentElement.clientWidth,
            r = window.innerWidth;
        return {
            left: t[0],
            top: t[1],
            right: t[2],
            gap: Math.max(0, r - n + t[2] - t[0])
        }
    },
    Ct = yt(),
    J = `data-scroll-locked`,
    wt = function(e, t, n, r) {
        var i = e.left,
            a = e.top,
            o = e.right,
            s = e.gap;
        return n === void 0 && (n = `margin`), `
  .${et} {
   overflow: hidden ${r};
   padding-right: ${s}px ${r};
  }
  body[${J}] {
    overflow: hidden ${r};
    overscroll-behavior: contain;
    ${[t&&`position: relative ${r};`,n===`margin`&&`
    padding-left: ${i}px;
    padding-top: ${a}px;
    padding-right: ${o}px;
    margin-left:0;
    margin-top:0;
    margin-right: ${s}px ${r};
    `,n===`padding`&&`padding-right: ${s}px ${r};`].filter(Boolean).join(``)}
  }
  
  .${H} {
    right: ${s}px ${r};
  }
  
  .${U} {
    margin-right: ${s}px ${r};
  }
  
  .${H} .${H} {
    right: 0 ${r};
  }
  
  .${U} .${U} {
    margin-right: 0 ${r};
  }
  
  body[${J}] {
    ${tt}: ${s}px;
  }
`
    },
    Tt = function() {
        var e = parseInt(document.body.getAttribute(`data-scroll-locked`) || `0`, 10);
        return isFinite(e) ? e : 0
    },
    Et = function() {
        i.useEffect(function() {
            return document.body.setAttribute(J, (Tt() + 1).toString()),
                function() {
                    var e = Tt() - 1;
                    e <= 0 ? document.body.removeAttribute(J) : document.body.setAttribute(J, e.toString())
                }
        }, [])
    },
    Dt = function(e) {
        var t = e.noRelative,
            n = e.noImportant,
            r = e.gapMode,
            a = r === void 0 ? `margin` : r;
        Et();
        var o = i.useMemo(function() {
            return St(a)
        }, [a]);
        return i.createElement(Ct, {
            styles: wt(o, !t, a, n ? `` : `!important`)
        })
    },
    Y = !1;
if (typeof window < `u`) try {
    var X = Object.defineProperty({}, "passive", {
        get: function() {
            return Y = !0, !0
        }
    });
    window.addEventListener(`test`, X, X), window.removeEventListener(`test`, X, X)
} catch {
    Y = !1
}
var Z = Y ? {
        passive: !1
    } : !1,
    Ot = function(e) {
        return e.tagName === `TEXTAREA`
    },
    kt = function(e, t) {
        if (!(e instanceof Element)) return !1;
        var n = window.getComputedStyle(e);
        return n[t] !== `hidden` && !(n.overflowY === n.overflowX && !Ot(e) && n[t] === `visible`)
    },
    At = function(e) {
        return kt(e, `overflowY`)
    },
    jt = function(e) {
        return kt(e, `overflowX`)
    },
    Mt = function(e, t) {
        var n = t.ownerDocument,
            r = t;
        do {
            if (typeof ShadowRoot < `u` && r instanceof ShadowRoot && (r = r.host), Ft(e, r)) {
                var i = It(e, r);
                if (i[1] > i[2]) return !0
            }
            r = r.parentNode
        } while (r && r !== n.body);
        return !1
    },
    Nt = function(e) {
        return [e.scrollTop, e.scrollHeight, e.clientHeight]
    },
    Pt = function(e) {
        return [e.scrollLeft, e.scrollWidth, e.clientWidth]
    },
    Ft = function(e, t) {
        return e === `v` ? At(t) : jt(t)
    },
    It = function(e, t) {
        return e === `v` ? Nt(t) : Pt(t)
    },
    Lt = function(e, t) {
        return e === `h` && t === `rtl` ? -1 : 1
    },
    Rt = function(e, t, n, r, i) {
        var a = Lt(e, window.getComputedStyle(t).direction),
            o = a * r,
            s = n.target,
            c = t.contains(s),
            l = !1,
            u = o > 0,
            d = 0,
            f = 0;
        do {
            if (!s) break;
            var p = It(e, s),
                m = p[0],
                h = p[1] - p[2] - a * m;
            (m || h) && Ft(e, s) && (d += h, f += m);
            var g = s.parentNode;
            s = g && g.nodeType === Node.DOCUMENT_FRAGMENT_NODE ? g.host : g
        } while (!c && s !== document.body || c && (t.contains(s) || t === s));
        return (u && (i && Math.abs(d) < 1 || !i && o > d) || !u && (i && Math.abs(f) < 1 || !i && -o > f)) && (l = !0), l
    },
    Q = function(e) {
        return `changedTouches` in e ? [e.changedTouches[0].clientX, e.changedTouches[0].clientY] : [0, 0]
    },
    zt = function(e) {
        return [e.deltaX, e.deltaY]
    },
    Bt = function(e) {
        return e && `current` in e ? e.current : e
    },
    Vt = function(e, t) {
        return e[0] === t[0] && e[1] === t[1]
    },
    Ht = function(e) {
        return `
  .block-interactivity-${e} {pointer-events: none;}
  .allow-interactivity-${e} {pointer-events: all;}
`
    },
    Ut = 0,
    $ = [];

function Wt(e) {
    var t = i.useRef([]),
        n = i.useRef([0, 0]),
        r = i.useRef(),
        a = i.useState(Ut++)[0],
        o = i.useState(yt)[0],
        s = i.useRef(e);
    i.useEffect(function() {
        s.current = e
    }, [e]), i.useEffect(function() {
        if (e.inert) {
            document.body.classList.add(`block-interactivity-${a}`);
            var t = $e([e.lockRef.current], (e.shards || []).map(Bt), !0).filter(Boolean);
            return t.forEach(function(e) {
                    return e.classList.add(`allow-interactivity-${a}`)
                }),
                function() {
                    document.body.classList.remove(`block-interactivity-${a}`), t.forEach(function(e) {
                        return e.classList.remove(`allow-interactivity-${a}`)
                    })
                }
        }
    }, [e.inert, e.lockRef.current, e.shards]);
    var c = i.useCallback(function(e, t) {
            if (`touches` in e && e.touches.length === 2 || e.type === `wheel` && e.ctrlKey) return !s.current.allowPinchZoom;
            var i = Q(e),
                a = n.current,
                o = `deltaX` in e ? e.deltaX : a[0] - i[0],
                c = `deltaY` in e ? e.deltaY : a[1] - i[1],
                l, u = e.target,
                d = Math.abs(o) > Math.abs(c) ? `h` : `v`;
            if (`touches` in e && d === `h` && u.type === `range`) return !1;
            var f = window.getSelection(),
                p = f && f.anchorNode;
            if (p && (p === u || p.contains(u))) return !1;
            var m = Mt(d, u);
            if (!m) return !0;
            if (m ? l = d : (l = d === `v` ? `h` : `v`, m = Mt(d, u)), !m) return !1;
            if (!r.current && `changedTouches` in e && (o || c) && (r.current = l), !l) return !0;
            var h = r.current || l;
            return Rt(h, t, e, h === `h` ? o : c, !0)
        }, []),
        l = i.useCallback(function(e) {
            var n = e;
            if (!(!$.length || $[$.length - 1] !== o)) {
                var r = `deltaY` in n ? zt(n) : Q(n),
                    i = t.current.filter(function(e) {
                        return e.name === n.type && (e.target === n.target || n.target === e.shadowParent) && Vt(e.delta, r)
                    })[0];
                if (i && i.should) {
                    n.cancelable && n.preventDefault();
                    return
                }
                if (!i) {
                    var a = (s.current.shards || []).map(Bt).filter(Boolean).filter(function(e) {
                        return e.contains(n.target)
                    });
                    (a.length > 0 ? c(n, a[0]) : !s.current.noIsolation) && n.cancelable && n.preventDefault()
                }
            }
        }, []),
        u = i.useCallback(function(e, n, r, i) {
            var a = {
                name: e,
                delta: n,
                target: r,
                should: i,
                shadowParent: Gt(r)
            };
            t.current.push(a), setTimeout(function() {
                t.current = t.current.filter(function(e) {
                    return e !== a
                })
            }, 1)
        }, []),
        d = i.useCallback(function(e) {
            n.current = Q(e), r.current = void 0
        }, []),
        f = i.useCallback(function(t) {
            u(t.type, zt(t), t.target, c(t, e.lockRef.current))
        }, []),
        p = i.useCallback(function(t) {
            u(t.type, Q(t), t.target, c(t, e.lockRef.current))
        }, []);
    i.useEffect(function() {
        return $.push(o), e.setCallbacks({
                onScrollCapture: f,
                onWheelCapture: f,
                onTouchMoveCapture: p
            }), document.addEventListener(`wheel`, l, Z), document.addEventListener(`touchmove`, l, Z), document.addEventListener(`touchstart`, d, Z),
            function() {
                $ = $.filter(function(e) {
                    return e !== o
                }), document.removeEventListener(`wheel`, l, Z), document.removeEventListener(`touchmove`, l, Z), document.removeEventListener(`touchstart`, d, Z)
            }
    }, []);
    var m = e.removeScrollBar,
        h = e.inert;
    return i.createElement(i.Fragment, null, h ? i.createElement(o, {
        styles: Ht(a)
    }) : null, m ? i.createElement(Dt, {
        noRelative: e.noRelative,
        gapMode: e.gapMode
    }) : null)
}

function Gt(e) {
    for (var t = null; e !== null;) e instanceof ShadowRoot && (t = e.host, e = e.host), e = e.parentNode;
    return t
}
var Kt = ut(dt, Wt),
    qt = i.forwardRef(function(e, t) {
        return i.createElement(K, V({}, e, {
            ref: t,
            sideCar: Kt
        }))
    });
qt.classNames = K.classNames;
export {
    o as C, u as S, m as _, Ae as a, d as b, _e as c, A as d, me as f, D as g, E as h, je as i, j as l, O as m, Ze as n, Te as o, le as p, Fe as r, ye as s, qt as t, he as u, p as v, l as x, g as y
};