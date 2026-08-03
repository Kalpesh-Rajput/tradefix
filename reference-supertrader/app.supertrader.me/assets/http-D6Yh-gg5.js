import {
    c as e,
    n as t,
    o as n,
    r
} from "./createLucideIcon-DwuI3uP3.js";
var i = class {
        constructor() {
            this.listeners = new Set, this.subscribe = this.subscribe.bind(this)
        }
        subscribe(e) {
            return this.listeners.add(e), this.onSubscribe(), () => {
                this.listeners.delete(e), this.onUnsubscribe()
            }
        }
        hasListeners() {
            return this.listeners.size > 0
        }
        onSubscribe() {}
        onUnsubscribe() {}
    },
    a = new class extends i {#
        e;#
        t;#
        n;
        constructor() {
            super(), this.#n = e => {
                if (typeof window < `u` && window.addEventListener) {
                    let t = () => e();
                    return window.addEventListener(`visibilitychange`, t, !1), () => {
                        window.removeEventListener(`visibilitychange`, t)
                    }
                }
            }
        }
        onSubscribe() {
            this.#t || this.setEventListener(this.#n)
        }
        onUnsubscribe() {
            this.hasListeners() || (this.#t ? .(), this.#t = void 0)
        }
        setEventListener(e) {
            this.#n = e, this.#t ? .(), this.#t = e(e => {
                typeof e == `boolean` ? this.setFocused(e) : this.onFocus()
            })
        }
        setFocused(e) {
            this.#e !== e && (this.#e = e, this.onFocus())
        }
        onFocus() {
            let e = this.isFocused();
            this.listeners.forEach(t => {
                t(e)
            })
        }
        isFocused() {
            return typeof this.#e == `boolean` ? this.#e : globalThis.document ? .visibilityState !== `hidden`
        }
    },
    o = {
        setTimeout: (e, t) => setTimeout(e, t),
        clearTimeout: e => clearTimeout(e),
        setInterval: (e, t) => setInterval(e, t),
        clearInterval: e => clearInterval(e)
    },
    s = new class {#
        e = o;
        setTimeoutProvider(e) {
            this.#e = e
        }
        setTimeout(e, t) {
            return this.#e.setTimeout(e, t)
        }
        clearTimeout(e) {
            this.#e.clearTimeout(e)
        }
        setInterval(e, t) {
            return this.#e.setInterval(e, t)
        }
        clearInterval(e) {
            this.#e.clearInterval(e)
        }
    };

function c(e) {
    setTimeout(e, 0)
}
var l = typeof window > `u` || `Deno` in globalThis;

function u() {}

function d(e, t) {
    return typeof e == `function` ? e(t) : e
}

function f(e) {
    return typeof e == `number` && e >= 0 && e !== 1 / 0
}

function p(e, t) {
    return Math.max(e + (t || 0) - Date.now(), 0)
}

function m(e, t) {
    return typeof e == `function` ? e(t) : e
}

function h(e, t) {
    return typeof e == `function` ? e(t) : e
}

function g(e, t) {
    let {
        type: n = `all`,
        exact: r,
        fetchStatus: i,
        predicate: a,
        queryKey: o,
        stale: s
    } = e;
    if (o) {
        if (r) {
            if (t.queryHash !== v(o, t.options)) return !1
        } else if (!b(t.queryKey, o)) return !1
    }
    if (n !== `all`) {
        let e = t.isActive();
        if (n === `active` && !e || n === `inactive` && e) return !1
    }
    return !(typeof s == `boolean` && t.isStale() !== s || i && i !== t.state.fetchStatus || a && !a(t))
}

function _(e, t) {
    let {
        exact: n,
        status: r,
        predicate: i,
        mutationKey: a
    } = e;
    if (a) {
        if (!t.options.mutationKey) return !1;
        if (n) {
            if (y(t.options.mutationKey) !== y(a)) return !1
        } else if (!b(t.options.mutationKey, a)) return !1
    }
    return !(r && t.state.status !== r || i && !i(t))
}

function v(e, t) {
    return (t ? .queryKeyHashFn || y)(e)
}

function y(e) {
    return JSON.stringify(e, (e, t) => T(t) ? Object.keys(t).sort().reduce((e, n) => (e[n] = t[n], e), {}) : t)
}

function b(e, t) {
    return e === t ? !0 : typeof e == typeof t && e && t && typeof e == `object` && typeof t == `object` ? Object.keys(t).every(n => b(e[n], t[n])) : !1
}
var x = Object.prototype.hasOwnProperty;

function S(e, t, n = 0) {
    if (e === t) return e;
    if (n > 500) return t;
    let r = w(e) && w(t);
    if (!r && !(T(e) && T(t))) return t;
    let i = (r ? e : Object.keys(e)).length,
        a = r ? t : Object.keys(t),
        o = a.length,
        s = r ? Array(o) : {},
        c = 0;
    for (let l = 0; l < o; l++) {
        let o = r ? l : a[l],
            u = e[o],
            d = t[o];
        if (u === d) {
            s[o] = u, (r ? l < i : x.call(e, o)) && c++;
            continue
        }
        if (u === null || d === null || typeof u != `object` || typeof d != `object`) {
            s[o] = d;
            continue
        }
        let f = S(u, d, n + 1);
        s[o] = f, f === u && c++
    }
    return i === o && c === i ? e : s
}

function C(e, t) {
    if (!t || Object.keys(e).length !== Object.keys(t).length) return !1;
    for (let n in e)
        if (e[n] !== t[n]) return !1;
    return !0
}

function w(e) {
    return Array.isArray(e) && e.length === Object.keys(e).length
}

function T(e) {
    if (!E(e)) return !1;
    let t = e.constructor;
    if (t === void 0) return !0;
    let n = t.prototype;
    return !(!E(n) || !n.hasOwnProperty(`isPrototypeOf`) || Object.getPrototypeOf(e) !== Object.prototype)
}

function E(e) {
    return Object.prototype.toString.call(e) === `[object Object]`
}

function ee(e) {
    return new Promise(t => {
        s.setTimeout(t, e)
    })
}

function te(e, t, n) {
    return typeof n.structuralSharing == `function` ? n.structuralSharing(e, t) : n.structuralSharing === !1 ? t : S(e, t)
}

function ne(e, t, n = 0) {
    let r = [...e, t];
    return n && r.length > n ? r.slice(1) : r
}

function D(e, t, n = 0) {
    let r = [t, ...e];
    return n && r.length > n ? r.slice(0, -1) : r
}
var O = Symbol();

function k(e, t) {
    return !e.queryFn && t ? .initialPromise ? () => t.initialPromise : !e.queryFn || e.queryFn === O ? () => Promise.reject(Error(`Missing queryFn: '${e.queryHash}'`)) : e.queryFn
}

function A(e, t) {
    return typeof e == `function` ? e(...t) : !!e
}

function re(e, t, n) {
    let r = !1,
        i;
    return Object.defineProperty(e, "signal", {
        enumerable: !0,
        get: () => (i ? ? = t(), r ? i : (r = !0, i.aborted ? n() : i.addEventListener(`abort`, n, {
            once: !0
        }), i))
    }), e
}
var j = (() => {
    let e = () => l;
    return {
        isServer() {
            return e()
        },
        setIsServer(t) {
            e = t
        }
    }
})();

function ie() {
    let e, t, n = new Promise((n, r) => {
        e = n, t = r
    });
    n.status = `pending`, n.catch(() => {});

    function r(e) {
        Object.assign(n, e), delete n.resolve, delete n.reject
    }
    return n.resolve = t => {
        r({
            status: `fulfilled`,
            value: t
        }), e(t)
    }, n.reject = e => {
        r({
            status: `rejected`,
            reason: e
        }), t(e)
    }, n
}
var ae = c;

function M() {
    let e = [],
        t = 0,
        n = e => {
            e()
        },
        r = e => {
            e()
        },
        i = ae,
        a = r => {
            t ? e.push(r) : i(() => {
                n(r)
            })
        },
        o = () => {
            let t = e;
            e = [], t.length && i(() => {
                r(() => {
                    t.forEach(e => {
                        n(e)
                    })
                })
            })
        };
    return {
        batch: e => {
            let n;
            t++;
            try {
                n = e()
            } finally {
                t--, t || o()
            }
            return n
        },
        batchCalls: e => (...t) => {
            a(() => {
                e(...t)
            })
        },
        schedule: a,
        setNotifyFunction: e => {
            n = e
        },
        setBatchNotifyFunction: e => {
            r = e
        },
        setScheduler: e => {
            i = e
        }
    }
}
var N = M(),
    P = new class extends i {#
        e = !0;#
        t;#
        n;
        constructor() {
            super(), this.#n = e => {
                if (typeof window < `u` && window.addEventListener) {
                    let t = () => e(!0),
                        n = () => e(!1);
                    return window.addEventListener(`online`, t, !1), window.addEventListener(`offline`, n, !1), () => {
                        window.removeEventListener(`online`, t), window.removeEventListener(`offline`, n)
                    }
                }
            }
        }
        onSubscribe() {
            this.#t || this.setEventListener(this.#n)
        }
        onUnsubscribe() {
            this.hasListeners() || (this.#t ? .(), this.#t = void 0)
        }
        setEventListener(e) {
            this.#n = e, this.#t ? .(), this.#t = e(this.setOnline.bind(this))
        }
        setOnline(e) {
            this.#e !== e && (this.#e = e, this.listeners.forEach(t => {
                t(e)
            }))
        }
        isOnline() {
            return this.#e
        }
    };

function F(e) {
    return Math.min(1e3 * 2 ** e, 3e4)
}

function oe(e) {
    return (e ? ? `online`) === `online` ? P.isOnline() : !0
}
var se = class extends Error {
    constructor(e) {
        super(`CancelledError`), this.revert = e ? .revert, this.silent = e ? .silent
    }
};

function ce(e) {
    let t = !1,
        n = 0,
        r, i = ie(),
        o = () => i.status !== `pending`,
        s = t => {
            if (!o()) {
                let n = new se(t);
                p(n), e.onCancel ? .(n)
            }
        },
        c = () => {
            t = !0
        },
        l = () => {
            t = !1
        },
        u = () => a.isFocused() && (e.networkMode === `always` || P.isOnline()) && e.canRun(),
        d = () => oe(e.networkMode) && e.canRun(),
        f = e => {
            o() || (r ? .(), i.resolve(e))
        },
        p = e => {
            o() || (r ? .(), i.reject(e))
        },
        m = () => new Promise(t => {
            r = e => {
                (o() || u()) && t(e)
            }, e.onPause ? .()
        }).then(() => {
            r = void 0, o() || e.onContinue ? .()
        }),
        h = () => {
            if (o()) return;
            let r, i = n === 0 ? e.initialPromise : void 0;
            try {
                r = i ? ? e.fn()
            } catch (e) {
                r = Promise.reject(e)
            }
            Promise.resolve(r).then(f).catch(r => {
                if (o()) return;
                let i = e.retry ? ? (j.isServer() ? 0 : 3),
                    a = e.retryDelay ? ? F,
                    s = typeof a == `function` ? a(n, r) : a,
                    c = i === !0 || typeof i == `number` && n < i || typeof i == `function` && i(n, r);
                if (t || !c) {
                    p(r);
                    return
                }
                n++, e.onFail ? .(n, r), ee(s).then(() => u() ? void 0 : m()).then(() => {
                    t ? p(r) : h()
                })
            })
        };
    return {
        promise: i,
        status: () => i.status,
        cancel: s,
        continue: () => (r ? .(), i),
        cancelRetry: c,
        continueRetry: l,
        canStart: d,
        start: () => (d() ? h() : m().then(h), i)
    }
}
var le = class {#
    e;
    destroy() {
        this.clearGcTimeout()
    }
    scheduleGc() {
        this.clearGcTimeout(), f(this.gcTime) && (this.#e = s.setTimeout(() => {
            this.optionalRemove()
        }, this.gcTime))
    }
    updateGcTime(e) {
        this.gcTime = Math.max(this.gcTime || 0, e ? ? (j.isServer() ? 1 / 0 : 300 * 1e3))
    }
    clearGcTimeout() {
        this.#e !== void 0 && (s.clearTimeout(this.#e), this.#e = void 0)
    }
};

function ue(e) {
    return {
        onFetch: (t, n) => {
            let r = t.options,
                i = t.fetchOptions ? .meta ? .fetchMore ? .direction,
                a = t.state.data ? .pages || [],
                o = t.state.data ? .pageParams || [],
                s = {
                    pages: [],
                    pageParams: []
                },
                c = 0,
                l = async () => {
                    let n = !1,
                        l = e => {
                            re(e, () => t.signal, () => n = !0)
                        },
                        u = k(t.options, t.fetchOptions),
                        d = async (e, r, i) => {
                            if (n) return Promise.reject(t.signal.reason);
                            if (r == null && e.pages.length) return Promise.resolve(e);
                            let a = await u((() => {
                                    let e = {
                                        client: t.client,
                                        queryKey: t.queryKey,
                                        pageParam: r,
                                        direction: i ? `backward` : `forward`,
                                        meta: t.options.meta
                                    };
                                    return l(e), e
                                })()),
                                {
                                    maxPages: o
                                } = t.options,
                                s = i ? D : ne;
                            return {
                                pages: s(e.pages, a, o),
                                pageParams: s(e.pageParams, r, o)
                            }
                        };
                    if (i && a.length) {
                        let e = i === `backward`,
                            t = e ? fe : de,
                            n = {
                                pages: a,
                                pageParams: o
                            };
                        s = await d(n, t(r, n), e)
                    } else {
                        let t = e ? ? a.length;
                        do {
                            let e = c === 0 ? o[0] ? ? r.initialPageParam : de(r, s);
                            if (c > 0 && e == null) break;
                            s = await d(s, e), c++
                        } while (c < t)
                    }
                    return s
                };
            t.options.persister ? t.fetchFn = () => t.options.persister ? .(l, {
                client: t.client,
                queryKey: t.queryKey,
                meta: t.options.meta,
                signal: t.signal
            }, n) : t.fetchFn = l
        }
    }
}

function de(e, {
    pages: t,
    pageParams: n
}) {
    let r = t.length - 1;
    return t.length > 0 ? e.getNextPageParam(t[r], t, n[r], n) : void 0
}

function fe(e, {
    pages: t,
    pageParams: n
}) {
    return t.length > 0 ? e.getPreviousPageParam ? .(t[0], t, n[0], n) : void 0
}

function pe(e, t) {
    return t ? de(e, t) != null : !1
}

function me(e, t) {
    return !t || !e.getPreviousPageParam ? !1 : fe(e, t) != null
}
var he = class extends le {#
    e;#
    t;#
    n;#
    r;#
    i;#
    a;#
    o;#
    s;
    constructor(e) {
        super(), this.#s = !1, this.#o = e.defaultOptions, this.setOptions(e.options), this.observers = [], this.#i = e.client, this.#r = this.#i.getQueryCache(), this.queryKey = e.queryKey, this.queryHash = e.queryHash, this.#t = ve(this.options), this.state = e.state ? ? this.#t, this.scheduleGc()
    }
    get meta() {
        return this.options.meta
    }
    get queryType() {
        return this.#e
    }
    get promise() {
        return this.#a ? .promise
    }
    setOptions(e) {
        if (this.options = { ...this.#o,
                ...e
            }, e ? ._type && (this.#e = e._type), this.updateGcTime(this.options.gcTime), this.state && this.state.data === void 0) {
            let e = ve(this.options);
            e.data !== void 0 && (this.setState(_e(e.data, e.dataUpdatedAt)), this.#t = e)
        }
    }
    optionalRemove() {
        !this.observers.length && this.state.fetchStatus === `idle` && this.#r.remove(this)
    }
    setData(e, t) {
        let n = te(this.state.data, e, this.options);
        return this.#l({
            data: n,
            type: `success`,
            dataUpdatedAt: t ? .updatedAt,
            manual: t ? .manual
        }), n
    }
    setState(e) {
        this.#l({
            type: `setState`,
            state: e
        })
    }
    cancel(e) {
        let t = this.#a ? .promise;
        return this.#a ? .cancel(e), t ? t.then(u).catch(u) : Promise.resolve()
    }
    destroy() {
        super.destroy(), this.cancel({
            silent: !0
        })
    }
    get resetState() {
        return this.#t
    }
    reset() {
        this.destroy(), this.setState(this.resetState)
    }
    isActive() {
        return this.observers.some(e => h(e.options.enabled, this) !== !1)
    }
    isDisabled() {
        return this.getObserversCount() > 0 ? !this.isActive() : this.options.queryFn === O || !this.isFetched()
    }
    isFetched() {
        return this.state.dataUpdateCount + this.state.errorUpdateCount > 0
    }
    isStatic() {
        return this.getObserversCount() > 0 ? this.observers.some(e => m(e.options.staleTime, this) === `static`) : !1
    }
    isStale() {
        return this.getObserversCount() > 0 ? this.observers.some(e => e.getCurrentResult().isStale) : this.state.data === void 0 || this.state.isInvalidated
    }
    isStaleByTime(e = 0) {
        return this.state.data === void 0 ? !0 : e === `static` ? !1 : this.state.isInvalidated ? !0 : !p(this.state.dataUpdatedAt, e)
    }
    onFocus() {
        this.observers.find(e => e.shouldFetchOnWindowFocus()) ? .refetch({
            cancelRefetch: !1
        }), this.#a ? .continue()
    }
    onOnline() {
        this.observers.find(e => e.shouldFetchOnReconnect()) ? .refetch({
            cancelRefetch: !1
        }), this.#a ? .continue()
    }
    addObserver(e) {
        this.observers.includes(e) || (this.observers.push(e), this.clearGcTimeout(), this.#r.notify({
            type: `observerAdded`,
            query: this,
            observer: e
        }))
    }
    removeObserver(e) {
        this.observers.includes(e) && (this.observers = this.observers.filter(t => t !== e), this.observers.length || (this.#a && (this.#s || this.#c() ? this.#a.cancel({
            revert: !0
        }) : this.#a.cancelRetry()), this.scheduleGc()), this.#r.notify({
            type: `observerRemoved`,
            query: this,
            observer: e
        }))
    }
    getObserversCount() {
        return this.observers.length
    }#
    c() {
        return this.state.fetchStatus === `paused` && this.state.status === `pending`
    }
    invalidate() {
        this.state.isInvalidated || this.#l({
            type: `invalidate`
        })
    }
    async fetch(e, t) {
        if (this.state.fetchStatus !== `idle` && this.#a ? .status() !== `rejected`) {
            if (this.state.data !== void 0 && t ? .cancelRefetch) this.cancel({
                silent: !0
            });
            else if (this.#a) return this.#a.continueRetry(), this.#a.promise
        }
        if (e && this.setOptions(e), !this.options.queryFn) {
            let e = this.observers.find(e => e.options.queryFn);
            e && this.setOptions(e.options)
        }
        let n = new AbortController,
            r = e => {
                Object.defineProperty(e, "signal", {
                    enumerable: !0,
                    get: () => (this.#s = !0, n.signal)
                })
            },
            i = () => {
                let e = k(this.options, t),
                    n = (() => {
                        let e = {
                            client: this.#i,
                            queryKey: this.queryKey,
                            meta: this.meta
                        };
                        return r(e), e
                    })();
                return this.#s = !1, this.options.persister ? this.options.persister(e, n, this) : e(n)
            },
            a = (() => {
                let e = {
                    fetchOptions: t,
                    options: this.options,
                    queryKey: this.queryKey,
                    client: this.#i,
                    state: this.state,
                    fetchFn: i
                };
                return r(e), e
            })();
        (this.#e === `infinite` ? ue(this.options.pages) : this.options.behavior) ? .onFetch(a, this), this.#n = this.state, (this.state.fetchStatus === `idle` || this.state.fetchMeta !== a.fetchOptions ? .meta) && this.#l({
            type: `fetch`,
            meta: a.fetchOptions ? .meta
        }), this.#a = ce({
            initialPromise: t ? .initialPromise,
            fn: a.fetchFn,
            onCancel: e => {
                e instanceof se && e.revert && this.setState({ ...this.#n,
                    fetchStatus: `idle`
                }), n.abort()
            },
            onFail: (e, t) => {
                this.#l({
                    type: `failed`,
                    failureCount: e,
                    error: t
                })
            },
            onPause: () => {
                this.#l({
                    type: `pause`
                })
            },
            onContinue: () => {
                this.#l({
                    type: `continue`
                })
            },
            retry: a.options.retry,
            retryDelay: a.options.retryDelay,
            networkMode: a.options.networkMode,
            canRun: () => !0
        });
        try {
            let e = await this.#a.start();
            if (e === void 0) throw Error(`${this.queryHash} data is undefined`);
            return this.setData(e), this.#r.config.onSuccess ? .(e, this), this.#r.config.onSettled ? .(e, this.state.error, this), e
        } catch (e) {
            if (e instanceof se) {
                if (e.silent) return this.#a.promise;
                if (e.revert) {
                    if (this.state.data === void 0) throw e;
                    return this.state.data
                }
            }
            throw this.#l({
                type: `error`,
                error: e
            }), this.#r.config.onError ? .(e, this), this.#r.config.onSettled ? .(this.state.data, e, this), e
        } finally {
            this.scheduleGc()
        }
    }#
    l(e) {
        let t = t => {
            switch (e.type) {
                case `failed`:
                    return { ...t,
                        fetchFailureCount: e.failureCount,
                        fetchFailureReason: e.error
                    };
                case `pause`:
                    return { ...t,
                        fetchStatus: `paused`
                    };
                case `continue`:
                    return { ...t,
                        fetchStatus: `fetching`
                    };
                case `fetch`:
                    return { ...t,
                        ...ge(t.data, this.options),
                        fetchMeta: e.meta ? ? null
                    };
                case `success`:
                    let n = { ...t,
                        ..._e(e.data, e.dataUpdatedAt),
                        dataUpdateCount: t.dataUpdateCount + 1,
                        ...!e.manual && {
                            fetchStatus: `idle`,
                            fetchFailureCount: 0,
                            fetchFailureReason: null
                        }
                    };
                    return this.#n = e.manual ? n : void 0, n;
                case `error`:
                    let r = e.error;
                    return { ...t,
                        error: r,
                        errorUpdateCount: t.errorUpdateCount + 1,
                        errorUpdatedAt: Date.now(),
                        fetchFailureCount: t.fetchFailureCount + 1,
                        fetchFailureReason: r,
                        fetchStatus: `idle`,
                        status: `error`,
                        isInvalidated: !0
                    };
                case `invalidate`:
                    return { ...t,
                        isInvalidated: !0
                    };
                case `setState`:
                    return { ...t,
                        ...e.state
                    }
            }
        };
        this.state = t(this.state), N.batch(() => {
            this.observers.forEach(e => {
                e.onQueryUpdate()
            }), this.#r.notify({
                query: this,
                type: `updated`,
                action: e
            })
        })
    }
};

