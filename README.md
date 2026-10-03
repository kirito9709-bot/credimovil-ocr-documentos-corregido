<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/f942f9ba-9f43-4b7d-b07c-29f11668c135

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Preview / ejecución

Esta aplicación necesita el servidor Express porque el OCR de Gemini y la persistencia de documentos pasan por `/api/*`. Por eso **no debes usar `vite preview` directamente** para probar el flujo completo.

1. Instala dependencias: `npm install`
2. Crea `.env.local` a partir de `.env.example` y coloca `GEMINI_API_KEY=...`
3. Ejecuta: `npm run dev`
4. Abre el preview que indique la terminal (normalmente `http://localhost:3000`).

También se dejó `npm run preview` apuntando al mismo servidor Express para que el preview completo funcione con OCR y documentos.

## Persistencia de documentos

Los archivos subidos ya no se guardan como base64 dentro de `data/expedientes.json`. El servidor los almacena en `data/uploads/<id-del-expediente>/` y el expediente conserva únicamente una URL `/api/expedientes/.../documentos/...`. Los expedientes antiguos con base64 se migran automáticamente cuando se consultan.
