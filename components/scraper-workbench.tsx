'use client';

import { useEffect, useRef, useState } from 'react';
import type { MouseEvent, ReactNode, WheelEvent } from 'react';

import type { SelectedElementInfo, SessionResponse } from '@/lib/types';

import styles from './scraper-workbench.module.css';

const DEFAULT_URL = 'https://example.com';
const FALLBACK_VIEWPORT = { width: 1200, height: 800 };

export function ScraperWorkbench() {
	const [url, setUrl] = useState(DEFAULT_URL);
	const [sessionId, setSessionId] = useState<string | null>(null);
	const [viewport, setViewport] = useState(FALLBACK_VIEWPORT);
	const [screenshotTick, setScreenshotTick] = useState(0);
	const [selectedElement, setSelectedElement] = useState<SelectedElementInfo | null>(null);
	const [script, setScript] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [busyState, setBusyState] = useState<'idle' | 'starting' | 'selecting' | 'building' | 'stopping'>('idle');

	const imageRef = useRef<HTMLImageElement | null>(null);
	const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const lastMoveRef = useRef(0);

	useEffect(() => {
		return () => {
			if (pollRef.current) {
				clearInterval(pollRef.current);
			}
		};
	}, []);

	async function requestJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
		const response = await fetch(input, init);
		const json = (await response.json()) as T & { message?: string };

		if (!response.ok) {
			throw new Error(json.message || 'Request failed');
		}

		return json;
	}

	async function startSession() {
		setBusyState('starting');
		setError(null);
		setSelectedElement(null);
		setScript(null);

		try {
			const data = await requestJson<SessionResponse>('/api/session', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ url }),
			});

			setSessionId(data.sessionId);
			setViewport(data.viewport ?? FALLBACK_VIEWPORT);
			setScreenshotTick((value) => value + 1);

			if (pollRef.current) {
				clearInterval(pollRef.current);
			}

			pollRef.current = setInterval(() => {
				setScreenshotTick((value) => value + 1);
			}, 800);
		} catch (requestError) {
			setError(requestError instanceof Error ? requestError.message : 'Failed to create session');
		} finally {
			setBusyState('idle');
		}
	}

	async function stopSession() {
		if (!sessionId) {
			return;
		}

		setBusyState('stopping');

		try {
			await requestJson<{ ok: boolean }>('/api/stop', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ sessionId }),
			});
		} catch {
			// Ignore stop failures during cleanup.
		} finally {
			if (pollRef.current) {
				clearInterval(pollRef.current);
				pollRef.current = null;
			}

			setSessionId(null);
			setSelectedElement(null);
			setScript(null);
			setBusyState('idle');
		}
	}

	function getPageCoordinates(event: MouseEvent<HTMLImageElement>) {
		const image = imageRef.current;
		if (!image) {
			return null;
		}

		const rect = image.getBoundingClientRect();
		const relativeX = event.clientX - rect.left;
		const relativeY = event.clientY - rect.top;

		return {
			x: Math.round((relativeX / rect.width) * viewport.width),
			y: Math.round((relativeY / rect.height) * viewport.height),
		};
	}

	async function handleClick(event: MouseEvent<HTMLImageElement>) {
		if (!sessionId) {
			return;
		}

		const coordinates = getPageCoordinates(event);
		if (!coordinates) {
			return;
		}

		setBusyState('selecting');
		setError(null);

		try {
			const result = await requestJson<SelectedElementInfo>('/api/click', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					sessionId,
					x: coordinates.x,
					y: coordinates.y,
				}),
			});

			setSelectedElement(result);
			setScreenshotTick((value) => value + 1);
		} catch (requestError) {
			setError(requestError instanceof Error ? requestError.message : 'Selection failed');
		} finally {
			setBusyState('idle');
		}
	}

	async function handleMouseMove(event: MouseEvent<HTMLImageElement>) {
		if (!sessionId) {
			return;
		}

		const now = Date.now();
		if (now - lastMoveRef.current < 33) {
			return;
		}
		lastMoveRef.current = now;

		const coordinates = getPageCoordinates(event);
		if (!coordinates) {
			return;
		}

		void fetch('/api/mouse-move', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				sessionId,
				x: coordinates.x,
				y: coordinates.y,
			}),
		}).catch(() => undefined);
	}

	async function handleWheel(event: WheelEvent<HTMLImageElement>) {
		if (!sessionId) {
			return;
		}

		event.preventDefault();

		try {
			await requestJson<{ ok: boolean }>('/api/scroll', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					sessionId,
					deltaY: Math.round(event.deltaY),
				}),
			});

			setScreenshotTick((value) => value + 1);
		} catch (requestError) {
			setError(requestError instanceof Error ? requestError.message : 'Scroll failed');
		}
	}

	async function generateScript() {
		if (!sessionId || !selectedElement) {
			setError('Select an element before generating a scraper.');
			return;
		}

		setBusyState('building');
		setError(null);
		setScript(null);

		try {
			const result = await requestJson<{ script: string }>('/api/plan', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					url,
					clickedElement: selectedElement,
				}),
			});

			setScript(result.script);
		} catch (requestError) {
			setError(requestError instanceof Error ? requestError.message : 'Script generation failed');
		} finally {
			setBusyState('idle');
		}
	}

	function downloadScript() {
		if (!script) {
			return;
		}

		const blob = new Blob([script], { type: 'text/javascript' });
		const blobUrl = URL.createObjectURL(blob);
		const anchor = document.createElement('a');
		anchor.href = blobUrl;
		anchor.download = 'generated-scraper.js';
		document.body.appendChild(anchor);
		anchor.click();
		anchor.remove();
		URL.revokeObjectURL(blobUrl);
	}

	const screenshotUrl = sessionId ? `/api/screenshot?sessionId=${encodeURIComponent(sessionId)}&tick=${screenshotTick}` : null;

	return (
		<main className={styles.page}>
			<section className={styles.hero}>
				<div className={styles.heroCopy}>
					<p className={styles.eyebrow}>
						<a href="https://www.linkedin.com/in/danielprastha/">Daniel Prastha</a>
					</p>
					<h1>Visual web selector capture with direct Puppeteer script generation.</h1>
					<p className={styles.lead}>Start a remote browser session, point at the element you want, and let the backend turn that selection into an exportable scraping script.</p>
				</div>

				<div className={styles.heroMeta}>
					<div>
						<span className={styles.metaLabel}>Stack</span>
						<strong>Next.js App Router + TypeScript</strong>
					</div>
					<div>
						<span className={styles.metaLabel}>Backend</span>
						<strong>Puppeteer route handlers + direct selector-based generation</strong>
					</div>
				</div>
			</section>

			<section className={styles.toolbar}>
				<label className={styles.inputGroup}>
					<span>Target URL</span>
					<input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com" />
				</label>

				<div className={styles.toolbarActions}>
					<button className={styles.primaryButton} onClick={sessionId ? stopSession : startSession} disabled={busyState === 'starting' || busyState === 'stopping'}>
						{sessionId ? 'Stop Session' : 'Start Session'}
					</button>
					<button className={styles.secondaryButton} onClick={generateScript} disabled={!selectedElement || busyState === 'building'}>
						Generate Script
					</button>
					<button className={styles.secondaryButton} onClick={downloadScript} disabled={!script}>
						Download Script
					</button>
				</div>
			</section>

			<section className={styles.workspace}>
				<div className={styles.browserPanel}>
					<div className={styles.panelHeader}>
						<div>
							<h2>Remote Browser</h2>
							<p>Hover to preview, click to capture, scroll to navigate the page.</p>
						</div>
						<span className={styles.statusPill} data-state={busyState}>
							{sessionId ? `Session live • ${busyState}` : 'No active session'}
						</span>
					</div>

					<div className={styles.browserViewport}>
						{screenshotUrl ? (
							<img ref={imageRef} src={screenshotUrl} alt="Remote browser preview" className={styles.browserImage} onClick={handleClick} onMouseMove={handleMouseMove} onWheel={handleWheel} draggable={false} />
						) : (
							<div className={styles.emptyState}>Start a session to load the target site into the remote browser.</div>
						)}
					</div>
				</div>

				<div className={styles.sidePanel}>
					<PanelCard title="Selected Element" description="Captured selector metadata from the last click.">
						{error ? <p className={styles.errorMessage}>{error}</p> : null}
						<JsonBlock value={selectedElement} emptyLabel="No element selected yet." />
					</PanelCard>

					<PanelCard title="Generated Script" description="Deterministic Puppeteer output derived directly from the selected element.">
						{script ? <pre className={styles.codeBlock}>{script.slice(0, 4000)}</pre> : <p className={styles.emptyPanelText}>No script generated yet.</p>}
					</PanelCard>
				</div>
			</section>
		</main>
	);
}

function PanelCard({ title, description, children }: { title: string; description: string; children: ReactNode }) {
	return (
		<article className={styles.card}>
			<div className={styles.cardHeader}>
				<div>
					<h3>{title}</h3>
					<p>{description}</p>
				</div>
			</div>
			<div>{children}</div>
		</article>
	);
}

function JsonBlock({ value, emptyLabel }: { value: unknown; emptyLabel: string }) {
	if (!value) {
		return <p className={styles.emptyPanelText}>{emptyLabel}</p>;
	}

	return <pre className={styles.codeBlock}>{JSON.stringify(value, null, 2)}</pre>;
}