function ge(e, t) {
    return {
        fetchFailureCount: 0,
        fetchFailureReason: null,
        fetchStatus: oe(t.networkMode) ? `fetching` : `paused`,
        ...e === void 0 && {
            error: null,
            status: `pending`
        }
    }
}

function _e(e, t) {
    return {
        data: e,
        dataUpdatedAt: t ? ? Date.now(),
        error: null,
        isInvalidated: !1,
        status: `success`
    }
}

function ve(e) {
    let t = typeof e.initialData == `function` ? e.initialData() : e.initialData,
        n = t !== void 0,
        r = n ? typeof e.initialDataUpdatedAt == `function` ? e.initialDataUpdatedAt() : e.initialDataUpdatedAt : 0;
    return {
        data: t,
        dataUpdateCount: 0,
        dataUpdatedAt: n ? r ? ? Date.now() : 0,
        error: null,
        errorUpdateCount: 0,
        errorUpdatedAt: 0,
        fetchFailureCount: 0,
        fetchFailureReason: null,
        fetchMeta: null,
        isInvalidated: !1,
        status: n ? `success` : `pending`,
        fetchStatus: `idle`
    }
}
var ye = class extends i {
    constructor(e, t) {
        super(), this.options = t, this.#e = e, this.#s = null, this.#o = ie(), this.bindMethods(), this.setOptions(t)
    }#
    e;#
    t = void 0;#
    n = void 0;#
    r = void 0;#
    i;#
    a;#
    o;#
    s;#
    c;#
    l;#
    u;#
    d;#
    f;#
    p;#
    m = new Set;
    bindMethods() {
        this.refetch = this.refetch.bind(this)
    }
    onSubscribe() {
        this.listeners.size === 1 && (this.#t.addObserver(this), xe(this.#t, this.options) ? this.#h() : this.updateResult(), this.#y())
    }
    onUnsubscribe() {
        this.hasListeners() || this.destroy()
    }
    shouldFetchOnReconnect() {
        return Se(this.#t, this.options, this.options.refetchOnReconnect)
    }
    shouldFetchOnWindowFocus() {
        return Se(this.#t, this.options, this.options.refetchOnWindowFocus)
    }
    destroy() {
        this.listeners = new Set, this.#b(), this.#x(), this.#t.removeObserver(this)
    }
    setOptions(e) {
        let t = this.options,
            n = this.#t;
        if (this.options = this.#e.defaultQueryOptions(e), this.options.enabled !== void 0 && typeof this.options.enabled != `boolean` && typeof this.options.enabled != `function` && typeof h(this.options.enabled, this.#t) != `boolean`) throw Error(`Expected enabled to be a boolean or a callback that returns a boolean`);
        this.#S(), this.#t.setOptions(this.options), t._defaulted && !C(this.options, t) && this.#e.getQueryCache().notify({
            type: `observerOptionsUpdated`,
            query: this.#t,
            observer: this
        });
        let r = this.hasListeners();
        r && Ce(this.#t, n, this.options, t) && this.#h(), this.updateResult(), r && (this.#t !== n || h(this.options.enabled, this.#t) !== h(t.enabled, this.#t) || m(this.options.staleTime, this.#t) !== m(t.staleTime, this.#t)) && this.#g();
        let i = this.#_();
        r && (this.#t !== n || h(this.options.enabled, this.#t) !== h(t.enabled, this.#t) || i !== this.#p) && this.#v(i)
    }
    getOptimisticResult(e) {
        let t = this.#e.getQueryCache().build(this.#e, e),
            n = this.createResult(t, e);
        return Te(this, n) && (this.#r = n, this.#a = this.options, this.#i = this.#t.state), n
    }
    getCurrentResult() {
        return this.#r
    }
    trackResult(e, t) {
        return new Proxy(e, {
            get: (e, n) => (this.trackProp(n), t ? .(n), n === `promise` && (this.trackProp(`data`), !this.options.experimental_prefetchInRender && this.#o.status === `pending` && this.#o.reject(Error(`experimental_prefetchInRender feature flag is not enabled`))), Reflect.get(e, n))
        })
    }
    trackProp(e) {
        this.#m.add(e)
    }
    getCurrentQuery() {
        return this.#t
    }
    refetch({ ...e
    } = {}) {
        return this.fetch({ ...e
        })
    }
    fetchOptimistic(e) {
        let t = this.#e.defaultQueryOptions(e),
            n = this.#e.getQueryCache().build(this.#e, t);
        return n.fetch().then(() => this.createResult(n, t))
    }
    fetch(e) {
        return this.#h({ ...e,
            cancelRefetch: e.cancelRefetch ? ? !0
        }).then(() => (this.updateResult(), this.#r))
    }#
    h(e) {
        this.#S();
        let t = this.#t.fetch(this.options, e);
        return e ? .throwOnError || (t = t.catch(u)), t
    }#
    g() {
        this.#b();
        let e = m(this.options.staleTime, this.#t);
        if (j.isServer() || this.#r.isStale || !f(e)) return;
        let t = p(this.#r.dataUpdatedAt, e) + 1;
        this.#d = s.setTimeout(() => {
            this.#r.isStale || this.updateResult()
        }, t)
    }#
    _() {
        return (typeof this.options.refetchInterval == `function` ? this.options.refetchInterval(this.#t) : this.options.refetchInterval) ? ? !1
    }#
    v(e) {
        this.#x(), this.#p = e, !(j.isServer() || h(this.options.enabled, this.#t) === !1 || !f(this.#p) || this.#p === 0) && (this.#f = s.setInterval(() => {
            (this.options.refetchIntervalInBackground || a.isFocused()) && this.#h()
        }, this.#p))
    }#
    y() {
        this.#g(), this.#v(this.#_())
    }#
    b() {
        this.#d !== void 0 && (s.clearTimeout(this.#d), this.#d = void 0)
    }#
    x() {
        this.#f !== void 0 && (s.clearInterval(this.#f), this.#f = void 0)
    }
    createResult(e, t) {
        let n = this.#t,
            r = this.options,
            i = this.#r,
            a = this.#i,
            o = this.#a,
            s = e === n ? this.#n : e.state,
            {
                state: c
            } = e,
            l = { ...c
            },
            u = !1,
            d;
        if (t._optimisticResults) {
            let i = this.hasListeners(),
                a = !i && xe(e, t),
                o = i && Ce(e, n, t, r);
            (a || o) && (l = { ...l,
                ...ge(c.data, e.options)
            }), t._optimisticResults === `isRestoring` && (l.fetchStatus = `idle`)
        }
        let {
            error: f,
            errorUpdatedAt: p,
            status: m
        } = l;
        d = l.data;
        let g = !1;
        if (t.placeholderData !== void 0 && d === void 0 && m === `pending`) {
            let e;
            i ? .isPlaceholderData && t.placeholderData === o ? .placeholderData ? (e = i.data, g = !0) : e = typeof t.placeholderData == `function` ? t.placeholderData(this.#u ? .state.data, this.#u) : t.placeholderData, e !== void 0 && (m = `success`, d = te(i ? .data, e, t), u = !0)
        }
        if (t.select && d !== void 0 && !g)
            if (i && d === a ? .data && t.select === this.#c) d = this.#l;
            else try {
                this.#c = t.select, d = t.select(d), d = te(i ? .data, d, t), this.#l = d, this.#s = null
            } catch (e) {
                this.#s = e
            }
        this.#s && (f = this.#s, d = this.#l, p = Date.now(), m = `error`);
        let _ = l.fetchStatus === `fetching`,
            v = m === `pending`,
            y = m === `error`,
            b = v && _,
            x = d !== void 0,
            S = {
                status: m,
                fetchStatus: l.fetchStatus,
                isPending: v,
                isSuccess: m === `success`,
                isError: y,
                isInitialLoading: b,
                isLoading: b,
                data: d,
                dataUpdatedAt: l.dataUpdatedAt,
                error: f,
                errorUpdatedAt: p,
                failureCount: l.fetchFailureCount,
                failureReason: l.fetchFailureReason,
                errorUpdateCount: l.errorUpdateCount,
                isFetched: e.isFetched(),
                isFetchedAfterMount: l.dataUpdateCount > s.dataUpdateCount || l.errorUpdateCount > s.errorUpdateCount,
                isFetching: _,
                isRefetching: _ && !v,
                isLoadingError: y && !x,
                isPaused: l.fetchStatus === `paused`,
                isPlaceholderData: u,
                isRefetchError: y && x,
                isStale: we(e, t),
                refetch: this.refetch,
                promise: this.#o,
                isEnabled: h(t.enabled, e) !== !1
            };
        if (this.options.experimental_prefetchInRender) {
            let t = S.data !== void 0,
                r = S.status === `error` && !t,
                i = e => {
                    r ? e.reject(S.error) : t && e.resolve(S.data)
                },
                a = () => {
                    i(this.#o = S.promise = ie())
                },
                o = this.#o;
            switch (o.status) {
                case `pending`:
                    e.queryHash === n.queryHash && i(o);
                    break;
                case `fulfilled`:
                    (r || S.data !== o.value) && a();
                    break;
                case `rejected`:
                    (!r || S.error !== o.reason) && a();
                    break
            }
        }
        return S
    }
    updateResult() {
        let e = this.#r,
            t = this.createResult(this.#t, this.options);
        this.#i = this.#t.state, this.#a = this.options, this.#i.data !== void 0 && (this.#u = this.#t), !C(t, e) && (this.#r = t, this.#C({
            listeners: (() => {
                if (!e) return !0;
                let {
                    notifyOnChangeProps: t
                } = this.options, n = typeof t == `function` ? t() : t;
                if (n === `all` || !n && !this.#m.size) return !0;
                let r = new Set(n ? ? this.#m);
                return this.options.throwOnError && r.add(`error`), Object.keys(this.#r).some(t => {
                    let n = t;
                    return this.#r[n] !== e[n] && r.has(n)
                })
            })()
        }))
    }#
    S() {
        let e = this.#e.getQueryCache().build(this.#e, this.options);
        if (e === this.#t) return;
        let t = this.#t;
        this.#t = e, this.#n = e.state, this.hasListeners() && (t ? .removeObserver(this), e.addObserver(this))
    }
    onQueryUpdate() {
        this.updateResult(), this.hasListeners() && this.#y()
    }#
    C(e) {
        N.batch(() => {
            e.listeners && this.listeners.forEach(e => {
                e(this.#r)
            }), this.#e.getQueryCache().notify({
                query: this.#t,
                type: `observerResultsUpdated`
            })
        })
    }
};

function be(e, t) {
    return h(t.enabled, e) !== !1 && e.state.data === void 0 && !(e.state.status === `error` && h(t.retryOnMount, e) === !1)
}

function xe(e, t) {
    return be(e, t) || e.state.data !== void 0 && Se(e, t, t.refetchOnMount)
}

function Se(e, t, n) {
    if (h(t.enabled, e) !== !1 && m(t.staleTime, e) !== `static`) {
        let r = typeof n == `function` ? n(e) : n;
        return r === `always` || r !== !1 && we(e, t)
    }
    return !1
}

function Ce(e, t, n, r) {
    return (e !== t || h(r.enabled, e) === !1) && (!n.suspense || e.state.status !== `error`) && we(e, n)
}

function we(e, t) {
    return h(t.enabled, e) !== !1 && e.isStaleByTime(m(t.staleTime, e))
}

function Te(e, t) {
    return !C(e.getCurrentResult(), t)
}
var I = e(r(), 1),
    Ee = t(),
    De = I.createContext(void 0),
    Oe = e => {
        let t = I.useContext(De);
        if (e) return e;
        if (!t) throw Error(`No QueryClient set, use QueryClientProvider to set one`);
        return t
    },
    ke = ({
        client: e,
        children: t
    }) => (I.useEffect(() => (e.mount(), () => {
        e.unmount()
    }), [e]), (0, Ee.jsx)(De.Provider, {
        value: e,
        children: t
    })),
    Ae = I.createContext(!1),
    je = () => I.useContext(Ae);
Ae.Provider;

function Me() {
    let e = !1;
    return {
        clearReset: () => {
            e = !1
        },
        reset: () => {
            e = !0
        },
        isReset: () => e
    }
}
var Ne = I.createContext(Me()),
    Pe = () => I.useContext(Ne),
    Fe = (e, t, n) => {
        let r = n ? .state.error && typeof e.throwOnError == `function` ? A(e.throwOnError, [n.state.error, n]) : e.throwOnError;
        (e.suspense || e.experimental_prefetchInRender || r) && (t.isReset() || (e.retryOnMount = !1))
    },
    Ie = e => {
        I.useEffect(() => {
            e.clearReset()
        }, [e])
    },
    Le = ({
        result: e,
        errorResetBoundary: t,
        throwOnError: n,
        query: r,
        suspense: i
    }) => e.isError && !t.isReset() && !e.isFetching && r && (i && e.data === void 0 || A(n, [e.error, r])),
    Re = e => {
        if (e.suspense) {
            let t = 1e3,
                n = e => e === `static` ? e : Math.max(e ? ? t, t),
                r = e.staleTime;
            e.staleTime = typeof r == `function` ? (...e) => n(r(...e)) : n(r), typeof e.gcTime == `number` && (e.gcTime = Math.max(e.gcTime, t))
        }
    },
    ze = (e, t) => e.isLoading && e.isFetching && !t,
    Be = (e, t) => e ? .suspense && t.isPending,
    Ve = (e, t, n) => t.fetchOptimistic(e).catch(() => {
        n.clearReset()
    });

function He(e, t, n) {
    let r = je(),
        i = Pe(),
        a = Oe(n),
        o = a.defaultQueryOptions(e);
    a.getDefaultOptions().queries ? ._experimental_beforeQuery ? .(o);
    let s = a.getQueryCache().get(o.queryHash),
        c = e.subscribed !== !1;
    o._optimisticResults = r ? `isRestoring` : c ? `optimistic` : void 0, Re(o), Fe(o, i, s), Ie(i);
    let l = !a.getQueryCache().get(o.queryHash),
        [d] = I.useState(() => new t(a, o)),
        f = d.getOptimisticResult(o),
        p = !r && c;
    if (I.useSyncExternalStore(I.useCallback(e => {
            let t = p ? d.subscribe(N.batchCalls(e)) : u;
            return d.updateResult(), t
        }, [d, p]), () => d.getCurrentResult(), () => d.getCurrentResult()), I.useEffect(() => {
            d.setOptions(o)
        }, [o, d]), Be(o, f)) throw Ve(o, d, i);
    if (Le({
            result: f,
            errorResetBoundary: i,
            throwOnError: o.throwOnError,
            query: s,
            suspense: o.suspense
        })) throw f.error;
    return a.getDefaultOptions().queries ? ._experimental_afterQuery ? .(o, f), o.experimental_prefetchInRender && !j.isServer() && ze(f, r) && (l ? Ve(o, d, i) : s ? .promise) ? .catch(u).finally(() => {
        d.updateResult()
    }), o.notifyOnChangeProps ? f : d.trackResult(f)
}

function Ue(e, t) {
    return He(e, ye, t)
}
var We = e => {
        let t, n = new Set,
            r = (e, r) => {
                let i = typeof e == `function` ? e(t) : e;
                if (!Object.is(i, t)) {
                    let e = t;
                    t = r ? ? (typeof i != `object` || !i) ? i : Object.assign({}, t, i), n.forEach(n => n(t, e))
                }
            },
            i = () => t,
            a = {
                setState: r,
                getState: i,
                getInitialState: () => o,
                subscribe: e => (n.add(e), () => n.delete(e))
            },
            o = t = e(r, i, a);
        return a
    },
    Ge = (e => e ? We(e) : We),
    Ke = e => e;

function qe(e, t = Ke) {
    let n = I.useSyncExternalStore(e.subscribe, I.useCallback(() => t(e.getState()), [e, t]), I.useCallback(() => t(e.getInitialState()), [e, t]));
    return I.useDebugValue(n), n
}
var Je = e => {
        let t = Ge(e),
            n = e => qe(t, e);
        return Object.assign(n, t), n
    },
    Ye = (e => e ? Je(e) : Je),
    Xe = `access_token`,
    Ze = `refresh_token`,
    Qe = `user`,
    $e = `active_portfolio_id`,
    et = `active_portfolio_scope`;

function tt(e) {
    if (!e) return null;
    try {
        let t = e.split(`.`);
        if (t.length < 2) return null;
        let n = t[1].replace(/-/g, `+`).replace(/_/g, `/`),
            r = decodeURIComponent(atob(n).split(``).map(e => `%${(`00`+e.charCodeAt(0).toString(16)).slice(-2)}`).join(``)),
            i = JSON.parse(r);
        return i.sub == null ? null : String(i.sub)
    } catch {
        return null
    }
}

function nt() {
    return localStorage.getItem(Xe)
}

function rt() {
    return localStorage.getItem(Ze)
}

function it() {
    let e = localStorage.getItem(Qe);
    if (!e) return null;
    try {
        return JSON.parse(e)
    } catch {
        return null
    }
}

function at(e) {
    localStorage.setItem(Qe, JSON.stringify(e))
}

function ot(e, t) {
    localStorage.setItem(Xe, e), localStorage.setItem(Ze, t)
}

function st() {
    localStorage.removeItem(Xe), localStorage.removeItem(Ze), localStorage.removeItem(Qe)
}

function ct() {
    return localStorage.getItem($e)
}

function L(e) {
    e ? localStorage.setItem($e, e) : localStorage.removeItem($e)
}

function lt() {
    return localStorage.getItem(et) === `all` ? `all` : null
}

function R(e) {
    e === `all` ? localStorage.setItem(et, `all`) : localStorage.removeItem(et)
}

function ut() {
    L(null), R(null)
}

function dt() {
    return !!nt()
}

function ft(e, t) {
    let n = it();
    return {
        id: tt(t) ? ? n ? .id ? ? ``,
        email: e,
        name: n ? .name
    }
}
var pt = Ye(e => ({
    status: `anonymous`,
    user: null,
    activePortfolioId: null,
    allPortfoliosView: !1,
    setLoading: () => e({
        status: `loading`
    }),
    setSession: (t, n = null) => {
        n && (L(n), R(null)), e({
            status: `authenticated`,
            user: t,
            activePortfolioId: n,
            allPortfoliosView: !1
        })
    },
    clearSession: () => {
        ut(), e({
            status: `anonymous`,
            user: null,
            activePortfolioId: null,
            allPortfoliosView: !1
        })
    },
    setActivePortfolioId: t => {
        t ? (L(t), R(null), e({
            activePortfolioId: t,
            allPortfoliosView: !1
        })) : (L(null), e({
            activePortfolioId: null
        }))
    },
    setPortfolioSelection: (t, n) => {
        if (t !== null) {
            L(t), R(null), e({
                activePortfolioId: t,
                allPortfoliosView: !1
            });
            return
        }
        L(null), n ? .viewAll ? (R(`all`), e({
            activePortfolioId: null,
            allPortfoliosView: !0
        })) : (R(null), e({
            activePortfolioId: null,
            allPortfoliosView: !1
        }))
    }
}));

function mt(e, t) {
    return function() {
        return e.apply(t, arguments)
    }
}
var {
    toString: ht
} = Object.prototype, {
    getPrototypeOf: z
} = Object, {
    iterator: gt,
    toStringTag: _t
} = Symbol, vt = (({
    hasOwnProperty: e
}) => (t, n) => e.call(t, n))(Object.prototype), yt = (e, t) => {
    let n = e,
        r = [];
    for (; n != null && n !== Object.prototype;) {
        if (r.indexOf(n) !== -1) return !1;
        if (r.push(n), vt(n, t)) return !0;
        n = z(n)
    }
    return !1
}, bt = (e, t) => e != null && yt(e, t) ? e[t] : void 0, xt = (e => t => {
    let n = ht.call(t);
    return e[n] || (e[n] = n.slice(8, -1).toLowerCase())
})(Object.create(null)), B = e => (e = e.toLowerCase(), t => xt(t) === e), St = e => t => typeof t === e, {
    isArray: V
} = Array, Ct = St(`undefined`);

function wt(e) {
    return e !== null && !Ct(e) && e.constructor !== null && !Ct(e.constructor) && H(e.constructor.isBuffer) && e.constructor.isBuffer(e)
}
var Tt = B(`ArrayBuffer`);

function Et(e) {
    let t;
    return t = typeof ArrayBuffer < `u` && ArrayBuffer.isView ? ArrayBuffer.isView(e) : e && e.buffer && Tt(e.buffer), t
}
var Dt = St(`string`),
    H = St(`function`),
    Ot = St(`number`),
    kt = e => typeof e == `object` && !!e,
    At = e => e === !0 || e === !1,
    jt = e => {
        if (!kt(e)) return !1;
        let t = z(e);
        return (t === null || t === Object.prototype || z(t) === null) && !yt(e, _t) && !yt(e, gt)
    },
    Mt = e => {
        if (!kt(e) || wt(e)) return !1;
        try {
            return Object.keys(e).length === 0 && Object.getPrototypeOf(e) === Object.prototype
        } catch {
            return !1
        }
    },
    Nt = B(`Date`),
    Pt = B(`File`),
    Ft = e => !!(e && e.uri !== void 0),
    It = e => e && e.getParts !== void 0,
    Lt = B(`Blob`),
    Rt = B(`FileList`),
    zt = e => kt(e) && H(e.pipe);

function Bt() {
    return typeof globalThis < `u` ? globalThis : typeof self < `u` ? self : typeof window < `u` ? window : typeof global < `u` ? global : {}
}
var Vt = Bt(),
    Ht = Vt.FormData === void 0 ? void 0 : Vt.FormData,
    Ut = e => {
        if (!e) return !1;
        if (Ht && e instanceof Ht) return !0;
        let t = z(e);
        if (!t || t === Object.prototype || !H(e.append)) return !1;
        let n = xt(e);
        return n === `formdata` || n === `object` && H(e.toString) && e.toString() === `[object FormData]`
    },
    Wt = B(`URLSearchParams`),
    [Gt, Kt, qt, Jt] = [`ReadableStream`, `Request`, `Response`, `Headers`].map(B),
    Yt = e => e.trim ? e.trim() : e.replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, ``);

function Xt(e, t, {
    allOwnKeys: n = !1
} = {}) {
    if (e == null) return;
    let r, i;
    if (typeof e != `object` && (e = [e]), V(e))
        for (r = 0, i = e.length; r < i; r++) t.call(null, e[r], r, e);
    else {
        if (wt(e)) return;
        let i = n ? Object.getOwnPropertyNames(e) : Object.keys(e),
            a = i.length,
            o;
        for (r = 0; r < a; r++) o = i[r], t.call(null, e[o], o, e)
    }
}

function Zt(e, t) {
    if (wt(e)) return null;
    t = t.toLowerCase();
    let n = Object.keys(e),
        r = n.length,
        i;
    for (; r-- > 0;)
        if (i = n[r], t === i.toLowerCase()) return i;
    return null
}
var U = typeof globalThis < `u` ? globalThis : typeof self < `u` ? self : typeof window < `u` ? window : global,
    Qt = e => !Ct(e) && e !== U;

function $t(...e) {
    let {
        caseless: t,
        skipUndefined: n
    } = Qt(this) && this || {}, r = {}, i = (e, i) => {
        if (i === `__proto__` || i === `constructor` || i === `prototype`) return;
        let a = t && typeof i == `string` && Zt(r, i) || i,
            o = vt(r, a) ? r[a] : void 0;
        jt(o) && jt(e) ? r[a] = $t(o, e) : jt(e) ? r[a] = $t({}, e) : V(e) ? r[a] = e.slice() : (!n || !Ct(e)) && (r[a] = e)
    };
    for (let t = 0, n = e.length; t < n; t++) {
        let n = e[t];
        if (!n || wt(n) || (Xt(n, i), typeof n != `object` || V(n))) continue;
        let r = Object.getOwnPropertySymbols(n);
        for (let e = 0; e < r.length; e++) {
            let t = r[e];
            fn.call(n, t) && i(n[t], t)
        }
    }
    return r
}
var en = (e, t, n, {
        allOwnKeys: r
    } = {}) => (Xt(t, (t, r) => {
        n && H(t) ? Object.defineProperty(e, r, {
            __proto__: null,
            value: mt(t, n),
            writable: !0,
            enumerable: !0,
            configurable: !0
        }) : Object.defineProperty(e, r, {
            __proto__: null,
            value: t,
            writable: !0,
            enumerable: !0,
            configurable: !0
        })
    }, {
        allOwnKeys: r
    }), e),
    tn = e => (e.charCodeAt(0) === 65279 && (e = e.slice(1)), e),
    nn = (e, t, n, r) => {
        e.prototype = Object.create(t.prototype, r), Object.defineProperty(e.prototype, "constructor", {
            __proto__: null,
            value: e,
            writable: !0,
            enumerable: !1,
            configurable: !0
        }), Object.defineProperty(e, "super", {
            __proto__: null,
            value: t.prototype
        }), n && Object.assign(e.prototype, n)
    },
    rn = (e, t, n, r) => {
        let i, a, o, s = {};
        if (t || = {}, e == null) return t;
        do {
            for (i = Object.getOwnPropertyNames(e), a = i.length; a-- > 0;) o = i[a], (!r || r(o, e, t)) && !s[o] && (t[o] = e[o], s[o] = !0);
            e = n !== !1 && z(e)
        } while (e && (!n || n(e, t)) && e !== Object.prototype);
        return t
    },
    an = (e, t, n) => {
        e = String(e), (n === void 0 || n > e.length) && (n = e.length), n -= t.length;
        let r = e.indexOf(t, n);
        return r !== -1 && r === n
    },
    on = e => {
        if (!e) return null;
        if (V(e)) return e;
        let t = e.length;
        if (!Ot(t)) return null;
        let n = Array(t);
        for (; t-- > 0;) n[t] = e[t];
        return n
    },
    sn = (e => t => e && t instanceof e)(typeof Uint8Array < `u` && z(Uint8Array)),
    cn = (e, t) => {
        let n = (e && e[gt]).call(e),
            r;
        for (;
            (r = n.next()) && !r.done;) {
            let n = r.value;
            t.call(e, n[0], n[1])
        }
    },
    ln = (e, t) => {
        let n, r = [];
        for (;
            (n = e.exec(t)) !== null;) r.push(n);
        return r
    },
    un = B(`HTMLFormElement`),
    dn = e => e.toLowerCase().replace(/[-_\s]([a-z\d])(\w*)/g, function(e, t, n) {
        return t.toUpperCase() + n
    }),
    {
        propertyIsEnumerable: fn
    } = Object.prototype,
    pn = B(`RegExp`),
    mn = (e, t) => {
        let n = Object.getOwnPropertyDescriptors(e),
            r = {};
        Xt(n, (n, i) => {
            let a;
            (a = t(n, i, e)) !== !1 && (r[i] = a || n)
        }), Object.defineProperties(e, r)
    },
    hn = e => {
        mn(e, (t, n) => {
            if (H(e) && [`arguments`, `caller`, `callee`].includes(n)) return !1;
            let r = e[n];
            if (H(r)) {
                if (t.enumerable = !1, `writable` in t) {
                    t.writable = !1;
                    return
                }
                t.set || = () => {
                    throw Error(`Can not rewrite read-only method '` + n + `'`)
                }
            }
        })
    },
    gn = (e, t) => {
        let n = {},
            r = e => {
                e.forEach(e => {
                    n[e] = !0
                })
            };
        return V(e) ? r(e) : r(String(e).split(t)), n
    },
    _n = () => {},
    vn = (e, t) => e != null && Number.isFinite(e = +e) ? e : t;

function yn(e) {
    return !!(e && H(e.append) && e[_t] === `FormData` && e[gt])
}
var bn = e => {
        let t = new WeakSet,
            n = e => {
                if (kt(e)) {
                    if (t.has(e)) return;
                    if (wt(e)) return e;
                    if (!(`toJSON` in e)) {
                        t.add(e);
                        let r = V(e) ? [] : {};
                        return Xt(e, (e, t) => {
                            let i = n(e);
                            !Ct(i) && (r[t] = i)
                        }), t.delete(e), r
                    }
                }
                return e
            };
        return n(e)
    },
    xn = B(`AsyncFunction`),
    Sn = e => e && (kt(e) || H(e)) && H(e.then) && H(e.catch),
    Cn = ((e, t) => e ? setImmediate : t ? ((e, t) => (U.addEventListener(`message`, ({
        source: n,
        data: r
    }) => {
        n === U && r === e && t.length && t.shift()()
    }, !1), n => {
        t.push(n), U.postMessage(e, `*`)
    }))(`axios@${Math.random()}`, []) : e => setTimeout(e))(typeof setImmediate == `function`, H(U.postMessage)),
    wn = typeof queueMicrotask < `u` ? queueMicrotask.bind(U) : typeof process < `u` && process.nextTick || Cn,
    Tn = e => e != null && H(e[gt]),
    W = {
        isArray: V,
        isArrayBuffer: Tt,
        isBuffer: wt,
        isFormData: Ut,
        isArrayBufferView: Et,
        isString: Dt,
        isNumber: Ot,
        isBoolean: At,
        isObject: kt,
        isPlainObject: jt,
        isEmptyObject: Mt,
        isReadableStream: Gt,
        isRequest: Kt,
        isResponse: qt,
        isHeaders: Jt,
        isUndefined: Ct,
        isDate: Nt,
        isFile: Pt,
        isReactNativeBlob: Ft,
        isReactNative: It,
        isBlob: Lt,
        isRegExp: pn,
        isFunction: H,
        isStream: zt,
        isURLSearchParams: Wt,
        isTypedArray: sn,
        isFileList: Rt,
        forEach: Xt,
        merge: $t,
        extend: en,
        trim: Yt,
        stripBOM: tn,
        inherits: nn,
        toFlatObject: rn,
        kindOf: xt,
        kindOfTest: B,
        endsWith: an,
        toArray: on,
        forEachEntry: cn,
        matchAll: ln,
        isHTMLForm: un,
        hasOwnProperty: vt,
        hasOwnProp: vt,
        hasOwnInPrototypeChain: yt,
        getSafeProp: bt,
        reduceDescriptors: mn,
        freezeMethods: hn,
        toObjectSet: gn,
        toCamelCase: dn,
        noop: _n,
        toFiniteNumber: vn,
        findKey: Zt,
        global: U,
        isContextDefined: Qt,
        isSpecCompliantForm: yn,
        toJSONObject: bn,
        isAsyncFn: xn,
        isThenable: Sn,
        setImmediate: Cn,
        asap: wn,
        isIterable: Tn,
        isSafeIterable: e => e != null && yt(e, gt) && Tn(e)
    },
    En = W.toObjectSet([`age`, `authorization`, `content-length`, `content-type`, `etag`, `expires`, `from`, `host`, `if-modified-since`, `if-unmodified-since`, `last-modified`, `location`, `max-forwards`, `proxy-authorization`, `referer`, `retry-after`, `user-agent`]),
    Dn = e => {
        let t = {},
            n, r, i;
        return e && e.split(`
`).forEach(function(e) {
            i = e.indexOf(`:`), n = e.substring(0, i).trim().toLowerCase(), r = e.substring(i + 1).trim(), !(!n || t[n] && En[n]) && (n === `set-cookie` ? t[n] ? t[n].push(r) : t[n] = [r] : t[n] = t[n] ? t[n] + `, ` + r : r)
        }), t
    };

function On(e) {
    let t = 0,
        n = e.length;
    for (; t < n;) {
        let n = e.charCodeAt(t);
        if (n !== 9 && n !== 32) break;
        t += 1
    }
    for (; n > t;) {
        let t = e.charCodeAt(n - 1);
        if (t !== 9 && t !== 32) break;
        --n
    }
    return t === 0 && n === e.length ? e : e.slice(t, n)
}
var kn = RegExp(`[\\u0000-\\u0008\\u000a-\\u001f\\u007f]+`, `g`),
    An = RegExp(`[^\\u0009\\u0020-\\u007e\\u0080-\\u00ff]+`, `g`);

function jn(e, t) {
    return W.isArray(e) ? e.map(e => jn(e, t)) : On(String(e).replace(t, ``))
}
var Mn = e => jn(e, kn),
    Nn = e => jn(e, An);

function Pn(e) {
    let t = Object.create(null);
    return W.forEach(e.toJSON(), (e, n) => {
        t[n] = Nn(e)
    }), t
}
var Fn = Symbol(`internals`);

function In(e) {
    return e && String(e).trim().toLowerCase()
}

function Ln(e) {
    return e === !1 || e == null ? e : W.isArray(e) ? e.map(Ln) : Mn(String(e))
}

function Rn(e) {
    let t = Object.create(null),
        n = /([^\s,;=]+)\s*(?:=\s*([^,;]+))?/g,
        r;
    for (; r = n.exec(e);) t[r[1]] = r[2];
    return t
}
var zn = e => /^[-_a-zA-Z0-9^`|~,!#$%&'*+.]+$/.test(e.trim());

function Bn(e, t, n, r, i) {
    if (W.isFunction(r)) return r.call(this, t, n);
    if (i && (t = n), W.isString(t)) {
        if (W.isString(r)) return t.indexOf(r) !== -1;
        if (W.isRegExp(r)) return r.test(t)
    }
}

function Vn(e) {
    return e.trim().toLowerCase().replace(/([a-z\d])(\w*)/g, (e, t, n) => t.toUpperCase() + n)
}

function Hn(e, t) {
    let n = W.toCamelCase(` ` + t);
    [`get`, `set`, `has`].forEach(r => {
        Object.defineProperty(e, r + n, {
            __proto__: null,
            value: function(e, n, i) {
                return this[r].call(this, t, e, n, i)
            },
            configurable: !0
        })
    })
}
var G = class {
    constructor(e) {
        e && this.set(e)
    }
    set(e, t, n) {
        let r = this;

        function i(e, t, n) {
            let i = In(t);
            if (!i) return;
            let a = W.findKey(r, i);
            (!a || r[a] === void 0 || n === !0 || n === void 0 && r[a] !== !1) && (r[a || t] = Ln(e))
        }
        let a = (e, t) => W.forEach(e, (e, n) => i(e, n, t));
        if (W.isPlainObject(e) || e instanceof this.constructor) a(e, t);
        else if (W.isString(e) && (e = e.trim()) && !zn(e)) a(Dn(e), t);
        else if (W.isObject(e) && W.isSafeIterable(e)) {
            let n = Object.create(null),
                r, i;
            for (let t of e) {
                if (!W.isArray(t)) throw TypeError(`Object iterator must return a key-value pair`);
                i = t[0], W.hasOwnProp(n, i) ? (r = n[i], n[i] = W.isArray(r) ? [...r, t[1]] : [r, t[1]]) : n[i] = t[1]
            }
            a(n, t)
        } else e != null && i(t, e, n);
        return this
    }
    get(e, t) {
        if (e = In(e), e) {
            let n = W.findKey(this, e);
            if (n) {
                let e = this[n];
                if (!t) return e;
                if (t === !0) return Rn(e);
                if (W.isFunction(t)) return t.call(this, e, n);
                if (W.isRegExp(t)) return t.exec(e);
                throw TypeError(`parser must be boolean|regexp|function`)
            }
        }
    }
    has(e, t) {
        if (e = In(e), e) {
            let n = W.findKey(this, e);
            return !!(n && this[n] !== void 0 && (!t || Bn(this, this[n], n, t)))
        }
        return !1
    }
    delete(e, t) {
        let n = this,
            r = !1;

        function i(e) {
            if (e = In(e), e) {
                let i = W.findKey(n, e);
                i && (!t || Bn(n, n[i], i, t)) && (delete n[i], r = !0)
            }
        }
        return W.isArray(e) ? e.forEach(i) : i(e), r
    }
    clear(e) {
        let t = Object.keys(this),
            n = t.length,
            r = !1;
        for (; n--;) {
            let i = t[n];
            (!e || Bn(this, this[i], i, e, !0)) && (delete this[i], r = !0)
        }
        return r
    }
    normalize(e) {
        let t = this,
            n = {};
        return W.forEach(this, (r, i) => {
            let a = W.findKey(n, i);
            if (a) {
                t[a] = Ln(r), delete t[i];
                return
            }
            let o = e ? Vn(i) : String(i).trim();
            o !== i && delete t[i], t[o] = Ln(r), n[o] = !0
        }), this
    }
    concat(...e) {
        return this.constructor.concat(this, ...e)
    }
    toJSON(e) {
        let t = Object.create(null);
        return W.forEach(this, (n, r) => {
            n != null && n !== !1 && (t[r] = e && W.isArray(n) ? n.join(`, `) : n)
        }), t
    }[Symbol.iterator]() {
        return Object.entries(this.toJSON())[Symbol.iterator]()
    }
    toString() {
        return Object.entries(this.toJSON()).map(([e, t]) => e + `: ` + t).join(`
`)
    }
    getSetCookie() {
        return this.get(`set-cookie`) || []
    }
    get[Symbol.toStringTag]() {
        return `AxiosHeaders`
    }
    static from(e) {
        return e instanceof this ? e : new this(e)
    }
    static concat(e, ...t) {
        let n = new this(e);
        return t.forEach(e => n.set(e)), n
    }
    static accessor(e) {
        let t = (this[Fn] = this[Fn] = {
                accessors: {}
            }).accessors,
            n = this.prototype;

        function r(e) {
            let r = In(e);
            t[r] || (Hn(n, e), t[r] = !0)
        }
        return W.isArray(e) ? e.forEach(r) : r(e), this
    }
};
G.accessor([`Content-Type`, `Content-Length`, `Accept`, `Accept-Encoding`, `User-Agent`, `Authorization`]), W.reduceDescriptors(G.prototype, ({
    value: e
}, t) => {
    let n = t[0].toUpperCase() + t.slice(1);
    return {
        get: () => e,
        set(e) {
            this[n] = e
        }
    }
}), W.freezeMethods(G);
var Un = `[REDACTED ****]`;

function Wn(e) {
    if (W.hasOwnProp(e, `toJSON`)) return !0;
    let t = Object.getPrototypeOf(e);
    for (; t && t !== Object.prototype;) {
        if (W.hasOwnProp(t, `toJSON`)) return !0;
        t = Object.getPrototypeOf(t)
    }
    return !1
}

function Gn(e, t) {
    let n = new Set(t.map(e => String(e).toLowerCase())),
        r = [],
        i = e => {
            if (typeof e != `object` || !e || W.isBuffer(e)) return e;
            if (r.indexOf(e) !== -1) return;
            e instanceof G && (e = e.toJSON()), r.push(e);
            let t;
            if (W.isArray(e)) t = [], e.forEach((e, n) => {
                let r = i(e);
                W.isUndefined(r) || (t[n] = r)
            });
            else {
                if (!W.isPlainObject(e) && Wn(e)) return r.pop(), e;
                t = Object.create(null);
                for (let [r, a] of Object.entries(e)) {
                    let e = n.has(r.toLowerCase()) ? Un : i(a);
                    W.isUndefined(e) || (t[r] = e)
                }
            }
            return r.pop(), t
        };
    return i(e)
}
var K = class e extends Error {
    static from(t, n, r, i, a, o) {
        let s = new e(t.message, n || t.code, r, i, a);
        return Object.defineProperty(s, "cause", {
            __proto__: null,
            value: t,
            writable: !0,
            enumerable: !1,
            configurable: !0
        }), s.name = t.name, t.status != null && s.status == null && (s.status = t.status), o && Object.assign(s, o), s
    }
    constructor(e, t, n, r, i) {
        super(e), Object.defineProperty(this, "message", {
            __proto__: null,
            value: e,
            enumerable: !0,
            writable: !0,
            configurable: !0
        }), this.name = `AxiosError`, this.isAxiosError = !0, t && (this.code = t), n && (this.config = n), r && (this.request = r), i && (this.response = i, this.status = i.status)
    }
    toJSON() {
        let e = this.config,
            t = e && W.hasOwnProp(e, `redact`) ? e.redact : void 0,
            n = W.isArray(t) && t.length > 0 ? Gn(e, t) : W.toJSONObject(e);
        return {
            message: this.message,
            name: this.name,
            description: this.description,
            number: this.number,
            fileName: this.fileName,
            lineNumber: this.lineNumber,
            columnNumber: this.columnNumber,
            stack: this.stack,
            config: n,
            code: this.code,
            status: this.status
        }
    }
};
K.ERR_BAD_OPTION_VALUE = `ERR_BAD_OPTION_VALUE`, K.ERR_BAD_OPTION = `ERR_BAD_OPTION`, K.ECONNABORTED = `ECONNABORTED`, K.ETIMEDOUT = `ETIMEDOUT`, K.ECONNREFUSED = `ECONNREFUSED`, K.ERR_NETWORK = `ERR_NETWORK`, K.ERR_FR_TOO_MANY_REDIRECTS = `ERR_FR_TOO_MANY_REDIRECTS`, K.ERR_DEPRECATED = `ERR_DEPRECATED`, K.ERR_BAD_RESPONSE = `ERR_BAD_RESPONSE`, K.ERR_BAD_REQUEST = `ERR_BAD_REQUEST`, K.ERR_CANCELED = `ERR_CANCELED`, K.ERR_NOT_SUPPORT = `ERR_NOT_SUPPORT`, K.ERR_INVALID_URL = `ERR_INVALID_URL`, K.ERR_FORM_DATA_DEPTH_EXCEEDED = `ERR_FORM_DATA_DEPTH_EXCEEDED`;

function Kn(e) {
    return W.isPlainObject(e) || W.isArray(e)
}

function qn(e) {
    return W.endsWith(e, `[]`) ? e.slice(0, -2) : e
}

function Jn(e, t, n) {
    return e ? e.concat(t).map(function(e, t) {
        return e = qn(e), !n && t ? `[` + e + `]` : e
    }).join(n ? `.` : ``) : t
}

function Yn(e) {
    return W.isArray(e) && !e.some(Kn)
}
var Xn = W.toFlatObject(W, {}, null, function(e) {
    return /^is[A-Z]/.test(e)
});

function Zn(e, t, n) {
    if (!W.isObject(e)) throw TypeError(`target must be an object`);
    t || = new FormData, n = W.toFlatObject(n, {
        metaTokens: !0,
        dots: !1,
        indexes: !1
    }, !1, function(e, t) {
        return !W.isUndefined(t[e])
    });
    let r = n.metaTokens,
        i = n.visitor || m,
        a = n.dots,
        o = n.indexes,
        s = n.Blob || typeof Blob < `u` && Blob,
        c = n.maxDepth === void 0 ? 100 : n.maxDepth,
        l = s && W.isSpecCompliantForm(t),
        u = [];
    if (!W.isFunction(i)) throw TypeError(`visitor must be a function`);

    function d(e) {
        if (e === null) return ``;
        if (W.isDate(e)) return e.toISOString();
        if (W.isBoolean(e)) return e.toString();
        if (!l && W.isBlob(e)) throw new K(`Blob is not supported. Use a Buffer instead.`);
        if (W.isArrayBuffer(e) || W.isTypedArray(e)) {
            if (l && typeof s == `function`) return new s([e]);
            if (typeof Buffer < `u`) return Buffer.from(e);
            throw new K(`Blob is not supported. Use a Buffer instead.`, K.ERR_NOT_SUPPORT)
        }
        return e
    }

    function f(e) {
        if (e > c) throw new K(`Object is too deeply nested (` + e + ` levels). Max depth: ` + c, K.ERR_FORM_DATA_DEPTH_EXCEEDED)
    }

    function p(e, t) {
        if (c === 1 / 0) return JSON.stringify(e);
        let n = [];
        return JSON.stringify(e, function(e, r) {
            if (!W.isObject(r)) return r;
            for (; n.length && n[n.length - 1] !== this;) n.pop();
            return n.push(r), f(t + n.length - 1), r
        })
    }

    function m(e, n, i) {
        let s = e;
        if (W.isReactNative(t) && W.isReactNativeBlob(e)) return t.append(Jn(i, n, a), d(e)), !1;
        if (e && !i && typeof e == `object`) {
            if (W.endsWith(n, `{}`)) n = r ? n : n.slice(0, -2), e = p(e, 1);
            else if (W.isArray(e) && Yn(e) || (W.isFileList(e) || W.endsWith(n, `[]`)) && (s = W.toArray(e))) return n = qn(n), s.forEach(function(e, r) {
                !(W.isUndefined(e) || e === null) && t.append(o === !0 ? Jn([n], r, a) : o === null ? n : n + `[]`, d(e))
            }), !1
        }
        return Kn(e) ? !0 : (t.append(Jn(i, n, a), d(e)), !1)
    }
    let h = Object.assign(Xn, {
        defaultVisitor: m,
        convertValue: d,
        isVisitable: Kn
    });

    function g(e, n, r = 0) {
        if (!W.isUndefined(e)) {
            if (f(r), u.indexOf(e) !== -1) throw Error(`Circular reference detected in ` + n.join(`.`));
            u.push(e), W.forEach(e, function(e, a) {
                (!(W.isUndefined(e) || e === null) && i.call(t, e, W.isString(a) ? a.trim() : a, n, h)) === !0 && g(e, n ? n.concat(a) : [a], r + 1)
            }), u.pop()
        }
    }
    if (!W.isObject(e)) throw TypeError(`data must be an object`);
    return g(e), t
}

function Qn(e) {
    let t = {
        "!": `%21`,
        "'": `%27`,
        "(": `%28`,
        ")": `%29`,
        "~": `%7E`,
        "%20": `+`
    };
    return encodeURIComponent(e).replace(/[!'()~]|%20/g, function(e) {
        return t[e]
    })
}

function $n(e, t) {
    this._pairs = [], e && Zn(e, this, t)
}
var er = $n.prototype;
er.append = function(e, t) {
    this._pairs.push([e, t])
}, er.toString = function(e) {
    let t = e ? t => e.call(this, t, Qn) : Qn;
    return this._pairs.map(function(e) {
        return t(e[0]) + `=` + t(e[1])
    }, ``).join(`&`)
};

function tr(e) {
    return encodeURIComponent(e).replace(/%3A/gi, `:`).replace(/%24/g, `$`).replace(/%2C/gi, `,`).replace(/%20/g, `+`)
}

function nr(e, t, n) {
    if (!t) return e;
    e || = ``;
    let r = W.isFunction(n) ? {
            serialize: n
        } : n,
        i = W.getSafeProp(r, `encode`) || tr,
        a = W.getSafeProp(r, `serialize`),
        o;
    if (o = a ? a(t, r) : W.isURLSearchParams(t) ? t.toString() : new $n(t, r).toString(i), o) {
        let t = e.indexOf(`#`);
        t !== -1 && (e = e.slice(0, t)), e += (e.indexOf(`?`) === -1 ? `?` : `&`) + o
    }
    return e
}
var rr = class {
        constructor() {
            this.handlers = []
        }
        use(e, t, n) {
            return this.handlers.push({
                fulfilled: e,
                rejected: t,
                synchronous: n ? n.synchronous : !1,
                runWhen: n ? n.runWhen : null
            }), this.handlers.length - 1
        }
        eject(e) {
            this.handlers[e] && (this.handlers[e] = null)
        }
        clear() {
            this.handlers && = []
        }
        forEach(e) {
            W.forEach(this.handlers, function(t) {
                t !== null && e(t)
            })
        }
    },
    ir = {
        silentJSONParsing: !0,
        forcedJSONParsing: !0,
        clarifyTimeoutError: !1,
        legacyInterceptorReqResOrdering: !0,
        advertiseZstdAcceptEncoding: !1,
        validateStatusUndefinedResolves: !0
    },
    ar = {
        isBrowser: !0,
        classes: {
            URLSearchParams: typeof URLSearchParams < `u` ? URLSearchParams : $n,
            FormData: typeof FormData < `u` ? FormData : null,
            Blob: typeof Blob < `u` ? Blob : null
        },
        protocols: [`http`, `https`, `file`, `blob`, `url`, `data`]
    },
    or = n({
        hasBrowserEnv: () => sr,
        hasStandardBrowserEnv: () => lr,
        hasStandardBrowserWebWorkerEnv: () => ur,
        navigator: () => cr,
        origin: () => dr
    }),
    sr = typeof window < `u` && typeof document < `u`,
    cr = typeof navigator == `object` && navigator || void 0,
    lr = sr && (!cr || [`ReactNative`, `NativeScript`, `NS`].indexOf(cr.product) < 0),
    ur = typeof WorkerGlobalScope < `u` && self instanceof WorkerGlobalScope && typeof self.importScripts == `function`,
    dr = sr && window.location.href || `http://localhost`,
    q = { ...or,
        ...ar
    };

function fr(e, t) {
    return Zn(e, new q.classes.URLSearchParams, {
        visitor: function(e, t, n, r) {
            return q.isNode && W.isBuffer(e) ? (this.append(t, e.toString(`base64`)), !1) : r.defaultVisitor.apply(this, arguments)
        },
        ...t
    })
}
var pr = 100;

function mr(e) {
    if (e > pr) throw new K(`FormData field is too deeply nested (` + e + ` levels). Max depth: ` + pr, K.ERR_FORM_DATA_DEPTH_EXCEEDED)
}

function hr(e) {
    let t = [],
        n = /\w+|\[(\w*)]/g,
        r;
    for (;
        (r = n.exec(e)) !== null;) mr(t.length), t.push(r[0] === `[]` ? `` : r[1] || r[0]);
    return t
}

function gr(e) {
    let t = {},
        n = Object.keys(e),
        r, i = n.length,
        a;
    for (r = 0; r < i; r++) a = n[r], t[a] = e[a];
    return t
}

function _r(e) {
    function t(e, n, r, i) {
        mr(i);
        let a = e[i++];
        if (a === `__proto__`) return !0;
        let o = Number.isFinite(+a),
            s = i >= e.length;
        return a = !a && W.isArray(r) ? r.length : a, s ? (W.hasOwnProp(r, a) ? r[a] = W.isArray(r[a]) ? r[a].concat(n) : [r[a], n] : r[a] = n, !o) : ((!W.hasOwnProp(r, a) || !W.isObject(r[a])) && (r[a] = []), t(e, n, r[a], i) && W.isArray(r[a]) && (r[a] = gr(r[a])), !o)
    }
    if (W.isFormData(e) && W.isFunction(e.entries)) {
        let n = {};
        return W.forEachEntry(e, (e, r) => {
            t(hr(e), r, n, 0)
        }), n
    }
    return null
}
var vr = (e, t) => e != null && W.hasOwnProp(e, t) ? e[t] : void 0;

function yr(e, t, n) {
    if (W.isString(e)) try {
        return (t || JSON.parse)(e), W.trim(e)
    } catch (e) {
        if (e.name !== `SyntaxError`) throw e
    }
    return (n || JSON.stringify)(e)
}
var br = {
    transitional: ir,
    adapter: [`xhr`, `http`, `fetch`],
    transformRequest: [function(e, t) {
        let n = t.getContentType() || ``,
            r = n.indexOf(`application/json`) > -1,
            i = W.isObject(e);
        if (i && W.isHTMLForm(e) && (e = new FormData(e)), W.isFormData(e)) return r ? JSON.stringify(_r(e)) : e;
        if (W.isArrayBuffer(e) || W.isBuffer(e) || W.isStream(e) || W.isFile(e) || W.isBlob(e) || W.isReadableStream(e)) return e;
        if (W.isArrayBufferView(e)) return e.buffer;
        if (W.isURLSearchParams(e)) return t.setContentType(`application/x-www-form-urlencoded;charset=utf-8`, !1), e.toString();
        let a;
        if (i) {
            let t = vr(this, `formSerializer`);
            if (n.indexOf(`application/x-www-form-urlencoded`) > -1) return fr(e, t).toString();
            if ((a = W.isFileList(e)) || n.indexOf(`multipart/form-data`) > -1) {
                let n = vr(this, `env`),
                    r = n && n.FormData;
                return Zn(a ? {
                    "files[]": e
                } : e, r && new r, t)
            }
        }
        return i || r ? (t.setContentType(`application/json`, !1), yr(e)) : e
    }],
    transformResponse: [function(e) {
        let t = vr(this, `transitional`) || br.transitional,
            n = t && t.forcedJSONParsing,
            r = vr(this, `responseType`),
            i = r === `json`;
        if (W.isResponse(e) || W.isReadableStream(e)) return e;
        if (e && W.isString(e) && (n && !r || i)) {
            let n = !(t && t.silentJSONParsing) && i;
            try {
                return JSON.parse(e, vr(this, `parseReviver`))
            } catch (e) {
                if (n) throw e.name === `SyntaxError` ? K.from(e, K.ERR_BAD_RESPONSE, this, null, vr(this, `response`)) : e
            }
        }
        return e
    }],
    timeout: 0,
    xsrfCookieName: `XSRF-TOKEN`,
    xsrfHeaderName: `X-XSRF-TOKEN`,
    maxContentLength: -1,
    maxBodyLength: -1,
    env: {
        FormData: q.classes.FormData,
        Blob: q.classes.Blob
    },
    validateStatus: function(e) {
        return e >= 200 && e < 300
    },
    headers: {
        common: {
            Accept: `application/json, text/plain, */*`,
            "Content-Type": void 0
        }
    }
};
W.forEach([`delete`, `get`, `head`, `post`, `put`, `patch`, `query`], e => {
    br.headers[e] = {}
});

function xr(e, t) {
    let n = this || br,
        r = t || n,
        i = G.from(r.headers),
        a = r.data;
    return W.forEach(e, function(e) {
        a = e.call(n, a, i.normalize(), t ? t.status : void 0)
    }), i.normalize(), a
}

function Sr(e) {
    return !!(e && e.__CANCEL__)
}
var Cr = class extends K {
    constructor(e, t, n) {
        super(e ? ? `canceled`, K.ERR_CANCELED, t, n), this.name = `CanceledError`, this.__CANCEL__ = !0
    }
};

function wr(e, t, n) {
    let r = n.config.validateStatus;
    !n.status || !r || r(n.status) ? e(n) : t(new K(`Request failed with status code ` + n.status, n.status >= 400 && n.status < 500 ? K.ERR_BAD_REQUEST : K.ERR_BAD_RESPONSE, n.config, n.request, n))
}

function Tr(e) {
    let t = /^([-+\w]{1,25}):(?:\/\/)?/.exec(e);
    return t && t[1] || ``
}

function Er(e, t) {
    e || = 10;
    let n = Array(e),
        r = Array(e),
        i = 0,
        a = 0,
        o;
    return t = t === void 0 ? 1e3 : t,
        function(s) {
            let c = Date.now(),
                l = r[a];
            o || = c, n[i] = s, r[i] = c;
            let u = a,
                d = 0;
            for (; u !== i;) d += n[u++], u %= e;
            if (i = (i + 1) % e, i === a && (a = (a + 1) % e), c - o < t) return;
            let f = l && c - l;
            return f ? Math.round(d * 1e3 / f) : void 0
        }
}

function Dr(e, t) {
    let n = 0,
        r = 1e3 / t,
        i, a, o = (t, r = Date.now()) => {
            n = r, i = null, a && = (clearTimeout(a), null), e(...t)
        };
    return [(...e) => {
        let t = Date.now(),
            s = t - n;
        s >= r ? o(e, t) : (i = e, a || = setTimeout(() => {
            a = null, o(i)
        }, r - s))
    }, () => i && o(i)]
}
var Or = (e, t, n = 3) => {
        let r = 0,
            i = Er(50, 250);
        return Dr(n => {
            if (!n || typeof n.loaded != `number`) return;
            let a = n.loaded,
                o = n.lengthComputable ? n.total : void 0,
                s = o == null ? a : Math.min(a, o),
                c = Math.max(0, s - r),
                l = i(c);
            r = Math.max(r, s), e({
                loaded: s,
                total: o,
                progress: o ? s / o : void 0,
                bytes: c,
                rate: l || void 0,
                estimated: l && o ? (o - s) / l : void 0,
                event: n,
                lengthComputable: o != null,
                [t ? `download` : `upload`]: !0
            })
        }, n)
    },
    kr = (e, t) => {
        let n = e != null;
        return [r => t[0]({
            lengthComputable: n,
            total: e,
            loaded: r
        }), t[1]]
    },
    Ar = e => (...t) => W.asap(() => e(...t)),
    jr = q.hasStandardBrowserEnv ? ((e, t) => n => (n = new URL(n, q.origin), e.protocol === n.protocol && e.host === n.host && (t || e.port === n.port)))(new URL(q.origin), q.navigator && /(msie|trident)/i.test(q.navigator.userAgent)) : () => !0,
    Mr = q.hasStandardBrowserEnv ? {
        write(e, t, n, r, i, a, o) {
            if (typeof document > `u`) return;
            let s = [`${e}=${encodeURIComponent(t)}`];
            W.isNumber(n) && s.push(`expires=${new Date(n).toUTCString()}`), W.isString(r) && s.push(`path=${r}`), W.isString(i) && s.push(`domain=${i}`), a === !0 && s.push(`secure`), W.isString(o) && s.push(`SameSite=${o}`), document.cookie = s.join(`; `)
        },
        read(e) {
            if (typeof document > `u`) return null;
            let t = document.cookie.split(`;`);
            for (let n = 0; n < t.length; n++) {
                let r = t[n].replace(/^\s+/, ``),
                    i = r.indexOf(`=`);
                if (i !== -1 && r.slice(0, i) === e) try {
                    return decodeURIComponent(r.slice(i + 1))
                } catch {
                    return r.slice(i + 1)
                }
            }
            return null
        },
        remove(e) {
            this.write(e, ``, Date.now() - 864e5, `/`)
        }
    } : {
        write() {},
        read() {
            return null
        },
        remove() {}
    };

function Nr(e) {
    return typeof e == `string` ? /^([a-z][a-z\d+\-.]*:)?\/\//i.test(e) : !1
}

function Pr(e, t) {
    return t ? e.replace(/\/?\/$/, ``) + `/` + t.replace(/^\/+/, ``) : e
}
var Fr = /^https?:(?!\/\/)/i,
    Ir = /[\t\n\r]/g;

function Lr(e) {
    let t = 0;
    for (; t < e.length && e.charCodeAt(t) <= 32;) t++;
    return e.slice(t)
}

function Rr(e) {
    return Lr(e).replace(Ir, ``)
}

function zr(e, t) {
    if (typeof e == `string` && Fr.test(Rr(e))) throw new K(`Invalid URL: missing "//" after protocol`, K.ERR_INVALID_URL, t)
}

function Br(e, t, n, r) {
    zr(t, r);
    let i = !Nr(t);
    return e && (i || n === !1) ? (zr(e, r), Pr(e, t)) : t
}
var Vr = e => e instanceof G ? { ...e
} : e;

function J(e, t) {
    e || = {}, t || = {};
    let n = Object.create(null);
    Object.defineProperty(n, "hasOwnProperty", {
        __proto__: null,
        value: Object.prototype.hasOwnProperty,
        enumerable: !1,
        writable: !0,
        configurable: !0
    });

    function r(e, t, n, r) {
        return W.isPlainObject(e) && W.isPlainObject(t) ? W.merge.call({
            caseless: r
        }, e, t) : W.isPlainObject(t) ? W.merge({}, t) : W.isArray(t) ? t.slice() : t
    }

    function i(e, t, n, i) {
        if (!W.isUndefined(t)) return r(e, t, n, i);
        if (!W.isUndefined(e)) return r(void 0, e, n, i)
    }

    function a(e, t) {
        if (!W.isUndefined(t)) return r(void 0, t)
    }

    function o(e, t) {
        if (!W.isUndefined(t)) return r(void 0, t);
        if (!W.isUndefined(e)) return r(void 0, e)
    }

    function s(n) {
        let r = W.hasOwnProp(t, `transitional`) ? t.transitional : void 0;
        if (!W.isUndefined(r))
            if (W.isPlainObject(r)) {
                if (W.hasOwnProp(r, n)) return r[n]
            } else return;
        let i = W.hasOwnProp(e, `transitional`) ? e.transitional : void 0;
        if (W.isPlainObject(i) && W.hasOwnProp(i, n)) return i[n]
    }

    function c(n, i, a) {
        if (W.hasOwnProp(t, a)) return r(n, i);
        if (W.hasOwnProp(e, a)) return r(void 0, n)
    }
    let l = {
        url: a,
        method: a,
        data: a,
        baseURL: o,
        transformRequest: o,
        transformResponse: o,
        paramsSerializer: o,
        timeout: o,
        timeoutMessage: o,
        withCredentials: o,
        withXSRFToken: o,
        adapter: o,
        responseType: o,
        xsrfCookieName: o,
        xsrfHeaderName: o,
        onUploadProgress: o,
        onDownloadProgress: o,
        decompress: o,
        maxContentLength: o,
        maxBodyLength: o,
        beforeRedirect: o,
        transport: o,
        httpAgent: o,
        httpsAgent: o,
        cancelToken: o,
        socketPath: o,
        allowedSocketPaths: o,
        responseEncoding: o,
        validateStatus: c,
        headers: (e, t, n) => i(Vr(e), Vr(t), n, !0)
    };
    return W.forEach(Object.keys({ ...e,
        ...t
    }), function(r) {
        if (r === `__proto__` || r === `constructor` || r === `prototype`) return;
        let a = W.hasOwnProp(l, r) ? l[r] : i,
            o = a(W.hasOwnProp(e, r) ? e[r] : void 0, W.hasOwnProp(t, r) ? t[r] : void 0, r);
        W.isUndefined(o) && a !== c || (n[r] = o)
    }), W.hasOwnProp(t, `validateStatus`) && W.isUndefined(t.validateStatus) && s(`validateStatusUndefinedResolves`) === !1 && (W.hasOwnProp(e, `validateStatus`) ? n.validateStatus = r(void 0, e.validateStatus) : delete n.validateStatus), n
}
var Hr = [`content-type`, `content-length`];

function Ur(e, t, n) {
    if (n !== `content-only`) {
        e.set(t);
        return
    }
    Object.entries(t || {}).forEach(([t, n]) => {
        Hr.includes(t.toLowerCase()) && e.set(t, n)
    })
}
var Wr = e => encodeURIComponent(e).replace(/%([0-9A-F]{2})/gi, (e, t) => String.fromCharCode(parseInt(t, 16)));

function Gr(e) {
    let t = J({}, e),
        n = e => W.hasOwnProp(t, e) ? t[e] : void 0,
        r = n(`data`),
        i = n(`withXSRFToken`),
        a = n(`xsrfHeaderName`),
        o = n(`xsrfCookieName`),
        s = n(`headers`),
        c = n(`auth`),
        l = n(`baseURL`),
        u = n(`allowAbsoluteUrls`),
        d = n(`url`);
    if (t.headers = s = G.from(s), t.url = nr(Br(l, d, u, t), n(`params`), n(`paramsSerializer`)), c) {
        let t = W.getSafeProp(c, `username`) || ``,
            n = W.getSafeProp(c, `password`) || ``;
        try {
            s.set(`Authorization`, `Basic ` + btoa(t + `:` + (n ? Wr(n) : ``)))
        } catch (t) {
            throw K.from(t, K.ERR_BAD_OPTION_VALUE, e)
        }
    }
    if (W.isFormData(r) && (q.hasStandardBrowserEnv || q.hasStandardBrowserWebWorkerEnv || W.isReactNative(r) ? s.setContentType(void 0) : W.isFunction(r.getHeaders) && Ur(s, r.getHeaders(), n(`formDataHeaderPolicy`))), q.hasStandardBrowserEnv && (W.isFunction(i) && (i = i(t)), i === !0 || i == null && jr(t.url))) {
        let e = a && o && Mr.read(o);
        e && s.set(a, e)
    }
    return t
}
var Kr = typeof XMLHttpRequest < `u` && function(e) {
        return new Promise(function(t, n) {
            let r = Gr(e),
                i = r.data,
                a = G.from(r.headers).normalize(),
                {
                    responseType: o,
                    onUploadProgress: s,
                    onDownloadProgress: c
                } = r,
                l, u, d, f, p;

            function m() {
                f && f(), p && p(), r.cancelToken && r.cancelToken.unsubscribe(l), r.signal && r.signal.removeEventListener(`abort`, l)
            }
            let h = new XMLHttpRequest;
            h.open(r.method.toUpperCase(), r.url, !0), h.timeout = r.timeout;

            function g() {
                if (!h) return;
                let r = G.from(`getAllResponseHeaders` in h && h.getAllResponseHeaders());
                wr(function(e) {
                    t(e), m()
                }, function(e) {
                    n(e), m()
                }, {
                    data: !o || o === `text` || o === `json` ? h.responseText : h.response,
                    status: h.status,
                    statusText: h.statusText,
                    headers: r,
                    config: e,
                    request: h
                }), h = null
            }
            `onloadend` in h ? h.onloadend = g : h.onreadystatechange = function() {
                !h || h.readyState !== 4 || h.status === 0 && !(h.responseURL && h.responseURL.startsWith(`file:`)) || setTimeout(g)
            }, h.onabort = function() {
                h && = (n(new K(`Request aborted`, K.ECONNABORTED, e, h)), m(), null)
            }, h.onerror = function(t) {
                let r = new K(t && t.message ? t.message : `Network Error`, K.ERR_NETWORK, e, h);
                r.event = t || null, n(r), m(), h = null
            }, h.ontimeout = function() {
                let t = r.timeout ? `timeout of ` + r.timeout + `ms exceeded` : `timeout exceeded`,
                    i = r.transitional || ir;
                r.timeoutErrorMessage && (t = r.timeoutErrorMessage), n(new K(t, i.clarifyTimeoutError ? K.ETIMEDOUT : K.ECONNABORTED, e, h)), m(), h = null
            }, i === void 0 && a.setContentType(null), `setRequestHeader` in h && W.forEach(Pn(a), function(e, t) {
                h.setRequestHeader(t, e)
            }), W.isUndefined(r.withCredentials) || (h.withCredentials = !!r.withCredentials), o && o !== `json` && (h.responseType = r.responseType), c && ([d, p] = Or(c, !0), h.addEventListener(`progress`, d)), s && h.upload && ([u, f] = Or(s), h.upload.addEventListener(`progress`, u), h.upload.addEventListener(`loadend`, f)), (r.cancelToken || r.signal) && (l = t => {
                h && = (n(!t || t.type ? new Cr(null, e, h) : t), h.abort(), m(), null)
            }, r.cancelToken && r.cancelToken.subscribe(l), r.signal && (r.signal.aborted ? l() : r.signal.addEventListener(`abort`, l)));
            let _ = Tr(r.url);
            if (_ && !q.protocols.includes(_)) {
                n(new K(`Unsupported protocol ` + _ + `:`, K.ERR_BAD_REQUEST, e)), m();
                return
            }
            h.send(i || null)
        })
    },
    qr = (e, t) => {
        if (e = e ? e.filter(Boolean) : [], !t && !e.length) return;
        let n = new AbortController,
            r = !1,
            i = function(e) {
                if (!r) {
                    r = !0, o();
                    let t = e instanceof Error ? e : this.reason;
                    n.abort(t instanceof K ? t : new Cr(t instanceof Error ? t.message : t))
                }
            },
            a = t && setTimeout(() => {
                a = null, i(new K(`timeout of ${t}ms exceeded`, K.ETIMEDOUT))
            }, t),
            o = () => {
                e && = (a && clearTimeout(a), a = null, e.forEach(e => {
                    e.unsubscribe ? e.unsubscribe(i) : e.removeEventListener(`abort`, i)
                }), null)
            };
        e.forEach(e => e.addEventListener(`abort`, i, {
            once: !0
        }));
        let {
            signal: s
        } = n;
        return s.unsubscribe = () => W.asap(o), s
    },
    Jr = function*(e, t) {
        let n = e.byteLength;
        if (!t || n < t) {
            yield e;
            return
        }
        let r = 0,
            i;
        for (; r < n;) i = r + t, yield e.slice(r, i), r = i
    },
    Yr = async function*(e, t) {
        for await (let n of Xr(e)) yield* Jr(n, t)
    },
    Xr = async function*(e) {
        if (e[Symbol.asyncIterator]) {
            yield* e;
            return
        }
        let t = e.getReader();
        try {
            for (;;) {
                let {
                    done: e,
                    value: n
                } = await t.read();
                if (e) break;
                yield n
            }
        } finally {
            await t.cancel()
        }
    },
    Zr = (e, t, n, r) => {
        let i = Yr(e, t),
            a = 0,
            o, s = e => {
                o || (o = !0, r && r(e))
            };
        return new ReadableStream({
            async pull(e) {
                try {
                    let {
                        done: t,
                        value: r
                    } = await i.next();
                    if (t) {
                        s(), e.close();
                        return
                    }
                    let o = r.byteLength;
                    n && n(a += o), e.enqueue(new Uint8Array(r))
                } catch (e) {
                    throw s(e), e
                }
            },
            cancel(e) {
                return s(e), i.return()
            }
        }, {
            highWaterMark: 2
        })
    },
    Qr = e => e >= 48 && e <= 57 || e >= 65 && e <= 70 || e >= 97 && e <= 102,
    $r = (e, t, n) => t + 2 < n && Qr(e.charCodeAt(t + 1)) && Qr(e.charCodeAt(t + 2));

function ei(e) {
    if (!e || typeof e != `string` || !e.startsWith(`data:`)) return 0;
    let t = e.indexOf(`,`);
    if (t < 0) return 0;
    let n = e.slice(5, t),
        r = e.slice(t + 1);
    if (/;base64/i.test(n)) {
        let e = r.length,
            t = r.length;
        for (let n = 0; n < t; n++)
            if (r.charCodeAt(n) === 37 && n + 2 < t) {
                let t = r.charCodeAt(n + 1),
                    i = r.charCodeAt(n + 2);
                Qr(t) && Qr(i) && (e -= 2, n += 2)
            }
        let n = 0,
            i = t - 1,
            a = e => e >= 2 && r.charCodeAt(e - 2) === 37 && r.charCodeAt(e - 1) === 51 && (r.charCodeAt(e) === 68 || r.charCodeAt(e) === 100);
        i >= 0 && (r.charCodeAt(i) === 61 ? (n++, i--) : a(i) && (n++, i -= 3)), n === 1 && i >= 0 && (r.charCodeAt(i) === 61 || a(i)) && n++;
        let o = Math.floor(e / 4) * 3 - (n || 0);
        return o > 0 ? o : 0
    }
    let i = 0;
    for (let e = 0, t = r.length; e < t; e++) {
        let n = r.charCodeAt(e);
        if (n === 37 && $r(r, e, t)) i += 1, e += 2;
        else if (n < 128) i += 1;
        else if (n < 2048) i += 2;
        else if (n >= 55296 && n <= 56319 && e + 1 < t) {
            let t = r.charCodeAt(e + 1);
            t >= 56320 && t <= 57343 ? (i += 4, e++) : i += 3
        } else i += 3
    }
    return i
}
var ti = `1.18.1`,
    ni = 64 * 1024,
    {
        isFunction: ri
    } = W,
    ii = e => encodeURIComponent(e).replace(/%([0-9A-F]{2})/gi, (e, t) => String.fromCharCode(parseInt(t, 16))),
    ai = e => {
        if (!W.isString(e)) return e;
        try {
            return decodeURIComponent(e)
        } catch {
            return e
        }
    },
    oi = (e, ...t) => {
        try {
            return !!e(...t)
        } catch {
            return !1
        }
    },
    si = e => {
        let t = e.indexOf(`://`),
            n = e;
        return t !== -1 && (n = n.slice(t + 3)), n.includes(`@`) || n.includes(`:`)
    },
    ci = e => {
        let t = W.global !== void 0 && W.global !== null ? W.global : globalThis,
            {
                ReadableStream: n,
                TextEncoder: r
            } = t;
        e = W.merge.call({
            skipUndefined: !0
        }, {
            Request: t.Request,
            Response: t.Response
        }, e);
        let {
            fetch: i,
            Request: a,
            Response: o
        } = e, s = i ? ri(i) : typeof fetch == `function`, c = ri(a), l = ri(o);
        if (!s) return !1;
        let u = s && ri(n),
            d = s && (typeof r == `function` ? (e => t => e.encode(t))(new r) : async e => new Uint8Array(await new a(e).arrayBuffer())),
            f = c && u && oi(() => {
                let e = !1,
                    t = new a(q.origin, {
                        body: new n,
                        method: `POST`,
                        get duplex() {
                            return e = !0, `half`
                        }
                    }),
                    r = t.headers.has(`Content-Type`);
                return t.body != null && t.body.cancel(), e && !r
            }),
            p = l && u && oi(() => W.isReadableStream(new o(``).body)),
            m = {
                stream: p && (e => e.body)
            };
        s && [`text`, `arrayBuffer`, `blob`, `formData`, `stream`].forEach(e => {
            !m[e] && (m[e] = (t, n) => {
                let r = t && t[e];
                if (r) return r.call(t);
                throw new K(`Response type '${e}' is not supported`, K.ERR_NOT_SUPPORT, n)
            })
        });
        let h = async e => {
                if (e == null) return 0;
                if (W.isBlob(e)) return e.size;
                if (W.isSpecCompliantForm(e)) return (await new a(q.origin, {
                    method: `POST`,
                    body: e
                }).arrayBuffer()).byteLength;
                if (W.isArrayBufferView(e) || W.isArrayBuffer(e)) return e.byteLength;
                if (W.isURLSearchParams(e) && (e += ``), W.isString(e)) return (await d(e)).byteLength
            },
            g = async (e, t) => W.toFiniteNumber(e.getContentLength()) ? ? h(t);
        return async e => {
            let {
                url: t,
                method: n,
                data: s,
                signal: l,
                cancelToken: d,
                timeout: _,
                onDownloadProgress: v,
                onUploadProgress: y,
                responseType: b,
                headers: x,
                withCredentials: S = `same-origin`,
                fetchOptions: C,
                maxContentLength: w,
                maxBodyLength: T
            } = Gr(e), E = W.isNumber(w) && w > -1, ee = W.isNumber(T) && T > -1, te = t => W.hasOwnProp(e, t) ? e[t] : void 0, ne = i || fetch;
            b = b ? (b + ``).toLowerCase() : `text`;
            let D = qr([l, d && d.toAbortSignal()], _),
                O = null,
                k = D && D.unsubscribe && (() => {
                    D.unsubscribe()
                }),
                A, re = null,
                j = () => new K(`Request body larger than maxBodyLength limit`, K.ERR_BAD_REQUEST, e, O);
            try {
                let i, l = te(`auth`);
                if (l && (i = {
                        username: W.getSafeProp(l, `username`) || ``,
                        password: W.getSafeProp(l, `password`) || ``
                    }), si(t)) {
                    let e = new URL(t, q.origin);
                    !i && (e.username || e.password) && (i = {
                        username: ai(e.username),
                        password: ai(e.password)
                    }), (e.username || e.password) && (e.username = ``, e.password = ``, t = e.href)
                }
                if (i && (x.delete(`authorization`), x.set(`Authorization`, `Basic ` + btoa(ii((i.username || ``) + `:` + (i.password || ``))))), E && typeof t == `string` && t.startsWith(`data:`) && ei(t) > w) throw new K(`maxContentLength size of ` + w + ` exceeded`, K.ERR_BAD_RESPONSE, e, O);
                if (ee && n !== `get` && n !== `head`) {
                    let e = await h(s);
                    if (typeof e == `number` && isFinite(e) && (A = e, e > T)) throw j()
                }
                let d = ee && (W.isReadableStream(s) || W.isStream(s)),
                    _ = (e, t, n) => Zr(e, ni, e => {
                        if (ee && e > T) throw re = j();
                        t && t(e)
                    }, n);
                if (f && n !== `get` && n !== `head` && (y || d)) {
                    if (A ? ? = await g(x, s), A !== 0 || d) {
                        let e = new a(t, {
                                method: `POST`,
                                body: s,
                                duplex: `half`
                            }),
                            n;
                        if (W.isFormData(s) && (n = e.headers.get(`content-type`)) && x.setContentType(n), e.body) {
                            let [t, n] = y && kr(A, Or(Ar(y))) || [];
                            s = _(e.body, t, n)
                        }
                    }
                } else if (d && !c && u && n !== `get` && n !== `head`) s = _(s);
                else if (d && c && !f && n !== `get` && n !== `head`) throw new K(`Stream request bodies are not supported by the current fetch implementation`, K.ERR_NOT_SUPPORT, e, O);
                W.isString(S) || (S = S ? `include` : `omit`);
                let ie = c && `credentials` in a.prototype;
                if (W.isFormData(s)) {
                    let e = x.getContentType();
                    e && /^multipart\/form-data/i.test(e) && !/boundary=/i.test(e) && x.delete(`content-type`)
                }
                x.set(`User-Agent`, `axios/` + ti, !1);
                let ae = { ...C,
                    signal: D,
                    method: n.toUpperCase(),
                    headers: Pn(x.normalize()),
                    body: s,
                    duplex: `half`,
                    credentials: ie ? S : void 0
                };
                O = c && new a(t, ae);
                let M = await (c ? ne(O, C) : ne(t, ae)),
                    N = G.from(M.headers);
                if (E) {
                    let t = W.toFiniteNumber(N.getContentLength());
                    if (t != null && t > w) throw new K(`maxContentLength size of ` + w + ` exceeded`, K.ERR_BAD_RESPONSE, e, O)
                }
                let P = p && (b === `stream` || b === `response`);
                if (p && M.body && (v || E || P && k)) {
                    let t = {};
                    [`status`, `statusText`, `headers`].forEach(e => {
                        t[e] = M[e]
                    });
                    let n = W.toFiniteNumber(N.getContentLength()),
                        [r, i] = v && kr(n, Or(Ar(v), !0)) || [],
                        a = 0;
                    M = new o(Zr(M.body, ni, t => {
                        if (E && (a = t, a > w)) throw new K(`maxContentLength size of ` + w + ` exceeded`, K.ERR_BAD_RESPONSE, e, O);
                        r && r(t)
                    }, () => {
                        i && i(), k && k()
                    }), t)
                }
                b || = `text`;
                let F = await m[W.findKey(m, b) || `text`](M, e);
                if (E && !p && !P) {
                    let t;
                    if (F != null && (typeof F.byteLength == `number` ? t = F.byteLength : typeof F.size == `number` ? t = F.size : typeof F == `string` && (t = typeof r == `function` ? new r().encode(F).byteLength : F.length)), typeof t == `number` && t > w) throw new K(`maxContentLength size of ` + w + ` exceeded`, K.ERR_BAD_RESPONSE, e, O)
                }
                return !P && k && k(), await new Promise((t, n) => {
                    wr(t, n, {
                        data: F,
                        headers: G.from(M.headers),
                        status: M.status,
                        statusText: M.statusText,
                        config: e,
                        request: O
                    })
                })
            } catch (t) {
                if (k && k(), D && D.aborted && D.reason instanceof K) {
                    let n = D.reason;
                    throw n.config = e, O && (n.request = O), t !== n && Object.defineProperty(n, "cause", {
                        __proto__: null,
                        value: t,
                        writable: !0,
                        enumerable: !1,
                        configurable: !0
                    }), n
                }
                if (re) throw O && !re.request && (re.request = O), re;
                if (t instanceof K) throw O && !t.request && (t.request = O), t;
                if (t && t.name === `TypeError` && /Load failed|fetch/i.test(t.message)) {
                    let n = new K(`Network Error`, K.ERR_NETWORK, e, O, t && t.response);
                    throw Object.defineProperty(n, "cause", {
                        __proto__: null,
                        value: t.cause || t,
                        writable: !0,
                        enumerable: !1,
                        configurable: !0
                    }), n
                }
                throw K.from(t, t && t.code, e, O, t && t.response)
            }
        }
    },
    li = new Map,
    ui = e => {
        let t = e && e.env || {},
            {
                fetch: n,
                Request: r,
                Response: i
            } = t,
            a = [r, i, n],
            o = a.length,
            s, c, l = li;
        for (; o--;) s = a[o], c = l.get(s), c === void 0 && l.set(s, c = o ? new Map : ci(t)), l = c;
        return c
    };
ui();
var di = {
    http: null,
    xhr: Kr,
    fetch: {
        get: ui
    }
};
W.forEach(di, (e, t) => {
    if (e) {
        try {
            Object.defineProperty(e, "name", {
                __proto__: null,
                value: t
            })
        } catch {}
        Object.defineProperty(e, "adapterName", {
            __proto__: null,
            value: t
        })
    }
});
var fi = e => `- ${e}`,
    pi = e => W.isFunction(e) || e === null || e === !1;

function mi(e, t) {
    e = W.isArray(e) ? e : [e];
    let {
        length: n
    } = e, r, i, a = {};
    for (let o = 0; o < n; o++) {
        r = e[o];
        let n;
        if (i = r, !pi(r) && (i = di[(n = String(r)).toLowerCase()], i === void 0)) throw new K(`Unknown adapter '${n}'`);
        if (i && (W.isFunction(i) || (i = i.get(t)))) break;
        a[n || `#` + o] = i
    }
    if (!i) {
        let e = Object.entries(a).map(([e, t]) => `adapter ${e} ` + (t === !1 ? `is not supported by the environment` : `is not available in the build`));
        throw new K(`There is no suitable adapter to dispatch the request ` + (n ? e.length > 1 ? `since :
` + e.map(fi).join(`
`) : ` ` + fi(e[0]) : `as no adapter specified`), K.ERR_NOT_SUPPORT)
    }
    return i
}
var hi = {
    getAdapter: mi,
    adapters: di
};

function gi(e) {
    if (e.cancelToken && e.cancelToken.throwIfRequested(), e.signal && e.signal.aborted) throw new Cr(null, e)
}

function _i(e) {
    return gi(e), e.headers = G.from(e.headers), e.data = xr.call(e, e.transformRequest), [`post`, `put`, `patch`].indexOf(e.method) !== -1 && e.headers.setContentType(`application/x-www-form-urlencoded`, !1), hi.getAdapter(e.adapter || br.adapter, e)(e).then(function(t) {
        gi(e), e.response = t;
        try {
            t.data = xr.call(e, e.transformResponse, t)
        } finally {
            delete e.response
        }
        return t.headers = G.from(t.headers), t
    }, function(t) {
        if (!Sr(t) && (gi(e), t && t.response)) {
            e.response = t.response;
            try {
                t.response.data = xr.call(e, e.transformResponse, t.response)
            } finally {
                delete e.response
            }
            t.response.headers = G.from(t.response.headers)
        }
        return Promise.reject(t)
    })
}
var vi = {};
[`object`, `boolean`, `number`, `function`, `string`, `symbol`].forEach((e, t) => {
    vi[e] = function(n) {
        return typeof n === e || `a` + (t < 1 ? `n ` : ` `) + e
    }
});
var yi = {};
vi.transitional = function(e, t, n) {
    function r(e, t) {
        return `[Axios v` + ti + `] Transitional option '` + e + `'` + t + (n ? `. ` + n : ``)
    }
    return (n, i, a) => {
        if (e === !1) throw new K(r(i, ` has been removed` + (t ? ` in ` + t : ``)), K.ERR_DEPRECATED);
        return t && !yi[i] && (yi[i] = !0, console.warn(r(i, ` has been deprecated since v` + t + ` and will be removed in the near future`))), e ? e(n, i, a) : !0
    }
}, vi.spelling = function(e) {
    return (t, n) => (console.warn(`${n} is likely a misspelling of ${e}`), !0)
};

function bi(e, t, n) {
    if (typeof e != `object` || !e) throw new K(`options must be an object`, K.ERR_BAD_OPTION_VALUE);
    let r = Object.keys(e),
        i = r.length;
    for (; i-- > 0;) {
        let a = r[i],
            o = Object.prototype.hasOwnProperty.call(t, a) ? t[a] : void 0;
        if (o) {
            let t = e[a],
                n = t === void 0 || o(t, a, e);
            if (n !== !0) throw new K(`option ` + a + ` must be ` + n, K.ERR_BAD_OPTION_VALUE);
            continue
        }
        if (n !== !0) throw new K(`Unknown option ` + a, K.ERR_BAD_OPTION)
    }
}
var xi = {
        assertOptions: bi,
        validators: vi
    },
    Y = xi.validators,
    X = class {
        constructor(e) {
            this.defaults = e || {}, this.interceptors = {
                request: new rr,
                response: new rr
            }
        }
        async request(e, t) {
            try {
                return await this._request(e, t)
            } catch (e) {
                if (e instanceof Error) {
                    let t = {};
                    Error.captureStackTrace ? Error.captureStackTrace(t) : t = Error();
                    let n = (() => {
                        if (!t.stack) return ``;
                        let e = t.stack.indexOf(`
`);
                        return e === -1 ? `` : t.stack.slice(e + 1)
                    })();
                    try {
                        if (!e.stack) e.stack = n;
                        else if (n) {
                            let t = n.indexOf(`
`),
                                r = t === -1 ? -1 : n.indexOf(`
`, t + 1),
                                i = r === -1 ? `` : n.slice(r + 1);
                            String(e.stack).endsWith(i) || (e.stack += `
` + n)
                        }
                    } catch {}
                }
                throw e
            }
        }
        _request(e, t) {
            typeof e == `string` ? (t || = {}, t.url = e) : t = e || {}, t = J(this.defaults, t);
            let {
                transitional: n,
                paramsSerializer: r,
                headers: i
            } = t;
            n !== void 0 && xi.assertOptions(n, {
                silentJSONParsing: Y.transitional(Y.boolean),
                forcedJSONParsing: Y.transitional(Y.boolean),
                clarifyTimeoutError: Y.transitional(Y.boolean),
                legacyInterceptorReqResOrdering: Y.transitional(Y.boolean),
                advertiseZstdAcceptEncoding: Y.transitional(Y.boolean),
                validateStatusUndefinedResolves: Y.transitional(Y.boolean)
            }, !1), r != null && (W.isFunction(r) ? t.paramsSerializer = {
                serialize: r
            } : xi.assertOptions(r, {
                encode: Y.function,
                serialize: Y.function
            }, !0)), t.allowAbsoluteUrls !== void 0 || (this.defaults.allowAbsoluteUrls === void 0 ? t.allowAbsoluteUrls = !0 : t.allowAbsoluteUrls = this.defaults.allowAbsoluteUrls), xi.assertOptions(t, {
                baseUrl: Y.spelling(`baseURL`),
                withXsrfToken: Y.spelling(`withXSRFToken`)
            }, !0), t.method = (t.method || this.defaults.method || `get`).toLowerCase();
            let a = i && W.merge(i.common, i[t.method]);
            i && W.forEach([`delete`, `get`, `head`, `post`, `put`, `patch`, `query`, `common`], e => {
                delete i[e]
            }), t.headers = G.concat(a, i);
            let o = [],
                s = !0;
            this.interceptors.request.forEach(function(e) {
                if (typeof e.runWhen == `function` && e.runWhen(t) === !1) return;
                s && = e.synchronous;
                let n = t.transitional || ir;
                n && n.legacyInterceptorReqResOrdering ? o.unshift(e.fulfilled, e.rejected) : o.push(e.fulfilled, e.rejected)
            });
            let c = [];
            this.interceptors.response.forEach(function(e) {
                c.push(e.fulfilled, e.rejected)
            });
            let l, u = 0,
                d;
            if (!s) {
                let e = [_i.bind(this), void 0];
                for (e.unshift(...o), e.push(...c), d = e.length, l = Promise.resolve(t); u < d;) l = l.then(e[u++], e[u++]);
                return l
            }
            d = o.length;
            let f = t;
            for (; u < d;) {
                let e = o[u++],
                    t = o[u++];
                try {
                    f = e(f)
                } catch (e) {
                    t.call(this, e);
                    break
                }
            }
            try {
                l = _i.call(this, f)
            } catch (e) {
                return Promise.reject(e)
            }
            for (u = 0, d = c.length; u < d;) l = l.then(c[u++], c[u++]);
            return l
        }
        getUri(e) {
            return e = J(this.defaults, e), nr(Br(e.baseURL, e.url, e.allowAbsoluteUrls, e), e.params, e.paramsSerializer)
        }
    };
W.forEach([`delete`, `get`, `head`, `options`], function(e) {
    X.prototype[e] = function(t, n) {
        return this.request(J(n || {}, {
            method: e,
            url: t,
            data: n && W.hasOwnProp(n, `data`) ? n.data : void 0
        }))
    }
}), W.forEach([`post`, `put`, `patch`, `query`], function(e) {
    function t(t) {
        return function(n, r, i) {
            return this.request(J(i || {}, {
                method: e,
                headers: t ? {
                    "Content-Type": `multipart/form-data`
                } : {},
                url: n,
                data: r
            }))
        }
    }
    X.prototype[e] = t(), e !== `query` && (X.prototype[e + `Form`] = t(!0))
});
var Si = class e {
    constructor(e) {
        if (typeof e != `function`) throw TypeError(`executor must be a function.`);
        let t;
        this.promise = new Promise(function(e) {
            t = e
        });
        let n = this;
        this.promise.then(e => {
            if (!n._listeners) return;
            let t = n._listeners.length;
            for (; t-- > 0;) n._listeners[t](e);
            n._listeners = null
        }), this.promise.then = e => {
            let t, r = new Promise(e => {
                n.subscribe(e), t = e
            }).then(e);
            return r.cancel = function() {
                n.unsubscribe(t)
            }, r
        }, e(function(e, r, i) {
            n.reason || (n.reason = new Cr(e, r, i), t(n.reason))
        })
    }
    throwIfRequested() {
        if (this.reason) throw this.reason
    }
    subscribe(e) {
        if (this.reason) {
            e(this.reason);
            return
        }
        this._listeners ? this._listeners.push(e) : this._listeners = [e]
    }
    unsubscribe(e) {
        if (!this._listeners) return;
        let t = this._listeners.indexOf(e);
        t !== -1 && this._listeners.splice(t, 1)
    }
    toAbortSignal() {
        let e = new AbortController,
            t = t => {
                e.abort(t)
            };
        return this.subscribe(t), e.signal.unsubscribe = () => this.unsubscribe(t), e.signal
    }
    static source() {
        let t;
        return {
            token: new e(function(e) {
                t = e
            }),
            cancel: t
        }
    }
};

function Ci(e) {
    return function(t) {
        return e.apply(null, t)
    }
}

function wi(e) {
    return W.isObject(e) && e.isAxiosError === !0
}
var Ti = {
    Continue: 100,
    SwitchingProtocols: 101,
    Processing: 102,
    EarlyHints: 103,
    Ok: 200,
    Created: 201,
    Accepted: 202,
    NonAuthoritativeInformation: 203,
    NoContent: 204,
    ResetContent: 205,
    PartialContent: 206,
    MultiStatus: 207,
    AlreadyReported: 208,
    ImUsed: 226,
    MultipleChoices: 300,
    MovedPermanently: 301,
    Found: 302,
    SeeOther: 303,
    NotModified: 304,
    UseProxy: 305,
    Unused: 306,
    TemporaryRedirect: 307,
    PermanentRedirect: 308,
    BadRequest: 400,
    Unauthorized: 401,
    PaymentRequired: 402,
    Forbidden: 403,
    NotFound: 404,
    MethodNotAllowed: 405,
    NotAcceptable: 406,
    ProxyAuthenticationRequired: 407,
    RequestTimeout: 408,
    Conflict: 409,
    Gone: 410,
    LengthRequired: 411,
    PreconditionFailed: 412,
    PayloadTooLarge: 413,
    UriTooLong: 414,
    UnsupportedMediaType: 415,
    RangeNotSatisfiable: 416,
    ExpectationFailed: 417,
    ImATeapot: 418,
    MisdirectedRequest: 421,
    UnprocessableEntity: 422,
    Locked: 423,
    FailedDependency: 424,
    TooEarly: 425,
    UpgradeRequired: 426,
    PreconditionRequired: 428,
    TooManyRequests: 429,
    RequestHeaderFieldsTooLarge: 431,
    UnavailableForLegalReasons: 451,
    InternalServerError: 500,
    NotImplemented: 501,
    BadGateway: 502,
    ServiceUnavailable: 503,
    GatewayTimeout: 504,
    HttpVersionNotSupported: 505,
    VariantAlsoNegotiates: 506,
    InsufficientStorage: 507,
    LoopDetected: 508,
    NotExtended: 510,
    NetworkAuthenticationRequired: 511,
    WebServerIsDown: 521,
    ConnectionTimedOut: 522,
    OriginIsUnreachable: 523,
    TimeoutOccurred: 524,
    SslHandshakeFailed: 525,
    InvalidSslCertificate: 526
};
Object.entries(Ti).forEach(([e, t]) => {
    Ti[t] = e
});

function Ei(e) {
    let t = new X(e),
        n = mt(X.prototype.request, t);
    return W.extend(n, X.prototype, t, {
        allOwnKeys: !0
    }), W.extend(n, t, null, {
        allOwnKeys: !0
    }), n.create = function(t) {
        return Ei(J(e, t))
    }, n
}
var Z = Ei(br);
Z.Axios = X, Z.CanceledError = Cr, Z.CancelToken = Si, Z.isCancel = Sr, Z.VERSION = ti, Z.toFormData = Zn, Z.AxiosError = K, Z.Cancel = Z.CanceledError, Z.all = function(e) {
    return Promise.all(e)
}, Z.spread = Ci, Z.isAxiosError = wi, Z.mergeConfig = J, Z.AxiosHeaders = G, Z.formToJSON = e => _r(W.isHTMLForm(e) ? new FormData(e) : e), Z.getAdapter = hi.getAdapter, Z.HttpStatusCode = Ti, Z.default = Z;
var Di = `https://app.supertrader.me/api`,
    Oi = {
        login: `/login`,
        register: `/register`,
        refreshToken: `/refresh_token`,
        checkToken: `/check-token`,
        googleAuth: `/auth/google`,
        appleAuthCallback: `/auth/apple/callback`,
        resetPasswordRequest: `/reset_password_request`
    },
    ki = {
        details: `/account`
    },
    Ai = {
        list: `/portfolio`,
        create: `/portfolio`,
        get: e => `/portfolio/${e}`,
        update: e => `/portfolio/${e}`,
        delete: e => `/portfolio/${e}`,
        forceDelete: e => `/portfolio/${e}/force-delete`,
        default: `/portfolio/default`,
        setDefault: e => `/portfolio/${e}/set-default`,
        stats: e => `/portfolio/${e}/stats`,
        holdings: e => `/portfolio/${e}/holdings`
    },
    ji = {
        list: `/watchlist`,
        create: `/watchlist`,
        update: e => `/watchlist/${e}`,
        delete: e => `/watchlist/${e}`
    },
    Mi = {
        list: `/get/trades`,
        add: `/manual-trade/add`,
        update: `/update-trade`,
        delete: `/trades/`,
        count: `/trades/count`,
        symbols: `/symbols`,
        review: e => `/trades/${e}/review`,
        unreviewedCount: `/trades/unreviewed/count`,
        unreviewed: `/trades/unreviewed`,
        quotesBatch: `/quotes/batch`,
        importTrade: `/import-trade`,
        importTradeStatus: e => `/import-trade/status/${e}`
    },
    Ni = {
        data: `/dashboard`,
        state: `/dashboard/state`,
        activityStreaks: `/dashboard/activity-streaks`
    },
    Pi = {
        get: `/goals`,
        save: `/goals`
    },
    Fi = {
        get: `/trading-plan`,
        save: `/trading-plan`
    },
    Ii = {
        calendar: `/analytics/calendar`
    },
    Li = {
        overview: `/analytics/overview`,
        strategies: `/analytics/strategies`
    },
    Ri = {
        add: `/broker/add`,
        list: `/broker/accounts`,
        update: `/broker/update`,
        delete: `/broker/delete`,
        sync: `/broker/sync`,
        syncJob: e => `/broker/sync-job/${e}`,
        icons: `/broker-icons`,
        mt5Servers: `/broker/mt5/servers`,
        mt5ServerTree: `/broker/mt5/server-tree`,
        mt5ValidateCredentials: `/broker/mt5/validate-credentials`,
        mt5AddServer: `/broker/mt5/add-server`,
        mt5GetOrders: `/broker/mt5/get-orders`,
        mt4ServerTree: `/broker/mt4/server-tree`,
        mt4ValidateCredentials: `/broker/mt4/validate-credentials`,
        mt4AddServer: `/broker/mt4/add-server`,
        snaptrade: {
            connect: `/broker/snaptrade/connect`,
            checkConnection: `/broker/snaptrade/check-connection`
        }
    },
    zi = {
        user: `/settings/user`,
        tradesExport: `/settings/trades/export`,
        subscriptionCurrent: `/settings/subscription/current`,
        subscriptionPortal: `/settings/subscription/portal`
    },
    Bi = {
        profiles: `/coach/profiles`,
        assignment: `/coach/assignment`,
        join: `/coach/join`,
        leave: `/coach/leave`,
        register: `/coach/register`
    },
    Vi = {
        changePassword: `/account/change-password`,
        delete: `/account/delete`,
        uploadImage: `/account/upload-image`
    },
    Hi = {
        plans: `/plans`,
        checkout: `/create-checkout-session`,
        cancel: `/cancel-subscription`,
        reactivate: `/reactivate-subscription`,
        success: `/success`,
        rcAttributes: `/revenuecat/attributes`
    },
    Ui = {
        entry: `/journal/entry`
    },
    Wi = {
        mentalEntry: `/psychology/mental-entry`,
        mentalEntries: `/psychology/mental-entries`
    },
    Gi = {
        strategies: `/backtest/strategies`,
        strategy: e => `/backtest/strategies/${e}`,
        runs: `/backtest/runs`,
        run: e => `/backtest/runs/${e}`,
        executeRun: e => `/backtest/runs/${e}/execute`,
        monteCarlo: e => `/backtest/runs/${e}/monte-carlo`,
        walkForward: e => `/backtest/runs/${e}/walk-forward`,
        optimizations: `/backtest/optimizations`,
        optimization: e => `/backtest/optimizations/${e}`,
        replaySessions: `/backtest/replay-sessions`,
        replaySession: e => `/backtest/replay-sessions/${e}`,
        replaySessionComplete: e => `/backtest/replay-sessions/${e}/complete`,
        historical: e => `/backtest/historical/${e}`,
        tickerSearch: `/backtest/ticker-search`,
        challengeAttempts: `/backtest/challenge-attempts`,
        challengeAttempt: e => `/backtest/challenge-attempts/${e}`
    },
    Ki = {
        insights: `/ai/insights`,
        usage: `/ai-assistant/usage`,
        history: `/ai/history`,
        conversations: `/ai/conversations`,
        conversation: e => `/ai/conversations/${e}`,
        memory: `/ai/memory`
    },
    qi = {
        library: `/agents/library`,
        subscriptions: `/agents/subscriptions`,
        unsubscribe: e => `/agents/subscriptions/${e}`,
        createCustom: `/agents/custom`,
        messages: `/agents/messages`,
        markRead: e => `/agents/messages/${e}/read`,
        credits: `/agents/credits`
    },
    Ji = {
        portfolios: `/discover/portfolios`,
        portfolio: e => `/discover/portfolios/${e}`
    },
    Yi = {
        models: `/arena/models`,
        leaderboard: `/arena/leaderboard`
    },
    Xi = {
        list: `/news`,
        article: e => `/news/${e}`
    },
    Zi = {
        marketBrief: `/market-brief`,
        setupAlert: `/daily-intelligence/setup-alert`
    },
    Qi = {
        metrics: `/admin/metrics`,
        users: {
            list: `/admin/users`,
            details: e => `/admin/users/${e}`,
            files: e => `/admin/users/${e}/files`,
            connectedAccounts: e => `/admin/users/${e}/connected-accounts`,
            actions: e => `/admin/users/${e}/actions`,
            csvUploads: e => `/admin/users/${e}/csv-uploads`,
            zeroPnlTrades: e => `/admin/users/${e}/zero-pnl-trades`
        },
        csv: {
            logs: `/admin/csv-uploads`,
            summary: `/admin/csv-uploads/summary`,
            download: e => `/admin/csv-uploads/${e}/download`
        },
        subscription: {
            manualActivate: `/admin/subscription/manual-activate`,
            assign: `/admin/subscription/assign`
        },
        impersonation: {
            start: `/admin/impersonate`,
            stop: `/admin/impersonate/stop`
        },
        secrets: {
            list: `/admin/secrets`,
            create: `/admin/secrets`,
            update: e => `/admin/secrets/${e}`,
            delete: e => `/admin/secrets/${e}`,
            refresh: `/admin/secrets/refresh`
        },
        appConfig: {
            list: `/admin/app-config`,
            update: e => `/admin/app-config/${e}`
        },
        snaptrade: {
            userList: `/admin/snaptrade/user-list`,
            userDetails: e => `/admin/snaptrade/user/${e}`,
            deleteConnection: `/admin/snaptrade/connection`,
            deleteUser: e => `/admin/snaptrade/user/${e}/delete`,
            deduplicateAccounts: `/admin/snaptrade/deduplicate-accounts`,
            cleanupInactiveSubscribers: `/admin/snaptrade/cleanup-inactive-subscribers`,
            syncBrokerageIds: `/broker/snaptrade/sync-brokerage-ids`
        },
        metaapi: {
            mt5FallbackAccounts: `/admin/metaapi/mt5-fallback-accounts`,
            mt5FallbackDelete: `/admin/metaapi/mt5-fallback`
        },
        mt5: {
            serviceStatus: `/admin/mt5/service-status`,
            accounts: `/admin/mt5/accounts`,
            accountDetail: e => `/admin/mt5/accounts/${e}`,
            validate: e => `/admin/mt5/accounts/${e}/validate`,
            fetchTrades: e => `/admin/mt5/accounts/${e}/fetch-trades`,
            fetchJob: e => `/admin/mt5/fetch-jobs/${e}`,
            serverTree: `/admin/mt5/server-tree`,
            addServer: `/admin/mt5/add-server`,
            restart: `/admin/mt5/restart`
        },
        mt4: {
            serviceStatus: `/admin/mt4/service-status`,
            accounts: `/admin/mt4/accounts`,
            accountDetail: e => `/admin/mt4/accounts/${e}`,
            validate: e => `/admin/mt4/accounts/${e}/validate`,
            fetchTrades: e => `/admin/mt4/accounts/${e}/fetch-trades`,
            fetchJob: e => `/admin/mt4/fetch-jobs/${e}`,
            serverTree: `/admin/mt4/server-tree`,
            addServer: `/admin/mt4/add-server`,
            restart: `/admin/mt4/restart`
        },
        leads: {
            downloads: `/admin/leads/downloads`,
            utmAnalytics: `/admin/leads/utm-analytics`,
            stats: `/admin/leads/stats`
        }
    },
    $i = {
        blogPosts: `/cms/blog-posts`,
        blogPost: e => `/cms/blog-posts/${e}`,
        comparisons: `/cms/comparisons`,
        comparison: e => `/cms/comparisons/${e}`,
        landingSections: `/cms/landing-sections`,
        landingSection: e => `/cms/landing-sections/${e}`,
        landingSectionReorder: `/cms/landing-sections/reorder`,
        brokers: `/cms/brokers`,
        broker: e => `/cms/brokers/${e}`,
        guides: `/cms/guides`,
        guide: e => `/cms/guides/${e}`,
        staticPages: `/cms/static-pages`,
        staticPage: e => `/cms/static-pages/${e}`,
        documentation: `/cms/documentation`,
        documentationArticle: e => `/cms/documentation/${e}`,
        languages: `/cms/languages`,
        language: e => `/cms/languages/${e}`,
        translations: `/cms/translations`,
        seo: {
            robots: `/cms/seo/robots`,
            redirects: `/cms/seo/redirects`,
            redirect: e => `/cms/seo/redirects/${e}`,
            sitemapPages: `/cms/sitemap-pages`,
            sitemapPage: e => `/cms/sitemap-pages/${e}`,
            sitemapConfig: `/cms/sitemap-config`,
            sitemapSync: `/cms/sitemap/sync`
        },
        navigation: `/cms/navigation`
    },
    ea = {
        stressed: {
            mood: 2,
            energy_level: 3,
            focus: 3,
            stress_level: 8,
            sleep_quality: 5
        },
        worried: {
            mood: 4,
            energy_level: 4,
            focus: 4,
            stress_level: 7,
            sleep_quality: 5
        },
        neutral: {
            mood: 5,
            energy_level: 5,
            focus: 5,
            stress_level: 5,
            sleep_quality: 5
        },
        calm: {
            mood: 7,
            energy_level: 6,
            focus: 7,
            stress_level: 3,
            sleep_quality: 6
        },
        sharp: {
            mood: 9,
            energy_level: 8,
            focus: 9,
            stress_level: 2,
            sleep_quality: 7
        }
    },
    ta = {
        "Review yesterday's trades": !1,
        "Check pre-market news": !1,
        "Review watchlist levels": !1,
        "Set daily loss limit": !1,
        "Clear emotional state": !1
    };

function na(e) {
    return {
        date: e,
        preSession: {
            mood: null,
            checklist: { ...ta
            },
            note: ``,
            completed: !1
        },
        postSession: {
            rating: null,
            whatWorked: [],
            whatToImprove: [],
            takeaway: ``,
            completed: !1
        }
    }
}
var ra = `supertrader_mindset`;

function ia() {
    try {
        let e = localStorage.getItem(ra);
        return e ? JSON.parse(e) : {}
    } catch {
        return {}
    }
}

function aa(e) {
    localStorage.setItem(ra, JSON.stringify(e))
}

function oa(e) {
    return ia()[e] ? ? na(e)
}

function sa(e) {
    let [t, n] = (0, I.useState)(() => oa(e));
    return (0, I.useEffect)(() => {
        n(oa(e))
    }, [e]), {
        session: t,
        updatePreSession: (0, I.useCallback)(t => {
            n(n => {
                let r = { ...n,
                        preSession: { ...n.preSession,
                            ...t
                        }
                    },
                    i = ia();
                return i[e] = r, aa(i), r
            })
        }, [e]),
        updatePostSession: (0, I.useCallback)(t => {
            n(n => {
                let r = { ...n,
                        postSession: { ...n.postSession,
                            ...t
                        }
                    },
                    i = ia();
                return i[e] = r, aa(i), r
            })
        }, [e]),
        completePreSession: (0, I.useCallback)(() => {
            n(t => {
                let n = { ...t,
                        preSession: { ...t.preSession,
                            completed: !0
                        }
                    },
                    r = ia();
                return r[e] = n, aa(r), n
            })
        }, [e]),
        completePostSession: (0, I.useCallback)(() => {
            n(t => {
                let n = { ...t,
                        postSession: { ...t.postSession,
                            completed: !0
                        }
                    },
                    r = ia();
                return r[e] = n, aa(r), n
            })
        }, [e])
    }
}

function ca() {
    try {
        let e = localStorage.getItem(ra);
        return e ? JSON.parse(e) : {}
    } catch {
        return {}
    }
}

function la() {
    localStorage.removeItem(ra)
}
var ua = [{
        value: `teal`,
        label: `Teal`,
        hex: `#00C896`,
        hsl: `165 100% 39%`
    }, {
        value: `blue`,
        label: `Blue`,
        hex: `#3B82F6`,
        hsl: `217 91% 60%`
    }, {
        value: `purple`,
        label: `Purple`,
        hex: `#8B5CF6`,
        hsl: `258 90% 66%`
    }, {
        value: `orange`,
        label: `Orange`,
        hex: `#F59E0B`,
        hsl: `38 92% 50%`
    }, {
        value: `red`,
        label: `Red`,
        hex: `#EF4444`,
        hsl: `0 84% 60%`
    }, {
        value: `pink`,
        label: `Pink`,
        hex: `#EC4899`,
        hsl: `330 81% 60%`
    }, {
        value: `green`,
        label: `Green`,
        hex: `#10B981`,
        hsl: `160 84% 39%`
    }, {
        value: `indigo`,
        label: `Indigo`,
        hex: `#6366F1`,
        hsl: `239 84% 67%`
    }],
    da = Object.fromEntries(ua.map(e => [e.value, e])),
    Q = da.teal;

function fa(e) {
    try {
        let t = e.replace(`#`, ``);
        if (t.length !== 6) throw Error(`invalid hex`);
        let n = parseInt(t.slice(0, 2), 16) / 255,
            r = parseInt(t.slice(2, 4), 16) / 255,
            i = parseInt(t.slice(4, 6), 16) / 255,
            a = Math.max(n, r, i),
            o = Math.min(n, r, i),
            s = 0,
            c = 0,
            l = (a + o) / 2;
        if (a !== o) {
            let e = a - o;
            switch (c = l > .5 ? e / (2 - a - o) : e / (a + o), a) {
                case n:
                    s = ((r - i) / e + (r < i ? 6 : 0)) / 6;
                    break;
                case r:
                    s = ((i - n) / e + 2) / 6;
                    break;
                case i:
                    s = ((n - r) / e + 4) / 6;
                    break
            }
        }
        return `${Math.round(s*360)} ${Math.round(c*100)}% ${Math.round(l*100)}%`
    } catch {
        return Q.hsl
    }
}

function pa(e) {
    return e >= 55 ? `0 0% 0%` : `0 0% 100%`
}

function ma(e) {
    let t = /(\d+(?:\.\d+)?)%\s*$/.exec(e.trim());
    return t ? Number(t[1]) : 50
}

function ha(e) {
    if (!e) return {
        token: Q.value,
        hsl: Q.hsl,
        foreground: pa(ma(Q.hsl)),
        hex: Q.hex
    };
    let t = da[e.toLowerCase()];
    if (t) return {
        token: t.value,
        hsl: t.hsl,
        foreground: pa(ma(t.hsl)),
        hex: t.hex
    };
    if (e.startsWith(`#`)) {
        let t = fa(e);
        return {
            token: Q.value,
            hsl: t,
            foreground: pa(ma(t)),
            hex: e
        }
    }
    return {
        token: Q.value,
        hsl: Q.hsl,
        foreground: pa(ma(Q.hsl)),
        hex: Q.hex
    }
}

function ga(e) {
    let t = ha(e);
    return da[t.token] ? t.token : Q.value
}
var _a = [{
        value: `followed_plan`,
        label: `Followed Plan`
    }, {
        value: `good_risk_reward`,
        label: `Solid Risk/Reward`
    }, {
        value: `patient_entry`,
        label: `Patient Entry`
    }, {
        value: `disciplined_exit`,
        label: `Disciplined Exit`
    }, {
        value: `respected_stops`,
        label: `Respected Stops`
    }, {
        value: `sized_correctly`,
        label: `Sized Position Well`
    }, {
        value: `clear_setup`,
        label: `Clear Setup`
    }, {
        value: `avoided_fomo`,
        label: `Avoided FOMO`
    }, {
        value: `took_profit_as_planned`,
        label: `Took Profit as Planned`
    }, {
        value: `good_timing`,
        label: `Good Market Timing`
    }, {
        value: `journaling_helped`,
        label: `Journaling/Review Helped`
    }, {
        value: `other_positive`,
        label: `Other Positive`
    }],
    va = [{
        value: `broke_rules`,
        label: `Broke Rules`
    }, {
        value: `fomo`,
        label: `FOMO Entry`
    }, {
        value: `revenge_trading`,
        label: `Revenge Trading`
    }, {
        value: `overtrading`,
        label: `Overtrading`
    }, {
        value: `ignored_stop_loss`,
        label: `Ignored Stop Loss`
    }, {
        value: `moved_stop_loss`,
        label: `Moved Stop Loss`
    }, {
        value: `too_large_position`,
        label: `Position Too Large`
    }, {
        value: `early_exit`,
        label: `Exited Too Early`
    }, {
        value: `late_exit`,
        label: `Exited Too Late`
    }, {
        value: `chased_entry`,
        label: `Chased Entry`
    }, {
        value: `no_plan`,
        label: `No Trading Plan`
    }, {
        value: `emotional_decision`,
        label: `Emotional Decision`
    }, {
        value: `poor_risk_reward`,
        label: `Poor Risk/Reward`
    }, {
        value: `wrong_timeframe`,
        label: `Wrong Timeframe`
    }, {
        value: `ignored_signals`,
        label: `Ignored Signals`
    }],
    ya = [{
        value: `breakout`,
        label: `Breakout`
    }, {
        value: `trend_following`,
        label: `Trend Following`
    }, {
        value: `mean_reversion`,
        label: `Mean Reversion`
    }, {
        value: `scalping`,
        label: `Scalping`
    }, {
        value: `swing`,
        label: `Swing Trade`
    }, {
        value: `momentum`,
        label: `Momentum`
    }, {
        value: `gap_fill`,
        label: `Gap Fill`
    }, {
        value: `support_resistance`,
        label: `Support/Resistance`
    }, {
        value: `news_catalyst`,
        label: `News/Catalyst`
    }, {
        value: `earnings_play`,
        label: `Earnings Play`
    }, {
        value: `options_spread`,
        label: `Options Spread`
    }, {
        value: `reversal`,
        label: `Reversal`
    }];
ya.map(e => e.value), va.map(e => e.value), [{
    value: `stocks`,
    label: `Stocks`
}, {
    value: `forex`,
    label: `Forex`
}, {
    value: `crypto`,
    label: `Crypto`
}, {
    value: `options`,
    label: `Options`
}, {
    value: `futures`,
    label: `Futures`
}, {
    value: `etf`,
    label: `ETF`
}, {
    value: `other`,
    label: `Other`
}].map(e => e.value);

function ba() {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone ? .trim() || void 0
    } catch {
        return
    }
}

function xa(e, t = new Date) {
    let n = (e ? ? `UTC`).trim();
    if (!n || n.toUpperCase() === `UTC`) return `+00:00`;
    try {
        let e = new Intl.DateTimeFormat(`en-US`, {
            timeZone: n,
            timeZoneName: `longOffset`
        }).formatToParts(t).find(e => e.type === `timeZoneName`) ? .value;
        if (!e) return `+00:00`;
        let r = e.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/i) ? ? e.match(/UTC([+-])(\d{1,2})(?::(\d{2}))?/i);
        if (!r) return `+00:00`;
        let i = r[1] === `-` ? `-` : `+`,
            a = Math.min(23, Math.max(0, parseInt(r[2], 10))),
            o = r[3] ? Math.min(59, Math.max(0, parseInt(r[3], 10))) : 0;
        return `${i}${String(a).padStart(2,`0`)}:${String(o).padStart(2,`0`)}`
    } catch {
        return `+00:00`
    }
}
var Sa = `supertrader_settings`,
    Ca = `settingsstore:update`,
    wa = [`Breakout`, `Swing`, `Momentum`, `Mean Reversion`, `Gap & Go`, `News Play`, `Trend Follow`, `Premium Selling`, `Earnings Play`],
    Ta = [`Followed plan`, `Revenge trade`, `Overtraded`, `Patient entry`, `Chased`, `Good R:R`, `Sized wrong`, `FOMO`],
    Ea = {
        profile: {
            firstName: `Alex`,
            lastName: `Kim`,
            email: `alex@example.com`,
            username: `alexkim`,
            bio: ``,
            location: ``,
            publicProfile: !1
        },
        system: {
            timezone: ba() ? ? `UTC`,
            language: `en`,
            saveFilters: !0,
            journalTemplate: ``,
            tradeNotesTemplate: ``
        },
        tradingDefaults: {
            strategies: [...wa],
            mistakes: [...Ta],
            defaultStrategyIds: [`Breakout`],
            defaultSymbol: ``,
            defaultQuantity: null,
            defaultFee: null,
            defaultForexLeverage: null
        },
        goals: {
            weeklyPnl: null,
            monthlyPnl: null,
            yearlyPnl: null,
            weeklyTrades: null,
            monthlyTrades: null,
            yearlyTrades: null
        },
        notifications: {
            dailyPnlSummary: !0,
            tradeAlerts: !0,
            mentalStateReminders: !1,
            learningProgress: !0,
            streakNotifications: !0
        },
        appearance: {
            theme: `dark`,
            accentColor: `teal`
        },
        coaching: {
            inviteCode: ``,
            isCoach: !1,
            coachName: ``
        },
        riskLimits: {
            sectorConcentrationThreshold: 30
        }
    };

function Da(e, t) {
    return {
        profile: { ...e.profile,
            ...t.profile ? ? {}
        },
        system: { ...e.system,
            ...t.system ? ? {}
        },
        tradingDefaults: { ...e.tradingDefaults,
            ...t.tradingDefaults ? ? {}
        },
        goals: { ...e.goals,
            ...t.goals ? ? {}
        },
        notifications: { ...e.notifications,
            ...t.notifications ? ? {}
        },
        appearance: { ...e.appearance,
            ...t.appearance ? ? {}
        },
        coaching: { ...e.coaching,
            ...t.coaching ? ? {}
        },
        riskLimits: { ...e.riskLimits,
            ...t.riskLimits ? ? {}
        }
    }
}

function $() {
    try {
        let e = localStorage.getItem(Sa);
        return e ? Da(Ea, JSON.parse(e)) : { ...Ea
        }
    } catch {
        return { ...Ea
        }
    }
}

function Oa(e) {
    try {
        localStorage.setItem(Sa, JSON.stringify(e)), window.dispatchEvent(new CustomEvent(Ca))
    } catch {}
}

function ka() {
    localStorage.removeItem(Sa)
}

function Aa(e, t, n = []) {
    return t.find(t => t.value === e) ? .label ? ? n.find(t => t.value === e) ? .label ? ? e
}

function ja(e, t = [], n = []) {
    let r = [...e, ...t];
    return (n.length > 0 ? [...r].sort((e, t) => {
        let r = n.indexOf(e.value),
            i = n.indexOf(t.value);
        return r === -1 && i === -1 ? 0 : r === -1 ? 1 : i === -1 ? -1 : r - i
    }) : r).map(e => e.label)
}

function Ma(e, t = ``) {
    let n = e.custom_strategies ? ? [],
        r = e.custom_mistakes ? ? [],
        i = ja(ya, n, e.strategy_order ? ? []),
        a = ja(va, r, e.mistake_order ? ? []),
        o = (e.default_strategies ? ? []).map(e => Aa(e, ya, n)),
        s = $();
    Oa({ ...s,
        profile: { ...s.profile,
            firstName: e.first_name ? ? ``,
            lastName: e.last_name ? ? ``,
            email: t || s.profile.email,
            username: e.username ? ? ``,
            bio: e.bio ? ? ``,
            location: e.location ? ? ``,
            publicProfile: e.public_profile ? ? !1
        },
        system: { ...s.system,
            timezone: e.timezone,
            language: e.language,
            saveFilters: e.save_filters,
            journalTemplate: e.default_journal_template ? ? ``,
            tradeNotesTemplate: e.default_trade_template ? ? ``
        },
        tradingDefaults: {
            strategies: i.length > 0 ? i : s.tradingDefaults.strategies,
            mistakes: a.length > 0 ? a : s.tradingDefaults.mistakes,
            defaultStrategyIds: o.length > 0 ? o : s.tradingDefaults.defaultStrategyIds,
            defaultSymbol: e.default_symbol ? ? ``,
            defaultQuantity: e.default_quantity ? ? null,
            defaultFee: e.default_fee ? ? null,
            defaultForexLeverage: e.default_forex_leverage ? ? null
        },
        notifications: {
            dailyPnlSummary: e.notify_daily_pnl,
            tradeAlerts: e.notify_trade_alerts,
            mentalStateReminders: e.notify_mental_reminders,
            learningProgress: e.notify_learning_progress,
            streakNotifications: e.notify_streak_alerts
        },
        appearance: {
            theme: e.theme || s.appearance.theme,
            accentColor: ha(e.accent_color).token
        }
    }), Fa({
        theme: e.theme || s.appearance.theme,
        accentColor: ha(e.accent_color).token
    })
}

function Na(e) {
    let t = $();
    Oa({
        profile: { ...t.profile,
            ...e.profile ? ? {}
        },
        system: { ...t.system,
            ...e.system ? ? {}
        },
        tradingDefaults: { ...t.tradingDefaults,
            ...e.tradingDefaults ? ? {}
        },
        goals: { ...t.goals,
            ...e.goals ? ? {}
        },
        notifications: { ...t.notifications,
            ...e.notifications ? ? {}
        },
        appearance: { ...t.appearance,
            ...e.appearance ? ? {}
        },
        coaching: { ...t.coaching,
            ...e.coaching ? ? {}
        },
        riskLimits: { ...t.riskLimits,
            ...e.riskLimits ? ? {}
        }
    })
}

function Pa() {
    let [e, t] = (0, I.useState)(() => $());
    return (0, I.useEffect)(() => {
        let e = () => t($());
        return window.addEventListener(Ca, e), () => window.removeEventListener(Ca, e)
    }, []), e
}

function Fa(e) {
    if (typeof window > `u`) return;
    let t = e ? ? $().appearance,
        n = document.documentElement,
        r = ha(t.accentColor);
    n.style.setProperty(`--primary`, r.hsl), n.style.setProperty(`--primary-foreground`, r.foreground), n.style.setProperty(`--accent`, r.hsl), n.style.setProperty(`--ring`, r.hsl), n.style.setProperty(`--sidebar-primary`, r.hsl), n.style.setProperty(`--sidebar-primary-foreground`, r.foreground), n.style.setProperty(`--sidebar-ring`, r.hsl), n.style.setProperty(`--chart-1`, r.hsl);
    let i = !t.theme || t.theme === `dark` || t.theme === `system` && window.matchMedia(`(prefers-color-scheme: dark)`).matches;
    n.classList.toggle(`dark`, i), n.classList.toggle(`light`, !i), n.style.colorScheme = i ? `dark` : `light`
}
typeof window < `u` && Fa($().appearance);
var Ia = `supertrader_accounts`,
    La = `tradestore:accounts:update`,
    Ra = [{
        id: `main`,
        name: `Main Portfolio`,
        description: ``,
        initialBalance: 1e4,
        currency: `USD`,
        pnlMode: `net`,
        defaultFee: 0
    }];

function za() {
    try {
        let e = localStorage.getItem(Ia),
            t = e ? JSON.parse(e) : null;
        return Array.isArray(t) && t.length > 0 ? t : [...Ra]
    } catch {
        return [...Ra]
    }
}

function Ba() {
    let [e, t] = (0, I.useState)(() => za());
    return (0, I.useEffect)(() => {
        let e = () => t(za());
        return window.addEventListener(La, e), () => window.removeEventListener(La, e)
    }, []), e
}
var Va = `supertrader_entries`;

function Ha() {
    try {
        let e = localStorage.getItem(Va);
        return e ? JSON.parse(e) : []
    } catch {
        return []
    }
}

function Ua() {
    return Ha().filter(e => e.type === `trade`)
}

function Wa() {
    localStorage.removeItem(Ia), localStorage.removeItem(Va)
}
var Ga = class extends Error {
    statusCode;
    errorCode;
    details;
    constructor(e, t, n, r) {
        super(e), this.name = `HttpError`, this.statusCode = t, this.errorCode = n, this.details = r
    }
};

function Ka(e) {
    if (typeof e != `object` || !e) return e;
    let t = e;
    if (!Object.prototype.hasOwnProperty.call(t, `data`)) return e;
    let n = t.data,
        r = new Set([`success`, `message`, `error`, `data`]),
        i = Object.keys(t).filter(e => !r.has(e));
    return n == null || Array.isArray(n) && n.length === 0 && i.length > 0 || typeof n == `object` && !Array.isArray(n) && Object.keys(n).length === 0 && i.length > 0 ? e : n
}

function qa(e) {
    if (e.response) {
        let t = e.response.data;
        return new Ga(t ? .message ? ? t ? .error ? ? e.message, e.response.status, t ? .error, t ? .details ? ? t ? .errors)
    }
    return e.request ? new Ga(`No response from server. Please check your connection.`, 0) : new Ga(e.message, 0)
}

function Ja() {
    st(), la(), ka(), Wa(), pt.getState().clearSession()
}
var Ya = !1;

function Xa(e) {
    Ya = e
}
var Za = Z.create({
    baseURL: Di,
    timeout: 3e4,
    headers: {
        "Content-Type": `application/json`
    }
});
Za.interceptors.request.use(e => {
    e.data instanceof FormData && e.headers && delete e.headers[`Content-Type`];
    let t = e.headers;
    if (t[`X-Use-Admin-Token`]) {
        delete t[`X-Use-Admin-Token`];
        let e = localStorage.getItem(`admin_original_access_token`) || localStorage.getItem(`access_token`);
        e && (t.Authorization = `Bearer ${e}`)
    } else {
        let e = nt();
        e && (t.Authorization = `Bearer ${e}`)
    }
    return e
}), Za.interceptors.response.use(e => e, async e => {
    let t = e.config;
    if (e.response ? .status === 401 && t && !t._retry && !Ya) {
        t._retry = !0;
        let n = rt();
        if (!n) return Ja(), Promise.reject(qa(e));
        try {
            let r = Ka((await Z.post(`${Di}/refresh_token`, {}, {
                    headers: {
                        "Content-Type": `application/json`,
                        Authorization: `Bearer ${n}`
                    }
                })).data),
                i = r.access_token;
            return i ? (ot(i, r.refresh_token ? ? n), t.headers && (t.headers.Authorization = `Bearer ${i}`), Za(t)) : (Ja(), Promise.reject(qa(e)))
        } catch {
            return Ja(), Promise.reject(qa(e))
        }
    }
    return Promise.reject(qa(e))
});
async function Qa(e, t, n, r) {
    return Ka((await Za.request({
        method: e,
        url: t,
        data: n,
        ...r
    })).data)
}
async function $a(e) {
    return (await Za.get(e, {
        responseType: `blob`
    })).data
}
var eo = {
    get: (e, t) => Qa(`GET`, e, void 0, t),
    getBlob: e => $a(e),
    post: (e, t, n) => Qa(`POST`, e, t, n),
    put: (e, t, n) => Qa(`PUT`, e, t, n),
    delete: (e, t) => Qa(`DELETE`, e, void 0, t),
    patch: (e, t, n) => Qa(`PATCH`, e, t, n)
};
export {
    Fi as $, Qi as A, u as At, $i as B, ha as C, P as Ct, sa as D, v as Dt, ca as E, y as Et, Yi as F, O as Ft, Pi as G, Zi as H, Oi as I, a as It, Ai as J, Ui as K, Gi as L, i as Lt, Ki as M, m as Mt, Li as N, C as Nt, Vi as O, _ as Ot, Di as P, A as Pt, Mi as Q, Ri as R, ga as S, ce as St, la as T, d as Tt, Ni as U, Bi as V, Ji as W, zi as X, Wi as Y, Hi as Z, xa as _, ye as _t, Ka as a, nt as at, ya as b, me as bt, Ua as c, it as ct, ka as d, at as dt, ji as et, $ as f, ot as ft, ba as g, Oe as gt, Pa as h, ke as ht, Xa as i, st as it, qi as j, b as jt, ki as k, g as kt, Ba as l, dt as lt, Na as m, He as mt, Za as n, ft as nt, Wa as o, ct as ot, Ma as p, Ue as pt, Xi as q, eo as r, ut as rt, za as s, lt as st, Ga as t, pt as tt, Fa as u, tt as ut, _a as v, he as vt, ea as w, N as wt, ua as x, le as xt, va as y, pe as yt, Ii as z
};