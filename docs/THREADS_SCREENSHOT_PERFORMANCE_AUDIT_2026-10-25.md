# Threads: auditoría de capturas y plan de mejora — 2026-10-25

## Alcance y procedencia

**Fuente primaria del análisis visual:** ocho capturas de Threads Insights proporcionadas por la persona propietaria de la cuenta el 25/10/2026. Se transcribieron solo las cifras visibles, sin OCR, sin inferir IDs externos y sin almacenar las imágenes ni datos personales en este repositorio público. Los paneles se solapan; se descontaron las repeticiones identificables. Evidencia estructurada: `state/manual-breakouts.json` (`evidence_type=user_supplied_threads_insights_screenshots`).

**Fuente operativa independiente:** `jobs/results/*.json`. Estos archivos son autoritativos para el sistema automatizado únicamente cuando `result.provider_status="sent"`, `provider_post_id` está presente y hay un enlace externo cuando lo devuelve el proveedor. Capturas de publicaciones de hace cinco semanas no son necesariamente trabajos de este repositorio; no hacer coincidir una fila con un ID de Buffer por nombre parecido.

**Limitaciones fundamentales:** capturas muestran observaciones con edades de 12 horas a 5 semanas, algunas vistas están redondeadas (`8.1 K`, `1.1 K`), no hay denominadores de impresiones únicos, horarios ni desglose completo de distribución, ni cambios de seguidores. Es un corte transversal de **posts visibles**, no una muestra aleatoria de todos los publicados. Las cifras **no** prueban causalidad por imagen, categoría, horario, marca ni longitud. No importarlas como métricas del proveedor ni emplearlas para autoajustar límites.

## Hallazgos cuantitativos reproducibles

| Indicador | Valor visual observado | Lectura correcta |
|---|---:|---|
| Publicaciones distintas visibles | 52 | Muestra parcial, deduplicada entre capturas por renglón identificable |
| Mediana de vistas | 23,5 | Una publicación típica visible tiene alcance bajo |
| Publicaciones con menos de 40 vistas | 35/52 = 67,3 % | Mucha difusión marginal; no se resuelve por sí sola aumentando la cuota |
| Percentil 75 | 65,75 vistas | Media y mediana están distorsionadas por la cola larga |
| One UI 9 | 8.100 vistas (redondeadas), 18 me gusta, 0 respuestas | Señal de **distribución**, no de conversación/conversión |
| Alerta PHP | 1.100 vistas (redondeadas), 2 me gusta, 1 republicación, 3 compartidos, 0 respuestas | Señal de alcance y redistribución por utilidad práctica |
| Googlebook | 168 y 145 vistas en dos publicaciones visibles del **mismo tema** | Potencial reutilización de acontecimiento: evento ≠ variación de titular |
| CUDA/Rust | 164 vistas y 2 me gusta | Hipótesis de relevancia para desarrolladores |
| Claude Opus | 137 vistas, 0 reacciones visibles | El reconocimiento de marca no basta para generar interacción |
| NVIDIA RTX PRO | 111 vistas, 0 reacciones visibles | Métrica visual más nueva que el último snapshot de Buffer |
| Instagram Apple TV | 65 vistas a ~12 h | **No comparable** sin normalización por edad |

One UI representa aproximadamente **72,1 %** de la suma de las 52 observaciones visibles (11.233 vistas transcritas); el número no implica que las 52 publicaciones tengan la misma madurez. La distribución es extremadamente asimétrica, por lo que **no** usar promedio bruto como predictor ni ajustar frecuencia por ese único outlier. Las publicaciones de animales pertenecen a otra temática: no deben contaminar el ranking de noticias de tecnología ni inducir cambios en otros repositorios.

## Diagnóstico editorial

**1. Mayor prioridad provisional:** lanzamientos/despliegues de Android y software de gran base instalada, restricciones de compatibilidad, cambios en seguridad que exigen acción y novedades de grandes plataformas con utilidad concreta. Son *hipótesis*, no multiplicadores arbitrarios de `candidate_score`.

**2. Los detalles importan más que el “anunció”:** fecha concreta, versión afectada, elegibilidad por región/dispositivo, cambio verificable, consecuencias y qué debe hacer un lector. En ciberseguridad, identificar versiones y mitigación desde aviso oficial. En IA, acceso efectivo, limitaciones y precios con unidades; no amplificar benchmarks de fabricante como pruebas independientes.

**3. La repetición degrada la confianza:** Googlebook aparece dos veces con copy distinto. El nuevo `strategy.event_key` canónico permite deduplicar un acontecimiento aunque cambien idioma, gancho o imagen. Mantener también la revisión editorial de posibles duplicados antiguos sin `event_key`. No reintentar `FAILED`/`DELIVERY_PENDING` sin diagnóstico.

**4. Las tarjetas son útiles cuando transmiten información:** el aspecto idéntico de muchas tarjetas no garantiza alcance (también se observan 1–24 vistas con imagen). Priorizar legibilidad móvil, un titular concreto, una cifra/plazo validado y subtítulo complementario. El renderizador ahora ajusta el tamaño según longitud y rechaza frases que no caben, en lugar de recortarlas silenciosamente. El modo texto sigue disponible cuando sirve mejor al lector o no hay presupuesto multimedia verificado. No adjudicar victoria de imagen frente a texto sin una comparación madura y emparejada.

