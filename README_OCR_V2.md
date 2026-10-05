# CrediMóvil OCR Financiero V2

## Objetivo
Separar OCR, parser bancario, validación financiera y auditoría de IA.

Flujo objetivo:
Documento -> OCR estructurado -> parser del banco -> validación matemática -> resultado
                                         -> Gemini auditor cuando haya dudas

## Configuración opcional en Render

### Document AI
- GOOGLE_CLOUD_PROJECT
- GOOGLE_DOCUMENT_AI_LOCATION (por ejemplo: us)
- GOOGLE_DOCUMENT_AI_PROCESSOR_ID
- GOOGLE_DOCUMENT_AI_PROCESSOR_NAME (alternativa al par project/location/id)
- GOOGLE_DOCUMENT_AI_CREDENTIALS_JSON (JSON de la cuenta de servicio, si Render no usa Application Default Credentials)
- OCR_PROVIDER=auto | document-ai | gemini

'auto' utiliza Document AI cuando está configurado y cae a Gemini si no hay tabla utilizable o si Document AI falla.

Para estados bancarios se recomienda crear un processor de tipo Form Parser o Layout Parser en Google Cloud Document AI. Document AI puede extraer OCR y tablas; el parser de CrediMóvil usa la cabecera CARGOS/ABONOS para determinar el movimiento sin inferirlo desde la descripción.

## Siguiente etapa: cola para 20 usuarios
Ejecutar supabase/ocr_jobs.sql y crear en Supabase Queues una cola llamada credimovil-ocr.
Después se activará OCR_ASYNC=true y se agregará un worker separado para procesar la cola y actualizar ocr_jobs.

## Regla financiera
Si la validación de saldo no cuadra o un movimiento no proviene de columnas explícitas CARGOS/ABONOS, el expediente debe quedar en REVISAR.