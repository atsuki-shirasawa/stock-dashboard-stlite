/**
 * yf-proxy — a CORS proxy for the Yahoo Finance chart API with an edge cache
 * that every viewer shares.
 *
 * Browser storage (localStorage) is per-origin *and* per-browser, so one
 * viewer's cache can never help another. This Worker is the shared layer: the
 * first viewer to request a symbol/period warms Cloudflare's edge cache and
 * everyone else reads from it, which both cuts the error rate and keeps the
 * request volume Yahoo sees low.
 *
 * Usage: GET /?url=<encoded Yahoo URL>&ttl=<seconds>
 */

/** Only these hosts may be proxied — without this the Worker is an open relay. */
const ALLOWED_HOSTS = new Set([
	"query1.finance.yahoo.com",
	"query2.finance.yahoo.com",
]);

const MIN_TTL_SEC = 60;
const MAX_TTL_SEC = 24 * 60 * 60;
const DEFAULT_TTL_SEC = 300;

/** Browsers should revalidate often; the edge is what holds the long TTL. */
const BROWSER_MAX_AGE_SEC = 30;

const UPSTREAM_HEADERS = {
	"User-Agent":
		"Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
		"AppleWebKit/537.36 (KHTML, like Gecko) " +
		"Chrome/120.0.0.0 Safari/537.36",
	Accept: "application/json,text/plain,*/*",
};

function corsHeaders(): Record<string, string> {
	return {
		"Access-Control-Allow-Origin": "*",
		"Access-Control-Allow-Methods": "GET, OPTIONS",
		"Access-Control-Allow-Headers": "*",
		"Access-Control-Max-Age": "86400",
	};
}

function errorResponse(status: number, message: string): Response {
	return new Response(JSON.stringify({ error: message }), {
		status,
		headers: { ...corsHeaders(), "Content-Type": "application/json" },
	});
}

function clampTtl(raw: string | null): number {
	const n = Number(raw);
	if (!Number.isFinite(n)) return DEFAULT_TTL_SEC;
	return Math.min(MAX_TTL_SEC, Math.max(MIN_TTL_SEC, Math.floor(n)));
}

export default {
	async fetch(request: Request, _env: unknown, ctx: ExecutionContext) {
		if (request.method === "OPTIONS") {
			return new Response(null, { status: 204, headers: corsHeaders() });
		}
		if (request.method !== "GET") {
			return errorResponse(405, "Method not allowed");
		}

		const target = new URL(request.url).searchParams.get("url");
		if (!target) return errorResponse(400, "Missing ?url=");

		let upstream: URL;
		try {
			upstream = new URL(target);
		} catch {
			return errorResponse(400, "Malformed ?url=");
		}
		if (upstream.protocol !== "https:" || !ALLOWED_HOSTS.has(upstream.hostname)) {
			return errorResponse(403, `Host not allowed: ${upstream.hostname}`);
		}

		const ttl = clampTtl(new URL(request.url).searchParams.get("ttl"));

		// The client already varies the upstream URL by its own cache window
		// (`_t=`), so keying the edge cache on that URL gives us the same window.
		const cacheKey = new Request(upstream.toString(), { method: "GET" });
		const cache = caches.default;

		const hit = await cache.match(cacheKey);
		if (hit) {
			const headers = new Headers(hit.headers);
			for (const [k, v] of Object.entries(corsHeaders())) headers.set(k, v);
			headers.set("X-Proxy-Cache", "HIT");
			return new Response(hit.body, { status: hit.status, headers });
		}

		let resp: Response;
		try {
			resp = await fetch(upstream.toString(), {
				headers: UPSTREAM_HEADERS,
				cf: { cacheTtl: ttl, cacheEverything: true },
			});
		} catch (err) {
			return errorResponse(502, `Upstream fetch failed: ${String(err)}`);
		}

		const body = await resp.text();
		const headers = new Headers({
			...corsHeaders(),
			"Content-Type": resp.headers.get("Content-Type") ?? "application/json",
			"X-Proxy-Cache": "MISS",
		});

		if (resp.ok) {
			// s-maxage drives the edge cache; stale-while-revalidate lets a viewer
			// get an instant (slightly old) answer while the edge refreshes.
			headers.set(
				"Cache-Control",
				`public, max-age=${BROWSER_MAX_AGE_SEC}, s-maxage=${ttl}, stale-while-revalidate=${ttl}`,
			);
			ctx.waitUntil(
				cache.put(cacheKey, new Response(body, { status: 200, headers })),
			);
		} else {
			// Never cache an upstream failure.
			headers.set("Cache-Control", "no-store");
		}

		return new Response(body, { status: resp.status, headers });
	},
} satisfies ExportedHandler;
