// The page around a fragment from app/ (index.html, 404.html), for the website (tools/bundle.mjs) and npm start
// (server.js). A fragment starts with its head part (title, meta tags, icon, fonts, styles) up to the first
// </style>; the rest is the page's body. The top/bottom safe areas (iPhone notch, home bar) are padded here on
// :root, once; the sides by the app's own gutters.
export function page(fragment) {
  const end = fragment.indexOf("</style>");
  const cut = end < 0 ? 0 : end + "</style>".length;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>
${fragment.slice(0, cut).trim()}
</head><body>
${fragment.slice(cut).trim()}
</body></html>`;
}
