import {
    c as e,
    n as t,
    r as n
} from "./createLucideIcon-DwuI3uP3.js";
import {
    C as r,
    S as i,
    a,
    b as o,
    h as s,
    m as c,
    o as l,
    v as u
} from "./Combination-DQZp0Vig.js";
import {
    S as d
} from "./button-DxiAmHhP.js";
import {
    t as f
} from "./utils-Cz4MqTg-.js";
var p = e(n(), 1),
    m = t();

function h(e) {
    let t = e + `CollectionProvider`,
        [n, r] = o(t),
        [a, s] = n(t, {
            collectionRef: {
                current: null
            },
            itemMap: new Map
        }),
        c = e => {
            let {
                scope: t,
                children: n
            } = e, r = p.useRef(null), i = p.useRef(new Map).current;
            return (0, m.jsx)(a, {
                scope: t,
                itemMap: i,
                collectionRef: r,
                children: n
            })
        };
    c.displayName = t;
    let l = e + `CollectionSlot`,
        d = u(l),
        f = p.forwardRef((e, t) => {
            let {
                scope: n,
                children: r
            } = e;
            return (0, m.jsx)(d, {
                ref: i(t, s(l, n).collectionRef),
                children: r
            })
        });
    f.displayName = l;
    let h = e + `CollectionItemSlot`,
        g = `data-radix-collection-item`,
        _ = u(h),
        v = p.forwardRef((e, t) => {
            let {
                scope: n,
                children: r,
                ...a
            } = e, o = p.useRef(null), c = i(t, o), l = s(h, n);
            return p.useEffect(() => (l.itemMap.set(o, {
                ref: o,
                ...a
            }), () => void l.itemMap.delete(o))), (0, m.jsx)(_, {
                [g]: ``,
                ref: c,
                children: r
            })
        });
    v.displayName = h;

    function y(t) {
        let n = s(e + `CollectionConsumer`, t);
        return p.useCallback(() => {
            let e = n.collectionRef.current;
            if (!e) return [];
            let t = Array.from(e.querySelectorAll(`[${g}]`));
            return Array.from(n.itemMap.values()).sort((e, n) => t.indexOf(e.ref.current) - t.indexOf(n.ref.current))
        }, [n.collectionRef, n.itemMap])
    }
    return [{
        Provider: c,
        Slot: f,
        ItemSlot: v
    }, y, r]
}
var g = p.createContext(void 0);

function _(e) {
    let t = p.useContext(g);
    return e || t || `ltr`
}
var v = `rovingFocusGroup.onEntryFocus`,
    y = {
        bubbles: !1,
        cancelable: !0
    },
    b = `RovingFocusGroup`,
    [x, S, C] = h(b),
    [w, T] = o(b, [C]),
    [E, D] = w(b),
    O = p.forwardRef((e, t) => (0, m.jsx)(x.Provider, {
        scope: e.__scopeRovingFocusGroup,
        children: (0, m.jsx)(x.Slot, {
            scope: e.__scopeRovingFocusGroup,
            children: (0, m.jsx)(k, { ...e,
                ref: t
            })
        })
    }));
