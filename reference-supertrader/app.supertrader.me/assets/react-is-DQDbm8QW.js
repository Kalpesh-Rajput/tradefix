import {
    i as e
} from "./createLucideIcon-DwuI3uP3.js";
var t = e(((e, t) => {
        t.exports = `SECRET_DO_NOT_PASS_THIS_OR_YOU_WILL_BE_FIRED`
    })),
    n = e(((e, n) => {
        var r = t();

        function i() {}

        function a() {}
        a.resetWarningCache = i, n.exports = function() {
            function e(e, t, n, i, a, o) {
                if (o !== r) {
                    var s = Error("Calling PropTypes validators directly is not supported by the `prop-types` package. Use PropTypes.checkPropTypes() to call them. Read more at http://fb.me/use-check-prop-types");
                    throw s.name = `Invariant Violation`, s
                }
            }
            e.isRequired = e;

            function t() {
                return e
            }
            var n = {
                array: e,
                bigint: e,
                bool: e,
                func: e,
                number: e,
                object: e,
                string: e,
                symbol: e,
                any: e,
                arrayOf: t,
                element: e,
                elementType: e,
                instanceOf: t,
                node: e,
                objectOf: t,
                oneOf: t,
                oneOfType: t,
                shape: t,
                exact: t,
                checkPropTypes: a,
                resetWarningCache: i
            };
            return n.PropTypes = n, n
        }
    })),
    r = e(((e, t) => {
        t.exports = n()()
    })),
    i = e((e => {
        var t = Symbol.for(`react.element`),
            n = Symbol.for(`react.portal`),
            r = Symbol.for(`react.fragment`),
            i = Symbol.for(`react.strict_mode`),
            a = Symbol.for(`react.profiler`),
            o = Symbol.for(`react.provider`),
            s = Symbol.for(`react.context`),
            c = Symbol.for(`react.server_context`),
            l = Symbol.for(`react.forward_ref`),
            u = Symbol.for(`react.suspense`),
            d = Symbol.for(`react.suspense_list`),
            f = Symbol.for(`react.memo`),
            p = Symbol.for(`react.lazy`),
            m = Symbol.for(`react.offscreen`),
            h = Symbol.for(`react.module.reference`);

        function g(e) {
            if (typeof e == `object` && e) {
                var m = e.$$typeof;
                switch (m) {
                    case t:
                        switch (e = e.type, e) {
                            case r:
                            case a:
                            case i:
                            case u:
                            case d:
                                return e;
                            default:
                                switch (e && = e.$$typeof, e) {
                                    case c:
                                    case s:
                                    case l:
                                    case p:
                                    case f:
                                    case o:
                                        return e;
                                    default:
                                        return m
                                }
                        }
                    case n:
                        return m
                }
            }
        }
        e.isFragment = function(e) {
            return g(e) === r
        }, e.isValidElementType = function(e) {
            return !!(typeof e == `string` || typeof e == `function` || e === r || e === a || e === i || e === u || e === d || e === m || typeof e == `object` && e && (e.$$typeof === p || e.$$typeof === f || e.$$typeof === o || e.$$typeof === s || e.$$typeof === l || e.$$typeof === h || e.getModuleId !== void 0))
        }
    })),
    a = e(((e, t) => {
        t.exports = i()
    }));
export {
    r as n, a as t
};