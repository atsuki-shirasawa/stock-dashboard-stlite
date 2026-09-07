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

export interface Env {
	/**
	 * Comma-separated list of browser origins allowed to call this Worker, e.g.
	 * "https://acme.github.io". Empty/unset means any origin — convenient, but it
	 * lets anyone who finds the URL spend your quota. Set it in wrangler.toml.
	 */
	ALLOWED_ORIGINS?: string;
}

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

/**
 * Returns the value for Access-Control-Allow-Origin, or null when the caller is
 * not allowed. With no allowlist configured every origin is accepted.
 */
function resolveOrigin(request: Request, env: Env): string | null {
	const allowed = (env.ALLOWED_ORIGINS ?? "")
		.split(",")
		.map((o) => o.trim())
		.filter(Boolean);
	if (allowed.length === 0) return "*";

	// A browser always sends Origin on a cross-origin fetch; its absence means a
	// non-browser caller, which an allowlisted deployment has no reason to serve.
	const origin = request.headers.get("Origin");
	if (!origin) return null;
	return allowed.includes(origin) ? origin : null;
}

function corsHeaders(allowOrigin: string): Record<string, string> {
	return {
		"Access-Control-Allow-Origin": allowOrigin,
		"Access-Control-Allow-Methods": "GET, OPTIONS",
		"Access-Control-Allow-Headers": "*",
		"Access-Control-Max-Age": "86400",
		// The allowed origin is echoed back, so caches must key on it.
		Vary: "Origin",
	};
}

function errorResponse(
	status: number,
	message: string,
	allowOrigin: string | null,
): Response {
	return new Response(JSON.stringify({ error: message }), {
		status,
		headers: {
			...(allowOrigin ? corsHeaders(allowOrigin) : {}),
			"Content-Type": "application/json",
		},
	});
}

function clampTtl(raw: string | null): number {
	const n = Number(raw);
	if (!Number.isFinite(n)) return DEFAULT_TTL_SEC;
	return Math.min(MAX_TTL_SEC, Math.max(MIN_TTL_SEC, Math.floor(n)));
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext) {
		const allowOrigin = resolveOrigin(request, env);
		if (!allowOrigin) {
			return errorResponse(403, "Origin not allowed", null);
		}

		if (request.method === "OPTIONS") {
			return new Response(null, {
				status: 204,
				headers: corsHeaders(allowOrigin),
			});
		}
		if (request.method !== "GET") {
			return errorResponse(405, "Method not allowed", allowOrigin);
		}

		const target = new URL(request.url).searchParams.get("url");
		if (!target) return errorResponse(400, "Missing ?url=", allowOrigin);

		let upstream: URL;
		try {
			upstream = new URL(target);
		} catch {
			return errorResponse(400, "Malformed ?url=", allowOrigin);
		}
		if (upstream.protocol !== "https:" || !ALLOWED_HOSTS.has(upstream.hostname)) {
			return errorResponse(
				403,
				`Host not allowed: ${upstream.hostname}`,
				allowOrigin,
			);
		}

		const ttl = clampTtl(new URL(request.url).searchParams.get("ttl"));

		// The client already varies the upstream URL by its own cache window
		// (`_t=`), so keying the edge cache on that URL gives us the same window.
		const cacheKey = new Request(upstream.toString(), { method: "GET" });
		const cache = caches.default;

		const hit = await cache.match(cacheKey);
		if (hit) {
			// CORS headers are re-applied per request: the cached copy may have been
			// stored for a different origin.
			const headers = new Headers(hit.headers);
			for (const [k, v] of Object.entries(corsHeaders(allowOrigin))) {
				headers.set(k, v);
			}
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
			return errorResponse(
				502,
				`Upstream fetch failed: ${String(err)}`,
				allowOrigin,
			);
		}

		const body = await resp.text();
		const headers = new Headers({
			...corsHeaders(allowOrigin),
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
} satisfies ExportedHandler<Env>;
