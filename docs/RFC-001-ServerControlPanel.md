# RFC-001 — Panel de Control de Servidor Ubuntu
**Título:** Infraestructura unificada de gestión de proyectos desplegados  
**Autor:** Didac  
**Estado:** Borrador  
**Fecha:** Abril 2026  
**Revisión:** 1.0

---

## Tabla de Contenidos
1. [Resumen Ejecutivo](#1-resumen-ejecutivo)
2. [Motivación y Problema](#2-motivación-y-problema)
3. [Objetivos y No-Objetivos](#3-objetivos-y-no-objetivos)
4. [Solución Propuesta](#4-solución-propuesta)
5. [Alternativas Consideradas](#5-alternativas-consideradas)
6. [Impacto y Riesgos](#6-impacto-y-riesgos)
7. [Plan de Rollout](#7-plan-de-rollout)
8. [Preguntas Abiertas](#8-preguntas-abiertas)
9. [Referencias](#9-referencias)

---

## 1. Resumen Ejecutivo

Este RFC propone el diseño y construcción de **ServerCtrl** — un panel de control web self-hosted para un servidor Ubuntu que centraliza la gestión de múltiples proyectos desplegados bajo diferentes dominios y subdominios. El panel permitirá monitorizar el estado de servicios, gestionar la configuración del reverse proxy (Caddy o Nginx), escalar proyectos, y administrar servidores TCP, bases de datos y servidores de email desde una única interfaz.

---

## 2. Motivación y Problema

### 2.1 Contexto actual

El servidor actualmente aloja proyectos heterogéneos con stacks distintos:

| Proyecto | Dominio | Stack |
|---|---|---|
| Portfolio/Landing | `didtor.dev` | Astro (estático) |
| TortoiseGPS | `tortoisegps.didtor.dev` | React + Node.js + MongoDB + TCP servers |
| Proyecto futuro | `*.didtor.dev` | React + Node.js + MySQL |

Cada proyecto tiene sus propios requisitos de proceso, puertos, certificados TLS, reglas de proxy, y ciclo de vida de despliegue.

### 2.2 Problemas identificados

**Fragmentación operacional.** Hoy gestionar el servidor implica conectarse por SSH y ejecutar comandos manuales dispersos entre systemd, pm2, caddy/nginx config files, y CLIs de base de datos. No existe una vista consolidada del estado del sistema.

**Riesgo en cambios de configuración de proxy.** Añadir un nuevo subdominio o modificar reglas de Caddy/Nginx requiere editar ficheros de configuración a mano, con riesgo de romper proyectos existentes por error de sintaxis o conflicto de rutas.

**Ausencia de observabilidad unificada.** Los logs de cada proyecto viven en ubicaciones distintas. No hay un dashboard que muestre de forma agregada si un proceso está caído, si un servidor TCP tiene conexiones activas, o si el certificado TLS va a expirar.

**Escalado manual.** Aumentar workers de pm2 o ajustar recursos de un proyecto implica SSH + comandos, sin histórico ni rollback.

**Gestión de email dispersa.** La configuración de servidores de email (Postfix, DNS records SPF/DKIM) no está integrada con el resto de la gestión de dominios.

### 2.3 Oportunidad

Un panel centralizado elimina la fricción operacional, reduce el tiempo de reacción ante incidentes, y hace el servidor mantenible a largo plazo sin depender de memoria muscular de comandos SSH.

---

## 3. Objetivos y No-Objetivos

### 3.1 Objetivos (In Scope)

- **O1.** Vista unificada del estado de todos los proyectos y sus servicios asociados (web, API, TCP, DB).
- **O2.** Gestión visual de Caddy o Nginx: añadir/editar/eliminar virtual hosts, subdominios, reglas de proxy, certificados TLS.
- **O3.** Control de ciclo de vida de procesos (start/stop/restart/reload) mediante PM2 o systemd.
- **O4.** Escalado de workers PM2 desde la UI.
- **O5.** Visualización de logs en tiempo real por proyecto y por servicio.
- **O6.** Métricas básicas del servidor: CPU, RAM, disco, red por proceso.
- **O7.** Gestión de servidores TCP: estado de conexiones activas, restart, configuración de puertos.
- **O8.** Soporte para múltiples motores de base de datos: MongoDB y MySQL/MariaDB (estado, conexiones, backup básico).
- **O9.** Gestión de servidores de email: configuración de dominios, estado de Postfix/Mailcow, DNS records.
- **O10.** Autenticación segura con sesión de administrador única.
- **O11.** API REST interna que expone todas las operaciones para posible automatización futura.

### 3.2 No-Objetivos (Out of Scope v1)

- Panel multi-servidor (solo aplica al servidor donde está instalado).
- Gestión de clusters Kubernetes o Docker Swarm.
- CI/CD pipeline integrado (se contempla en v2).
- Marketplace de plantillas de proyectos.
- Facturación o gestión de clientes.

---

## 4. Solución Propuesta

### 4.1 Arquitectura General

```
┌─────────────────────────────────────────────────────────┐
│                     SERVIDOR UBUNTU                      │
│                                                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │           ServerCtrl Dashboard (Web UI)          │    │
│  │           React + Vite + TypeScript              │    │
│  │           Acceso: panel.didtor.dev               │    │
│  └────────────────────┬────────────────────────────┘    │
│                       │ WebSocket + REST API             │
│  ┌────────────────────▼────────────────────────────┐    │
│  │           ServerCtrl Backend (Node.js)           │    │
│  │           Express + Socket.io + TypeScript       │    │
│  │           Puerto: 4000 (interno)                 │    │
│  └─┬──────────────┬──────────────┬────────────────┘    │
│    │              │              │                        │
│  ┌─▼──┐   ┌──────▼──┐   ┌──────▼──────┐               │
│  │PM2/│   │ Caddy / │   │  TCP/DB/    │               │
│  │syst│   │  Nginx  │   │  Email Mgr  │               │
│  │emd │   │  Config │   │             │               │
│  └────┘   └─────────┘   └─────────────┘               │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │              PROYECTOS DESPLEGADOS                │   │
│  │  didtor.dev  │  tortoisegps.didtor.dev  │  ...    │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### 4.2 Stack Tecnológico Propuesto

**Backend (ServerCtrl Agent):**
- Runtime: Node.js 20 LTS + TypeScript
- Framework: Express.js
- Realtime: Socket.io (logs streaming, métricas en vivo)
- Process management: Interfaz con PM2 API / systemd via `node-systemd-journal`
- Proxy management: Lectura/escritura de Caddyfile o nginx.conf + reload via API/shell
- Auth: JWT con refresh tokens, almacenados en SQLite local
- DB interna: SQLite (configuración, historial de eventos)

**Frontend (ServerCtrl UI):**
- Framework: React 18 + TypeScript + Vite
- UI: Tailwind CSS + shadcn/ui
- Charts/Métricas: Recharts
- Log viewer: xterm.js (terminal en browser)
- Estado global: Zustand
- HTTP client: TanStack Query

**Infraestructura del propio panel:**
- Proceso: PM2 (el panel se gestiona a sí mismo)
- Proxy: Caddy o Nginx (el panel vive en `panel.didtor.dev`)
- TLS: automático via Caddy ACME o certbot

### 4.3 Módulos Funcionales

**Módulo 1 — Dashboard Overview**
Vista principal con estado en tiempo real de todos los proyectos. Tarjetas por proyecto mostrando: estado del proceso, uptime, uso de CPU/RAM, última actividad. Alertas visuales si algún servicio está caído.

**Módulo 2 — Proxy Manager**
Editor visual para Caddy o Nginx. Operaciones: crear virtual host, asignar dominio/subdominio, configurar upstream (puerto local del proyecto), activar HTTPS automático, gestionar redirects y headers. Preview del bloque de configuración generado antes de aplicar. Historial de cambios con rollback.

**Módulo 3 — Process Manager**
Interfaz sobre PM2. Lista de procesos con estado, PID, uso de recursos. Acciones: start/stop/restart/reload, cambiar número de workers (cluster mode), ver ecosystem.config.js, ejecutar deploy hooks. También control de servicios systemd no gestionados por PM2.

**Módulo 4 — Log Viewer**
Streaming de logs en tiempo real via WebSocket. Filtros por proyecto, nivel (info/warn/error), fecha. Descarga de logs. Integración con journald para servicios systemd.

**Módulo 5 — TCP Server Manager**
Estado de servidores TCP activos: puerto, conexiones activas, bytes transferidos. Acciones de restart. Configuración de puertos en firewall (UFW) desde la UI.

**Módulo 6 — Database Manager**
Para MongoDB: estado del servicio, bases de datos activas, tamaño, conexiones. Para MySQL/MariaDB: estado, schemas, conexiones activas. Backup manual (dump a `/backups/`). Sin query editor en v1 (fuera de scope).

**Módulo 7 — Domain & DNS Manager**
Lista de dominios y subdominios registrados en el proxy. Estado de certificados TLS (expiración, renovación). Integración con DNS records (solo lectura en v1, escritura si se usa Cloudflare API en v2).

**Módulo 8 — Email Server Manager**
Estado de Postfix o Mailcow. Configuración de dominios de email. Vista de DNS records necesarios (SPF, DKIM, DMARC). Cola de emails pendientes.

**Módulo 9 — System Metrics**
Métricas del servidor: CPU, RAM, swap, disco por partición, tráfico de red. Histórico de 24h. Alertas configurables (umbral de CPU/RAM).

### 4.4 Seguridad

- El panel estará protegido por autenticación básica con JWT.
- Solo accesible desde `panel.didtor.dev` con TLS.
- Las operaciones destructivas (delete, rollback) requerirán confirmación explícita.
- El backend nunca expondrá credenciales de bases de datos en las respuestas de API.
- Rate limiting en endpoints de login.
- Todas las acciones quedarán registradas en un log de auditoría interno.

---

## 5. Alternativas Consideradas

### 5.1 Usar una solución existente (Portainer, Webmin, Cockpit)

**Portainer** está orientado a Docker/Kubernetes. No aplica bien a proyectos Node.js nativos gestionados por PM2.

**Webmin** es una solución generalista y antigua, con UX pobre y una superficie de ataque grande al ser tan amplio.

**Cockpit** (Red Hat) ofrece buen monitoreo del sistema pero no tiene gestión de proyectos web, proxy ni dominios.

**Decisión:** Ninguna cubre el caso de uso específico de gestionar proyectos Node/Astro/React con PM2 + Caddy/Nginx de forma integrada y con la UX deseada.

### 5.2 Scripts de shell + cron + Telegram bot

Una solución ligera con scripts bash para tareas comunes y alertas via Telegram.

**Pros:** Muy simple, sin dependencias adicionales.  
**Contras:** No hay UI centralizada, requiere conocimiento de los scripts, difícil de mantener al crecer el número de proyectos, no resuelve el problema de observabilidad ni la gestión del proxy.

**Decisión:** Válido como complemento pero no como solución principal.

### 5.3 Solución SaaS (Render, Railway, Coolify Cloud)

**Coolify** es la más cercana al caso de uso y es open source con opción self-hosted.

**Pros:** Ya construido, activamente mantenido, soporta múltiples stacks.  
**Contras:** Introduce Docker como dependencia obligatoria (todos los proyectos deben containerizarse), tiene opiniones fuertes sobre el modelo de despliegue, y añade una capa de complejidad cuando los proyectos actuales corren nativamente en el servidor.

**Decisión:** Coolify es la alternativa más seria. Si la implementación custom resulta demasiado costosa en tiempo, Coolify self-hosted sería el fallback. Se documentará en la sección de riesgos.

---

## 6. Impacto y Riesgos

### 6.1 Riesgos Técnicos

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| El panel escribe una config de Nginx/Caddy incorrecta y rompe todos los proyectos | Media | Alto | Validar config antes de aplicar, backup automático antes de cada cambio, rollback con un click |
| El proceso del panel se cae y no hay forma de recuperarlo | Baja | Alto | PM2 watch, health endpoint externo (UptimeRobot), acceso SSH siempre disponible como fallback |
| Vulnerabilidad de seguridad en el panel da acceso al servidor | Baja | Crítico | Autenticación robusta, no exponer en internet sin TLS, considerar IP allowlist |
| Complejidad de implementar control de PM2 programáticamente | Media | Medio | PM2 tiene una API de módulo documentada; alternativa: invocar CLI via child_process |

### 6.2 Riesgos de Proyecto

- Scope creep: el panel puede crecer indefinidamente en features. Mantener v1 acotada a lo definido en O1-O11.
- Tiempo de implementación subestimado para módulos de proxy y email.

---

## 7. Plan de Rollout

### Fase 1 — MVP (4-6 semanas)
- Setup del proyecto (monorepo, build pipeline, dev environment)
- Backend: Auth, API base, integración PM2, lectura de métricas del sistema
- Frontend: Layout, Dashboard overview, Process Manager
- Despliegue del panel en `panel.didtor.dev`

### Fase 2 — Proxy & Domains (3-4 semanas)
- Proxy Manager (Caddy primero, Nginx como opción)
- Domain & DNS Manager (lectura)
- Log Viewer con streaming

### Fase 3 — Servicios Avanzados (3-4 semanas)
- TCP Server Manager
- Database Manager (MongoDB + MySQL)
- System Metrics con histórico

### Fase 4 — Email & Pulido (2-3 semanas)
- Email Server Manager
- Alertas configurables
- UI polish, documentación interna

---

## 8. Preguntas Abiertas

1. **¿Caddy o Nginx como proxy principal?** Caddy tiene gestión automática de TLS y un Caddyfile más legible, lo que facilita la implementación del Proxy Manager. Nginx es más conocido y tiene más documentación de casos edge. **Recomendación tentativa: Caddy.**

2. **¿Monorepo o repos separados?** Para un proyecto de esta escala (un solo desarrollador, frontend + backend íntimamente relacionados), un monorepo con turborepo o pnpm workspaces es preferible.

3. **¿Autenticación multi-usuario o single admin?** En v1, un único usuario administrador es suficiente y más simple de implementar con seguridad. Multi-usuario queda para v2.

4. **¿Soporte para Docker?** Algunos proyectos futuros podrían usar Docker. La arquitectura del panel debería ser agnóstica y contemplar añadir un módulo Docker en v2 sin reescrituras.

5. **¿Dónde almacenar los backups de bases de datos?** Localmente en `/backups/` con rotación automática es suficiente para v1. Integración con S3/B2 en v2.

---

## 9. Referencias

- [PM2 Programmatic API](https://pm2.keymetrics.io/docs/usage/pm2-api/)
- [Caddy JSON API](https://caddyserver.com/docs/api)
- [Nginx HTTP API](https://nginx.org/en/docs/http/ngx_http_api_module.html)
- [node-os-utils](https://github.com/nicedoc/node-os-utils) — métricas del sistema desde Node.js
- [xterm.js](https://xtermjs.org/) — terminal en browser para log viewer
- [Coolify](https://coolify.io/) — alternativa open source de referencia

---

*RFC-001 v1.0 — Sujeto a revisión tras feedback*