**5. Faltan conversaciones:** muchas publicaciones tienen 0 respuestas. Aprovechar comentarios humanos reales para responder de forma útil cuando el proveedor y el canal lo permitan, o marcarlos para atención manual. Un análisis de Buffer de ~128.000 posts de Threads encontró una asociación de +42 % en engagement cuando el autor responde, pero no prueba que responder lo cause y **no** autoriza respuestas automatizadas vacías: https://buffer.com/resources/threads-comments-engagement/

## Aplicación priorizada al agente (sin aumentar cuotas)

**P0 — integridad de aprendizaje.** `src/core/metrics-learning.ts` exige entrega `sent`, ID proveedor, observación posterior a 24 h y bandas de edad de observación; `adaptive-tuner.ts` requiere un grupo emparejado por idioma, tipo, visual y banda, con al menos 20 observaciones recientes **y** 20 de referencia. Sin esa muestra, solo hipótesis, no cambios automáticos globales. Las capturas nunca se mezclan con datos API. Este es un bloqueo deliberado frente a falso aprendizaje.

**P0 — deduplicación semántica por evento.** Nuevo campo opcional `strategy.event_key`, formato slug minúsculo ASCII (`samsung-one-ui-9-2026-10-10-rollout`), estable para un mismo acontecimiento y versión; a partir de ahora los trabajos nuevos deben definirlo en el controlador editorial. Runtime y `policy.ts` rechazan repetición dentro del historial de evaluación aunque texto o idioma sean distintos. Se ordena historial newest-first antes de aplicar `duplicate_lookback`. Requiere continuar cotejando *todos* los estados y pendientes; la clave no reemplaza la revisión.

**P1 — cobertura de noticias de utilidad real.** En la pasada horaria ya existente, analizar 3–4 categorías y verificar los dos mejores **eventos distintos**. Usar como criterios cualitativos utilidad para la audiencia real, número de personas afectadas si se conoce, diferencia práctica y datos verificables; no asignar automáticamente +puntos por marcas como Samsung o Google. Mantener pesos y umbrales de siete dimensiones.

**P1 — conversación y distribución separadas.** Registrar visualizaciones, interacción y compartidos por 1.000 vistas, respuestas por 1.000, conversiones solo si existen. Distinguir los canales de descubrimiento (Threads/Instagram/Facebook) si Insights lo expone; una visualización no implica lector único ni seguidor. Las respuestas humanas se revisan por su contenido, no solo se persiguen números.

**P2 — experimento emparejado.** Mantener el estudio de 28 días iniciado el 19/10. Cuando existan al menos 20 publicaciones comparables maduras por segmento, contrastar 24h y 72h para (a) beneficio concreto vs anuncio simple, (b) card informativa vs texto técnico, (c) ventanas de audiencia en zonas reales. Dos versiones del mismo evento están **prohibidas** como ensayo A/B por deduplicación; usar eventos distintos y comparables. Sin métricas segmentadas maduras, no afirmar ganadores.

## Referencias para hipótesis externas

- Meta, etiquetas nativas: https://about.fb.com/news/2025/03/new-threads-features-more-personalized-experience-you-control/ (la plataforma reportó más vistas en posts con tópico; no garantiza crecimiento particular).
- Buffer 2026, 2,5 millones de posts y horarios: https://buffer.com/resources/the-best-time-to-post-on-threads/ (prior externo, no norma causal).
- Buffer 2026, formatos en Threads: https://buffer.com/resources/state-of-social-media-engagement-2026/ (medianas: imagen ~4,55 %, texto ~2,79 %, vídeo ~5,55 %; relación observacional y formatos solapados; no implementar vídeo donde no existe).
- Buffer 2026, respuestas: https://buffer.com/resources/threads-comments-engagement/ (asociación observacional, no instrucción de generar engagement bait).

**Sin cambios a:** `config/policy.json`, presupuesto Buffer/Cloudinary, horarios de la automatización, `queue.yml`, `metrics.yml`, límite de 60 minutos o programación de tareas. No se envía ningún post por este análisis.

## Conciliación adicional con los resultados del repositorio (`main`, 2026-10-25)

La lectura individual de los 14 archivos existentes en `jobs/results` dio **13 entregas con `provider_status=sent` e ID de Buffer**, **un `FAILED`**, y ningún `DELIVERY_PENDING` abierto. Entre las 13 entregadas: 9 tarjetas y 4 solo texto; 9 publicaciones en español y 4 en inglés. Hay 12 con `result.metrics.views`: mediana **23** vistas (foto de métricas de distinta edad, NO comparación causal). Diez de estas tienen más de 36 h de observación; el registro de Kimi tenía una muestra tomada a 13 h y no es maduro, mientras Instagram Apple TV aún no mostraba métricas en el JSON. Para el corte de maduración `>=24 h` son **11** observaciones técnicamente elegibles; todavía muy pocas para cohortes 20+20 por idioma/formato/tipo/edad.

**Cruce significativo:** la alerta PHP de 23/10 tenía **1.100 vistas** en el JSON de Buffer, compatible con la cifra redondeada **1,1K** de la captura. NVIDIA aparece con ~110 vistas en Buffer y ~111 en captura: la pequeña diferencia puede explicarse por fecha de la instantánea. No sobrescribir el JSON con datos de captura ni sumar ambos como publicaciones distintas.

Conclusión operacional: las capturas amplían la historia disponible, pero el repositorio aún no tiene 40 ejemplos maduros del **mismo** segmento para autoajuste fiable. Registrar resultados de distribución por separado de interacción/seguidores y mantener la selección editorial por evidencia verificable.
