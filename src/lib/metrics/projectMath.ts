export function toNumber(v: unknown, fallback: number = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
}

export function clamp(n: number, min: number, max: number) {
    return Math.max(min, Math.min(n, max));
}

export function round(n: number) {
    return Math.round(n)
}

