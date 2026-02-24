/**
 * ESM wrapper — webtorrent/dist/webtorrent.min.js uses ES module syntax
 * (export{…}), so it can't be loaded as a classic <script>.
 * This file is loaded as <script type="module"> at runtime; the browser
 * handles the ESM import chain natively without any Vite involvement.
 */
import WebTorrent from '/webtorrent.min.js';
window.WebTorrent = WebTorrent;
