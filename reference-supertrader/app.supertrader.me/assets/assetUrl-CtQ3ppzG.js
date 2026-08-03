import {
    P as e
} from "./http-D6Yh-gg5.js";

function t(t) {
    return t ? .trim() ? /^https?:\/\//i.test(t) ? t : `${e.replace(/\/api\/?$/,``)}${t.startsWith(`/`)?t:`/${t}`}` : null
}

function n(t) {
    return t ? .trim() ? /^https?:\/\//i.test(t) ? t : `${e.replace(/\/$/,``)}/${t.replace(/^\//,``)}` : null
}
export {
    n,
    t
};