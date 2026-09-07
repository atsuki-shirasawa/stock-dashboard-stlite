/// <reference types="vite/client" />

interface ImportMetaEnv {
	/**
	 * Optional self-hosted CORS proxy endpoint (see `worker/`). When set it is
	 * tried before the public proxies; its edge cache is shared by all viewers.
	 * e.g. "https://yf-proxy.<subdomain>.workers.dev"
	 */
	readonly VITE_YF_PROXY?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