O.displayName = b;
var k = p.forwardRef((e, t) => {
        let {
            __scopeRovingFocusGroup: n,
            orientation: a,
            loop: o = !1,
            dir: u,
            currentTabStopId: d,
            defaultCurrentTabStopId: f,
            onCurrentTabStopIdChange: h,
            onEntryFocus: g,
            preventScrollOnEntryFocus: x = !1,
            ...C
        } = e, w = p.useRef(null), T = i(t, w), D = _(u), [O, k] = l({
            prop: d,
            defaultProp: f ? ? null,
            onChange: h,
            caller: b
        }), [A, j] = p.useState(!1), M = c(g), N = S(n), P = p.useRef(!1), [I, L] = p.useState(0);
        return p.useEffect(() => {
            let e = w.current;
            if (e) return e.addEventListener(v, M), () => e.removeEventListener(v, M)
        }, [M]), (0, m.jsx)(E, {
            scope: n,
            orientation: a,
            dir: D,
            loop: o,
            currentTabStopId: O,
            onItemFocus: p.useCallback(e => k(e), [k]),
            onItemShiftTab: p.useCallback(() => j(!0), []),
            onFocusableItemAdd: p.useCallback(() => L(e => e + 1), []),
            onFocusableItemRemove: p.useCallback(() => L(e => e - 1), []),
            children: (0, m.jsx)(s.div, {
                tabIndex: A || I === 0 ? -1 : 0,
                "data-orientation": a,
                ...C,
                ref: T,
                style: {
                    outline: `none`,
                    ...e.style
                },
                onMouseDown: r(e.onMouseDown, () => {
                    P.current = !0
                }),
                onFocus: r(e.onFocus, e => {
                    let t = !P.current;
                    if (e.target === e.currentTarget && t && !A) {
                        let t = new CustomEvent(v, y);
                        if (e.currentTarget.dispatchEvent(t), !t.defaultPrevented) {
                            let e = N().filter(e => e.focusable);
                            F([e.find(e => e.active), e.find(e => e.id === O), ...e].filter(Boolean).map(e => e.ref.current), x)
                        }
                    }
                    P.current = !1
                }),
                onBlur: r(e.onBlur, () => j(!1))
            })
        })
    }),
    A = `RovingFocusGroupItem`,
    j = p.forwardRef((e, t) => {
        let {
            __scopeRovingFocusGroup: n,
            focusable: i = !0,
            active: o = !1,
            tabStopId: c,
            children: l,
            ...u
        } = e, d = a(), f = c || d, h = D(A, n), g = h.currentTabStopId === f, _ = S(n), {
            onFocusableItemAdd: v,
            onFocusableItemRemove: y,
            currentTabStopId: b
        } = h;
        return p.useEffect(() => {
            if (i) return v(), () => y()
        }, [i, v, y]), (0, m.jsx)(x.ItemSlot, {
            scope: n,
            id: f,
            focusable: i,
            active: o,
            children: (0, m.jsx)(s.span, {
                tabIndex: g ? 0 : -1,
                "data-orientation": h.orientation,
                ...u,
                ref: t,
                onMouseDown: r(e.onMouseDown, e => {
                    i ? h.onItemFocus(f) : e.preventDefault()
                }),
                onFocus: r(e.onFocus, () => h.onItemFocus(f)),
                onKeyDown: r(e.onKeyDown, e => {
                    if (e.key === `Tab` && e.shiftKey) {
                        h.onItemShiftTab();
                        return
                    }
                    if (e.target !== e.currentTarget) return;
                    let t = P(e, h.orientation, h.dir);
                    if (t !== void 0) {
                        if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
                        e.preventDefault();
                        let n = _().filter(e => e.focusable).map(e => e.ref.current);
                        if (t === `last`) n.reverse();
                        else if (t === `prev` || t === `next`) {
                            t === `prev` && n.reverse();
                            let r = n.indexOf(e.currentTarget);
                            n = h.loop ? I(n, r + 1) : n.slice(r + 1)
                        }
                        setTimeout(() => F(n))
                    }
                }),
                children: typeof l == `function` ? l({
                    isCurrentTabStop: g,
                    hasTabStop: b != null
                }) : l
            })
        })
    });
j.displayName = A;
var M = {
    ArrowLeft: `prev`,
    ArrowUp: `prev`,
    ArrowRight: `next`,
    ArrowDown: `next`,
    PageUp: `first`,
    Home: `first`,
    PageDown: `last`,
    End: `last`
};

function N(e, t) {
    return t === `rtl` ? e === `ArrowLeft` ? `ArrowRight` : e === `ArrowRight` ? `ArrowLeft` : e : e
}

function P(e, t, n) {
    let r = N(e.key, n);
    if (!(t === `vertical` && [`ArrowLeft`, `ArrowRight`].includes(r)) && !(t === `horizontal` && [`ArrowUp`, `ArrowDown`].includes(r))) return M[r]
}

function F(e, t = !1) {
    let n = document.activeElement;
    for (let r of e)
        if (r === n || (r.focus({
                preventScroll: t
            }), document.activeElement !== n)) return
}

function I(e, t) {
    return e.map((n, r) => e[(t + r) % e.length])
}
var L = O,
    R = j,
    z = p.forwardRef(({
        className: e,
        type: t,
        ...n
    }, r) => (0, m.jsx)(`input`, {
        type: t,
        className: f(`flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm`, e),
        ref: r,
        ...n
    }));
z.displayName = `Input`;
var B = `Label`,
    V = p.forwardRef((e, t) => (0, m.jsx)(s.label, { ...e,
        ref: t,
        onMouseDown: t => {
            t.target.closest(`button, input, select, textarea`) || (e.onMouseDown ? .(t), !t.defaultPrevented && t.detail > 1 && t.preventDefault())
        }
    }));
V.displayName = B;
var H = V,
    U = d(`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70`),
    W = p.forwardRef(({
        className: e,
        ...t
    }, n) => (0, m.jsx)(H, {
        ref: n,
        className: f(U(), e),
        ...t
    }));
W.displayName = H.displayName;

function G(e) {
    let t = p.useRef({
        value: e,
        previous: e
    });
    return p.useMemo(() => (t.current.value !== e && (t.current.previous = t.current.value, t.current.value = e), t.current.previous), [e])
}
export {
    L as a, h as c, R as i, W as n, T as o, z as r, _ as s, G as t
};